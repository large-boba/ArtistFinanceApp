// The pretend-entries store logic for Stage 1 (T1.5, T1.10, T1.10b, T1.10c): expenses
// and income kept in memory only, lost on refresh on purpose. The app tracks
// money after the fact (owner, 2026-10-25), so an income entry is "money that
// came in on this date, from this income stream", not a live sale. T1.10b adds
// a day's event takings (saved as a cash row and a card row), an optional
// income-stream tag on costs, and one "Other costs" figure per event. T1.10c
// adds the exact whole-cent adding helpers that src/lib/summaries.ts shares.
//
// Everything in this file is "pure": no clock, no random ids, no saving or
// loading. Given the same inputs it always gives the same answer and never
// changes what it was given. The React provider (a separate file) wraps it as
//   useReducer(entriesReducer, pretendEvents(todayOnDevice()).map((e) => e.id), createEntriesState)
// and makes the ids (e.g. crypto.randomUUID()) before dispatching an action.
//
// Rules: dates are "YYYY-MM-DD" strings (guide §6); money is whole cents
// (guide §7), never a decimal number; every category belongs to exactly one
// group, and only event & venue costs may point at an event (guide §7);
// every income belongs to one of the seven income streams, always says how it
// was paid (there is no default), and only "Sales at events" and "Vendor shelf
// rental" income may point at an event (guide §10); production costs never
// carry an event or a stream tag (guide §7, DECISIONS.md "Linking costs to
// events and streams"). The detailed decisions are written at the top of
// src/lib/entries.test.ts.

import { isIsoDate } from "@/lib/dates";
import { MAX_AMOUNT_CENTS } from "@/lib/money";
import { DRAFT_CATEGORIES, INCOME_STREAMS } from "@/lib/pretend-data";

export const EXPENSE_GROUPS = ["production", "event_venue", "operating"] as const;
export type ExpenseGroup = (typeof EXPENSE_GROUPS)[number];

export const PAYMENT_METHODS = ["cash", "card", "online", "bank_transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type ExpenseEntry = {
  kind: "expense";
  id: string;
  date: string; // YYYY-MM-DD
  supplier: string; // trimmed, may be ""
  amountCents: number; // whole cents, 0 or more
  categoryId: string;
  group: ExpenseGroup; // always looked up from the category
  eventId: string | null;
  streamId: string | null; // an INCOME_STREAMS id the cost counts toward, or null (never for production)
  notes: string; // trimmed, may be ""
};

export type IncomeEntry = {
  kind: "income";
  id: string;
  date: string; // YYYY-MM-DD, the day the money came in (cash basis, guide §10)
  streamId: string; // an INCOME_STREAMS id (pretend-data.ts)
  amountCents: number; // whole cents, 0 or more
  paymentMethod: PaymentMethod;
  eventId: string | null;
  notes: string; // trimmed, may be ""
};

export type Entry = ExpenseEntry | IncomeEntry;

/**
 * An event's "Other costs" figure (DECISIONS.md "Event 'Other costs'"), e.g.
 * what the stock sold there cost. It is shown only in that event's result and
 * is never an entry: the stock was already counted once as a production cost.
 */
export type OtherCosts = {
  amountCents: number; // whole cents, 0 or more
  notes: string; // trimmed, may be "" ("notes", plural, like every other input)
};

export type EntriesState = {
  entries: readonly Entry[]; // in the order they were added
  eventIds: readonly string[]; // the events entries may point at
  // event id → that event's "Other costs" figure. A plain object (not a Map),
  // so it compares and copies like the rest of the state. Most events have none.
  otherCosts: Readonly<Record<string, OtherCosts>>;
};

export type ExpenseInput = {
  date: string;
  supplier?: string;
  amountCents: number;
  categoryId: string;
  eventId?: string | null;
  streamId?: string | null; // only for event & venue and operating costs
  notes?: string;
};

export type IncomeInput = {
  date: string;
  streamId: string; // required: no default stream
  amountCents: number;
  paymentMethod: PaymentMethod; // required: no default payment method
  eventId?: string | null;
  notes?: string;
};

/**
 * One day's takings at an event, as the artist counts them at the end of the
 * day: the cash and the card amounts (DECISIONS.md "Event takings"). Saved as
 * two income rows that share the date, stream, event and notes.
 */
export type EventTakingsInput = {
  date: string;
  streamId: string; // required: "sales-at-events" or "vendor-shelf-rental"
  eventId?: string | null; // missing or null means "not assigned yet"
  cashCents: number; // 0 allowed
  cardCents: number; // 0 allowed
  notes?: string;
};

