// Tests for T1.5, part 3: the pretend-entries store logic
// (docs/stages/stage-01.md "T1.5 — Pretend-data store and today's date").
//
// Written by test-engineer BEFORE src/lib/entries.ts exists. The builder must
// not edit this file; disputes go to the project lead.
//
// Rules: guide §6 (dates stay "YYYY-MM-DD" strings), §7 (money is integer
// minor units; every category belongs to exactly one group; event & venue
// costs prompt for an event but allow "not assigned yet"), §10 (payment
// methods; quick sales default to cash), owner decision "zero is allowed".
//
// ─── CONTRACT FOR src/lib/entries.ts (the builder follows this exactly) ──────
//
// The React context/provider is a thin wrapper around the pure code below
// (useReducer(entriesReducer, pretendEvents(todayOnDevice()).map((e) => e.id),
// createEntriesState)); it is not unit-tested here. Everything in entries.ts is pure: no clock, no randomness, no I/O.
//
//   export const EXPENSE_GROUPS = ["production", "event_venue", "operating"] as const;
//   export type ExpenseGroup = (typeof EXPENSE_GROUPS)[number];
//   export const PAYMENT_METHODS = ["cash", "card", "online", "bank_transfer", "other"] as const;
//   export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
//
//   export type ExpenseEntry = {
//     kind: "expense"; id: string; date: string; supplier: string;   // trimmed, may be ""
//     amountCents: number; categoryId: string; group: ExpenseGroup;
//     eventId: string | null; notes: string;                          // notes trimmed
//   };
//   export type SaleEntry = {
//     kind: "sale"; id: string; date: string; amountCents: number;
//     paymentMethod: PaymentMethod; eventId: string | null;
//   };
//   export type Entry = ExpenseEntry | SaleEntry;
//   export type EntriesState = {
//     entries: readonly Entry[];    // in insertion order
//     eventIds: readonly string[];  // the events entries may point at (decision 9)
//   };
//   export function createEntriesState(eventIds: readonly string[]): EntriesState
//     → { entries: [], eventIds: <a copy of eventIds> }. Throws RangeError for an
//     empty or duplicate event id.
//
//   export type ExpenseInput = {
//     date: string; supplier?: string; amountCents: number; categoryId: string;
//     eventId?: string | null; notes?: string;
//   };
//   export type SaleInput = {
//     date: string; amountCents: number; paymentMethod?: PaymentMethod; eventId?: string | null;
//   };
//   export type EntriesAction =
//     | { type: "add-expense"; id: string; expense: ExpenseInput }
//     | { type: "add-sale"; id: string; sale: SaleInput }
//     | { type: "edit"; id: string; changes: Partial<ExpenseInput> | Partial<SaleInput> }
//     | { type: "delete"; id: string };
//
//   export function entriesReducer(state: EntriesState, action: EntriesAction): EntriesState
//   export function totalsForDate(entries: readonly Entry[], date: string):
//     { salesCents: number; salesCount: number; expensesCents: number }
//   export function entriesNewestFirst(entries: readonly Entry[]): Entry[]
//
// DECISIONS (made here so the tests can be exact; the lead confirms them):
//
//  1. IDs come in the action. The provider makes them (e.g. crypto.randomUUID())
//     before dispatching, so the reducer stays pure; React may call a reducer
//     twice in development, and an id generator inside it would misbehave.
//     Tests pass fixed ids. An empty id, or an id already in the state, is
//     rejected.
//  2. Invalid actions THROW a RangeError and the state is left untouched. Forms
//     validate first (T1.4's parseAmountToCents), so a bad action reaching the
//     reducer is a bug that should be loud, not silently ignored. This covers:
//     amounts that aren't safe non-negative integers (cents), dates that fail
//     isIsoDate, unknown categories, unknown payment methods, unknown action
//     types, editing an id that doesn't exist, and any field that isn't
//     allowed for that kind of entry (see 4).
//  3. Delete of an id that isn't there returns the SAME state object, so a
//     double-tapped "undo" is harmless.
//  4. Only these fields may be given (when adding) or changed (when editing):
//       expense: date, supplier, amountCents, categoryId, eventId, notes
//       sale:    date, amountCents, paymentMethod, eventId
//     `group` is never given: it is always looked up from the category in
//     DRAFT_CATEGORIES, also when an edit changes the category. Passing `group`,
//     `id`, `kind` or a field from the other kind throws RangeError.
//  5. Defaults: expense supplier → "", eventId → null, notes → ""; sale
//     paymentMethod → "cash", eventId → null.
//  6. Edit keeps the entry's place in insertion order (and its id and kind).
//  7. totalsForDate throws RangeError for a bad date, and when a total would
//     pass Number.MAX_SAFE_INTEGER cents (it can no longer be exact).
//  8. Newest first: later date first; on the same date, the entry added later
//     comes first. An edit doesn't count as "adding".
//  9. Events (lead's ruling, 2026-10-25). The state holds the ids of the
//     events entries may point at, set once by createEntriesState. In Stage 1
//     that is pretendEvents(today)'s ids. The rules, on add AND edit (checked
//     on the entry as it would be after the change):
//       - production and operating expenses: eventId must be null (guide §7:
//         not linked to events). So editing an event & venue expense that has
//         an event to a production category throws, unless the same edit also
//         sets eventId: null;
//       - event & venue expenses: null ("not assigned yet") or a known event id;
//       - sales: null or a known event id.
//     Anything else (an unknown id, "") throws RangeError.
// 10. Supplier is optional. Supplier and notes are stored trimmed
//     (String.prototype.trim); empty after trimming is allowed. A supplier or
//     notes value that isn't a string throws RangeError.
//
// Every expected value was worked out by hand (sums written in the comments).
// None comes from the code under test.

