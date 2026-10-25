// The pretend-entries store logic for Stage 1 (T1.5): expenses and sales kept
// in memory only, lost on refresh on purpose.
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
// quick sales default to cash (guide §10). The detailed decisions are written
// at the top of src/lib/entries.test.ts.

import { isIsoDate } from "@/lib/dates";
import { DRAFT_CATEGORIES } from "@/lib/pretend-data";

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

export type SaleEntry = {
  kind: "sale";
  id: string;
  date: string; // YYYY-MM-DD
  amountCents: number; // whole cents, 0 or more
  paymentMethod: PaymentMethod;
  eventId: string | null;
};

export type Entry = ExpenseEntry | SaleEntry;

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

export type SaleInput = {
  date: string;
  amountCents: number;
  paymentMethod?: PaymentMethod;
  eventId?: string | null;
};

export type EntriesAction =
  | { type: "add-expense"; id: string; expense: ExpenseInput }
  | { type: "add-sale"; id: string; sale: SaleInput }
  | { type: "edit"; id: string; changes: Partial<ExpenseInput> | Partial<SaleInput> }
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
const SALE_FIELDS: ReadonlySet<string> = new Set(["date", "amountCents", "paymentMethod", "eventId"]);

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

/** Whole cents from 0 up to the largest number JavaScript holds exactly. */
function checkAmountCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
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

function checkPaymentMethod(value: unknown): PaymentMethod {
  if (value === undefined) return "cash";
  const found = PAYMENT_METHODS.find((m) => m === value);
  if (found === undefined) throw new RangeError("unknown payment method");
  return found;
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

/** Builds a complete, checked sale entry. Used for adding and for editing. */
function buildSale(id: string, input: Record<string, unknown>, eventIds: readonly string[]): SaleEntry {
  return {
    kind: "sale",
    id,
    date: checkDate(input.date),
    amountCents: checkAmountCents(input.amountCents),
    paymentMethod: checkPaymentMethod(input.paymentMethod),
    eventId: checkEventId(input.eventId, eventIds),
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

    case "add-sale": {
      const id = checkNewId(state, action.id);
      const input = checkFields(action.sale, SALE_FIELDS);
      const entry = buildSale(id, input, state.eventIds);
      return { ...state, entries: [...state.entries, entry] };
    }

    case "edit": {
      const index = state.entries.findIndex((e) => e.id === action.id);
      if (index === -1) throw new RangeError("there is no entry with this id to edit");
      const current = state.entries[index];

      const changes = checkFields(action.changes, current.kind === "expense" ? EXPENSE_FIELDS : SALE_FIELDS);
      // To leave a field as it is, leave it out. An explicit undefined is
      // refused (use null for "no event").
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) throw new RangeError(`${key} can't be changed to undefined`);
      }

      // Rebuild the whole entry as it would be after the change, so every rule
      // (including the group and event rules) is checked on the end result.
      // The builders read only the editable fields, so the kind and id stay
      // as they were and the group is looked up again from the category.
      const merged: Record<string, unknown> = { ...current, ...changes };
      const updated =
        current.kind === "expense"
          ? buildExpense(current.id, merged, state.eventIds)
          : buildSale(current.id, merged, state.eventIds);

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
 * Totals for one calendar day: the sales in cents, how many sales (zero-amount
 * sales count), and the expenses in cents. Exact whole-cent sums. Throws
 * RangeError for a bad date, or if a total would go past
 * Number.MAX_SAFE_INTEGER cents (beyond that it could no longer be exact).
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
    if (entry.kind === "sale") {
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
