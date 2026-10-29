// Tests for the pretend-entries store logic in src/lib/entries.ts:
//   - T1.5 (docs/stages/stage-01.md "T1.5 — Pretend-data store and today's
//     date"): expenses, adding, editing, deleting, the totals, newest first;
//   - T1.10 ("Income entries and income streams (replacing 'sales')"): the
//     "sale" entry becomes an "income" entry with an income stream, a
//     required payment method and notes (owner's change of direction,
//     2026-10-25: the app tracks and organises income after the fact);
//   - T1.10b ("Event takings, stream tags on costs, event 'Other costs'"):
//     one action adds a day's event takings as two income rows (cash and
//     card); event & venue and operating costs can carry an income-stream
//     tag; each event can hold one "Other costs" figure. DECISIONS.md "Event
//     takings", "Linking costs to events and streams", "Event 'Other costs'".
//
// Written by test-engineer BEFORE the code. The builder must not edit this
// file; disputes go to the project lead.
//
// Rules: guide §6 (dates stay "YYYY-MM-DD" strings), §7 (money is integer
// minor units; every category belongs to exactly one group; event & venue
// costs prompt for an event but allow "not assigned yet"), §10 (income
// streams, payment methods, cash basis), owner decision "zero is allowed".
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
//     eventId: string | null;
//     streamId: string | null;           // T1.10b: an INCOME_STREAMS id or null
//     notes: string;                                                  // notes trimmed
//   };
//   export type IncomeEntry = {                                       (T1.10)
//     kind: "income"; id: string; date: string;
//     streamId: string;                  // an INCOME_STREAMS id (pretend-data.ts)
//     amountCents: number; paymentMethod: PaymentMethod;
//     eventId: string | null; notes: string;                          // notes trimmed
//   };
//   export type Entry = ExpenseEntry | IncomeEntry;
//   (SaleEntry and SaleInput are gone; there is no "sale" kind any more.)
//   export type OtherCosts = { amountCents: number; notes: string };  (T1.10b; "notes" since T1.10c)
//   export type EntriesState = {
//     entries: readonly Entry[];    // in insertion order
//     eventIds: readonly string[];  // the events entries may point at (decision 9)
//     otherCosts: Readonly<Record<string, OtherCosts>>;   // T1.10b, decision 14:
//                                   // a PLAIN OBJECT keyed by event id (not a Map)
//   };
//   export function createEntriesState(eventIds: readonly string[]): EntriesState
//     → { entries: [], eventIds: <a copy of eventIds>, otherCosts: {} }. Throws
//     RangeError for an empty or duplicate event id.
//
//   export type ExpenseInput = {
//     date: string; supplier?: string; amountCents: number; categoryId: string;
//     eventId?: string | null; streamId?: string | null; notes?: string;   // streamId: T1.10b
//   };
//   export type IncomeInput = {                                       (T1.10)
//     date: string; streamId: string; amountCents: number;
//     paymentMethod: PaymentMethod;      // REQUIRED: no default any more
//     eventId?: string | null; notes?: string;
//   };
//   export type EntriesAction =
//     | { type: "add-expense"; id: string; expense: ExpenseInput }
//     | { type: "add-income"; id: string; income: IncomeInput }        (T1.10)
//     | { type: "add-event-takings"; cashId: string; cardId: string;  (T1.10b)
//         takings: EventTakingsInput }
//     | { type: "edit"; id: string; changes: Partial<ExpenseInput> | Partial<IncomeInput> }
//     | { type: "delete"; id: string }
//     | { type: "set-event-other-costs"; eventId: string; amountCents: number; notes?: string } (T1.10b)
//     | { type: "clear-event-other-costs"; eventId: string };                                 (T1.10b)
//   export type EventTakingsInput = {                                 (T1.10b)
//     date: string; streamId: string; eventId?: string | null;   // missing → null
//     cashCents: number; cardCents: number; notes?: string;
//   };
//
//   export function entriesReducer(state: EntriesState, action: EntriesAction): EntriesState
//   export function totalsForDate(entries: readonly Entry[], date: string):
//     { salesCents: number; salesCount: number; expensesCents: number }
//     (T1.10: salesCents/salesCount now add up INCOME rows of every stream.
//     The names stay until T1.18 replaces Home's "today" wording.)
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
//     isIsoDate, unknown categories, unknown or missing income streams,
//     unknown or missing payment methods, unknown action types (including the
//     old "add-sale"), editing an id that doesn't exist, and any field that
//     isn't allowed for that kind of entry (see 4).
//  3. Delete of an id that isn't there returns the SAME state object, so a
//     double-tapped "undo" is harmless.
//  4. Only these fields may be given (when adding) or changed (when editing):
//       expense: date, supplier, amountCents, categoryId, eventId, streamId, notes
//       income:  date, streamId, amountCents, paymentMethod, eventId, notes
//       takings: date, streamId, eventId, cashCents, cardCents, notes (T1.10b)
//     `group` is never given: it is always looked up from the category in
//     DRAFT_CATEGORIES, also when an edit changes the category. Passing `group`,
//     `id`, `kind` or a field from the other kind throws RangeError.
//  5. Defaults: expense supplier → "", eventId → null, streamId → null, notes → "";
//     income eventId → null, notes → "". Income has NO default payment method
//     and no default stream (T1.10, lead): leaving either out throws.
//  6. Edit keeps the entry's place in insertion order (and its id and kind).
//  7. totalsForDate throws RangeError for a bad date, and when a total would
//     pass Number.MAX_SAFE_INTEGER cents (it can no longer be exact).
//  8. Newest first: later date first; on the same date, the entry added later
//     comes first. An edit doesn't count as "adding".
//  9. Events (lead's ruling, 2026-10-25, extended for T1.10). The state holds
//     the ids of the events entries may point at, set once by
//     createEntriesState. In Stage 1 that is pretendEvents(today)'s ids. The
//     rules, on add AND edit (checked on the entry as it would be after the
//     change):
//       - production and operating expenses: eventId must be null (guide §7:
//         not linked to events). So editing an event & venue expense that has
//         an event to a production category throws, unless the same edit also
//         sets eventId: null;
//       - event & venue expenses: null ("not assigned yet") or a known event id;
//       - income in the streams "sales-at-events" and "vendor-shelf-rental":
//         null or a known event id;
//       - income in any other stream: eventId must be null. So editing an
//         income that has an event to another stream throws, unless the same
//         edit also sets eventId: null (the same style as the expense rule).
//     Anything else (an unknown id, "") throws RangeError. The reducer only
//     knows event ids, not event types, so it doesn't check that the event's
//     usual stream matches the income's stream (DECISION, test engineer; see
//     the test "links a vendor-shelf-rental income to the market").
// 10. Supplier is optional. Supplier and notes (expense AND income) are
//     stored trimmed (String.prototype.trim); empty after trimming is allowed.
//     A supplier or notes value that isn't a string throws RangeError.
// 11. Income streams (T1.10): streamId must be exactly one of the INCOME_STREAMS
//     ids (pretend-data.test.ts pins them). A stream's display name ("Online
//     sales"), "" or null is not an id and throws RangeError.
//
// T1.10b — LEAD'S DECISIONS (2026-10-26), with the T1.10c review changes
// (decisions 15 and 16, and "note" renamed to "notes" in 14):
// 12. Event takings: "add-event-takings" adds EXACTLY TWO income rows, in this
//     order: cash first (id cashId, paymentMethod "cash", amount cashCents),
//     then card (id cardId, paymentMethod "card", amount cardCents). Both share
//     date, streamId, eventId and notes (trimmed; missing → ""). BOTH ROWS ARE
//     ALWAYS SAVED, EVEN WHEN AN AMOUNT IS 0 (owner, "Event takings").
//     streamId is required and must be one of STREAMS_WITH_EVENTS
//     ("sales-at-events", "vendor-shelf-rental"); the form pre-fills it from the
//     event's usual stream, the store doesn't look that up. eventId is
//     optional: missing or null means "not assigned yet" (lead, 2026-10-26);
//     otherwise it must be a known event. Both ids must be new and differ
//     from each other. ALL OR NOTHING: if anything is wrong, RangeError and
//     neither row is added. Afterwards each row is an ordinary income entry:
//     edit and delete work on one row at a time (no grouping id in Stage 1).
//     Test engineer's reading: the takings object may hold only the six fields
//     in decision 4 (anything else, e.g. paymentMethod, is refused).
// 13. Expense stream tag: streamId is null or a known INCOME_STREAMS id, and
//     may be non-null only for event & venue and operating costs (the
//     category's group). A production cost with a stream is a RangeError on
//     add AND edit; edits are checked after merging, so moving a tagged cost to
//     a production category is refused unless the same edit sets
//     streamId: null (and eventId: null, if it has an event: the event rule is
//     unchanged). Explicit undefined in an edit is refused, as for every field.
//     Any stream may tag an event & venue or operating cost; nothing ties it to
//     an event's usual stream.
// 14. Event "Other costs": state.otherCosts maps event id → { amountCents, notes }
//     and starts empty. "set-event-other-costs" sets or replaces one event's
//     figure: the event must be in the state's event list, the amount is whole
//     cents of 0 or more (the same check as entries), the notes are optional and
//     stored trimmed ("" when missing, also when replacing: "set" replaces the
//     whole figure). The field is "notes", plural like every other input (lead,
//     T1.10c review); the action may hold ONLY type, eventId, amountCents and
//     notes, so the old "note" or any other key is a RangeError.
//     "clear-event-other-costs" removes it; clearing an event that has none
//     returns the VERY SAME state object (like deleting a missing id), but an
//     unknown event id is a RangeError. Other costs are never entries, so totalsForDate and
//     entriesNewestFirst never see them, and every other action keeps them as
//     they were. The reducer stays pure: the old state never changes.
//     Test engineer's reading: otherCosts is a plain object (so it compares
//     with toStrictEqual and copies with JSON), and notes that aren't a string
//     are a RangeError, like expense notes.
// 15. Every action keeps the other figures EXACTLY (toStrictEqual), except
//     the set/clear of that same event (T1.10c review).
// 16. Plain objects only (T1.10c review). Every input object — expense,
//     income and takings input, and edit changes — must be a plain object: its
//     prototype is Object.prototype, or null (Object.create(null)). Anything
//     else is a RangeError: e.g. Object.create({ date, amountCents, ... })
//     would otherwise smuggle in fields that the "only these fields" check
//     (decision 4) never sees, because they're inherited, not the object's own.
//     (Test engineer's call, allowed by the lead: null-prototype objects pass,
//     since they can't inherit anything.)
//
// Every expected value was worked out by hand (sums written in the comments).
// None comes from the code under test.