import { describe, expect, it } from "vitest";
import {
  entriesNewestFirst,
  entriesReducer,
  createEntriesState,
  PAYMENT_METHODS,
  totalsForDate,
  type EntriesAction,
  type EntriesState,
  type Entry,
} from "@/lib/entries";
import { DRAFT_CATEGORIES, pretendEvents } from "@/lib/pretend-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Freezes an object and everything inside it, so any mutation throws. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** Looks a draft category up by its guide §7 name (names are pinned in pretend-data.test.ts). */
function categoryId(name: string): string {
  const found = DRAFT_CATEGORIES.find((c) => c.name === name);
  if (!found) throw new Error(`test setup: no draft category called ${name}`);
  return found.id;
}

const PRINTING = categoryId("Printing"); // production
const STALL_FEES = categoryId("Stall or table fees"); // event & venue
const SOFTWARE = categoryId("Software"); // operating

const TODAY = "2026-07-01";
/** The pretend events' ids (pretend-data.test.ts proves they're unique and stable). */
const EVENT_IDS: readonly string[] = deepFreeze(pretendEvents(TODAY).map((e) => e.id));
/** The pretend event that runs on TODAY (pretend-data.test.ts proves there's exactly one). */
const TODAYS_EVENT_ID = pretendEvents(TODAY).find((e) => e.startDate === TODAY)!.id;
/** Another pretend event, one that isn't on TODAY. */
const OTHER_EVENT_ID = EVENT_IDS.find((id) => id !== TODAYS_EVENT_ID)!;
const UNKNOWN_EVENT_ID = "no-such-event";

/** Applies actions one after another, starting from no entries and the pretend events. */
function run(...actions: EntriesAction[]): EntriesState {
  return actions.reduce(entriesReducer, createEntriesState(EVENT_IDS));
}

/** Runs actions, then deep-freezes the result so the next step can't mutate it. */
function frozenState(...actions: EntriesAction[]): EntriesState {
  return deepFreeze(run(...actions));
}

/** A JSON copy, to compare a state before and after with no shared objects. */
function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const addSale = (id: string, date: string, amountCents: number): EntriesAction => ({
  type: "add-sale",
  id,
  sale: { date, amountCents },
});

const addExpense = (id: string, date: string, amountCents: number): EntriesAction => ({
  type: "add-expense",
  id,
  expense: { date, supplier: "Officeworks", amountCents, categoryId: PRINTING },
});

const ids = (entries: readonly Entry[]) => entries.map((e) => e.id);

// ─── Starting point and the lists ───────────────────────────────────────────

describe("initial state and fixed lists", () => {
  it("starts with no entries and the given event ids", () => {
    expect(createEntriesState(EVENT_IDS)).toStrictEqual({ entries: [], eventIds: [...EVENT_IDS] });
  });

  it("starts with no entries and no events when given none", () => {
    expect(createEntriesState([])).toStrictEqual({ entries: [], eventIds: [] });
  });

  it("throws RangeError for a duplicate event id", () => {
    expect(() => createEntriesState(["ev-a", "ev-b", "ev-a"])).toThrow(RangeError);
  });

  it("throws RangeError for an empty event id", () => {
    expect(() => createEntriesState(["ev-a", ""])).toThrow(RangeError);
  });

  it("offers exactly the guide §10 payment methods, cash first", () => {
    expect([...PAYMENT_METHODS]).toStrictEqual(["cash", "card", "online", "bank_transfer", "other"]);
  });
});

// ─── Adding expenses ────────────────────────────────────────────────────────

