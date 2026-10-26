// The pretend-entries store logic for Stage 1 (T1.5, T1.10): expenses and
// income kept in memory only, lost on refresh on purpose. The app tracks
// money after the fact (owner, 2026-10-25), so an income entry is "money that
// came in on this date, from this income stream", not a live sale.
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
// rental" income may point at an event (guide §10). The detailed decisions are
// written at the top of src/lib/entries.test.ts.

import { isIsoDate } from "@/lib/dates";
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

export type EntriesState = {
  entries: readonly Entry[]; // in the order they were added
  eventIds: readonly string[]; // the events entries may point at
};

export type ExpenseInput = {
  date: string;
  supplier?: string;
  amountCents: number;
  categoryId: string;
  eventId?: string | null;
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

export type EntriesAction =
  | { type: "add-expense"; id: string; expense: ExpenseInput }
  | { type: "add-income"; id: string; income: IncomeInput }
  | { type: "edit"; id: string; changes: Partial<ExpenseInput> | Partial<IncomeInput> }
  | { type: "delete"; id: string };

// The only fields each kind of entry may be given or changed. Anything else
// (`group`, `id`, `kind`, or a field from the other kind) is refused.
const EXPENSE_FIELDS: ReadonlySet<string> = new Set([
  "date",
  "supplier",
  "amountCents",
  "categoryId",
  "eventId",
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
  return { entries: [], eventIds: [...eventIds] };
}

// ─── Checks shared by adding and editing ─────────────────────────────────────

/**
 * Whole cents from 0 up to the largest number JavaScript holds exactly.
 * -0 is refused too: `-0 < 0` is false, so it needs its own check
 * (Object.is tells -0 and 0 apart).
 */
function checkAmountCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new RangeError("amountCents must be a whole number of cents, 0 or more");
  }
  return value;
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

/** null means "no event"; anything else must be one of the state's events. */
function checkEventId(value: unknown, eventIds: readonly string[]): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !eventIds.includes(value)) {
    throw new RangeError("unknown event");
  }
  return value;
}

/** The input must be a plain object holding only the allowed fields. */
function checkFields(input: unknown, allowed: ReadonlySet<string>): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RangeError("expected an object of entry fields");
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
  return {
    kind: "expense",
    id,
    date: checkDate(input.date),
    supplier: checkText(input.supplier, "supplier"),
    amountCents: checkAmountCents(input.amountCents),
    categoryId: input.categoryId as string, // groupOf found it, so it's a known id
    group,
    eventId,
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

function checkNewId(state: EntriesState, id: unknown): string {
  if (typeof id !== "string" || id === "") throw new RangeError("an entry needs a non-empty id");
  if (state.entries.some((e) => e.id === id)) throw new RangeError("an entry with this id already exists");
  return id;
}

// ─── The reducer ─────────────────────────────────────────────────────────────

/**
 * Works out the next state from the current state and one action (add, edit
 * or delete). Never changes `state`; always returns a new object, except a
 * delete of an id that isn't there, which returns `state` itself.
 * Throws RangeError for anything invalid, leaving the state as it was.
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
      // is refused, unless the same edit also sets eventId: null.
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

    default: {
      // TypeScript knows this can't happen; at run time it is a bug, so be loud.
      const unknown: never = action;
      throw new RangeError(`unknown action type: ${String((unknown as { type?: unknown }).type)}`);
    }
  }
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
 */
export function totalsForDate(
  entries: readonly Entry[],
  date: string,
): { salesCents: number; salesCount: number; expensesCents: number } {
  checkDate(date);
  let salesCents = 0;
  let salesCount = 0;
  let expensesCents = 0;

  // Adds two whole-cent amounts, refusing a result past the exact limit.
  // The test "amount > MAX - total" uses only exact numbers, so it can't be
  // fooled by rounding the way checking "total + amount" afterwards could.
  const add = (total: number, amount: number): number => {
    checkAmountCents(amount);
    if (amount > Number.MAX_SAFE_INTEGER - total) {
      throw new RangeError("the total is too large to add up exactly");
    }
    return total + amount;
  };

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