import { describe, expect, it } from "vitest";
import {
  addCents,
  entriesNewestFirst,
  entriesReducer,
  createEntriesState,
  PAYMENT_METHODS,
  totalsForDate,
  type EntriesAction,
  type EntriesState,
  type Entry,
  type EventTakingsInput,
  type IncomeInput,
  subtractCents,
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

// The seven income stream ids (lead's decision; pinned in pretend-data.test.ts).
const SALES_AT_EVENTS = "sales-at-events";
const ONLINE_SALES = "online-sales";
const WHOLESALE = "wholesale";
const COMMISSIONS = "commissions";
const VENDOR_SHELF = "vendor-shelf-rental";
const SOCIAL_MEDIA = "social-media";
const SUBSCRIPTIONS = "subscription-income";
const ALL_STREAMS = [SALES_AT_EVENTS, ONLINE_SALES, WHOLESALE, COMMISSIONS, VENDOR_SHELF, SOCIAL_MEDIA, SUBSCRIPTIONS];
/** The only streams whose income may be linked to an event (decision 9). */
const STREAMS_WITH_EVENTS = [SALES_AT_EVENTS, VENDOR_SHELF];
/** The other five: their income is never linked to an event. */
const STREAMS_WITHOUT_EVENTS = [ONLINE_SALES, WHOLESALE, COMMISSIONS, SOCIAL_MEDIA, SUBSCRIPTIONS];

const TODAY = "2026-07-01";
/** The pretend events' ids (pretend-data.test.ts pins them and proves they're stable). */
const EVENT_IDS: readonly string[] = deepFreeze(pretendEvents(TODAY).map((e) => e.id));
const MARKET = "pretend-event-todays-market"; // today's market
const CONVENTION = "pretend-event-comic-con"; // a finished 3-day convention
const SHELF = "pretend-event-shelf"; // an ongoing shelf rental
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

/**
 * An add-income action. Unless `extra` says otherwise: stream Sales at events,
 * paid in cash, no event, no notes.
 */
const addIncome = (id: string, date: string, amountCents: number, extra: Partial<IncomeInput> = {}): EntriesAction => ({
  type: "add-income",
  id,
  income: { date, streamId: SALES_AT_EVENTS, amountCents, paymentMethod: "cash", ...extra },
});

/** The income entry the store should hold, written out by hand with the same defaults as addIncome. */
const incomeRow = (
  id: string,
  date: string,
  amountCents: number,
  extra: { streamId?: string; paymentMethod?: string; eventId?: string | null; notes?: string } = {},
) => ({
  kind: "income",
  id,
  date,
  streamId: SALES_AT_EVENTS,
  amountCents,
  paymentMethod: "cash",
  eventId: null,
  notes: "",
  ...extra,
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
    expect(createEntriesState(EVENT_IDS)).toStrictEqual({ entries: [], eventIds: [...EVENT_IDS], otherCosts: {} });
  });

  it("starts with no entries and no events when given none", () => {
    expect(createEntriesState([])).toStrictEqual({ entries: [], eventIds: [], otherCosts: {} });
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

  it("the pretend events used below are the three T1.10 events", () => {
    expect([...EVENT_IDS].sort()).toStrictEqual([CONVENTION, SHELF, MARKET].sort());
  });
});

// ─── Adding expenses (unchanged by T1.10) ───────────────────────────────────

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
      otherCosts: {},
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
          streamId: null,
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
      streamId: null,
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
        eventId: MARKET,
      },
    });
    expect(state.entries[0]).toMatchObject({ group: "event_venue", eventId: MARKET });
  });

  it("links an event & venue expense (shelf rent) to the ongoing shelf", () => {
    const state = run({
      type: "add-expense",
      id: "e1",
      expense: { date: TODAY, supplier: "Gallery", amountCents: 5000, categoryId: categoryId("Vendor shelf rent"), eventId: SHELF },
    });
    expect(state.entries[0]).toMatchObject({ group: "event_venue", eventId: SHELF });
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
    const state = run(addIncome("i1", TODAY, 100), addExpense("e1", "2026-06-01", 200), addIncome("i2", "2026-05-01", 300));
    expect(ids(state.entries)).toStrictEqual(["i1", "e1", "i2"]);
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

  it("throws RangeError when an income-only field (paymentMethod) is passed to add-expense", () => {
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

// ─── Adding income (T1.10) ──────────────────────────────────────────────────

describe("add-income", () => {
  it("stores an income with only the required fields, with no event and empty notes", () => {
    const state = run({
      type: "add-income",
      id: "i1",
      income: { date: TODAY, streamId: ONLINE_SALES, amountCents: 2000, paymentMethod: "online" },
    });
    expect(state).toStrictEqual({
      eventIds: [...EVENT_IDS],
      otherCosts: {},
      entries: [
        {
          kind: "income",
          id: "i1",
          date: TODAY,
          streamId: ONLINE_SALES,
          amountCents: 2000,
          paymentMethod: "online",
          eventId: null,
          notes: "",
        },
      ],
    });
  });

  it("stores every field exactly when all are given", () => {
    const state = run({
      type: "add-income",
      id: "i1",
      income: {
        date: TODAY,
        streamId: SALES_AT_EVENTS,
        amountCents: 4550,
        paymentMethod: "card",
        eventId: MARKET,
        notes: "Day 1 card takings",
      },
    });
    expect(state.entries[0]).toStrictEqual({
      kind: "income",
      id: "i1",
      date: TODAY,
      streamId: SALES_AT_EVENTS,
      amountCents: 4550,
      paymentMethod: "card",
      eventId: MARKET,
      notes: "Day 1 card takings",
    });
  });

  for (const streamId of ALL_STREAMS) {
    it(`accepts the stream ${streamId} and stores its id`, () => {
      expect(run(addIncome("i1", TODAY, 100, { streamId })).entries[0]).toStrictEqual(
        incomeRow("i1", TODAY, 100, { streamId }),
      );
    });
  }

  for (const method of ["cash", "card", "online", "bank_transfer", "other"] as const) {
    it(`accepts payment method ${method}`, () => {
      expect(run(addIncome("i1", TODAY, 100, { paymentMethod: method })).entries[0]).toMatchObject({
        paymentMethod: method,
      });
    });
  }

  it("allows a zero-amount income (owner decision)", () => {
    expect(run(addIncome("i1", TODAY, 0)).entries[0]).toStrictEqual(incomeRow("i1", TODAY, 0));
  });

  it("allows the largest exact amount, Number.MAX_SAFE_INTEGER cents", () => {
    expect(run(addIncome("i1", TODAY, Number.MAX_SAFE_INTEGER)).entries[0]).toMatchObject({
      amountCents: 9007199254740991,
    });
  });

  it("never stores the old kind \"sale\"", () => {
    expect(run(addIncome("i1", TODAY, 100)).entries[0].kind).toBe("income");
  });

  it("throws RangeError when the payment method is left out (no default to cash any more)", () => {
    expect(() =>
      run({
        type: "add-income",
        id: "i1",
        // @ts-expect-error -- paymentMethod is required for income
        income: { date: TODAY, streamId: SALES_AT_EVENTS, amountCents: 100 },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when the payment method is explicitly undefined (required, so no default)", () => {
    expect(() =>
      run({
        type: "add-income",
        id: "i1",
        income: { date: TODAY, streamId: SALES_AT_EVENTS, amountCents: 100, paymentMethod: undefined as unknown as "cash" },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError for an unknown payment method", () => {
    expect(() =>
      run({
        type: "add-income",
        id: "i1",
        // @ts-expect-error -- not one of PAYMENT_METHODS
        income: { date: TODAY, streamId: SALES_AT_EVENTS, amountCents: 100, paymentMethod: "bitcoin" },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError for a payment method's label (\"Cash\") instead of its id (\"cash\")", () => {
    expect(() =>
      run({
        type: "add-income",
        id: "i1",
        // @ts-expect-error -- "Cash" is what a screen shows, not a PaymentMethod
        income: { date: TODAY, streamId: SALES_AT_EVENTS, amountCents: 100, paymentMethod: "Cash" },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when the stream is left out", () => {
    expect(() =>
      run({
        type: "add-income",
        id: "i1",
        // @ts-expect-error -- streamId is required
        income: { date: TODAY, amountCents: 100, paymentMethod: "cash" },
      }),
    ).toThrow(RangeError);
  });

  const badStreams: Array<[unknown, string]> = [
    ["etsy", "not one of the seven streams"],
    ["Online sales", "a stream's name, not its id"],
    ["Online-Sales", "ids are exact, lowercase"],
    [" online-sales", "a space in front"],
    ["sales", "the old entry kind is not a stream"],
    ["", "empty"],
    [null, "null"],
    [undefined, "explicitly undefined"],
    [1, "a number"],
  ];
  for (const [streamId, why] of badStreams) {
    it(`throws RangeError for the stream ${JSON.stringify(streamId) ?? "undefined"} (${why})`, () => {
      expect(() => run(addIncome("i1", TODAY, 100, { streamId: streamId as string }))).toThrow(RangeError);
    });
  }

  it("throws RangeError when an expense-only field (categoryId) is passed to add-income", () => {
    expect(() =>
      run({
        type: "add-income",
        id: "i1",
        // @ts-expect-error -- income has no category
        income: { date: TODAY, streamId: SALES_AT_EVENTS, amountCents: 100, paymentMethod: "cash", categoryId: PRINTING },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when an expense-only field (supplier) is passed to add-income", () => {
    expect(() =>
      run({
        type: "add-income",
        id: "i1",
        // @ts-expect-error -- income has no supplier
        income: { date: TODAY, streamId: SALES_AT_EVENTS, amountCents: 100, paymentMethod: "cash", supplier: "Etsy" },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when a kind is passed in", () => {
    expect(() =>
      run({
        type: "add-income",
        id: "i1",
        // @ts-expect-error -- the kind is set by the action, never given
        income: { date: TODAY, streamId: SALES_AT_EVENTS, amountCents: 100, paymentMethod: "cash", kind: "expense" },
      }),
    ).toThrow(RangeError);
  });

  it("throws RangeError for the old action \"add-sale\" and leaves the state as it was", () => {
    const before = frozenState(addExpense("e0", TODAY, 100));
    const copy = snapshot(before);
    const oldAction ={ type: "add-sale", id: "s1", sale: { date: TODAY, amountCents: 100 } } as unknown as EntriesAction;
    expect(() => entriesReducer(before, oldAction)).toThrow(RangeError);
    expect(before).toStrictEqual(copy);
  });

  it("throws RangeError for \"add-sale\" even when it carries a complete, valid income (it isn't an alias)", () => {
    const valid = { date: TODAY, streamId: SALES_AT_EVENTS, amountCents: 100, paymentMethod: "cash" };
    const oldAction = { type: "add-sale", id: "s1", sale: valid, income: valid } as unknown as EntriesAction;
    expect(() => run(oldAction)).toThrow(RangeError);
  });
});

// ─── Rejecting bad amounts, dates and ids (both kinds) ──────────────────────

describe("rejects bad amounts with RangeError and leaves the state untouched", () => {
  const badAmounts: Array<[unknown, string]> = [
    [10.5, "not a whole number of cents"],
    [0.1, "a fraction of a cent"],
    [-1, "negative"],
    [-500, "negative"],
    [-0, "negative zero: Number.isSafeInteger(-0) is true and -0 < 0 is false, so it needs its own check"],
    [Number.MAX_SAFE_INTEGER + 1, "above MAX_SAFE_INTEGER, no longer exact"],
    [Number.NaN, "NaN"],
    [Number.POSITIVE_INFINITY, "Infinity"],
    ["1000", "a string, not a number"],
    [null, "null"],
    [undefined, "missing"],
  ];

  /** Like String(), but shows -0 as "-0" (String(-0) is "0"). */
  const show = (amount: unknown) => (Object.is(amount, -0) ? "-0" : String(amount));

  for (const [amount, why] of badAmounts) {
    it(`add-income rejects amountCents ${show(amount)} (${why})`, () => {
      const before = frozenState(addIncome("i0", TODAY, 100));
      const copy = snapshot(before);
      expect(() => entriesReducer(before, addIncome("i1", TODAY, amount as number))).toThrow(RangeError);
      expect(before).toStrictEqual(copy);
    });

    it(`add-expense rejects amountCents ${show(amount)} (${why})`, () => {
      const before = frozenState(addIncome("i0", TODAY, 100));
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

    it(`edit of an income rejects amountCents ${show(amount)} (${why})`, () => {
      const before = frozenState(addIncome("i1", TODAY, 100));
      const copy = snapshot(before);
      expect(() => entriesReducer(before, { type: "edit", id: "i1", changes: { amountCents: amount as number } })).toThrow(
        RangeError,
      );
      expect(before).toStrictEqual(copy);
    });

    it(`edit of an expense rejects amountCents ${show(amount)} (${why})`, () => {
      const before = frozenState(addExpense("e1", TODAY, 100));
      const copy = snapshot(before);
      expect(() => entriesReducer(before, { type: "edit", id: "e1", changes: { amountCents: amount as number } })).toThrow(
        RangeError,
      );
      expect(before).toStrictEqual(copy);
    });
  }
});

describe("rejects bad dates with RangeError", () => {
  const badDates = ["2026-02-30", "2026-02-29", "2026-7-1", "01/07/2026", "2026-07-01T09:00:00+10:00", ""];

  for (const date of badDates) {
    it(`add-income rejects date ${JSON.stringify(date)}`, () => {
      expect(() => run(addIncome("i1", date, 100))).toThrow(RangeError);
    });

    it(`add-expense rejects date ${JSON.stringify(date)}`, () => {
      expect(() => run(addExpense("e1", date, 100))).toThrow(RangeError);
    });

    it(`edit of an expense rejects date ${JSON.stringify(date)}`, () => {
      const before = frozenState(addExpense("e1", TODAY, 100));
      expect(() => entriesReducer(before, { type: "edit", id: "e1", changes: { date } })).toThrow(RangeError);
    });

    it(`edit of an income rejects date ${JSON.stringify(date)}`, () => {
      const before = frozenState(addIncome("i1", TODAY, 100));
      expect(() => entriesReducer(before, { type: "edit", id: "i1", changes: { date } })).toThrow(RangeError);
    });
  }

  it("rejects a Date object instead of a YYYY-MM-DD string", () => {
    const aMoment = new Date(Date.UTC(2026, 6, 1)) as unknown as string;
    expect(() => run(addIncome("i1", aMoment, 100))).toThrow(RangeError);
  });

  it("accepts a leap day in a leap year", () => {
    expect(run(addIncome("i1", "2028-02-29", 100)).entries[0]).toMatchObject({ date: "2028-02-29" });
  });
});

describe("ids", () => {
  it("throws RangeError when adding an income with an id that already exists", () => {
    const before = frozenState(addIncome("x", TODAY, 100));
    expect(() => entriesReducer(before, addIncome("x", TODAY, 200))).toThrow(RangeError);
  });

  it("throws RangeError when adding an expense with an id an income already uses", () => {
    const before = frozenState(addIncome("x", TODAY, 100));
    expect(() => entriesReducer(before, addExpense("x", TODAY, 200))).toThrow(RangeError);
  });

  it("throws RangeError when adding an income with an id an expense already uses", () => {
    const before = frozenState(addExpense("x", TODAY, 100));
    expect(() => entriesReducer(before, addIncome("x", TODAY, 200))).toThrow(RangeError);
  });

  it("throws RangeError for an empty id", () => {
    expect(() => run(addIncome("", TODAY, 100))).toThrow(RangeError);
  });

  it("throws RangeError for an unknown action type", () => {
    expect(() =>
      entriesReducer(frozenState(), { type: "explode", id: "s1" } as unknown as EntriesAction),
    ).toThrow(RangeError);
  });
});

// ─── Editing ────────────────────────────────────────────────────────────────

describe("edit", () => {
  // i1: online sale paid online, with notes. e1: production expense. i2: commission by bank transfer.
  const start = () =>
    frozenState(
      addIncome("i1", TODAY, 1000, { streamId: ONLINE_SALES, paymentMethod: "online", notes: "Etsy order 1182" }),
      {
        type: "add-expense",
        id: "e1",
        expense: { date: TODAY, supplier: "Officeworks", amountCents: 11000, categoryId: PRINTING, notes: "A3 prints" },
      },
      addIncome("i2", TODAY, 3000, { streamId: COMMISSIONS, paymentMethod: "bank_transfer" }),
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
      streamId: null,
      notes: "A3 prints",
    });
  });

  it("leaves the other entries exactly as they were", () => {
    const after = entriesReducer(start(), { type: "edit", id: "e1", changes: { amountCents: 12345 } });
    expect(after.entries[0]).toStrictEqual(
      incomeRow("i1", TODAY, 1000, { streamId: ONLINE_SALES, paymentMethod: "online", notes: "Etsy order 1182" }),
    );
    expect(after.entries[2]).toStrictEqual(
      incomeRow("i2", TODAY, 3000, { streamId: COMMISSIONS, paymentMethod: "bank_transfer" }),
    );
  });

  it("keeps the edited entry in its place (insertion order)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "e1", changes: { date: "2026-01-15" } });
    expect(ids(after.entries)).toStrictEqual(["i1", "e1", "i2"]);
  });

  it("changes an income's amount, keeping its stream, payment method and notes", () => {
    const after = entriesReducer(start(), { type: "edit", id: "i1", changes: { amountCents: 1250 } });
    expect(after.entries[0]).toStrictEqual(
      incomeRow("i1", TODAY, 1250, { streamId: ONLINE_SALES, paymentMethod: "online", notes: "Etsy order 1182" }),
    );
  });

  it("changes an income's payment method, keeping its amount", () => {
    const after = entriesReducer(start(), { type: "edit", id: "i2", changes: { paymentMethod: "card" } });
    expect(after.entries[2]).toStrictEqual(incomeRow("i2", TODAY, 3000, { streamId: COMMISSIONS, paymentMethod: "card" }));
  });

  it("changes an income's stream (commissions → wholesale), keeping everything else", () => {
    const after = entriesReducer(start(), { type: "edit", id: "i2", changes: { streamId: WHOLESALE } });
    expect(after.entries[2]).toStrictEqual(
      incomeRow("i2", TODAY, 3000, { streamId: WHOLESALE, paymentMethod: "bank_transfer" }),
    );
  });

  it("changes an income's date", () => {
    const after = entriesReducer(start(), { type: "edit", id: "i2", changes: { date: "2026-06-30" } });
    expect(after.entries[2]).toMatchObject({ id: "i2", date: "2026-06-30" });
  });

  it("re-derives the group when the category changes (production → event & venue)", () => {
    const after = entriesReducer(start(), {
      type: "edit",
      id: "e1",
      changes: { categoryId: STALL_FEES, eventId: MARKET },
    });
    expect(after.entries[1]).toMatchObject({ categoryId: STALL_FEES, group: "event_venue", eventId: MARKET });
  });

  it("re-derives the group when the category changes (production → operating)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "e1", changes: { categoryId: SOFTWARE } });
    expect(after.entries[1]).toMatchObject({ categoryId: SOFTWARE, group: "operating" });
  });

  it("can set an event & venue expense back to 'not assigned yet'", () => {
    const linked = entriesReducer(start(), {
      type: "edit",
      id: "e1",
      changes: { categoryId: STALL_FEES, eventId: MARKET },
    });
    const after = entriesReducer(deepFreeze(linked), { type: "edit", id: "e1", changes: { eventId: null } });
    expect(after.entries[1]).toMatchObject({ group: "event_venue", eventId: null });
  });

  it("throws RangeError when editing to an unknown category", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "e1", changes: { categoryId: "nope" } })).toThrow(
      RangeError,
    );
  });

  it("throws RangeError when editing an income to an unknown stream", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "i1", changes: { streamId: "etsy" } })).toThrow(RangeError);
  });

  it("throws RangeError when editing an income's stream to a stream's name instead of its id", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "i1", changes: { streamId: "Wholesale" } })).toThrow(
      RangeError,
    );
  });

  it("throws RangeError when editing an income to an unknown payment method", () => {
    expect(() =>
      // @ts-expect-error -- not one of PAYMENT_METHODS
      entriesReducer(start(), { type: "edit", id: "i1", changes: { paymentMethod: "cheque" } }),
    ).toThrow(RangeError);
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

  it("throws RangeError when an edit tries to turn an income into an expense", () => {
    expect(() =>
      // @ts-expect-error -- kind can't be edited
      entriesReducer(start(), { type: "edit", id: "i1", changes: { kind: "expense" } }),
    ).toThrow(RangeError);
  });

  it("throws RangeError when an edit gives an income a category", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "i1", changes: { categoryId: PRINTING } })).toThrow(
      RangeError,
    );
  });

  it("throws RangeError when an edit gives an income a supplier", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "i1", changes: { supplier: "Etsy" } })).toThrow(RangeError);
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

  it("does not change the state it was given (expense edit)", () => {
    const before = start();
    const copy = snapshot(before);
    entriesReducer(before, { type: "edit", id: "e1", changes: { amountCents: 1, categoryId: SOFTWARE } });
    expect(before).toStrictEqual(copy);
  });

  it("does not change the state it was given (income edit)", () => {
    const before = start();
    const copy = snapshot(before);
    entriesReducer(before, { type: "edit", id: "i1", changes: { amountCents: 1, streamId: WHOLESALE } });
    expect(before).toStrictEqual(copy);
  });
});

// ─── Deleting ───────────────────────────────────────────────────────────────

describe("delete", () => {
  const start = () =>
    frozenState(addIncome("i1", TODAY, 1000), addExpense("e1", TODAY, 2000), addIncome("i2", TODAY, 3000));

  it("removes only the target entry and keeps the others in order", () => {
    const after = entriesReducer(start(), { type: "delete", id: "e1" });
    expect(after).toStrictEqual({
      eventIds: [...EVENT_IDS],
      otherCosts: {},
      entries: [incomeRow("i1", TODAY, 1000), incomeRow("i2", TODAY, 3000)],
    });
  });

  it("removes the last-added income", () => {
    const after = entriesReducer(start(), { type: "delete", id: "i2" });
    expect(ids(after.entries)).toStrictEqual(["i1", "e1"]);
  });

  it("returns the very same state object when the id isn't there (a double-tapped undo is harmless)", () => {
    const before = start();
    expect(entriesReducer(before, { type: "delete", id: "missing" })).toBe(before);
  });

  it("does not change the state it was given", () => {
    const before = start();
    const copy = snapshot(before);
    entriesReducer(before, { type: "delete", id: "i1" });
    expect(before).toStrictEqual(copy);
  });
});

describe("adding never changes the state it was given", () => {
  it("add-income returns a new state and leaves the old one as it was", () => {
    const before = frozenState(addIncome("i1", TODAY, 1000));
    const copy = snapshot(before);
    const after = entriesReducer(before, addIncome("i2", TODAY, 500));
    expect(before).toStrictEqual(copy);
    expect(ids(after.entries)).toStrictEqual(["i1", "i2"]);
  });

  it("add-expense returns a new state and leaves the old one as it was", () => {
    const before = frozenState(addIncome("i1", TODAY, 1000));
    const copy = snapshot(before);
    const after = entriesReducer(before, addExpense("e1", TODAY, 500));
    expect(before).toStrictEqual(copy);
    expect(ids(after.entries)).toStrictEqual(["i1", "e1"]);
  });
});

// ─── Which entries may point at an event (decision 9) ───────────────────────

describe("events on add: expenses (unchanged by T1.10)", () => {
  const expenseWith = (categoryId: string, eventId: string | null): EntriesAction => ({
    type: "add-expense",
    id: "e1",
    expense: { date: TODAY, supplier: "S", amountCents: 100, categoryId, eventId },
  });

  it("throws RangeError for a production expense linked to an event", () => {
    expect(() => run(expenseWith(PRINTING, MARKET))).toThrow(RangeError);
  });

  it("throws RangeError for an operating expense linked to an event", () => {
    expect(() => run(expenseWith(SOFTWARE, MARKET))).toThrow(RangeError);
  });

  it("throws RangeError for a production expense with eventId \"\" (only null means no event)", () => {
    expect(() => run(expenseWith(PRINTING, ""))).toThrow(RangeError);
  });

  it("stores a production expense with eventId null", () => {
    expect(run(expenseWith(PRINTING, null)).entries[0]).toMatchObject({ group: "production", eventId: null });
  });

  it("links an event & venue expense to another known pretend event (the convention)", () => {
    expect(run(expenseWith(STALL_FEES, CONVENTION)).entries[0]).toMatchObject({
      group: "event_venue",
      eventId: CONVENTION,
      streamId: null,
    });
  });

  it("throws RangeError for an event & venue expense linked to an unknown event", () => {
    expect(() => run(expenseWith(STALL_FEES, UNKNOWN_EVENT_ID))).toThrow(RangeError);
  });

  it("throws RangeError for an event & venue expense with eventId \"\"", () => {
    expect(() => run(expenseWith(STALL_FEES, ""))).toThrow(RangeError);
  });
});

describe("events on add: income only for Sales at events and Vendor shelf rental (T1.10)", () => {
  const incomeWith = (streamId: string, eventId: string | null): EntriesAction =>
    addIncome("i1", TODAY, 100, { streamId, eventId });

  it("links a Sales at events income to today's market", () => {
    expect(run(incomeWith(SALES_AT_EVENTS, MARKET)).entries[0]).toStrictEqual(
      incomeRow("i1", TODAY, 100, { streamId: SALES_AT_EVENTS, eventId: MARKET }),
    );
  });

  it("links a Sales at events income to the finished convention (entered after the fact)", () => {
    expect(run(incomeWith(SALES_AT_EVENTS, CONVENTION)).entries[0]).toMatchObject({ eventId: CONVENTION });
  });

  it("links a Vendor shelf rental income to the shelf", () => {
    expect(run(incomeWith(VENDOR_SHELF, SHELF)).entries[0]).toStrictEqual(
      incomeRow("i1", TODAY, 100, { streamId: VENDOR_SHELF, eventId: SHELF }),
    );
  });

  it("links a Vendor shelf rental income to the market too (the reducer only knows event ids, decision 9)", () => {
    expect(run(incomeWith(VENDOR_SHELF, MARKET)).entries[0]).toMatchObject({ streamId: VENDOR_SHELF, eventId: MARKET });
  });

  for (const streamId of STREAMS_WITH_EVENTS) {
    it(`stores a ${streamId} income with no event (eventId null)`, () => {
      expect(run(incomeWith(streamId, null)).entries[0]).toMatchObject({ streamId, eventId: null });
    });

    it(`throws RangeError for a ${streamId} income linked to an unknown event`, () => {
      expect(() => run(incomeWith(streamId, UNKNOWN_EVENT_ID))).toThrow(RangeError);
    });

    it(`throws RangeError for a ${streamId} income with eventId "" (only null means no event)`, () => {
      expect(() => run(incomeWith(streamId, ""))).toThrow(RangeError);
    });
  }

  for (const streamId of STREAMS_WITHOUT_EVENTS) {
    it(`throws RangeError for a ${streamId} income linked to today's market`, () => {
      expect(() => run(incomeWith(streamId, MARKET))).toThrow(RangeError);
    });

    it(`throws RangeError for a ${streamId} income linked to the shelf`, () => {
      expect(() => run(incomeWith(streamId, SHELF))).toThrow(RangeError);
    });

    it(`stores a ${streamId} income with eventId null`, () => {
      expect(run(incomeWith(streamId, null)).entries[0]).toStrictEqual(incomeRow("i1", TODAY, 100, { streamId }));
    });
  }

  it("leaves the state exactly as it was after refusing an Online sales income with an event", () => {
    const before = frozenState(addIncome("i0", TODAY, 100));
    const copy = snapshot(before);
    expect(() => entriesReducer(before, incomeWith(ONLINE_SALES, MARKET))).toThrow(RangeError);
    expect(before).toStrictEqual(copy);
  });

  it("checks against the state's own event list: with no events, a pretend event id is unknown", () => {
    const noEvents = deepFreeze(createEntriesState([]));
    expect(() => entriesReducer(noEvents, incomeWith(SALES_AT_EVENTS, MARKET))).toThrow(RangeError);
  });

  it("with no events, an income with eventId null is still fine", () => {
    const noEvents = deepFreeze(createEntriesState([]));
    expect(entriesReducer(noEvents, incomeWith(SALES_AT_EVENTS, null)).entries[0]).toMatchObject({ eventId: null });
  });

  it("accepts an event id that is in the state's list even if it isn't a pretend event", () => {
    const custom = deepFreeze(createEntriesState(["ev-custom"]));
    expect(entriesReducer(custom, incomeWith(SALES_AT_EVENTS, "ev-custom")).entries[0]).toMatchObject({
      eventId: "ev-custom",
    });
  });
});

describe("events on edit: the rules apply to the entry as it would be after the change", () => {
  // e1: production, no event. v1: event & venue, linked to today's market.
  // m1: Sales at events income at today's market. o1: Online sales income, no event.
  const start = () =>
    frozenState(
      addExpense("e1", TODAY, 1000),
      {
        type: "add-expense",
        id: "v1",
        expense: { date: TODAY, supplier: "Craft Fair Co", amountCents: 8000, categoryId: STALL_FEES, eventId: MARKET },
      },
      addIncome("m1", TODAY, 500, { streamId: SALES_AT_EVENTS, paymentMethod: "card", eventId: MARKET }),
      addIncome("o1", TODAY, 2599, { streamId: ONLINE_SALES, paymentMethod: "online" }),
    );

  it("throws RangeError when a production expense is given an event", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "e1", changes: { eventId: MARKET } })).toThrow(
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
      streamId: null,
      notes: "",
    });
  });

  it("keeps the event when moving to another event & venue category (Stall fees → Flights)", () => {
    const flights = categoryId("Flights");
    const after = entriesReducer(start(), { type: "edit", id: "v1", changes: { categoryId: flights } });
    expect(after.entries[1]).toMatchObject({ categoryId: flights, group: "event_venue", eventId: MARKET });
  });

  it("moves an event & venue expense to another known event", () => {
    const after = entriesReducer(start(), { type: "edit", id: "v1", changes: { eventId: CONVENTION } });
    expect(after.entries[1]).toMatchObject({ eventId: CONVENTION });
  });

  it("throws RangeError when an event & venue expense is moved to an unknown event", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "v1", changes: { eventId: UNKNOWN_EVENT_ID } })).toThrow(
      RangeError,
    );
  });

  it("moves a Sales at events income to another known event (market → convention)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "m1", changes: { eventId: CONVENTION } });
    expect(after.entries[2]).toStrictEqual(
      incomeRow("m1", TODAY, 500, { streamId: SALES_AT_EVENTS, paymentMethod: "card", eventId: CONVENTION }),
    );
  });

  it("throws RangeError when a Sales at events income is edited to an unknown event", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "m1", changes: { eventId: UNKNOWN_EVENT_ID } })).toThrow(
      RangeError,
    );
  });

  it("keeps the event when an income moves between the two event streams (Sales at events → Vendor shelf rental)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "m1", changes: { streamId: VENDOR_SHELF } });
    expect(after.entries[2]).toStrictEqual(
      incomeRow("m1", TODAY, 500, { streamId: VENDOR_SHELF, paymentMethod: "card", eventId: MARKET }),
    );
  });

  for (const streamId of STREAMS_WITHOUT_EVENTS) {
    it(`throws RangeError when an income with an event moves to ${streamId} and keeps the event`, () => {
      expect(() => entriesReducer(start(), { type: "edit", id: "m1", changes: { streamId } })).toThrow(RangeError);
    });
  }

  it("allows the move to Online sales when the same edit clears the event", () => {
    const after = entriesReducer(start(), { type: "edit", id: "m1", changes: { streamId: ONLINE_SALES, eventId: null } });
    expect(after.entries[2]).toStrictEqual(
      incomeRow("m1", TODAY, 500, { streamId: ONLINE_SALES, paymentMethod: "card", eventId: null }),
    );
  });

  it("throws RangeError when an Online sales income is given an event", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "o1", changes: { eventId: MARKET } })).toThrow(RangeError);
  });

  it("allows giving an Online sales income an event when the same edit moves it to Sales at events", () => {
    const after = entriesReducer(start(), {
      type: "edit",
      id: "o1",
      changes: { streamId: SALES_AT_EVENTS, eventId: CONVENTION },
    });
    expect(after.entries[3]).toStrictEqual(
      incomeRow("o1", TODAY, 2599, { streamId: SALES_AT_EVENTS, paymentMethod: "online", eventId: CONVENTION }),
    );
  });

  it("can set a Sales at events income back to no event", () => {
    const after = entriesReducer(start(), { type: "edit", id: "m1", changes: { eventId: null } });
    expect(after.entries[2]).toMatchObject({ streamId: SALES_AT_EVENTS, eventId: null });
  });

  it("leaves the state exactly as it was after a rejected expense event edit", () => {
    const before = start();
    const copy = snapshot(before);
    expect(() => entriesReducer(before, { type: "edit", id: "v1", changes: { categoryId: PRINTING } })).toThrow(
      RangeError,
    );
    expect(before).toStrictEqual(copy);
  });

  it("leaves the state exactly as it was after a rejected income stream edit", () => {
    const before = start();
    const copy = snapshot(before);
    expect(() => entriesReducer(before, { type: "edit", id: "m1", changes: { streamId: WHOLESALE } })).toThrow(
      RangeError,
    );
    expect(before).toStrictEqual(copy);
  });

  it("never changes the state's event list", () => {
    const after = entriesReducer(start(), { type: "edit", id: "v1", changes: { eventId: CONVENTION } });
    expect(after.eventIds).toStrictEqual([...EVENT_IDS]);
  });
});