describe("add-expense", () => {
  it("stores every field exactly, with the group looked up from the category", () => {
    const state = run({
      type: "add-expense",
      id: "e1",
      expense: {
        date: "2026-06-30",
        supplier: "Officeworks",
        amountCents: 11000,
        categoryId: PRINTING,
        eventId: null,
        notes: "Zine reprint",
      },
    });
    expect(state).toStrictEqual({
      eventIds: [...EVENT_IDS],
      entries: [
        {
          kind: "expense",
          id: "e1",
          date: "2026-06-30",
          supplier: "Officeworks",
          amountCents: 11000,
          categoryId: PRINTING,
          group: "production",
          eventId: null,
          notes: "Zine reprint",
        },
      ],
    });
  });

  it("defaults eventId to null and notes to an empty string", () => {
    const state = run(addExpense("e1", TODAY, 2500));
    expect(state.entries[0]).toStrictEqual({
      kind: "expense",
      id: "e1",
      date: TODAY,
      supplier: "Officeworks",
      amountCents: 2500,
      categoryId: PRINTING,
      group: "production",
      eventId: null,
      notes: "",
    });
  });

  it("derives group event_venue for an event & venue category", () => {
    const state = run({
      type: "add-expense",
      id: "e1",
      expense: { date: TODAY, supplier: "Craft Fair Co", amountCents: 8000, categoryId: STALL_FEES },
    });
    expect(state.entries[0]).toMatchObject({ group: "event_venue" });
  });

  it("derives group operating for an operating category", () => {
    const state = run({
      type: "add-expense",
      id: "e1",
      expense: { date: TODAY, supplier: "Adobe", amountCents: 3299, categoryId: SOFTWARE },
    });
    expect(state.entries[0]).toMatchObject({ group: "operating" });
  });

  it("derives the right group for every draft category", () => {
    let state = createEntriesState(EVENT_IDS);
    DRAFT_CATEGORIES.forEach((c, i) => {
      state = entriesReducer(state, {
        type: "add-expense",
        id: `e${i}`,
        expense: { date: TODAY, supplier: "S", amountCents: 100, categoryId: c.id },
      });
    });
    expect(state.entries.map((e) => (e.kind === "expense" ? e.group : "not an expense"))).toStrictEqual(
      DRAFT_CATEGORIES.map((c) => c.group),
    );
  });

  it("lets an event & venue expense be 'not assigned yet' (eventId null)", () => {
    const state = run({
      type: "add-expense",
      id: "e1",
      expense: { date: TODAY, supplier: "Craft Fair Co", amountCents: 8000, categoryId: STALL_FEES, eventId: null },
    });
    expect(state.entries[0]).toMatchObject({ group: "event_venue", eventId: null });
  });

  it("links an event & venue expense to a pretend event", () => {
    const state = run({
      type: "add-expense",
      id: "e1",
      expense: {
        date: TODAY,
        supplier: "Craft Fair Co",
        amountCents: 8000,
        categoryId: STALL_FEES,
        eventId: TODAYS_EVENT_ID,
      },
    });
    expect(state.entries[0]).toMatchObject({ group: "event_venue", eventId: TODAYS_EVENT_ID });
  });

  it("allows a zero amount (owner decision)", () => {
    expect(run(addExpense("e1", TODAY, 0)).entries[0]).toMatchObject({ amountCents: 0 });
  });

  it("allows the largest exact amount, Number.MAX_SAFE_INTEGER cents", () => {
    expect(run(addExpense("e1", TODAY, Number.MAX_SAFE_INTEGER)).entries[0]).toMatchObject({
      amountCents: 9007199254740991,
    });
  });

  it("adds after the existing entries (insertion order)", () => {
    const state = run(addSale("s1", TODAY, 100), addExpense("e1", "2026-06-01", 200), addSale("s2", "2026-05-01", 300));
    expect(ids(state.entries)).toStrictEqual(["s1", "e1", "s2"]);
  });

  it("throws RangeError for an unknown category", () => {
    const before = frozenState();
    expect(() =>
      entriesReducer(before, {
        type: "add-expense",
        id: "e1",
        expense: { date: TODAY, supplier: "S", amountCents: 100, categoryId: "not-a-category" },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when the category is the category's name instead of its id", () => {
    // pretend-data.test.ts pins ids as slugs, so a name with spaces is never an id.
    expect(() =>
      run({
        type: "add-expense",
        id: "e1",
        expense: { date: TODAY, supplier: "S", amountCents: 100, categoryId: "Stall or table fees" },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when a group is passed in (it is always derived from the category)", () => {
    expect(() =>
      run({
        type: "add-expense",
        id: "e1",
        expense: {
          date: TODAY,
          supplier: "Officeworks",
          amountCents: 100,
          categoryId: PRINTING,
          // @ts-expect-error -- group isn't part of ExpenseInput; it comes from the category
          group: "operating",
        },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when a sale-only field (paymentMethod) is passed to add-expense", () => {
    expect(() =>
      run({
        type: "add-expense",
        id: "e1",
        expense: {
          date: TODAY,
          supplier: "Officeworks",
          amountCents: 100,
          categoryId: PRINTING,
          // @ts-expect-error -- expenses have no payment method in Stage 1
          paymentMethod: "card",
        },
      }),
    ).toThrow(RangeError);
  });
});

// ─── Adding sales ───────────────────────────────────────────────────────────

describe("add-sale", () => {
  it("defaults the payment method to cash and the event to null", () => {
    expect(run(addSale("s1", TODAY, 2000))).toStrictEqual({
      eventIds: [...EVENT_IDS],
      entries: [{ kind: "sale", id: "s1", date: TODAY, amountCents: 2000, paymentMethod: "cash", eventId: null }],
    });
  });

  it("stores every field exactly when all are given", () => {
    const state = run({
      type: "add-sale",
      id: "s1",
      sale: { date: TODAY, amountCents: 4550, paymentMethod: "card", eventId: TODAYS_EVENT_ID },
    });
    expect(state.entries[0]).toStrictEqual({
      kind: "sale",
      id: "s1",
      date: TODAY,
      amountCents: 4550,
      paymentMethod: "card",
      eventId: TODAYS_EVENT_ID,
    });
  });

  for (const method of ["cash", "card", "online", "bank_transfer", "other"] as const) {
    it(`accepts payment method ${method}`, () => {
      const state = run({ type: "add-sale", id: "s1", sale: { date: TODAY, amountCents: 100, paymentMethod: method } });
      expect(state.entries[0]).toMatchObject({ paymentMethod: method });
    });
  }

  it("allows a zero-amount sale (owner decision)", () => {
    expect(run(addSale("s1", TODAY, 0)).entries[0]).toMatchObject({ amountCents: 0 });
  });

  it("throws RangeError for an unknown payment method", () => {
    expect(() =>
      run({
        type: "add-sale",
        id: "s1",
        // @ts-expect-error -- not one of PAYMENT_METHODS
        sale: { date: TODAY, amountCents: 100, paymentMethod: "bitcoin" },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when an expense-only field (categoryId) is passed to add-sale", () => {
    expect(() =>
      run({
        type: "add-sale",
        id: "s1",
        // @ts-expect-error -- sales have no category
        sale: { date: TODAY, amountCents: 100, categoryId: PRINTING },
      }),
    ).toThrow(RangeError);
  });
});

// ─── Rejecting bad amounts, dates and ids (both kinds) ──────────────────────

describe("rejects bad amounts with RangeError and leaves the state untouched", () => {
  const badAmounts: Array<[unknown, string]> = [
    [10.5, "not a whole number of cents"],
    [0.1, "a fraction of a cent"],
    [-1, "negative"],
    [-500, "negative"],
    [Number.MAX_SAFE_INTEGER + 1, "above MAX_SAFE_INTEGER, no longer exact"],
    [Number.NaN, "NaN"],
    [Number.POSITIVE_INFINITY, "Infinity"],
    ["1000", "a string, not a number"],
    [null, "null"],
    [undefined, "missing"],
  ];

  for (const [amount, why] of badAmounts) {
    it(`add-sale rejects amountCents ${String(amount)} (${why})`, () => {
      const before = frozenState(addSale("s0", TODAY, 100));
      const copy = snapshot(before);
      expect(() =>
        entriesReducer(before, { type: "add-sale", id: "s1", sale: { date: TODAY, amountCents: amount as number } }),
      ).toThrow(RangeError);
      expect(before).toStrictEqual(copy);
    });

    it(`add-expense rejects amountCents ${String(amount)} (${why})`, () => {
      const before = frozenState(addSale("s0", TODAY, 100));
      const copy = snapshot(before);
      expect(() =>
        entriesReducer(before, {
          type: "add-expense",
          id: "e1",
          expense: { date: TODAY, supplier: "S", amountCents: amount as number, categoryId: PRINTING },
        }),
      ).toThrow(RangeError);
      expect(before).toStrictEqual(copy);
    });

    it(`edit rejects amountCents ${String(amount)} (${why})`, () => {
      const before = frozenState(addSale("s1", TODAY, 100));
      const copy = snapshot(before);
      expect(() => entriesReducer(before, { type: "edit", id: "s1", changes: { amountCents: amount as number } })).toThrow(
        RangeError,
      );
      expect(before).toStrictEqual(copy);
    });
  }
});

describe("rejects bad dates with RangeError", () => {
  const badDates = ["2026-02-30", "2026-02-29", "2026-7-1", "01/07/2026", "2026-07-01T09:00:00+10:00", ""];

  for (const date of badDates) {
    it(`add-sale rejects date ${JSON.stringify(date)}`, () => {
      expect(() => run(addSale("s1", date, 100))).toThrow(RangeError);
    });

    it(`add-expense rejects date ${JSON.stringify(date)}`, () => {
      expect(() => run(addExpense("e1", date, 100))).toThrow(RangeError);
    });

    it(`edit rejects date ${JSON.stringify(date)}`, () => {
      const before = frozenState(addExpense("e1", TODAY, 100));
      expect(() => entriesReducer(before, { type: "edit", id: "e1", changes: { date } })).toThrow(RangeError);
    });
  }

  it("rejects a Date object instead of a YYYY-MM-DD string", () => {
    const aMoment = new Date(Date.UTC(2026, 6, 1)) as unknown as string;
    expect(() => run(addSale("s1", aMoment, 100))).toThrow(RangeError);
  });

  it("accepts a leap day in a leap year", () => {
    expect(run(addSale("s1", "2028-02-29", 100)).entries[0]).toMatchObject({ date: "2028-02-29" });
  });
});

describe("ids", () => {
  it("throws RangeError when adding a sale with an id that already exists", () => {
    const before = frozenState(addSale("x", TODAY, 100));
    expect(() => entriesReducer(before, addSale("x", TODAY, 200))).toThrow(RangeError);
  });

  it("throws RangeError when adding an expense with an id a sale already uses", () => {
    const before = frozenState(addSale("x", TODAY, 100));
    expect(() => entriesReducer(before, addExpense("x", TODAY, 200))).toThrow(RangeError);
  });

  it("throws RangeError for an empty id", () => {
    expect(() => run(addSale("", TODAY, 100))).toThrow(RangeError);
  });

  it("throws RangeError for an unknown action type", () => {
    expect(() =>
      entriesReducer(frozenState(), { type: "explode", id: "s1" } as unknown as EntriesAction),
    ).toThrow(RangeError);
  });
});

// ─── Editing ────────────────────────────────────────────────────────────────

describe("edit", () => {
  const start = () =>
    frozenState(
      addSale("s1", TODAY, 1000),
      {
        type: "add-expense",
        id: "e1",
        expense: { date: TODAY, supplier: "Officeworks", amountCents: 11000, categoryId: PRINTING, notes: "A3 prints" },
      },
      addSale("s2", TODAY, 3000),
    );

  it("changes an expense's amount to new integer cents and nothing else", () => {
    const after = entriesReducer(start(), { type: "edit", id: "e1", changes: { amountCents: 12345 } });
    expect(after.entries[1]).toStrictEqual({
      kind: "expense",
      id: "e1",
      date: TODAY,
      supplier: "Officeworks",
      amountCents: 12345,
      categoryId: PRINTING,
      group: "production",
      eventId: null,
      notes: "A3 prints",
    });
  });

  it("leaves the other entries exactly as they were", () => {
    const after = entriesReducer(start(), { type: "edit", id: "e1", changes: { amountCents: 12345 } });
    expect(after.entries[0]).toStrictEqual({
      kind: "sale", id: "s1", date: TODAY, amountCents: 1000, paymentMethod: "cash", eventId: null,
    });
    expect(after.entries[2]).toStrictEqual({
      kind: "sale", id: "s2", date: TODAY, amountCents: 3000, paymentMethod: "cash", eventId: null,
    });
  });

  it("keeps the edited entry in its place (insertion order)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "e1", changes: { date: "2026-01-15" } });
    expect(ids(after.entries)).toStrictEqual(["s1", "e1", "s2"]);
  });

  it("changes a sale's payment method, keeping its amount", () => {
    const after = entriesReducer(start(), { type: "edit", id: "s2", changes: { paymentMethod: "card" } });
    expect(after.entries[2]).toStrictEqual({
      kind: "sale", id: "s2", date: TODAY, amountCents: 3000, paymentMethod: "card", eventId: null,
    });
  });

  it("re-derives the group when the category changes (production → event & venue)", () => {
    const after = entriesReducer(start(), {
      type: "edit",
      id: "e1",
      changes: { categoryId: STALL_FEES, eventId: TODAYS_EVENT_ID },
    });
    expect(after.entries[1]).toMatchObject({ categoryId: STALL_FEES, group: "event_venue", eventId: TODAYS_EVENT_ID });
  });

  it("re-derives the group when the category changes (production → operating)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "e1", changes: { categoryId: SOFTWARE } });
    expect(after.entries[1]).toMatchObject({ categoryId: SOFTWARE, group: "operating" });
  });

  it("can set an event & venue expense back to 'not assigned yet'", () => {
    const linked = entriesReducer(start(), {
      type: "edit",
      id: "e1",
      changes: { categoryId: STALL_FEES, eventId: TODAYS_EVENT_ID },
    });
    const after = entriesReducer(deepFreeze(linked), { type: "edit", id: "e1", changes: { eventId: null } });
    expect(after.entries[1]).toMatchObject({ group: "event_venue", eventId: null });
  });

  it("throws RangeError when editing to an unknown category", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "e1", changes: { categoryId: "nope" } })).toThrow(
      RangeError,
    );
  });

  it("throws RangeError when an edit passes a group", () => {
    expect(() =>
      // @ts-expect-error -- group is never edited directly
      entriesReducer(start(), { type: "edit", id: "e1", changes: { group: "operating" } }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when an edit tries to change the id", () => {
    expect(() =>
      // @ts-expect-error -- id can't be edited
      entriesReducer(start(), { type: "edit", id: "e1", changes: { id: "e9" } }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when an edit tries to turn a sale into an expense", () => {
    expect(() =>
      // @ts-expect-error -- kind can't be edited
      entriesReducer(start(), { type: "edit", id: "s1", changes: { kind: "expense" } }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when an edit gives a sale a category", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "s1", changes: { categoryId: PRINTING } })).toThrow(
      RangeError,
    );
  });

  it("throws RangeError when an edit gives an expense a payment method", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "e1", changes: { paymentMethod: "card" } })).toThrow(
      RangeError,
    );
  });

  it("throws RangeError when editing an id that doesn't exist", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "missing", changes: { amountCents: 1 } })).toThrow(
      RangeError,
    );
  });

  it("does not change the state it was given", () => {
    const before = start();
    const copy = snapshot(before);
    entriesReducer(before, { type: "edit", id: "e1", changes: { amountCents: 1, categoryId: SOFTWARE } });
    expect(before).toStrictEqual(copy);
  });
});

// ─── Deleting ───────────────────────────────────────────────────────────────

describe("delete", () => {
  const start = () =>
    frozenState(addSale("s1", TODAY, 1000), addExpense("e1", TODAY, 2000), addSale("s2", TODAY, 3000));

  it("removes only the target entry and keeps the others in order", () => {
    const after = entriesReducer(start(), { type: "delete", id: "e1" });
    expect(after).toStrictEqual({
      eventIds: [...EVENT_IDS],
      entries: [
        { kind: "sale", id: "s1", date: TODAY, amountCents: 1000, paymentMethod: "cash", eventId: null },
        { kind: "sale", id: "s2", date: TODAY, amountCents: 3000, paymentMethod: "cash", eventId: null },
      ],
    });
  });

  it("removes the last-added sale (the quick-sale undo)", () => {
    const after = entriesReducer(start(), { type: "delete", id: "s2" });
    expect(ids(after.entries)).toStrictEqual(["s1", "e1"]);
  });

  it("returns the very same state object when the id isn't there (a double-tapped undo is harmless)", () => {
    const before = start();
    expect(entriesReducer(before, { type: "delete", id: "missing" })).toBe(before);
  });

  it("does not change the state it was given", () => {
    const before = start();
    const copy = snapshot(before);
    entriesReducer(before, { type: "delete", id: "s1" });
    expect(before).toStrictEqual(copy);
  });
});

describe("adding never changes the state it was given", () => {
  it("add-sale returns a new state and leaves the old one as it was", () => {
    const before = frozenState(addSale("s1", TODAY, 1000));
    const copy = snapshot(before);
    const after = entriesReducer(before, addSale("s2", TODAY, 500));
    expect(before).toStrictEqual(copy);
    expect(ids(after.entries)).toStrictEqual(["s1", "s2"]);
  });

  it("add-expense returns a new state and leaves the old one as it was", () => {
    const before = frozenState(addSale("s1", TODAY, 1000));
    const copy = snapshot(before);
    const after = entriesReducer(before, addExpense("e1", TODAY, 500));
    expect(before).toStrictEqual(copy);
    expect(ids(after.entries)).toStrictEqual(["s1", "e1"]);
  });
});

// ─── Which entries may point at an event (decision 9) ───────────────────────

describe("events on add: production and operating never, event & venue and sales only known events", () => {
  const expenseWith = (categoryId: string, eventId: string | null): EntriesAction => ({
    type: "add-expense",
    id: "e1",
    expense: { date: TODAY, supplier: "S", amountCents: 100, categoryId, eventId },
  });
  const saleWith = (eventId: string | null): EntriesAction => ({
    type: "add-sale",
    id: "s1",
    sale: { date: TODAY, amountCents: 100, eventId },
  });

  it("throws RangeError for a production expense linked to an event", () => {
    expect(() => run(expenseWith(PRINTING, TODAYS_EVENT_ID))).toThrow(RangeError);
  });

  it("throws RangeError for an operating expense linked to an event", () => {
    expect(() => run(expenseWith(SOFTWARE, TODAYS_EVENT_ID))).toThrow(RangeError);
  });

  it("throws RangeError for a production expense with eventId \"\" (only null means no event)", () => {
    expect(() => run(expenseWith(PRINTING, ""))).toThrow(RangeError);
  });

  it("stores a production expense with eventId null", () => {
    expect(run(expenseWith(PRINTING, null)).entries[0]).toMatchObject({ group: "production", eventId: null });
  });

  it("links an event & venue expense to another known pretend event", () => {
    expect(run(expenseWith(STALL_FEES, OTHER_EVENT_ID)).entries[0]).toMatchObject({
      group: "event_venue",
      eventId: OTHER_EVENT_ID,
    });
  });

  it("throws RangeError for an event & venue expense linked to an unknown event", () => {
    expect(() => run(expenseWith(STALL_FEES, UNKNOWN_EVENT_ID))).toThrow(RangeError);
  });

  it("throws RangeError for an event & venue expense with eventId \"\"", () => {
    expect(() => run(expenseWith(STALL_FEES, ""))).toThrow(RangeError);
  });

  it("links a sale to another known pretend event", () => {
    expect(run(saleWith(OTHER_EVENT_ID)).entries[0]).toMatchObject({ eventId: OTHER_EVENT_ID });
  });

  it("throws RangeError for a sale linked to an unknown event", () => {
    expect(() => run(saleWith(UNKNOWN_EVENT_ID))).toThrow(RangeError);
  });

  it("throws RangeError for a sale with eventId \"\"", () => {
    expect(() => run(saleWith(""))).toThrow(RangeError);
  });

  it("checks against the state's own event list: with no events, a pretend event id is unknown", () => {
    const noEvents = deepFreeze(createEntriesState([]));
    expect(() => entriesReducer(noEvents, saleWith(TODAYS_EVENT_ID))).toThrow(RangeError);
  });

  it("with no events, a sale with eventId null is still fine", () => {
    const noEvents = deepFreeze(createEntriesState([]));
    expect(entriesReducer(noEvents, saleWith(null)).entries[0]).toMatchObject({ eventId: null });
  });

  it("accepts an event id that is in the state's list even if it isn't a pretend event", () => {
    const custom = deepFreeze(createEntriesState(["ev-custom"]));
    expect(entriesReducer(custom, saleWith("ev-custom")).entries[0]).toMatchObject({ eventId: "ev-custom" });
  });
});

describe("events on edit: the rules apply to the entry as it would be after the change", () => {
  // e1: production, no event. v1: event & venue, linked to today's event. s1: sale, no event.
  const start = () =>
    frozenState(
      addExpense("e1", TODAY, 1000),
      {
        type: "add-expense",
        id: "v1",
        expense: { date: TODAY, supplier: "Craft Fair Co", amountCents: 8000, categoryId: STALL_FEES, eventId: TODAYS_EVENT_ID },
      },
      addSale("s1", TODAY, 500),
    );

  it("throws RangeError when a production expense is given an event", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "e1", changes: { eventId: TODAYS_EVENT_ID } })).toThrow(
      RangeError,
    );
  });

  it("throws RangeError when an event & venue expense with an event moves to a production category", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "v1", changes: { categoryId: PRINTING } })).toThrow(
      RangeError,
    );
  });

  it("throws RangeError when an event & venue expense with an event moves to an operating category", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "v1", changes: { categoryId: SOFTWARE } })).toThrow(
      RangeError,
    );
  });

  it("allows the move to production when the same edit clears the event", () => {
    const after = entriesReducer(start(), { type: "edit", id: "v1", changes: { categoryId: PRINTING, eventId: null } });
    expect(after.entries[1]).toStrictEqual({
      kind: "expense",
      id: "v1",
      date: TODAY,
      supplier: "Craft Fair Co",
      amountCents: 8000,
      categoryId: PRINTING,
      group: "production",
      eventId: null,
      notes: "",
    });
  });

  it("keeps the event when moving to another event & venue category (Stall fees → Flights)", () => {
    const flights = categoryId("Flights");
    const after = entriesReducer(start(), { type: "edit", id: "v1", changes: { categoryId: flights } });
    expect(after.entries[1]).toMatchObject({ categoryId: flights, group: "event_venue", eventId: TODAYS_EVENT_ID });
  });

  it("moves an event & venue expense to another known event", () => {
    const after = entriesReducer(start(), { type: "edit", id: "v1", changes: { eventId: OTHER_EVENT_ID } });
    expect(after.entries[1]).toMatchObject({ eventId: OTHER_EVENT_ID });
  });

  it("throws RangeError when an event & venue expense is moved to an unknown event", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "v1", changes: { eventId: UNKNOWN_EVENT_ID } })).toThrow(
      RangeError,
    );
  });

  it("links a sale to a known event by editing", () => {
    const after = entriesReducer(start(), { type: "edit", id: "s1", changes: { eventId: OTHER_EVENT_ID } });
    expect(after.entries[2]).toStrictEqual({
      kind: "sale", id: "s1", date: TODAY, amountCents: 500, paymentMethod: "cash", eventId: OTHER_EVENT_ID,
    });
  });

  it("throws RangeError when a sale is edited to an unknown event", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "s1", changes: { eventId: UNKNOWN_EVENT_ID } })).toThrow(
      RangeError,
    );
  });

  it("leaves the state exactly as it was after a rejected event edit", () => {
    const before = start();
    const copy = snapshot(before);
    expect(() => entriesReducer(before, { type: "edit", id: "v1", changes: { categoryId: PRINTING } })).toThrow(
      RangeError,
    );
    expect(before).toStrictEqual(copy);
  });

  it("never changes the state's event list", () => {
    const after = entriesReducer(start(), { type: "edit", id: "v1", changes: { eventId: OTHER_EVENT_ID } });
    expect(after.eventIds).toStrictEqual([...EVENT_IDS]);
  });
});