export type EntriesAction =
  | { type: "add-expense"; id: string; expense: ExpenseInput }
  | { type: "add-income"; id: string; income: IncomeInput }
  | { type: "add-event-takings"; cashId: string; cardId: string; takings: EventTakingsInput }
  | { type: "edit"; id: string; changes: Partial<ExpenseInput> | Partial<IncomeInput> }
  | { type: "delete"; id: string }
  | { type: "set-event-other-costs"; eventId: string; amountCents: number; notes?: string }
  | { type: "clear-event-other-costs"; eventId: string };

// The only fields each kind of entry may be given or changed. Anything else
// (`group`, `id`, `kind`, or a field from the other kind) is refused.
const EXPENSE_FIELDS: ReadonlySet<string> = new Set([
  "date",
  "supplier",
  "amountCents",
  "categoryId",
  "eventId",
  "streamId",
  "notes",
]);
const INCOME_FIELDS: ReadonlySet<string> = new Set([
  "date",
  "streamId",
  "amountCents",
  "paymentMethod",
  "eventId",
  "notes",
]);
// Event takings: no paymentMethod or amountCents, because the action itself
// makes one "cash" row from cashCents and one "card" row from cardCents.
const TAKINGS_FIELDS: ReadonlySet<string> = new Set([
  "date",
  "streamId",
  "eventId",
  "cashCents",
  "cardCents",
  "notes",
]);
// The "set-event-other-costs" action itself: the figure's fields sit directly
// on the action, so the action is checked like an input. A misspelt field
// (such as the old name "note") is refused rather than quietly ignored.
const OTHER_COSTS_ACTION_FIELDS: ReadonlySet<string> = new Set(["type", "eventId", "amountCents", "notes"]);

/**
 * The only income streams whose income may be linked to an event (guide §10:
 * takings at a market or convention, and money from a vendor shelf). Income
 * from the other five streams (online sales, wholesale, ...) has no event.
 * Forms can use this to decide whether to offer an Event field.
 */
export const STREAMS_WITH_EVENTS: readonly string[] = Object.freeze(["sales-at-events", "vendor-shelf-rental"]);

/**
 * The starting state: no entries, and the events entries may point at.
 * Throws RangeError for an empty or repeated event id.
 */
export function createEntriesState(eventIds: readonly string[]): EntriesState {
  const seen = new Set<string>();
  for (const id of eventIds) {
    if (typeof id !== "string" || id === "") throw new RangeError("event ids must be non-empty strings");
    if (seen.has(id)) throw new RangeError("event ids must be unique");
    seen.add(id);
  }
  return { entries: [], eventIds: [...eventIds], otherCosts: {} };
}

// ─── Checks shared by adding and editing ─────────────────────────────────────

/**
 * Whole cents from 0 up to the largest number JavaScript holds exactly.
 * -0 is refused too: `-0 < 0` is false, so it needs its own check
 * (Object.is tells -0 and 0 apart).
 */
function checkWholeNonNegativeCents(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new RangeError(`${field} must be a whole number of cents, 0 or more`);
  }
  return value;
}

/**
 * An amount the artist is SAVING (T1.16b): whole cents from 0 up to the
 * owner's cap, $9,999,999.99 = 999,999,999 cents (MAX_AMOUNT_CENTS, owner
 * decision 2026-10-26). Every action that takes an amount uses this: expense
 * and income amounts (adding and editing), event takings cash and card, and
 * an event's "Other costs". The forms already refuse bigger amounts; the store
 * refuses them too, so no other route can slip one in. Keeping every entry
 * this small also keeps totals far below JavaScript's exact-number limit.
 */
function checkAmountCents(value: unknown, field = "amountCents"): number {
  const cents = checkWholeNonNegativeCents(value, field);
  if (cents > MAX_AMOUNT_CENTS) {
    throw new RangeError(`${field} must be at most ${MAX_AMOUNT_CENTS} cents ($9,999,999.99)`);
  }
  return cents;
}

function checkDate(value: unknown): string {
  if (!isIsoDate(value)) throw new RangeError("date must be a real YYYY-MM-DD date");
  return value;
}

/** Supplier and notes: optional text, stored with spaces trimmed off the ends. */
function checkText(value: unknown, field: string): string {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new RangeError(`${field} must be text`);
  return value.trim();
}

function groupOf(categoryId: unknown): ExpenseGroup {
  const category = DRAFT_CATEGORIES.find((c) => c.id === categoryId);
  if (category === undefined) throw new RangeError("unknown expense category");
  return category.group;
}

/** Required: there is no default payment method, so a missing one is refused too. */
function checkPaymentMethod(value: unknown): PaymentMethod {
  const found = PAYMENT_METHODS.find((m) => m === value);
  if (found === undefined) throw new RangeError("unknown payment method");
  return found;
}