// ─── Supplier and notes (decision 10) ───────────────────────────────────────

describe("supplier and notes are optional and stored trimmed (expenses)", () => {
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
      streamId: null,
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

describe("income notes are optional and stored trimmed, the same rules as expense notes (T1.10)", () => {
  const withNotes = (notes: unknown): EntriesAction => addIncome("i1", TODAY, 100, { notes: notes as string });

  it("stores missing notes as \"\"", () => {
    expect(run(addIncome("i1", TODAY, 100)).entries[0]).toMatchObject({ notes: "" });
  });

  it("trims the notes: \"  Day 2, rain  \\n\" → \"Day 2, rain\"", () => {
    expect(run(withNotes("  Day 2, rain  \n")).entries[0]).toMatchObject({ notes: "Day 2, rain" });
  });

  it("keeps spaces inside the notes: \" Etsy  order 7 \" → \"Etsy  order 7\"", () => {
    expect(run(withNotes(" Etsy  order 7 ")).entries[0]).toMatchObject({ notes: "Etsy  order 7" });
  });

  it("stores whitespace-only notes as \"\"", () => {
    expect(run(withNotes("\t ")).entries[0]).toMatchObject({ notes: "" });
  });

  it("trims notes changed by an edit: \" deposit 1 of 2 \" → \"deposit 1 of 2\"", () => {
    const before = frozenState(addIncome("i1", TODAY, 100, { streamId: COMMISSIONS, paymentMethod: "bank_transfer" }));
    const after = entriesReducer(before, { type: "edit", id: "i1", changes: { notes: " deposit 1 of 2 " } });
    expect(after.entries[0]).toStrictEqual(
      incomeRow("i1", TODAY, 100, { streamId: COMMISSIONS, paymentMethod: "bank_transfer", notes: "deposit 1 of 2" }),
    );
  });

  it("throws RangeError for notes that aren't a string (42)", () => {
    expect(() => run(withNotes(42))).toThrow(RangeError);
  });

  it("throws RangeError for notes that aren't a string (null)", () => {
    expect(() => run(withNotes(null))).toThrow(RangeError);
  });
});

// ─── Explicit undefined (lead's ruling, review follow-up) ────────────────────
//
// On edit, leave a field out to keep it; use null to clear the event. A field
// set to explicit `undefined` is a bug in the caller, so it throws RangeError
// and the state is unchanged. On add, an OPTIONAL field set to `undefined`
// just gets its default, exactly as if it were left out (and no key holding
// `undefined` is stored: toStrictEqual checks that). Income's payment method
// and stream are required, so `undefined` there throws (see add-income).

describe("explicit undefined: rejected on edit, a default on add", () => {
  const start = () =>
    frozenState(
      {
        type: "add-expense",
        id: "v1",
        expense: { date: TODAY, supplier: "Craft Fair Co", amountCents: 8000, categoryId: STALL_FEES, eventId: MARKET, notes: "Table 12" },
      },
      addIncome("i1", TODAY, 500, { paymentMethod: "card", eventId: MARKET, notes: "Day 1" }),
    );

  for (const field of ["date", "supplier", "amountCents", "categoryId", "eventId", "streamId", "notes"] as const) {
    it(`edit of an expense throws RangeError for ${field}: undefined and leaves the state unchanged`, () => {
      const before = start();
      const copy = snapshot(before);
      expect(() => entriesReducer(before, { type: "edit", id: "v1", changes: { [field]: undefined } })).toThrow(
        RangeError,
      );
      expect(before).toStrictEqual(copy);
    });
  }

  for (const field of ["date", "streamId", "amountCents", "paymentMethod", "eventId", "notes"] as const) {
    it(`edit of an income throws RangeError for ${field}: undefined and leaves the state unchanged`, () => {
      const before = start();
      const copy = snapshot(before);
      expect(() => entriesReducer(before, { type: "edit", id: "i1", changes: { [field]: undefined } })).toThrow(
        RangeError,
      );
      expect(before).toStrictEqual(copy);
    });
  }

  it("edit with eventId: null (not undefined) still clears the event", () => {
    const after = entriesReducer(start(), { type: "edit", id: "i1", changes: { eventId: null } });
    expect(after.entries[1]).toStrictEqual(incomeRow("i1", TODAY, 500, { paymentMethod: "card", notes: "Day 1" }));
  });

  it("add-expense with supplier, eventId, streamId and notes all undefined stores the defaults \"\", null, null and \"\"", () => {
    const state = run({
      type: "add-expense",
      id: "e1",
      expense: { date: TODAY, supplier: undefined, amountCents: 100, categoryId: PRINTING, eventId: undefined, streamId: undefined, notes: undefined },
    });
    expect(state.entries[0]).toStrictEqual({
      kind: "expense",
      id: "e1",
      date: TODAY,
      supplier: "",
      amountCents: 100,
      categoryId: PRINTING,
      group: "production",
      eventId: null,
      streamId: null,
      notes: "",
    });
  });

  it("add-income with eventId and notes undefined stores the defaults null and \"\"", () => {
    const state = run({
      type: "add-income",
      id: "i1",
      income: { date: TODAY, streamId: WHOLESALE, amountCents: 100, paymentMethod: "bank_transfer", eventId: undefined, notes: undefined },
    });
    expect(state.entries[0]).toStrictEqual({
      kind: "income",
      id: "i1",
      date: TODAY,
      streamId: WHOLESALE,
      amountCents: 100,
      paymentMethod: "bank_transfer",
      eventId: null,
      notes: "",
    });
  });
});

// ─── Totals for a day ───────────────────────────────────────────────────────

describe("totalsForDate (income rows count where sales did)", () => {
  // Hand-checked dataset, income from several streams. On 2026-07-01:
  //   income    i1 1500 (Sales at events, market) + i2 0 (Online sales)
  //             + i4 2250 (Commissions) + i6 3333 (Vendor shelf rental, shelf)
  //             + i7 17 (Social media)
  //             = 1500 + 0 = 1500; + 2250 = 3750; + 3333 = 7083; + 17 = 7100
  //             cents from 5 income rows (the 0 counts)
  //   expenses  e1 4000 + e3 1234 = 5234 cents
  // On 2026-06-30: i3 99999 (Wholesale) and e2 50000.
  // On 2026-07-02: i5 700 (Subscription income), no expenses.
  const dataset = () =>
    frozenState(
      addIncome("i1", "2026-07-01", 1500, { eventId: MARKET }),
      addIncome("i2", "2026-07-01", 0, { streamId: ONLINE_SALES, paymentMethod: "online" }),
      addExpense("e1", "2026-07-01", 4000),
      addIncome("i3", "2026-06-30", 99999, { streamId: WHOLESALE, paymentMethod: "bank_transfer" }),
      addIncome("i4", "2026-07-01", 2250, { streamId: COMMISSIONS, paymentMethod: "card" }),
      addExpense("e2", "2026-06-30", 50000),
      addIncome("i5", "2026-07-02", 700, { streamId: SUBSCRIPTIONS, paymentMethod: "online" }),
      {
        type: "add-expense",
        id: "e3",
        expense: { date: "2026-07-01", supplier: "Craft Fair Co", amountCents: 1234, categoryId: STALL_FEES },
      },
      addIncome("i6", "2026-07-01", 3333, { streamId: VENDOR_SHELF, paymentMethod: "bank_transfer", eventId: SHELF }),
      addIncome("i7", "2026-07-01", 17, { streamId: SOCIAL_MEDIA, paymentMethod: "other" }),
    ).entries;

  it("sums the day's income from every stream and the expenses, counting the zero-amount income (7100 from 5; 5234)", () => {
    expect(totalsForDate(dataset(), "2026-07-01")).toStrictEqual({
      salesCents: 7100,
      salesCount: 5,
      expensesCents: 5234,
    });
  });

  it("excludes other dates: 30 June has only its own income and expense", () => {
    expect(totalsForDate(dataset(), "2026-06-30")).toStrictEqual({
      salesCents: 99999,
      salesCount: 1,
      expensesCents: 50000,
    });
  });

  it("excludes other dates: 2 July has one income and no expenses", () => {
    expect(totalsForDate(dataset(), "2026-07-02")).toStrictEqual({
      salesCents: 700,
      salesCount: 1,
      expensesCents: 0,
    });
  });

  it("counts every one of the seven streams: 1 + 10 + 100 + 1000 + 10000 + 100000 + 1000000 = 1111111 from 7", () => {
    // One income per stream, each a different power of ten, so a stream left
    // out would show as a missing digit 1 in the total.
    const entries = frozenState(
      ...ALL_STREAMS.map((streamId, i) => addIncome(`i${i}`, TODAY, 10 ** i, { streamId })),
    ).entries;
    expect(totalsForDate(entries, TODAY)).toStrictEqual({ salesCents: 1111111, salesCount: 7, expensesCents: 0 });
  });

  it("is all zeros for a day with no entries", () => {
    expect(totalsForDate(dataset(), "2026-07-03")).toStrictEqual({ salesCents: 0, salesCount: 0, expensesCents: 0 });
  });

  it("is all zeros with no entries at all", () => {
    expect(totalsForDate([], "2026-07-01")).toStrictEqual({ salesCents: 0, salesCount: 0, expensesCents: 0 });
  });

  it("counts a day with only a zero income as 1 income row of 0 cents", () => {
    const entries = frozenState(addIncome("i1", TODAY, 0)).entries;
    expect(totalsForDate(entries, TODAY)).toStrictEqual({ salesCents: 0, salesCount: 1, expensesCents: 0 });
  });

  it("updates after a delete: removing i4 (2250) leaves 7100 − 2250 = 4850 from 4", () => {
    const after = entriesReducer(deepFreeze({ ...createEntriesState(EVENT_IDS), entries: dataset() }), { type: "delete", id: "i4" });
    expect(totalsForDate(after.entries, "2026-07-01")).toStrictEqual({
      salesCents: 4850,
      salesCount: 4,
      expensesCents: 5234,
    });
  });

  it("updates after an edit: i1 1500 → 1999 gives 7100 + 499 = 7599", () => {
    const after = entriesReducer(deepFreeze({ ...createEntriesState(EVENT_IDS), entries: dataset() }), {
      type: "edit",
      id: "i1",
      changes: { amountCents: 1999 },
    });
    expect(totalsForDate(after.entries, "2026-07-01")).toStrictEqual({
      salesCents: 7599,
      salesCount: 5,
      expensesCents: 5234,
    });
  });

  it("an income's stream change doesn't change the day's total: i4 Commissions → Wholesale is still 7100 from 5", () => {
    const after = entriesReducer(deepFreeze({ ...createEntriesState(EVENT_IDS), entries: dataset() }), {
      type: "edit",
      id: "i4",
      changes: { streamId: WHOLESALE },
    });
    expect(totalsForDate(after.entries, "2026-07-01")).toStrictEqual({
      salesCents: 7100,
      salesCount: 5,
      expensesCents: 5234,
    });
  });

  it("moves an entry between days when its date is edited: e1 (4000) to 30 June", () => {
    const after = entriesReducer(deepFreeze({ ...createEntriesState(EVENT_IDS), entries: dataset() }), {
      type: "edit",
      id: "e1",
      changes: { date: "2026-06-30" },
    });
    // 1 July expenses: 1234. 30 June expenses: 50000 + 4000 = 54000.
    expect(totalsForDate(after.entries, "2026-07-01").expensesCents).toBe(1234);
    expect(totalsForDate(after.entries, "2026-06-30").expensesCents).toBe(54000);
  });

  it("moves an income between days when its date is edited: i6 (3333) to 30 June", () => {
    const after = entriesReducer(deepFreeze({ ...createEntriesState(EVENT_IDS), entries: dataset() }), {
      type: "edit",
      id: "i6",
      changes: { date: "2026-06-30" },
    });
    // 1 July: 7100 − 3333 = 3767 from 4. 30 June: 99999 + 3333 = 103332 from 2.
    expect(totalsForDate(after.entries, "2026-07-01")).toStrictEqual({ salesCents: 3767, salesCount: 4, expensesCents: 5234 });
    expect(totalsForDate(after.entries, "2026-06-30")).toStrictEqual({ salesCents: 103332, salesCount: 2, expensesCents: 50000 });
  });

  it("is exact right up to MAX_SAFE_INTEGER: 4503599627370495 + 4503599627370496 = 9007199254740991", () => {
    const entries = frozenState(addIncome("i1", TODAY, 4503599627370495), addIncome("i2", TODAY, 4503599627370496)).entries;
    expect(totalsForDate(entries, TODAY)).toStrictEqual({
      salesCents: 9007199254740991,
      salesCount: 2,
      expensesCents: 0,
    });
  });

  it("throws RangeError when the day's income would pass MAX_SAFE_INTEGER (no longer exact)", () => {
    const entries = frozenState(addIncome("i1", TODAY, Number.MAX_SAFE_INTEGER), addIncome("i2", TODAY, 1)).entries;
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
      addIncome("A", "2026-07-01", 1),
      addExpense("B", "2026-06-30", 2),
      addIncome("C", "2026-07-01", 3, { streamId: ONLINE_SALES, paymentMethod: "online" }),
      addExpense("D", "2026-07-02", 4),
      addIncome("E", "2026-06-30", 5, { streamId: COMMISSIONS, paymentMethod: "card" }),
    ).entries;
    expect(ids(entriesNewestFirst(entries))).toStrictEqual(["D", "C", "A", "E", "B"]);
  });

  it("puts 1 Jan 2027 before 31 Dec 2026 and 1 Oct before 30 Sep", () => {
    const entries = frozenState(
      addIncome("dec31", "2026-12-31", 1),
      addIncome("sep30", "2026-09-30", 1),
      addIncome("jan1", "2027-01-01", 1),
      addIncome("oct1", "2026-10-01", 1),
    ).entries;
    expect(ids(entriesNewestFirst(entries))).toStrictEqual(["jan1", "dec31", "oct1", "sep30"]);
  });

  it("reverses insertion order for many entries on one day", () => {
    const actions = Array.from({ length: 25 }, (_, i) => addIncome(`i${i}`, TODAY, i));
    const entries = frozenState(...actions).entries;
    const expected = Array.from({ length: 25 }, (_, i) => `i${24 - i}`);
    expect(ids(entriesNewestFirst(entries))).toStrictEqual(expected);
  });

  it("uses the add order, not the edit order, for ties: A edited to 2 Jul still comes after D", () => {
    // A was added before D, so on the shared date 2 Jul, D (added later) is first.
    const state = frozenState(
      addIncome("A", "2026-07-01", 1),
      addIncome("D", "2026-07-02", 2),
    );
    const after = entriesReducer(state, { type: "edit", id: "A", changes: { date: "2026-07-02" } });
    expect(ids(entriesNewestFirst(after.entries))).toStrictEqual(["D", "A"]);
  });

  it("returns the full entries unchanged, only reordered", () => {
    const entries = frozenState(addIncome("i1", "2026-06-30", 100), addExpense("e1", "2026-07-01", 200)).entries;
    expect(entriesNewestFirst(entries)).toStrictEqual([entries[1], entries[0]]);
  });

  it("does not reorder the list it was given", () => {
    const entries = frozenState(addIncome("i1", "2026-06-30", 100), addIncome("i2", "2026-07-01", 200)).entries;
    entriesNewestFirst(entries);
    expect(ids(entries)).toStrictEqual(["i1", "i2"]);
  });

  it("returns an empty list for no entries", () => {
    expect(entriesNewestFirst([])).toStrictEqual([]);
  });
});

// ═══ T1.10b ═════════════════════════════════════════════════════════════════

// ─── Event takings: one day, two income rows (decision 12) ──────────────────
//
// The owner's example (DECISIONS.md "What the app is for"): a 3-day convention
// took $1,000, $2,000 and $1,500. With TODAY = 2026-07-01 the pretend
// convention runs 2026-06-22 to 2026-06-24 (today − 9 to today − 7,
// pretend-data.test.ts). Split by hand into cash and card:
//   day 1, 22 Jun: cash 40000 + card  60000 = 100000 cents ($1,000)
//   day 2, 23 Jun: cash 50000 + card 150000 = 200000 cents ($2,000)
//   day 3, 24 Jun: cash     0 + card 150000 = 150000 cents ($1,500; no cash that day)

/** An add-event-takings action. Unless `extra` says otherwise: day 1 of the convention, Sales at events. */
const addTakings = (cashId: string, cardId: string, extra: Partial<EventTakingsInput> = {}): EntriesAction => ({
  type: "add-event-takings",
  cashId,
  cardId,
  takings: {
    date: "2026-06-22",
    streamId: SALES_AT_EVENTS,
    eventId: CONVENTION,
    cashCents: 40000,
    cardCents: 60000,
    ...extra,
  },
});

/** The same action with any takings object at all (for refused inputs). */
const addRawTakings = (cashId: unknown, cardId: unknown, takings: unknown): EntriesAction =>
  ({ type: "add-event-takings", cashId, cardId, takings }) as unknown as EntriesAction;

const DAY_1 = { date: "2026-06-22", streamId: SALES_AT_EVENTS, eventId: CONVENTION, cashCents: 40000, cardCents: 60000 };

describe("add-event-takings: two rows, cash then card (T1.10b, decision 12)", () => {
  it("adds exactly two income rows, cash first then card, sharing date, stream, event and trimmed notes", () => {
    const state = run(addTakings("c1", "k1", { notes: "  Day 1, busy  " }));
    expect(state).toStrictEqual({
      eventIds: [...EVENT_IDS],
      otherCosts: {},
      entries: [
        {
          kind: "income",
          id: "c1",
          date: "2026-06-22",
          streamId: SALES_AT_EVENTS,
          amountCents: 40000,
          paymentMethod: "cash",
          eventId: CONVENTION,
          notes: "Day 1, busy",
        },
        {
          kind: "income",
          id: "k1",
          date: "2026-06-22",
          streamId: SALES_AT_EVENTS,
          amountCents: 60000,
          paymentMethod: "card",
          eventId: CONVENTION,
          notes: "Day 1, busy",
        },
      ],
    });
  });

  it("adds the two rows after the entries already there", () => {
    const state = run(addExpense("e0", TODAY, 100), addTakings("c1", "k1"));
    expect(ids(state.entries)).toStrictEqual(["e0", "c1", "k1"]);
  });

  it("stores missing notes as \"\" on both rows", () => {
    const [cash, card] = run(addTakings("c1", "k1")).entries;
    expect([cash.notes, card.notes]).toStrictEqual(["", ""]);
  });

  it("stores whitespace-only notes as \"\" on both rows", () => {
    const [cash, card] = run(addTakings("c1", "k1", { notes: " \t\n" })).entries;
    expect([cash.notes, card.notes]).toStrictEqual(["", ""]);
  });

  it("saves BOTH rows when there was no cash: day 3 is cash 0 and card 150000", () => {
    const state = run(addTakings("c3", "k3", { date: "2026-06-24", cashCents: 0, cardCents: 150000 }));
    expect(state.entries).toStrictEqual([
      incomeRow("c3", "2026-06-24", 0, { paymentMethod: "cash", eventId: CONVENTION }),
      incomeRow("k3", "2026-06-24", 150000, { paymentMethod: "card", eventId: CONVENTION }),
    ]);
  });

  it("saves BOTH rows when there was no card: cash 2500 and card 0", () => {
    const state = run(addTakings("c1", "k1", { cashCents: 2500, cardCents: 0 }));
    expect(state.entries).toStrictEqual([
      incomeRow("c1", "2026-06-22", 2500, { paymentMethod: "cash", eventId: CONVENTION }),
      incomeRow("k1", "2026-06-22", 0, { paymentMethod: "card", eventId: CONVENTION }),
    ]);
  });

  it("saves BOTH rows even when both are 0 (a day with no takings)", () => {
    const state = run(addTakings("c1", "k1", { cashCents: 0, cardCents: 0 }));
    expect(state.entries).toStrictEqual([
      incomeRow("c1", "2026-06-22", 0, { paymentMethod: "cash", eventId: CONVENTION }),
      incomeRow("k1", "2026-06-22", 0, { paymentMethod: "card", eventId: CONVENTION }),
    ]);
  });

  it("allows the largest exact amounts, Number.MAX_SAFE_INTEGER cents in each row", () => {
    const state = run(addTakings("c1", "k1", { cashCents: Number.MAX_SAFE_INTEGER, cardCents: Number.MAX_SAFE_INTEGER }));
    expect(state.entries.map((e) => e.amountCents)).toStrictEqual([9007199254740991, 9007199254740991]);
  });

  it("takes the Vendor shelf rental stream for the shelf", () => {
    const state = run(addTakings("c1", "k1", { streamId: VENDOR_SHELF, eventId: SHELF, cashCents: 0, cardCents: 8800 }));
    expect(state.entries).toStrictEqual([
      incomeRow("c1", "2026-06-22", 0, { streamId: VENDOR_SHELF, paymentMethod: "cash", eventId: SHELF }),
      incomeRow("k1", "2026-06-22", 8800, { streamId: VENDOR_SHELF, paymentMethod: "card", eventId: SHELF }),
    ]);
  });

  it("allows eventId null (\"not assigned yet\") on both rows", () => {
    const state = run(addTakings("c1", "k1", { eventId: null }));
    expect(state.entries).toStrictEqual([
      incomeRow("c1", "2026-06-22", 40000, { paymentMethod: "cash" }),
      incomeRow("k1", "2026-06-22", 60000, { paymentMethod: "card" }),
    ]);
  });

  it("treats a missing eventId as null (\"not assigned yet\") on both rows", () => {
    const noEvent: Record<string, unknown> = { ...DAY_1 };
    delete noEvent.eventId;
    const state = run(addRawTakings("c1", "k1", noEvent));
    expect(state.entries).toStrictEqual([
      incomeRow("c1", "2026-06-22", 40000, { paymentMethod: "cash" }),
      incomeRow("k1", "2026-06-22", 60000, { paymentMethod: "card" }),
    ]);
  });

  it("doesn't change the state it was given", () => {
    const before = frozenState(addExpense("e0", TODAY, 100));
    const copy = snapshot(before);
    entriesReducer(before, addTakings("c1", "k1"));
    expect(before).toStrictEqual(copy);
  });
});

describe("add-event-takings: all or nothing — RangeError and no row added (decision 12)", () => {
  /** Runs one refused takings action against a frozen state and checks nothing changed. */
  const expectRefused = (action: EntriesAction) => {
    const before = frozenState(addExpense("e0", TODAY, 100), addIncome("used", TODAY, 100));
    const copy = snapshot(before);
    expect(() => entriesReducer(before, action)).toThrow(RangeError);
    expect(before).toStrictEqual(copy);
  };

  for (const streamId of STREAMS_WITHOUT_EVENTS) {
    it(`refuses the stream ${streamId}, even with no event (takings are only for the two event streams)`, () => {
      expectRefused(addTakings("c1", "k1", { streamId, eventId: null }));
    });
  }

  const badStreams: Array<[unknown, string]> = [
    ["etsy", "not a stream"],
    ["Sales at events", "a name, not an id"],
    ["", "empty"],
    [null, "null"],
  ];
  for (const [streamId, why] of badStreams) {
    it(`refuses the stream ${JSON.stringify(streamId)} (${why})`, () => {
      expectRefused(addRawTakings("c1", "k1", { ...DAY_1, streamId }));
    });
  }

  it("refuses takings with no stream (the store doesn't look up the event's usual stream)", () => {
    const noStream: Record<string, unknown> = { ...DAY_1 };
    delete noStream.streamId;
    expectRefused(addRawTakings("c1", "k1", noStream));
  });

  it("refuses an unknown event", () => {
    expectRefused(addTakings("c1", "k1", { eventId: UNKNOWN_EVENT_ID }));
  });

  it("refuses eventId \"\" (only null means no event)", () => {
    expectRefused(addTakings("c1", "k1", { eventId: "" }));
  });

  for (const date of ["2026-02-29", "2026-6-22", "22/06/2026", ""]) {
    it(`refuses the date ${JSON.stringify(date)}`, () => {
      expectRefused(addTakings("c1", "k1", { date }));
    });
  }

  const badAmounts: Array<[unknown, string]> = [
    [-1, "negative"],
    [-0, "negative zero"],
    [10.5, "a fraction of a cent"],
    [Number.MAX_SAFE_INTEGER + 1, "above MAX_SAFE_INTEGER"],
    [Number.NaN, "NaN"],
    ["40000", "a string"],
    [null, "null"],
    [undefined, "missing"],
  ];
  const show = (amount: unknown) => (Object.is(amount, -0) ? "-0" : String(amount));
  for (const [amount, why] of badAmounts) {
    it(`refuses cashCents ${show(amount)} (${why}), so the good card row isn't added either`, () => {
      expectRefused(addRawTakings("c1", "k1", { ...DAY_1, cashCents: amount }));
    });

    it(`refuses cardCents ${show(amount)} (${why}), so the good cash row isn't added either`, () => {
      expectRefused(addRawTakings("c1", "k1", { ...DAY_1, cardCents: amount }));
    });
  }

  it("refuses the same id for both rows", () => {
    expectRefused(addTakings("same", "same"));
  });

  it("refuses a cashId that is already used", () => {
    expectRefused(addTakings("used", "k1"));
  });

  it("refuses a cardId that is already used, so the cash row isn't added either", () => {
    expectRefused(addTakings("c1", "used"));
  });

  it("refuses an empty cashId", () => {
    expectRefused(addTakings("", "k1"));
  });

  it("refuses an empty cardId", () => {
    expectRefused(addTakings("c1", ""));
  });

  it("refuses a missing cardId", () => {
    expectRefused(addRawTakings("c1", undefined, DAY_1));
  });

  for (const field of ["paymentMethod", "amountCents", "categoryId", "supplier", "id"] as const) {
    it(`refuses an extra field ${field} in the takings`, () => {
      expectRefused(addRawTakings("c1", "k1", { ...DAY_1, [field]: field === "amountCents" ? 100 : "card" }));
    });
  }

  it("refuses notes that aren't text (42)", () => {
    expectRefused(addRawTakings("c1", "k1", { ...DAY_1, notes: 42 }));
  });

  it("refuses takings that aren't an object (null)", () => {
    expectRefused(addRawTakings("c1", "k1", null));
  });
});

describe("event takings rows are ordinary income entries afterwards (decision 12)", () => {
  const start = () => frozenState(addTakings("c1", "k1"), addTakings("c2", "k2", { date: "2026-06-23", cashCents: 50000, cardCents: 150000 }));

  it("an edit changes only the one row: day 1 card 60000 → 65000, its cash row stays 40000", () => {
    const after = entriesReducer(start(), { type: "edit", id: "k1", changes: { amountCents: 65000 } });
    expect(after.entries.slice(0, 2)).toStrictEqual([
      incomeRow("c1", "2026-06-22", 40000, { paymentMethod: "cash", eventId: CONVENTION }),
      incomeRow("k1", "2026-06-22", 65000, { paymentMethod: "card", eventId: CONVENTION }),
    ]);
  });

  it("a delete removes only the one row: deleting day 1's cash row keeps its card row", () => {
    const after = entriesReducer(start(), { type: "delete", id: "c1" });
    expect(ids(after.entries)).toStrictEqual(["k1", "c2", "k2"]);
  });

  it("the normal income rules still apply: moving a row with an event to Online sales is refused", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "c1", changes: { streamId: ONLINE_SALES } })).toThrow(
      RangeError,
    );
  });

  it("a row's payment method can be corrected like any income (cash → other)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "c2", changes: { paymentMethod: "other" } });
    expect(after.entries[2]).toStrictEqual(
      incomeRow("c2", "2026-06-23", 50000, { paymentMethod: "other", eventId: CONVENTION }),
    );
  });

  it("newest first: day 2 card, day 2 cash, day 1 card, day 1 cash", () => {
    expect(ids(entriesNewestFirst(start().entries))).toStrictEqual(["k2", "c2", "k1", "c1"]);
  });
});