// ─── Supplier and notes (decision 10) ───────────────────────────────────────

describe("supplier and notes are optional and stored trimmed", () => {
  const expense = (extra: { supplier?: unknown; notes?: unknown }): EntriesAction => ({
    type: "add-expense",
    id: "e1",
    expense: { date: TODAY, amountCents: 100, categoryId: PRINTING, ...(extra as { supplier?: string; notes?: string }) },
  });

  it("stores a missing supplier as \"\"", () => {
    expect(run(expense({})).entries[0]).toStrictEqual({
      kind: "expense",
      id: "e1",
      date: TODAY,
      supplier: "",
      amountCents: 100,
      categoryId: PRINTING,
      group: "production",
      eventId: null,
      notes: "",
    });
  });

  it("trims spaces around the supplier: \"  Officeworks  \" → \"Officeworks\"", () => {
    expect(run(expense({ supplier: "  Officeworks  " })).entries[0]).toMatchObject({ supplier: "Officeworks" });
  });

  it("keeps spaces inside the supplier: \"  Art  Supplies Co \" → \"Art  Supplies Co\"", () => {
    expect(run(expense({ supplier: "  Art  Supplies Co " })).entries[0]).toMatchObject({ supplier: "Art  Supplies Co" });
  });

  it("stores an all-spaces supplier as \"\"", () => {
    expect(run(expense({ supplier: "   " })).entries[0]).toMatchObject({ supplier: "" });
  });

  it("trims the notes: \"  A3 prints \\n\" → \"A3 prints\"", () => {
    expect(run(expense({ notes: "  A3 prints \n" })).entries[0]).toMatchObject({ notes: "A3 prints" });
  });

  it("stores whitespace-only notes as \"\"", () => {
    expect(run(expense({ notes: "\t " })).entries[0]).toMatchObject({ notes: "" });
  });

  it("trims a supplier changed by an edit: \" Kmart \" → \"Kmart\"", () => {
    const before = frozenState(expense({ supplier: "Officeworks" }));
    const after = entriesReducer(before, { type: "edit", id: "e1", changes: { supplier: " Kmart " } });
    expect(after.entries[0]).toMatchObject({ supplier: "Kmart" });
  });

  it("trims notes changed by an edit: \" for the zine \" → \"for the zine\"", () => {
    const before = frozenState(expense({}));
    const after = entriesReducer(before, { type: "edit", id: "e1", changes: { notes: " for the zine " } });
    expect(after.entries[0]).toMatchObject({ notes: "for the zine" });
  });

  it("throws RangeError for a supplier that isn't a string (42)", () => {
    expect(() => run(expense({ supplier: 42 }))).toThrow(RangeError);
  });

  it("throws RangeError for notes that aren't a string (null)", () => {
    expect(() => run(expense({ notes: null }))).toThrow(RangeError);
  });
});