/** Required: must be exactly one of the INCOME_STREAMS ids (not a name such as "Online sales"). */
function checkStreamId(value: unknown): string {
  const found = INCOME_STREAMS.find((s) => s.id === value);
  if (found === undefined) throw new RangeError("unknown income stream");
  return found.id;
}

/** Optional stream tag on a cost: missing or null means "no stream"; anything else must be a known stream id. */
function checkStreamTag(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return checkStreamId(value);
}

/** Required: must be one of the state's events (null and "" are refused). */
function checkKnownEventId(value: unknown, eventIds: readonly string[]): string {
  if (typeof value !== "string" || !eventIds.includes(value)) {
    throw new RangeError("unknown event");
  }
  return value;
}

/** null means "no event"; anything else must be one of the state's events. */
function checkEventId(value: unknown, eventIds: readonly string[]): string | null {
  if (value === undefined || value === null) return null;
  return checkKnownEventId(value, eventIds);
}

/**
 * The input must be a plain object holding only the allowed fields.
 *
 * "Plain" means made with `{ ... }` (its prototype is Object.prototype) or
 * with Object.create(null) (no prototype at all). Anything else is refused:
 * an array, a class instance, or Object.create({ amountCents: 1 }). The last
 * one matters most: its fields are inherited, not its own, so the "only these
 * fields" loop below (which looks at own fields) would never see them, yet
 * the builders would still read them.
 */
function checkFields(input: unknown, allowed: ReadonlySet<string>): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw new RangeError("expected an object of entry fields");
  }
  const prototype: unknown = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RangeError("expected a plain object");
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new RangeError(`the field ${key} isn't allowed here`);
  }
  return input as Record<string, unknown>;
}

/** Builds a complete, checked expense entry. Used for adding and for editing. */
function buildExpense(id: string, input: Record<string, unknown>, eventIds: readonly string[]): ExpenseEntry {
  const group = groupOf(input.categoryId);
  const eventId = checkEventId(input.eventId, eventIds);
  // Guide §7: production and operating costs are never linked to an event.
  if (group !== "event_venue" && eventId !== null) {
    throw new RangeError("only event & venue expenses can be linked to an event");
  }
  const streamId = checkStreamTag(input.streamId);
  // DECISIONS.md "Linking costs to events and streams": production costs stay
  // unlinked from streams too. Any stream may tag the other two groups; it
  // doesn't have to be the linked event's usual stream.
  if (group === "production" && streamId !== null) {
    throw new RangeError("production expenses can't be tagged with an income stream");
  }
  return {
    kind: "expense",
    id,
    date: checkDate(input.date),
    supplier: checkText(input.supplier, "supplier"),
    amountCents: checkAmountCents(input.amountCents),
    categoryId: input.categoryId as string, // groupOf found it, so it's a known id
    group,
    eventId,
    streamId,
    notes: checkText(input.notes, "notes"),
  };
}

/** Builds a complete, checked income entry. Used for adding and for editing. */
function buildIncome(id: string, input: Record<string, unknown>, eventIds: readonly string[]): IncomeEntry {
  const streamId = checkStreamId(input.streamId);
  const eventId = checkEventId(input.eventId, eventIds);
  // Guide §10: only event takings and shelf income belong to an event.
  // (Whether the event's usual stream matches isn't checked: the usual stream
  // is a smart default for forms, not a rule.)
  if (!STREAMS_WITH_EVENTS.includes(streamId) && eventId !== null) {
    throw new RangeError("only Sales at events and Vendor shelf rental income can be linked to an event");
  }
  return {
    kind: "income",
    id,
    date: checkDate(input.date),
    streamId,
    amountCents: checkAmountCents(input.amountCents),
    paymentMethod: checkPaymentMethod(input.paymentMethod),
    eventId,
    notes: checkText(input.notes, "notes"),
  };
}

/**
 * Builds the two income rows for one day of event takings: cash first, then
 * card. Both are always built, even for $0, so "no cash today" is recorded
 * rather than looking like "forgot to enter the cash".
 */