describe("totalsForDate with event takings: both rows count (the owner's 3-day example)", () => {
  const convention = () =>
    frozenState(
      addTakings("c1", "k1"), // 22 Jun: 40000 + 60000
      addTakings("c2", "k2", { date: "2026-06-23", cashCents: 50000, cardCents: 150000 }),
      addTakings("c3", "k3", { date: "2026-06-24", cashCents: 0, cardCents: 150000 }),
    ).entries;

  it("day 1: 40000 + 60000 = 100000 cents ($1,000) from 2 rows", () => {
    expect(totalsForDate(convention(), "2026-06-22")).toStrictEqual({ salesCents: 100000, salesCount: 2, expensesCents: 0 });
  });

  it("day 2: 50000 + 150000 = 200000 cents ($2,000) from 2 rows", () => {
    expect(totalsForDate(convention(), "2026-06-23")).toStrictEqual({ salesCents: 200000, salesCount: 2, expensesCents: 0 });
  });

  it("day 3: 0 + 150000 = 150000 cents ($1,500) from 2 rows (the $0 cash row counts)", () => {
    expect(totalsForDate(convention(), "2026-06-24")).toStrictEqual({ salesCents: 150000, salesCount: 2, expensesCents: 0 });
  });
});

// ─── Stream tags on costs (decision 13) ─────────────────────────────────────