// ─── Totals for a day ───────────────────────────────────────────────────────

describe("totalsForDate", () => {
  // Hand-checked dataset. On 2026-07-01:
  //   sales     1500 + 0 + 2250            = 3750 cents from 3 sales (the 0 counts)
  //   expenses  4000 + 1234                = 5234 cents
  // On 2026-06-30: one sale of 99999, one expense of 50000.
  // On 2026-07-02: one sale of 700, no expenses.
  const dataset = () =>
    frozenState(
      addSale("s1", "2026-07-01", 1500),
      addSale("s2", "2026-07-01", 0),
      addExpense("e1", "2026-07-01", 4000),
      addSale("s3", "2026-06-30", 99999),
      { type: "add-sale", id: "s4", sale: { date: "2026-07-01", amountCents: 2250, paymentMethod: "card" } },
      addExpense("e2", "2026-06-30", 50000),
      addSale("s5", "2026-07-02", 700),
      {
        type: "add-expense",
        id: "e3",
        expense: { date: "2026-07-01", supplier: "Craft Fair Co", amountCents: 1234, categoryId: STALL_FEES },
      },
    ).entries;

  it("sums today's sales and expenses, counting the zero-amount sale (1500+0+2250; 4000+1234)", () => {
    expect(totalsForDate(dataset(), "2026-07-01")).toStrictEqual({
      salesCents: 3750,
      salesCount: 3,
      expensesCents: 5234,
    });
  });

  it("excludes other dates: 30 June has only its own sale and expense", () => {
    expect(totalsForDate(dataset(), "2026-06-30")).toStrictEqual({
      salesCents: 99999,
      salesCount: 1,
      expensesCents: 50000,
    });
  });

  it("excludes other dates: 2 July has one sale and no expenses", () => {
    expect(totalsForDate(dataset(), "2026-07-02")).toStrictEqual({
      salesCents: 700,
      salesCount: 1,
      expensesCents: 0,
    });
  });

  it("is all zeros for a day with no entries", () => {
    expect(totalsForDate(dataset(), "2026-07-03")).toStrictEqual({ salesCents: 0, salesCount: 0, expensesCents: 0 });
  });

  it("is all zeros with no entries at all", () => {
    expect(totalsForDate([], "2026-07-01")).toStrictEqual({ salesCents: 0, salesCount: 0, expensesCents: 0 });
  });

  it("counts a day with only a zero sale as 1 sale of 0 cents", () => {
    const entries = frozenState(addSale("s1", TODAY, 0)).entries;
    expect(totalsForDate(entries, TODAY)).toStrictEqual({ salesCents: 0, salesCount: 1, expensesCents: 0 });
  });

  it("updates after a delete: removing s4 (2250) leaves 1500+0 = 1500 from 2 sales", () => {
    const after = entriesReducer(deepFreeze({ entries: dataset(), eventIds: [...EVENT_IDS] }), { type: "delete", id: "s4" });
    expect(totalsForDate(after.entries, "2026-07-01")).toStrictEqual({
      salesCents: 1500,
      salesCount: 2,
      expensesCents: 5234,
    });
  });

  it("updates after an edit: s1 1500 → 1999 gives 1999+0+2250 = 4249", () => {
    const after = entriesReducer(deepFreeze({ entries: dataset(), eventIds: [...EVENT_IDS] }), {
      type: "edit",
      id: "s1",
      changes: { amountCents: 1999 },
    });
    expect(totalsForDate(after.entries, "2026-07-01")).toStrictEqual({
      salesCents: 4249,
      salesCount: 3,
      expensesCents: 5234,
    });
  });

  it("moves an entry between days when its date is edited: e1 (4000) to 30 June", () => {
    const after = entriesReducer(deepFreeze({ entries: dataset(), eventIds: [...EVENT_IDS] }), {
      type: "edit",
      id: "e1",
      changes: { date: "2026-06-30" },
    });
    // 1 July expenses: 1234. 30 June expenses: 50000 + 4000 = 54000.
    expect(totalsForDate(after.entries, "2026-07-01").expensesCents).toBe(1234);
    expect(totalsForDate(after.entries, "2026-06-30").expensesCents).toBe(54000);
  });

  it("is exact right up to MAX_SAFE_INTEGER: 4503599627370495 + 4503599627370496 = 9007199254740991", () => {
    const entries = frozenState(addSale("s1", TODAY, 4503599627370495), addSale("s2", TODAY, 4503599627370496)).entries;
    expect(totalsForDate(entries, TODAY)).toStrictEqual({
      salesCents: 9007199254740991,
      salesCount: 2,
      expensesCents: 0,
    });
  });

  it("throws RangeError when the day's sales would pass MAX_SAFE_INTEGER (no longer exact)", () => {
    const entries = frozenState(addSale("s1", TODAY, Number.MAX_SAFE_INTEGER), addSale("s2", TODAY, 1)).entries;
    expect(() => totalsForDate(entries, TODAY)).toThrow(RangeError);
  });

  it("throws RangeError when the day's expenses would pass MAX_SAFE_INTEGER", () => {
    const entries = frozenState(addExpense("e1", TODAY, Number.MAX_SAFE_INTEGER), addExpense("e2", TODAY, 1)).entries;
    expect(() => totalsForDate(entries, TODAY)).toThrow(RangeError);
  });

  it("throws RangeError for a date that isn't YYYY-MM-DD, instead of quietly showing zeros", () => {
    expect(() => totalsForDate(dataset(), "2026-7-1")).toThrow(RangeError);
  });
});