function buildTakings(
  cashId: string,
  cardId: string,
  takings: Record<string, unknown>,
  eventIds: readonly string[],
): [IncomeEntry, IncomeEntry] {
  // Takings only make sense for the two streams that have events. The store
  // doesn't look up the event's usual stream: the form pre-fills it.
  const streamId = checkStreamId(takings.streamId);
  if (!STREAMS_WITH_EVENTS.includes(streamId)) {
    throw new RangeError("event takings must be Sales at events or Vendor shelf rental income");
  }
  // Check the two amounts here so a bad one names its own field.
  const cashCents = checkAmountCents(takings.cashCents, "cashCents");
  const cardCents = checkAmountCents(takings.cardCents, "cardCents");

  // What the two rows share. buildIncome checks the date, event and notes.
  const shared = { date: takings.date, streamId, eventId: takings.eventId, notes: takings.notes };
  return [
    buildIncome(cashId, { ...shared, amountCents: cashCents, paymentMethod: "cash" }, eventIds),
    buildIncome(cardId, { ...shared, amountCents: cardCents, paymentMethod: "card" }, eventIds),
  ];
}

function checkNewId(state: EntriesState, id: unknown): string {
  if (typeof id !== "string" || id === "") throw new RangeError("an entry needs a non-empty id");
  if (state.entries.some((e) => e.id === id)) throw new RangeError("an entry with this id already exists");
  return id;
}

// ─── The reducer ─────────────────────────────────────────────────────────────

/**
 * Works out the next state from the current state and one action (add, edit,
 * delete, or set/clear an event's "Other costs"). Never changes `state`;
 * always returns a new object, except a delete of an id that isn't there or a
 * clear of a figure that isn't there, which return `state` itself.
 * Throws RangeError for anything invalid, leaving the state as it was.
 * Every action keeps the parts of the state it isn't about (`...state`).
 */
export function entriesReducer(state: EntriesState, action: EntriesAction): EntriesState {
  switch (action.type) {
    case "add-expense": {
      const id = checkNewId(state, action.id);
      const input = checkFields(action.expense, EXPENSE_FIELDS);
      const entry = buildExpense(id, input, state.eventIds);
      return { ...state, entries: [...state.entries, entry] };
    }

    case "add-income": {
      const id = checkNewId(state, action.id);
      const input = checkFields(action.income, INCOME_FIELDS);
      const entry = buildIncome(id, input, state.eventIds);
      return { ...state, entries: [...state.entries, entry] };
    }

    case "add-event-takings": {
      // All or nothing: every check runs before anything is added, and the
      // new state is only made once both rows are built. If anything throws,
      // neither row is added.
      const cashId = checkNewId(state, action.cashId);
      const cardId = checkNewId(state, action.cardId);
      if (cashId === cardId) throw new RangeError("the cash and card rows need different ids");
      const takings = checkFields(action.takings, TAKINGS_FIELDS);
      const [cash, card] = buildTakings(cashId, cardId, takings, state.eventIds);
      return { ...state, entries: [...state.entries, cash, card] };
    }

    case "edit": {
      const index = state.entries.findIndex((e) => e.id === action.id);
      if (index === -1) throw new RangeError("there is no entry with this id to edit");
      const current = state.entries[index];

      const changes = checkFields(action.changes, current.kind === "expense" ? EXPENSE_FIELDS : INCOME_FIELDS);
      // To leave a field as it is, leave it out. An explicit undefined is
      // refused (use null for "no event").
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) throw new RangeError(`${key} can't be changed to undefined`);
      }

      // Rebuild the whole entry as it would be after the change, so every rule
      // (including the group, stream and event rules) is checked on the end
      // result. So moving an income with an event to a stream without events
      // is refused, unless the same edit also sets eventId: null. Likewise a
      // cost with a stream tag can only move to a production category if the
      // same edit also sets streamId: null.
      // The builders read only the editable fields, so the kind and id stay
      // as they were and the group is looked up again from the category.
      const merged: Record<string, unknown> = { ...current, ...changes };
      const updated =
        current.kind === "expense"
          ? buildExpense(current.id, merged, state.eventIds)
          : buildIncome(current.id, merged, state.eventIds);

      const entries = state.entries.map((e, i) => (i === index ? updated : e));
      return { ...state, entries };
    }

    case "delete": {
      if (!state.entries.some((e) => e.id === action.id)) return state;
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };
    }

    case "set-event-other-costs": {
      // Sets or replaces the whole figure: missing notes mean "", not "keep
      // the old notes". This is a figure on the event, never an entry.
      // The action may hold only type, eventId, amountCents and notes.
      checkFields(action, OTHER_COSTS_ACTION_FIELDS);
      const eventId = checkKnownEventId(action.eventId, state.eventIds);
      const figure: OtherCosts = {
        amountCents: checkAmountCents(action.amountCents),
        notes: checkText(action.notes, "notes"),
      };
      return { ...state, otherCosts: { ...state.otherCosts, [eventId]: figure } };
    }

    case "clear-event-other-costs": {
      const eventId = checkKnownEventId(action.eventId, state.eventIds);
      // Nothing to clear: hand back the same state, like deleting a missing id.
      if (!Object.hasOwn(state.otherCosts, eventId)) return state;
      // A new object without that one event (the old one isn't touched).
      const otherCosts = Object.fromEntries(Object.entries(state.otherCosts).filter(([id]) => id !== eventId));
      return { ...state, otherCosts };
    }

    default: {
      // TypeScript knows this can't happen; at run time it is a bug, so be loud.
      const unknown: never = action;
      throw new RangeError(`unknown action type: ${String((unknown as { type?: unknown }).type)}`);
    }
  }
}