describe("expense stream tag on add: event & venue and operating only (T1.10b, decision 13)", () => {
  const expenseWith = (categoryId: string, streamId: unknown, eventId: string | null = null): EntriesAction => ({
    type: "add-expense",
    id: "e1",
    expense: { date: TODAY, supplier: "S", amountCents: 100, categoryId, eventId, streamId: streamId as string | null },
  });

  it("stores an operating cost tagged Online sales, every field exact", () => {
    const state = run({
      type: "add-expense",
      id: "e1",
      expense: { date: TODAY, supplier: "Etsy", amountCents: 1950, categoryId: categoryId("Payment fees"), streamId: ONLINE_SALES },
    });
    expect(state.entries[0]).toStrictEqual({
      kind: "expense",
      id: "e1",
      date: TODAY,
      supplier: "Etsy",
      amountCents: 1950,
      categoryId: categoryId("Payment fees"),
      group: "operating",
      eventId: null,
      streamId: ONLINE_SALES,
      notes: "",
    });
  });

  it("stores an event & venue cost with both an event and a stream (table at the convention)", () => {
    expect(run(expenseWith(STALL_FEES, SALES_AT_EVENTS, CONVENTION)).entries[0]).toMatchObject({
      group: "event_venue",
      eventId: CONVENTION,
      streamId: SALES_AT_EVENTS,
    });
  });

  it("allows any stream, even one that isn't the event's usual stream (market cost tagged Wholesale)", () => {
    expect(run(expenseWith(STALL_FEES, WHOLESALE, MARKET)).entries[0]).toMatchObject({ eventId: MARKET, streamId: WHOLESALE });
  });

  for (const streamId of ALL_STREAMS) {
    it(`allows the stream ${streamId} on an operating cost`, () => {
      expect(run(expenseWith(SOFTWARE, streamId)).entries[0]).toMatchObject({ group: "operating", streamId });
    });

    it(`refuses the stream ${streamId} on a production cost (production costs stay unlinked)`, () => {
      expect(() => run(expenseWith(PRINTING, streamId))).toThrow(RangeError);
    });
  }

  it("stores a production cost with streamId null", () => {
    expect(run(expenseWith(PRINTING, null)).entries[0]).toMatchObject({ group: "production", streamId: null });
  });

  it("stores a cost with no streamId given as streamId null", () => {
    expect(run(addExpense("e1", TODAY, 100)).entries[0]).toMatchObject({ streamId: null });
  });

  const badStreams: Array<[unknown, string]> = [
    ["etsy", "not a stream"],
    ["Online sales", "a name, not an id"],
    ["", "empty (only null means no stream)"],
    [1, "a number"],
  ];
  for (const [streamId, why] of badStreams) {
    it(`refuses the stream ${JSON.stringify(streamId)} on an operating cost (${why})`, () => {
      expect(() => run(expenseWith(SOFTWARE, streamId))).toThrow(RangeError);
    });
  }

  it("keeps the event rule: an operating cost with a stream still can't have an event", () => {
    expect(() => run(expenseWith(SOFTWARE, ONLINE_SALES, MARKET))).toThrow(RangeError);
  });
});