// ─── Newest first ───────────────────────────────────────────────────────────

describe("entriesNewestFirst", () => {
  it("sorts by date, newest first, and later-added first on the same date", () => {
    // Added in this order: A 1 Jul, B 30 Jun, C 1 Jul, D 2 Jul, E 30 Jun.
    // Newest first: D (2 Jul); C then A (1 Jul, C added later); E then B (30 Jun).
    const entries = frozenState(
      addSale("A", "2026-07-01", 1),
      addExpense("B", "2026-06-30", 2),
      addSale("C", "2026-07-01", 3),
      addExpense("D", "2026-07-02", 4),
      addSale("E", "2026-06-30", 5),
    ).entries;
    expect(ids(entriesNewestFirst(entries))).toStrictEqual(["D", "C", "A", "E", "B"]);
  });

  it("puts 1 Jan 2027 before 31 Dec 2026 and 1 Oct before 30 Sep", () => {
    const entries = frozenState(
      addSale("dec31", "2026-12-31", 1),
      addSale("sep30", "2026-09-30", 1),
      addSale("jan1", "2027-01-01", 1),
      addSale("oct1", "2026-10-01", 1),
    ).entries;
    expect(ids(entriesNewestFirst(entries))).toStrictEqual(["jan1", "dec31", "oct1", "sep30"]);
  });

  it("reverses insertion order for many entries on one day (a busy market day)", () => {
    const actions = Array.from({ length: 25 }, (_, i) => addSale(`s${i}`, TODAY, i));
    const entries = frozenState(...actions).entries;
    const expected = Array.from({ length: 25 }, (_, i) => `s${24 - i}`);
    expect(ids(entriesNewestFirst(entries))).toStrictEqual(expected);
  });

  it("uses the add order, not the edit order, for ties: A edited to 2 Jul still comes after D", () => {
    // A was added before D, so on the shared date 2 Jul, D (added later) is first.
    const state = frozenState(
      addSale("A", "2026-07-01", 1),
      addSale("D", "2026-07-02", 2),
    );
    const after = entriesReducer(state, { type: "edit", id: "A", changes: { date: "2026-07-02" } });
    expect(ids(entriesNewestFirst(after.entries))).toStrictEqual(["D", "A"]);
  });

  it("returns the full entries unchanged, only reordered", () => {
    const entries = frozenState(addSale("s1", "2026-06-30", 100), addExpense("e1", "2026-07-01", 200)).entries;
    expect(entriesNewestFirst(entries)).toStrictEqual([entries[1], entries[0]]);
  });

  it("does not reorder the list it was given", () => {
    const entries = frozenState(addSale("s1", "2026-06-30", 100), addSale("s2", "2026-07-01", 200)).entries;
    entriesNewestFirst(entries);
    expect(ids(entries)).toStrictEqual(["s1", "s2"]);
  });

  it("returns an empty list for no entries", () => {
    expect(entriesNewestFirst([])).toStrictEqual([]);
  });
});