// ─── Exact whole-cent sums ───────────────────────────────────────────────────
//
// JavaScript numbers hold whole numbers exactly only up to
// Number.MAX_SAFE_INTEGER (9,007,199,254,740,991) either way. Past that, adding
// 1 can quietly give the same number back. So every money total goes through
// these two helpers, which refuse (RangeError) instead of giving a wrong
// answer. They take signed numbers because a result can be a loss (negative).
//
// The overflow test is done BEFORE adding, and only with numbers that are
// themselves exact (e.g. "is a > MAX - b?"), so it can't be fooled by rounding
// the way checking "a + b" afterwards could.

const MAX_CENTS = Number.MAX_SAFE_INTEGER;

function checkWholeCents(value: number): void {
  if (!Number.isSafeInteger(value)) throw new RangeError("amounts must be whole numbers of cents");
}

/** a + b in whole cents. Throws RangeError if the answer would pass ±MAX_SAFE_INTEGER. */
export function addCents(a: number, b: number): number {
  checkWholeCents(a);
  checkWholeCents(b);
  if (b > 0 ? a > MAX_CENTS - b : a < -MAX_CENTS - b) {
    throw new RangeError("the total is too large to add up exactly");
  }
  return a + b;
}

/** a − b in whole cents. Throws RangeError if the answer would pass ±MAX_SAFE_INTEGER. */
export function subtractCents(a: number, b: number): number {
  checkWholeCents(a);
  checkWholeCents(b);
  if (b > 0 ? a < -MAX_CENTS + b : a > MAX_CENTS + b) {
    throw new RangeError("the result is too large to work out exactly");
  }
  return a - b;
}

// ─── Reading the entries ─────────────────────────────────────────────────────

/**
 * Totals for one calendar day: the income in cents (every stream), how many
 * income rows (zero-amount ones count), and the expenses in cents. The names
 * salesCents and salesCount stay until T1.18 replaces Home's "today" wording.
 * Exact whole-cent sums. Throws RangeError for a bad date, or if a total would
 * go past Number.MAX_SAFE_INTEGER cents (beyond that it could no longer be
 * exact). Negative amounts are rejected for now; refunds arrive in Stage 4 as
 * linked negative income rows, and real totals move to SQL (§12).
 * Not limited by the owner's $9,999,999.99 cap (T1.16b): that rule is for
 * saving entries, and a reader adds up whatever it's given.
 */
export function totalsForDate(
  entries: readonly Entry[],
  date: string,
): { salesCents: number; salesCount: number; expensesCents: number } {
  checkDate(date);
  let salesCents = 0;
  let salesCount = 0;
  let expensesCents = 0;

  // Adds one entry's amount (refusing a negative one for now) to a total.
  // On purpose this does NOT use the owner's cap (checkAmountCents): the cap
  // is a rule for what may be SAVED. This function only READS entries, so it
  // must add up exactly whatever it's given, refusing only what it can't add
  // exactly (fractions of a cent, or totals past Number.MAX_SAFE_INTEGER).
  const add = (total: number, amount: number): number =>
    addCents(total, checkWholeNonNegativeCents(amount, "amountCents"));

  for (const entry of entries) {
    if (entry.date !== date) continue;
    if (entry.kind === "income") {
      salesCents = add(salesCents, entry.amountCents);
      salesCount += 1;
    } else {
      expensesCents = add(expensesCents, entry.amountCents);
    }
  }
  return { salesCents, salesCount, expensesCents };
}

/**
 * The entries newest first: a later date comes first, and on the same date the
 * entry added later comes first (an edit doesn't count as adding). Returns a
 * new list holding the same entry objects; the given list isn't reordered.
 */
export function entriesNewestFirst(entries: readonly Entry[]): Entry[] {
  // "YYYY-MM-DD" strings sort correctly as plain text, so no Date is needed.
  return entries
    .map((entry, addedAt) => ({ entry, addedAt }))
    .sort((a, b) => {
      if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? 1 : -1;
      return b.addedAt - a.addedAt;
    })
    .map(({ entry }) => entry);
}