describe("expense stream tag on edit: checked on the entry after the change (decision 13)", () => {
  // o1: operating, tagged Online sales. v1: event & venue at the convention, tagged
  // Sales at events. p1: production, no tag.
  const start = () =>
    frozenState(
      {
        type: "add-expense",
        id: "o1",
        expense: { date: TODAY, supplier: "Etsy", amountCents: 1950, categoryId: SOFTWARE, streamId: ONLINE_SALES },
      },
      {
        type: "add-expense",
        id: "v1",
        expense: { date: TODAY, supplier: "Con HQ", amountCents: 50000, categoryId: STALL_FEES, eventId: CONVENTION, streamId: SALES_AT_EVENTS },
      },
      addExpense("p1", TODAY, 2350),
    );

  it("changes an operating cost's stream (Online sales → Commissions)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "o1", changes: { streamId: COMMISSIONS } });
    expect(after.entries[0]).toMatchObject({ streamId: COMMISSIONS });
  });

  it("clears a stream with streamId: null", () => {
    const after = entriesReducer(start(), { type: "edit", id: "o1", changes: { streamId: null } });
    expect(after.entries[0]).toMatchObject({ group: "operating", streamId: null });
  });

  it("refuses giving a production cost a stream", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "p1", changes: { streamId: ONLINE_SALES } })).toThrow(
      RangeError,
    );
  });

  it("refuses moving a tagged operating cost to a production category while it keeps its stream", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "o1", changes: { categoryId: PRINTING } })).toThrow(
      RangeError,
    );
  });

  it("allows that move when the same edit clears the stream", () => {
    const after = entriesReducer(start(), { type: "edit", id: "o1", changes: { categoryId: PRINTING, streamId: null } });
    expect(after.entries[0]).toStrictEqual({
      kind: "expense",
      id: "o1",
      date: TODAY,
      supplier: "Etsy",
      amountCents: 1950,
      categoryId: PRINTING,
      group: "production",
      eventId: null,
      streamId: null,
      notes: "",
    });
  });

  it("refuses moving a cost with an event and a stream to production when the edit clears only the stream", () => {
    expect(() =>
      entriesReducer(start(), { type: "edit", id: "v1", changes: { categoryId: PRINTING, streamId: null } }),
    ).toThrow(RangeError);
  });

  it("refuses moving a cost with an event and a stream to production when the edit clears only the event", () => {
    expect(() =>
      entriesReducer(start(), { type: "edit", id: "v1", changes: { categoryId: PRINTING, eventId: null } }),
    ).toThrow(RangeError);
  });

  it("allows moving it to production when the edit clears both", () => {
    const after = entriesReducer(start(), {
      type: "edit",
      id: "v1",
      changes: { categoryId: PRINTING, eventId: null, streamId: null },
    });
    expect(after.entries[1]).toMatchObject({ group: "production", eventId: null, streamId: null });
  });

  it("keeps the stream when an operating cost becomes an event & venue cost (Software → Stall fees)", () => {
    const after = entriesReducer(start(), { type: "edit", id: "o1", changes: { categoryId: STALL_FEES } });
    expect(after.entries[0]).toMatchObject({ group: "event_venue", eventId: null, streamId: ONLINE_SALES });
  });

  it("keeps the stream when an event & venue cost becomes operating and drops its event", () => {
    const after = entriesReducer(start(), { type: "edit", id: "v1", changes: { categoryId: SOFTWARE, eventId: null } });
    expect(after.entries[1]).toMatchObject({ group: "operating", eventId: null, streamId: SALES_AT_EVENTS });
  });

  it("refuses an edit to an unknown stream", () => {
    expect(() => entriesReducer(start(), { type: "edit", id: "o1", changes: { streamId: "etsy" } })).toThrow(RangeError);
  });

  it("leaves the state exactly as it was after a refused stream edit", () => {
    const before = start();
    const copy = snapshot(before);
    expect(() => entriesReducer(before, { type: "edit", id: "o1", changes: { categoryId: PRINTING } })).toThrow(
      RangeError,
    );
    expect(before).toStrictEqual(copy);
  });
});

// ─── Event "Other costs" (decision 14) ──────────────────────────────────────

/** A set-event-other-costs action. */
const setOther = (eventId: unknown, amountCents: unknown, notes?: unknown): EntriesAction =>
  (notes === undefined
    ? { type: "set-event-other-costs", eventId, amountCents }
    : { type: "set-event-other-costs", eventId, amountCents, notes }) as unknown as EntriesAction;

const clearOther = (eventId: unknown): EntriesAction =>
  ({ type: "clear-event-other-costs", eventId }) as unknown as EntriesAction;

describe("set-event-other-costs (T1.10b, decision 14)", () => {
  it("sets one event's figure with its notes trimmed, and nothing else changes", () => {
    const state = run(addExpense("e0", TODAY, 100), setOther(CONVENTION, 60000, "  Stock sold at the con "));
    expect(state).toStrictEqual({
      eventIds: [...EVENT_IDS],
      otherCosts: { [CONVENTION]: { amountCents: 60000, notes: "Stock sold at the con" } },
      entries: [
        {
          kind: "expense",
          id: "e0",
          date: TODAY,
          supplier: "Officeworks",
          amountCents: 100,
          categoryId: PRINTING,
          group: "production",
          eventId: null,
          streamId: null,
          notes: "",
        },
      ],
    });
  });

  it("stores missing notes as \"\"", () => {
    expect(run(setOther(MARKET, 1500)).otherCosts).toStrictEqual({ [MARKET]: { amountCents: 1500, notes: "" } });
  });

  it("stores whitespace-only notes as \"\"", () => {
    expect(run(setOther(MARKET, 1500, "  ")).otherCosts).toStrictEqual({ [MARKET]: { amountCents: 1500, notes: "" } });
  });

  it("allows 0 cents", () => {
    expect(run(setOther(SHELF, 0, "nothing sold")).otherCosts).toStrictEqual({ [SHELF]: { amountCents: 0, notes: "nothing sold" } });
  });

  it("replaces the figure when set again (60000 → 45000, new notes)", () => {
    const state = run(setOther(CONVENTION, 60000, "first guess"), setOther(CONVENTION, 45000, "recounted"));
    expect(state.otherCosts).toStrictEqual({ [CONVENTION]: { amountCents: 45000, notes: "recounted" } });
  });

  it("replacing without notes leaves the notes \"\" (not the old notes)", () => {
    const state = run(setOther(CONVENTION, 60000, "first guess"), setOther(CONVENTION, 45000));
    expect(state.otherCosts).toStrictEqual({ [CONVENTION]: { amountCents: 45000, notes: "" } });
  });

  it("keeps each event's figure separately", () => {
    const state = run(setOther(CONVENTION, 60000, "con stock"), setOther(SHELF, 12000, "shelf stock"));
    expect(state.otherCosts).toStrictEqual({
      [CONVENTION]: { amountCents: 60000, notes: "con stock" },
      [SHELF]: { amountCents: 12000, notes: "shelf stock" },
    });
  });

  it("doesn't change the state it was given (its otherCosts stay empty)", () => {
    const before = frozenState(addExpense("e0", TODAY, 100));
    const copy = snapshot(before);
    entriesReducer(before, setOther(CONVENTION, 60000, "x"));
    expect(before).toStrictEqual(copy);
  });

  it("doesn't change the earlier figure's state when replaced", () => {
    const first = frozenState(setOther(CONVENTION, 60000, "first"));
    entriesReducer(first, setOther(CONVENTION, 45000, "second"));
    expect(first.otherCosts).toStrictEqual({ [CONVENTION]: { amountCents: 60000, notes: "first" } });
  });

  const badAmounts: Array<[unknown, string]> = [
    [-1, "negative"],
    [-0, "negative zero"],
    [0.5, "half a cent"],
    [Number.MAX_SAFE_INTEGER + 1, "above MAX_SAFE_INTEGER"],
    [Number.POSITIVE_INFINITY, "Infinity"],
    ["600", "a string"],
    [null, "null"],
    [undefined, "missing"],
  ];
  const show = (amount: unknown) => (Object.is(amount, -0) ? "-0" : String(amount));
  for (const [amount, why] of badAmounts) {
    it(`refuses amountCents ${show(amount)} (${why}) and leaves the state as it was`, () => {
      const before = frozenState(setOther(CONVENTION, 60000, "kept"));
      const copy = snapshot(before);
      expect(() => entriesReducer(before, setOther(CONVENTION, amount, "new"))).toThrow(RangeError);
      expect(before).toStrictEqual(copy);
    });
  }

  for (const [eventId, why] of [
    [UNKNOWN_EVENT_ID, "an unknown event"],
    ["", "empty"],
    [null, "null"],
    ["Pretend comic convention", "the event's name, not its id"],
  ] as Array<[unknown, string]>) {
    it(`refuses ${JSON.stringify(eventId)} as the event (${why})`, () => {
      expect(() => run(setOther(eventId, 100))).toThrow(RangeError);
    });
  }

  it("checks against the state's own event list: with no events, a pretend event id is unknown", () => {
    expect(() => entriesReducer(deepFreeze(createEntriesState([])), setOther(CONVENTION, 100))).toThrow(RangeError);
  });

  it("refuses notes that aren't text (42)", () => {
    expect(() => run(setOther(CONVENTION, 100, 42))).toThrow(RangeError);
  });

  it("refuses the old field name \"note\" (it's \"notes\", like every other input), leaving the state as it was", () => {
    const before = frozenState(setOther(CONVENTION, 60000, "kept"));
    const copy = snapshot(before);
    const old = { type: "set-event-other-costs", eventId: CONVENTION, amountCents: 100, note: "x" } as unknown as EntriesAction;
    expect(() => entriesReducer(before, old)).toThrow(RangeError);
    expect(before).toStrictEqual(copy);
  });

  for (const [field, value] of [
    ["currency", "AUD"],
    ["date", "2026-06-22"],
    ["id", "x1"],
    ["streamId", "sales-at-events"],
  ] as Array<[string, unknown]>) {
    it(`refuses an extra field ${field} in the action (only type, eventId, amountCents and notes)`, () => {
      const action = { type: "set-event-other-costs", eventId: CONVENTION, amountCents: 100, [field]: value };
      expect(() => run(action as unknown as EntriesAction)).toThrow(RangeError);
    });
  }
});

describe("clear-event-other-costs (decision 14)", () => {
  const start = () => frozenState(setOther(CONVENTION, 60000, "con stock"), setOther(SHELF, 12000, "shelf stock"));

  it("removes only that event's figure", () => {
    const after = entriesReducer(start(), clearOther(CONVENTION));
    expect(after.otherCosts).toStrictEqual({ [SHELF]: { amountCents: 12000, notes: "shelf stock" } });
  });

  it("removing the last figure leaves otherCosts empty", () => {
    const after = entriesReducer(frozenState(setOther(MARKET, 100)), clearOther(MARKET));
    expect(after.otherCosts).toStrictEqual({});
  });

  it("clearing a known event that has no figure changes nothing", () => {
    const before = start();
    const copy = snapshot(before);
    expect(entriesReducer(before, clearOther(MARKET))).toStrictEqual(copy);
  });

  it("clearing a known event that has no figure hands back the very same state object", () => {
    const before = start();
    expect(entriesReducer(before, clearOther(MARKET))).toBe(before);
  });

  it("refuses an unknown event", () => {
    expect(() => entriesReducer(start(), clearOther(UNKNOWN_EVENT_ID))).toThrow(RangeError);
  });

  it("refuses an empty event id", () => {
    expect(() => entriesReducer(start(), clearOther(""))).toThrow(RangeError);
  });

  it("doesn't change the state it was given", () => {
    const before = start();
    const copy = snapshot(before);
    entriesReducer(before, clearOther(CONVENTION));
    expect(before).toStrictEqual(copy);
  });
});

describe("other costs are never entries and survive every other action (decision 14)", () => {
  // TODAY: takings cash 40000 + card 60000 = 100000 from 2 rows; table 50000.
  // The convention's other costs (60000) must never show up in any of these.
  const start = () =>
    frozenState(
      addTakings("c1", "k1", { date: TODAY }),
      {
        type: "add-expense",
        id: "v1",
        expense: { date: TODAY, supplier: "Con HQ", amountCents: 50000, categoryId: STALL_FEES, eventId: CONVENTION },
      },
      setOther(CONVENTION, 60000, "stock"),
    );
  const OTHER = { [CONVENTION]: { amountCents: 60000, notes: "stock" } };
  const OTHER_AND_SHELF = { ...OTHER, [SHELF]: { amountCents: 5, notes: "" } };

  it("totalsForDate ignores them: 100000 from 2 income rows, expenses 50000 (not 110000)", () => {
    expect(totalsForDate(start().entries, TODAY)).toStrictEqual({ salesCents: 100000, salesCount: 2, expensesCents: 50000 });
  });

  it("setting them adds no entry: still exactly c1, k1, v1", () => {
    expect(ids(start().entries)).toStrictEqual(["c1", "k1", "v1"]);
  });

  it("entriesNewestFirst lists only the 3 entries", () => {
    expect(ids(entriesNewestFirst(start().entries))).toStrictEqual(["v1", "k1", "c1"]);
  });

  // Decision 15: exactly the same figures afterwards (toStrictEqual), so an
  // action can't quietly add, drop or reshape a figure.
  const others: Array<[string, EntriesAction]> = [
    ["add-expense", addExpense("e9", TODAY, 1)],
    ["add-income", addIncome("i9", TODAY, 1)],
    ["add-event-takings", addTakings("c9", "k9")],
    ["edit", { type: "edit", id: "v1", changes: { amountCents: 50001 } }],
    ["delete", { type: "delete", id: "v1" }],
    ["clear for another event (which has no figure)", clearOther(MARKET)],
  ];
  for (const [name, action] of others) {
    it(`${name} keeps the other costs exactly as they were`, () => {
      expect(entriesReducer(start(), action).otherCosts).toStrictEqual(OTHER);
    });
  }

  it("set for another event keeps the convention's figure and adds only the shelf's", () => {
    expect(entriesReducer(start(), setOther(SHELF, 5)).otherCosts).toStrictEqual(OTHER_AND_SHELF);
  });

  it("deleting an entry linked to the event doesn't clear the event's other costs", () => {
    const after = entriesReducer(start(), { type: "delete", id: "v1" });
    expect(after.otherCosts).toStrictEqual(OTHER);
  });
});

// ─── Plain objects only (decision 16, T1.10c review) ────────────────────────

describe("inputs must be plain objects: inherited fields can't slip past the field check", () => {
  const EXPENSE = { date: TODAY, supplier: "Officeworks", amountCents: 2350, categoryId: PRINTING };
  const INCOME = { date: TODAY, streamId: ONLINE_SALES, amountCents: 2599, paymentMethod: "online" };
  const TAKINGS = { date: "2026-06-22", streamId: SALES_AT_EVENTS, cashCents: 40000, cardCents: 60000 };

  /** Checks a refused action leaves the state exactly as it was. */
  const expectRefused = (action: EntriesAction) => {
    const before = frozenState(addExpense("e0", TODAY, 100));
    const copy = snapshot(before);
    expect(() => entriesReducer(before, action)).toThrow(RangeError);
    expect(before).toStrictEqual(copy);
  };

  it("refuses an expense whose fields are all inherited (Object.create({...}))", () => {
    expectRefused({ type: "add-expense", id: "e1", expense: Object.create(EXPENSE) });
  });

  it("refuses an expense with its own valid fields but an inherited extra field (group)", () => {
    const sneaky = Object.assign(Object.create({ group: "operating" }), EXPENSE);
    expectRefused({ type: "add-expense", id: "e1", expense: sneaky });
  });

  it("refuses an income whose fields are all inherited", () => {
    expectRefused({ type: "add-income", id: "i1", income: Object.create(INCOME) });
  });

  it("refuses event takings whose fields are all inherited", () => {
    expectRefused({ type: "add-event-takings", cashId: "c1", cardId: "k1", takings: Object.create(TAKINGS) });
  });

  it("refuses edit changes whose fields are inherited (Object.create({ amountCents: 1 }))", () => {
    expectRefused({ type: "edit", id: "e0", changes: Object.create({ amountCents: 1 }) });
  });

  it("refuses an instance of a class, even with the right own fields", () => {
    class ExpenseLike {
      date = TODAY;
      supplier = "Officeworks";
      amountCents = 2350;
      categoryId = PRINTING;
    }
    expectRefused({ type: "add-expense", id: "e1", expense: new ExpenseLike() });
  });

  it("accepts an object with no prototype at all (Object.create(null)) holding valid fields", () => {
    const bare = Object.assign(Object.create(null), EXPENSE);
    expect(run({ type: "add-expense", id: "e1", expense: bare }).entries[0]).toStrictEqual({
      kind: "expense",
      id: "e1",
      date: TODAY,
      supplier: "Officeworks",
      amountCents: 2350,
      categoryId: PRINTING,
      group: "production",
      eventId: null,
      streamId: null,
      notes: "",
    });
  });

  it("accepts null-prototype edit changes too", () => {
    const after = entriesReducer(frozenState(addExpense("e0", TODAY, 100)), {
      type: "edit",
      id: "e0",
      changes: Object.assign(Object.create(null), { amountCents: 250 }),
    });
    expect(after.entries[0]).toMatchObject({ id: "e0", amountCents: 250 });
  });
});

// ─── addCents / subtractCents (T1.16 carry-over: direct unit tests) ─────────
//
// The exact whole-cent helpers every total goes through (T1.10c). Until now
// they were only tested through the totals. Contract (entries.ts):
//   addCents(a, b) = a + b, subtractCents(a, b) = a − b, for whole numbers of
//   cents of either sign; a RangeError when the answer would go past
//   ±Number.MAX_SAFE_INTEGER (9,007,199,254,740,991), and a RangeError when
//   either input isn't a safe integer (a fraction, NaN, ±Infinity, 2^53, or
//   not a number at all). Expected values are written out by hand.

describe("addCents", () => {
  const MAX = Number.MAX_SAFE_INTEGER;

  it.each([
    [2, 3, 5],
    [-2, 3, 1],
    [2, -3, -1],
    [-2, -3, -5],
    [0, 0, 0],
    [123450, 50, 123500],
  ])("addCents(%d, %d) is %d", (a, b, sum) => {
    expect(addCents(a, b)).toBe(sum);
  });

  it("reaches exactly MAX_SAFE_INTEGER: (MAX − 1) + 1 = 9007199254740991", () => {
    expect(addCents(MAX - 1, 1)).toBe(9007199254740991);
  });

  it("reaches exactly −MAX_SAFE_INTEGER: (−MAX + 1) + (−1) = −9007199254740991", () => {
    expect(addCents(-MAX + 1, -1)).toBe(-9007199254740991);
  });

  it("MAX + (−MAX) = 0, and MAX + 0 = MAX", () => {
    expect(addCents(MAX, -MAX)).toBe(0);
    expect(addCents(MAX, 0)).toBe(MAX);
  });

  it("refuses to go past MAX: MAX + 1 throws RangeError", () => {
    expect(() => addCents(MAX, 1)).toThrow(RangeError);
  });

  it("refuses to go past −MAX: −MAX + (−1) throws RangeError", () => {
    expect(() => addCents(-MAX, -1)).toThrow(RangeError);
  });

  it("refuses MAX + MAX (it would round silently in plain JavaScript)", () => {
    expect(() => addCents(MAX, MAX)).toThrow(RangeError);
  });

  const NOT_WHOLE_CENTS: readonly [string, unknown][] = [
    ["a fraction 1.5", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["2^53 (one past MAX)", 2 ** 53],
    ["the string \"1\"", "1"],
  ];
  for (const [why, bad] of NOT_WHOLE_CENTS) {
    it(`refuses ${why} as the first amount (RangeError)`, () => {
      expect(() => addCents(bad as number, 1)).toThrow(RangeError);
    });
    it(`refuses ${why} as the second amount (RangeError)`, () => {
      expect(() => addCents(1, bad as number)).toThrow(RangeError);
    });
  }
});

describe("subtractCents", () => {
  const MAX = Number.MAX_SAFE_INTEGER;

  it.each([
    [5, 3, 2],
    [3, 5, -2],
    [-3, 5, -8],
    [-3, -5, 2],
    [3, -5, 8],
    [0, 0, 0],
    [450000, 99900, 350100],
  ])("subtractCents(%d, %d) is %d", (a, b, difference) => {
    expect(subtractCents(a, b)).toBe(difference);
  });

  it("reaches exactly −MAX_SAFE_INTEGER: (−MAX + 1) − 1 = −9007199254740991", () => {
    expect(subtractCents(-MAX + 1, 1)).toBe(-9007199254740991);
  });

  it("reaches exactly MAX_SAFE_INTEGER: (MAX − 1) − (−1) = 9007199254740991", () => {
    expect(subtractCents(MAX - 1, -1)).toBe(9007199254740991);
  });

  it("MAX − MAX = 0, and −MAX − (−MAX) = 0", () => {
    expect(subtractCents(MAX, MAX)).toBe(0);
    expect(subtractCents(-MAX, -MAX)).toBe(0);
  });

  it("0 − MAX = −MAX (allowed)", () => {
    expect(subtractCents(0, MAX)).toBe(-MAX);
  });

  it("refuses to go past −MAX: −MAX − 1 throws RangeError", () => {
    expect(() => subtractCents(-MAX, 1)).toThrow(RangeError);
  });

  it("refuses to go past MAX: MAX − (−1) throws RangeError", () => {
    expect(() => subtractCents(MAX, -1)).toThrow(RangeError);
  });

  it("refuses −MAX − MAX", () => {
    expect(() => subtractCents(-MAX, MAX)).toThrow(RangeError);
  });

  const NOT_WHOLE_CENTS: readonly [string, unknown][] = [
    ["a fraction 0.1", 0.1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["-(2^53) (one past −MAX)", -(2 ** 53)],
    ["null", null],
  ];
  for (const [why, bad] of NOT_WHOLE_CENTS) {
    it(`refuses ${why} as the first amount (RangeError)`, () => {
      expect(() => subtractCents(bad as number, 1)).toThrow(RangeError);
    });
    it(`refuses ${why} as the second amount (RangeError)`, () => {
      expect(() => subtractCents(1, bad as number)).toThrow(RangeError);
    });
  }
});
