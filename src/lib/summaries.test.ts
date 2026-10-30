// Tests for T1.10c, "Summaries: by event, by stream, by date range"
// (docs/stages/stage-01.md). Guide §12 "By event or venue" and "By income
// stream"; DECISIONS.md "Event 'Other costs'" and "Linking costs to events and
// streams".
//
// Written by test-engineer BEFORE src/lib/summaries.ts exists. The builder must
// not edit this file; disputes go to the project lead.
//
// ─── CONTRACT FOR src/lib/summaries.ts (the builder follows this exactly) ────
//
// LEAD'S DECISIONS (2026-10-26):
//  A. Pure functions over an EntriesState (src/lib/entries.ts) plus the list of
//     events (PretendEvent[], from pretendEvents(today)). These are the ONLY
//     place money is added up; screens never add amounts themselves. They
//     never change what they're given.
//  B. Exact whole cents. A RangeError whenever a sum or a result would go past
//     Number.MAX_SAFE_INTEGER cents either way (above it, or below its
//     negative), like totalsForDate. Results may be negative.
//  C. eventSummary(state, events, eventId) → {
//       days: Array<{ date, cashCents, cardCents, otherCents, totalCents }>,
//         one item per date that has income linked to this event (any
//         stream, $0 rows included), oldest date first. otherCents is income
//         paid any other way (online, bank_transfer, other);
//         totalCents = cash + card + other;
//       takingsCents,             // the sum of the days' totals
//       costs: ExpenseEntry[],    // event & venue expenses linked to this event,
//                                 // oldest date first, then in the order added
//       eventCostsCents,
//       resultCents,              // takings − event costs
//       otherCosts: { amountCents, notes } | null,   // the event's figure
//       resultAfterOtherCostsCents: number | null,   // result − other costs;
//                                 // null (NOT 0) when there's no figure
//     }
//     The event must be in `events` (RangeError otherwise). Production costs
//     are never included (they can't be linked to an event anyway).
//  D. streamSummary(state, events, streamId) → {
//       income: IncomeEntry[],    // this stream's income, newest first
//                                 // (entriesNewestFirst's order)
//       incomeCents,
//       costs: ExpenseEntry[],    // the costs counted toward this stream, newest first
//       costsCents,
//       resultCents,              // income − costs
//     }
//     streamId must be an INCOME_STREAMS id (RangeError otherwise). A cost
//     counts toward: its own streamId if it has one; otherwise, if it's linked
//     to an event, that event's usualStreamId (looked up in `events`);
//     otherwise no stream. So each cost counts toward ONE stream at most.
//  E. rangeTotals(state, from, to) → { incomeCents, expensesCents, netCents }
//     for entries dated from..to INCLUSIVE ("YYYY-MM-DD"). RangeError for a bad
//     date or from > to. netCents = income − expenses.
//  F. "Other costs" NEVER count toward a stream or a range: they only appear in
//     the event's own summary (DECISIONS.md "Event 'Other costs'": the stock
//     was already counted once as a production cost).
//
// TEST ENGINEER'S READINGS (the lead may overrule):
//  G. A cost with no stream tag that is linked to an event missing from
//     `events` can't be placed, so streamSummary throws RangeError rather than
//     quietly dropping it.
//  H. The summaries' lists hold the store's own entry objects (each once), so a
//     screen can show and edit them.
//
// THE OWNER'S WORKED EXAMPLE (DECISIONS.md "What the app is for"), with
// today = 2026-07-01, so the pretend convention runs 22–24 June 2026
// (today − 9 to today − 7, pinned in pretend-data.test.ts):
//   day 1, 22 Jun: cash  40000 + card  60000 = 100000 cents ($1,000)
//   day 2, 23 Jun: cash  80000 + card 120000 = 200000 cents ($2,000)
//   day 3, 24 Jun: cash  50000 + card 100000 = 150000 cents ($1,500)
//   takings 100000 + 200000 + 150000         = 450000 cents ($4,500)
//   costs: table 50000 (22 Jun) + hotel 29900 (24 Jun) + food 20000 (23 Jun)
//                                             =  99900 cents ($999)
//   result 450000 − 99900                     = 350100 cents ($3,501)
//   other costs (stock sold) 60000; 350100 − 60000 = 290100 cents ($2,901)
// The costs have no stream tag, so they count toward the convention's usual
// stream, Sales at events: that stream's result is also $3,501. June's range
// total is income 450000, expenses 99900, net 350100: the $600 isn't in it.
//
// T1.16b (owner's amount cap): the store now refuses amounts above
// 999,999,999 cents, so the MAX_SAFE_INTEGER tests build their states with
// direct() instead of the reducer (marked CHANGED (T1.16b)). The summaries
// themselves keep decision B unchanged.
//
// T1.17 (Expenses tab), lead's decision (2026-10-29), ADDED:
//  I. expensesSummary(state) → {
//       expenses: ExpenseEntry[],   // EVERY expense in the state, newest first
//                                   // (entriesNewestFirst's order: later date
//                                   // first; same date, added later first),
//                                   // the store's own objects (decision H)
//       productionCents,            // the production expenses added up
//       eventVenueCents,            // the event & venue expenses added up
//       operatingCents,             // the operating expenses added up
//       totalCents,                 // production + event & venue + operating
//     }
//     Income is never in it. "Other costs" figures never count (decision F).
//     Exact whole cents with a RangeError past Number.MAX_SAFE_INTEGER, like
//     the others (decision B; not limited by the T1.16b cap). Pure: the state
//     is never changed. The groups come from each entry's own `group`.
//
// T1.18 (Home summary: this month), ADDED: totalsForDate is removed from
// entries.ts (its tests with it), and Home's month totals come from
// rangeTotals. Four of totalsForDate's claims had no rangeTotals twin yet, so
// they are carried over at the end of the rangeTotals block, marked ADDED
// (T1.18): every one of the seven streams counts; the totals follow an edit
// and a delete; exact right up to MAX_SAFE_INTEGER; and a RangeError when the
// EXPENSES would pass it. (They pass against today's rangeTotals: they guard
// it, they don't ask for new behaviour.)
//
// Every expected value is worked out by hand (sums in the comments). None
// comes from the code under test.

import { describe, expect, it } from "vitest";
import {
  createEntriesState,
  entriesReducer,
  type EntriesAction,
  type EntriesState,
  type Entry,
} from "@/lib/entries";
import { DRAFT_CATEGORIES, pretendEvents, type PretendEvent } from "@/lib/pretend-data";
import { eventSummary, expensesSummary, rangeTotals, streamSummary } from "@/lib/summaries";

// ─── Helpers and fixed facts ─────────────────────────────────────────────────

/** Freezes an object and everything inside it, so any mutation throws. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** A JSON copy, to compare before and after with no shared objects. */
function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function categoryId(name: string): string {
  const found = DRAFT_CATEGORIES.find((c) => c.name === name);
  if (!found) throw new Error(`test setup: no draft category called ${name}`);
  return found.id;
}

const TODAY = "2026-07-01";
const EVENTS: readonly PretendEvent[] = deepFreeze(pretendEvents(TODAY));
const CONVENTION = "pretend-event-comic-con"; // 2026-06-22 .. 2026-06-24, usual stream Sales at events
const MARKET = "pretend-event-todays-market"; // 2026-07-01, usual stream Sales at events
const SHELF = "pretend-event-shelf"; // from 2026-05-02, usual stream Vendor shelf rental

const SALES_AT_EVENTS = "sales-at-events";
const ONLINE_SALES = "online-sales";
const WHOLESALE = "wholesale";
const COMMISSIONS = "commissions";
const VENDOR_SHELF = "vendor-shelf-rental";
const SOCIAL_MEDIA = "social-media";
const SUBSCRIPTIONS = "subscription-income";
const ALL_STREAMS = [SALES_AT_EVENTS, ONLINE_SALES, WHOLESALE, COMMISSIONS, VENDOR_SHELF, SOCIAL_MEDIA, SUBSCRIPTIONS];

const MAX = Number.MAX_SAFE_INTEGER;

/** Builds a frozen state from the pretend events and some actions. */
function build(...actions: EntriesAction[]): EntriesState {
  return deepFreeze(actions.reduce(entriesReducer, createEntriesState(EVENTS.map((e) => e.id))));
}

const takings = (
  day: string,
  date: string,
  cashCents: number,
  cardCents: number,
  eventId: string | null = CONVENTION,
  streamId = SALES_AT_EVENTS,
): EntriesAction => ({
  type: "add-event-takings",
  cashId: `${day}-cash`,
  cardId: `${day}-card`,
  takings: { date, streamId, eventId, cashCents, cardCents },
});

const income = (
  id: string,
  date: string,
  amountCents: number,
  streamId: string,
  paymentMethod: "cash" | "card" | "online" | "bank_transfer" | "other",
  eventId: string | null = null,
): EntriesAction => ({ type: "add-income", id, income: { date, streamId, amountCents, paymentMethod, eventId } });

const expense = (
  id: string,
  date: string,
  amountCents: number,
  category: string,
  extra: { supplier?: string; eventId?: string | null; streamId?: string | null } = {},
): EntriesAction => ({
  type: "add-expense",
  id,
  expense: { date, amountCents, categoryId: categoryId(category), ...extra },
});

const otherCosts = (eventId: string, amountCents: number, notes?: string): EntriesAction => ({
  type: "set-event-other-costs",
  eventId,
  amountCents,
  ...(notes === undefined ? {} : { notes }),
});

const ids = (entries: readonly Entry[]) => entries.map((e) => e.id);

/** An expense entry as the store keeps it, written out by hand. */
const expenseRow = (
  id: string,
  date: string,
  supplier: string,
  amountCents: number,
  category: string,
  group: "production" | "event_venue" | "operating",
  eventId: string | null,
  streamId: string | null = null,
) => ({ kind: "expense", id, date, supplier, amountCents, categoryId: categoryId(category), group, eventId, streamId, notes: "" });

/** An income entry as the store keeps it, written out by hand. */
const incomeRow = (
  id: string,
  date: string,
  amountCents: number,
  streamId: string,
  paymentMethod: string,
  eventId: string | null,
) => ({ kind: "income", id, date, streamId, amountCents, paymentMethod, eventId, notes: "" });

/**
 * A frozen state written out directly, WITHOUT the reducer (T1.16b). Only for
 * the MAX_SAFE_INTEGER tests: the store now refuses amounts above the owner's
 * cap (999,999,999 cents), but the summaries must still add up exactly
 * whatever they're given (decision B), e.g. figures loaded from elsewhere.
 */
function direct(entries: readonly object[], otherCostsByEvent: EntriesState["otherCosts"] = {}): EntriesState {
  return deepFreeze({
    ...createEntriesState(EVENTS.map((e) => e.id)),
    entries: entries as Entry[],
    otherCosts: otherCostsByEvent,
  });
}

// ─── The owner's worked example ──────────────────────────────────────────────

/** The owner's 3-day convention, with the $600 other costs. */
const OWNER_ACTIONS: EntriesAction[] = [
  takings("d1", "2026-06-22", 40000, 60000),
  takings("d2", "2026-06-23", 80000, 120000),
  takings("d3", "2026-06-24", 50000, 100000),
  expense("table", "2026-06-22", 50000, "Stall or table fees", { supplier: "Con HQ", eventId: CONVENTION }),
  expense("hotel", "2026-06-24", 29900, "Accommodation", { supplier: "Harbour Hotel", eventId: CONVENTION }),
  expense("food", "2026-06-23", 20000, "Meals", { supplier: "Food court", eventId: CONVENTION }),
  otherCosts(CONVENTION, 60000, "  Stock sold at the con "),
];
const ownerState = () => build(...OWNER_ACTIONS);

const TABLE = expenseRow("table", "2026-06-22", "Con HQ", 50000, "Stall or table fees", "event_venue", CONVENTION);
const HOTEL = expenseRow("hotel", "2026-06-24", "Harbour Hotel", 29900, "Accommodation", "event_venue", CONVENTION);
const FOOD = expenseRow("food", "2026-06-23", "Food court", 20000, "Meals", "event_venue", CONVENTION);

/** The convention's summary for the owner's example, written out by hand. */
const OWNER_EVENT_SUMMARY = {
  days: [
    { date: "2026-06-22", cashCents: 40000, cardCents: 60000, otherCents: 0, totalCents: 100000 },
    { date: "2026-06-23", cashCents: 80000, cardCents: 120000, otherCents: 0, totalCents: 200000 },
    { date: "2026-06-24", cashCents: 50000, cardCents: 100000, otherCents: 0, totalCents: 150000 },
  ],
  takingsCents: 450000, // 100000 + 200000 + 150000
  costs: [TABLE, FOOD, HOTEL], // 22, 23, 24 June: oldest first, not the order added
  eventCostsCents: 99900, // 50000 + 20000 + 29900
  resultCents: 350100, // 450000 − 99900
  otherCosts: { amountCents: 60000, notes: "Stock sold at the con" },
  resultAfterOtherCostsCents: 290100, // 350100 − 60000
};

describe("the owner's worked example (DECISIONS.md, T1.10c 'Done when')", () => {
  it("the convention: takings $4,500, event costs $999, result $3,501, $2,901 after $600 other costs", () => {
    expect(eventSummary(ownerState(), EVENTS, CONVENTION)).toStrictEqual(OWNER_EVENT_SUMMARY);
  });

  it("Sales at events: income $4,500, costs $999 (through the convention's usual stream), result $3,501", () => {
    const state = ownerState();
    const summary = streamSummary(state, EVENTS, SALES_AT_EVENTS);
    expect(summary).toStrictEqual({
      // Newest first: 24 Jun (card added after cash, so card first), 23 Jun, 22 Jun.
      income: [
        incomeRow("d3-card", "2026-06-24", 100000, SALES_AT_EVENTS, "card", CONVENTION),
        incomeRow("d3-cash", "2026-06-24", 50000, SALES_AT_EVENTS, "cash", CONVENTION),
        incomeRow("d2-card", "2026-06-23", 120000, SALES_AT_EVENTS, "card", CONVENTION),
        incomeRow("d2-cash", "2026-06-23", 80000, SALES_AT_EVENTS, "cash", CONVENTION),
        incomeRow("d1-card", "2026-06-22", 60000, SALES_AT_EVENTS, "card", CONVENTION),
        incomeRow("d1-cash", "2026-06-22", 40000, SALES_AT_EVENTS, "cash", CONVENTION),
      ],
      incomeCents: 450000,
      costs: [HOTEL, FOOD, TABLE], // newest first: 24, 23, 22 June
      costsCents: 99900,
      resultCents: 350100, // NOT 290100: other costs never count toward a stream
    });
  });

  it("June 2026: income $4,500, expenses $999, net $3,501 — the $600 other costs aren't in it", () => {
    expect(rangeTotals(ownerState(), "2026-06-01", "2026-06-30")).toStrictEqual({
      incomeCents: 450000,
      expensesCents: 99900,
      netCents: 350100,
    });
  });
});

// ─── eventSummary ────────────────────────────────────────────────────────────

describe("eventSummary — takings by day", () => {
  it("puts the days in date order, whatever order they were entered in (day 3, day 1, day 2)", () => {
    const state = build(
      takings("d3", "2026-06-24", 50000, 100000),
      takings("d1", "2026-06-22", 40000, 60000),
      takings("d2", "2026-06-23", 80000, 120000),
    );
    expect(eventSummary(state, EVENTS, CONVENTION).days.map((d) => d.date)).toStrictEqual([
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
    ]);
  });

  it("puts income paid online, by bank transfer or 'other' in otherCents: 2500 + 1000 + 300 = 3800", () => {
    const state = build(
      takings("d1", "2026-06-22", 40000, 60000),
      income("pre-order", "2026-06-22", 2500, SALES_AT_EVENTS, "online", CONVENTION),
      income("invoice", "2026-06-22", 1000, SALES_AT_EVENTS, "bank_transfer", CONVENTION),
      income("swap", "2026-06-22", 300, SALES_AT_EVENTS, "other", CONVENTION),
    );
    // 40000 + 60000 + 3800 = 103800
    expect(eventSummary(state, EVENTS, CONVENTION).days).toStrictEqual([
      { date: "2026-06-22", cashCents: 40000, cardCents: 60000, otherCents: 3800, totalCents: 103800 },
    ]);
  });

  it("adds up several cash and card rows on the same day (two entries each)", () => {
    const state = build(
      takings("a", "2026-06-23", 10000, 20000),
      takings("b", "2026-06-23", 5000, 7500),
    );
    // cash 10000 + 5000 = 15000; card 20000 + 7500 = 27500; total 42500
    expect(eventSummary(state, EVENTS, CONVENTION).days).toStrictEqual([
      { date: "2026-06-23", cashCents: 15000, cardCents: 27500, otherCents: 0, totalCents: 42500 },
    ]);
  });

  it("lists a day whose takings were $0 cash and $0 card (it has income rows)", () => {
    const state = build(takings("d1", "2026-06-22", 0, 0));
    expect(eventSummary(state, EVENTS, CONVENTION)).toMatchObject({
      days: [{ date: "2026-06-22", cashCents: 0, cardCents: 0, otherCents: 0, totalCents: 0 }],
      takingsCents: 0,
    });
  });

  it("counts income of any stream linked to the event: the shelf's Vendor shelf rental payouts", () => {
    const state = build(
      income("may", "2026-05-31", 8800, VENDOR_SHELF, "bank_transfer", SHELF),
      income("jun", "2026-06-30", 12100, VENDOR_SHELF, "bank_transfer", SHELF),
    );
    expect(eventSummary(state, EVENTS, SHELF)).toMatchObject({
      days: [
        { date: "2026-05-31", cashCents: 0, cardCents: 0, otherCents: 8800, totalCents: 8800 },
        { date: "2026-06-30", cashCents: 0, cardCents: 0, otherCents: 12100, totalCents: 12100 },
      ],
      takingsCents: 20900, // 8800 + 12100
    });
  });
});

describe("eventSummary — only this event's money, never anything else", () => {
  // The owner's example plus "noise" that must not touch the convention:
  //   today's market: takings 3000 cash + 0 card on 1 Jul; table 8000 linked to it;
  //   income on a convention day but not linked to any event (999);
  //   an event & venue cost on a convention day, "not assigned yet" (4000);
  //   a production cost on a convention day (15000);
  //   an operating cost tagged Sales at events (1299).
  const noisyState = () =>
    build(
      ...OWNER_ACTIONS,
      takings("m", "2026-07-01", 3000, 0, MARKET),
      expense("market-table", "2026-07-01", 8000, "Stall or table fees", { supplier: "Council", eventId: MARKET }),
      income("loose", "2026-06-22", 999, SALES_AT_EVENTS, "cash"),
      expense("unassigned", "2026-06-22", 4000, "Meals"),
      expense("prints", "2026-06-22", 15000, "Printing"),
      expense("app", "2026-06-22", 1299, "Software", { streamId: SALES_AT_EVENTS }),
    );

  it("the convention's summary is exactly the owner's example, untouched by the noise", () => {
    expect(eventSummary(noisyState(), EVENTS, CONVENTION)).toStrictEqual(OWNER_EVENT_SUMMARY);
  });

  it("today's market: takings 3000, costs 8000, result −5000; no figure, so both other-costs fields are null", () => {
    expect(eventSummary(noisyState(), EVENTS, MARKET)).toStrictEqual({
      days: [{ date: "2026-07-01", cashCents: 3000, cardCents: 0, otherCents: 0, totalCents: 3000 }],
      takingsCents: 3000,
      costs: [expenseRow("market-table", "2026-07-01", "Council", 8000, "Stall or table fees", "event_venue", MARKET)],
      eventCostsCents: 8000,
      resultCents: -5000, // 3000 − 8000: a loss is shown as it is
      otherCosts: null,
      resultAfterOtherCostsCents: null, // null, never 0, when there's no figure
    });
  });

  it("an event with no entries and no figure: all empty, zeros and nulls", () => {
    expect(eventSummary(noisyState(), EVENTS, SHELF)).toStrictEqual({
      days: [],
      takingsCents: 0,
      costs: [],
      eventCostsCents: 0,
      resultCents: 0,
      otherCosts: null,
      resultAfterOtherCostsCents: null,
    });
  });

  it("an other-costs figure of 0 gives a result after it equal to the result (−5000), not null", () => {
    const state = build(
      takings("m", "2026-07-01", 3000, 0, MARKET),
      expense("market-table", "2026-07-01", 8000, "Stall or table fees", { eventId: MARKET }),
      otherCosts(MARKET, 0),
    );
    expect(eventSummary(state, EVENTS, MARKET)).toMatchObject({
      resultCents: -5000,
      otherCosts: { amountCents: 0, notes: "" },
      resultAfterOtherCostsCents: -5000,
    });
  });

  it("other costs can push a loss further: −5000 − 1000 = −6000", () => {
    const state = build(
      takings("m", "2026-07-01", 3000, 0, MARKET),
      expense("market-table", "2026-07-01", 8000, "Stall or table fees", { eventId: MARKET }),
      otherCosts(MARKET, 1000, "stock"),
    );
    expect(eventSummary(state, EVENTS, MARKET).resultAfterOtherCostsCents).toBe(-6000);
  });

  it("lists costs on the same date in the order they were added, after older dates", () => {
    const state = build(
      expense("a", "2026-06-22", 100, "Parking", { eventId: CONVENTION }),
      expense("b", "2026-06-22", 200, "Meals", { eventId: CONVENTION }),
      expense("c", "2026-06-21", 300, "Flights", { eventId: CONVENTION }),
    );
    // 21 Jun first (c), then 22 Jun in the order added (a, b). 100 + 200 + 300 = 600.
    const summary = eventSummary(state, EVENTS, CONVENTION);
    expect(ids(summary.costs)).toStrictEqual(["c", "a", "b"]);
    expect(summary.eventCostsCents).toBe(600);
  });

  it("a cost's stream tag doesn't move it off its event: a convention cost tagged Online sales still counts here", () => {
    const state = build(
      expense("banner", "2026-06-22", 1500, "Display equipment hire", { eventId: CONVENTION, streamId: ONLINE_SALES }),
    );
    expect(eventSummary(state, EVENTS, CONVENTION)).toMatchObject({ eventCostsCents: 1500, resultCents: -1500 });
  });

  it("never changes the state or the event list it was given", () => {
    const state = noisyState();
    const before = snapshot(state);
    const events = deepFreeze(pretendEvents(TODAY));
    eventSummary(state, events, CONVENTION);
    expect(state).toStrictEqual(before);
    expect(events).toStrictEqual(pretendEvents(TODAY));
  });
});

describe("eventSummary — refuses what it can't answer exactly", () => {
  it("throws RangeError for an event that isn't in the event list", () => {
    expect(() => eventSummary(ownerState(), EVENTS, "no-such-event")).toThrow(RangeError);
  });

  it("throws RangeError for a real event id when the event list given is empty", () => {
    expect(() => eventSummary(ownerState(), [], CONVENTION)).toThrow(RangeError);
  });

  it("throws RangeError for the event's name instead of its id", () => {
    expect(() => eventSummary(ownerState(), EVENTS, "Pretend comic convention")).toThrow(RangeError);
  });

  // CHANGED (T1.16b): the five MAX tests below were built through the
  // reducer, which now refuses amounts above 999,999,999 cents. They now hold
  // the very same entries, written out with direct(), so they still prove
  // that eventSummary adds up exactly to ±MAX_SAFE_INTEGER and throws past it
  // (decision B). The cap belongs to the store's actions, not to the sums.
  it("throws RangeError when the takings would pass MAX_SAFE_INTEGER (MAX cash + 1 card)", () => {
    const state = direct([
      incomeRow("d1-cash", "2026-06-22", MAX, SALES_AT_EVENTS, "cash", CONVENTION),
      incomeRow("d1-card", "2026-06-22", 1, SALES_AT_EVENTS, "card", CONVENTION),
    ]);
    expect(() => eventSummary(state, EVENTS, CONVENTION)).toThrow(RangeError);
  });

  it("is exact right at the limit: 4503599627370495 + 4503599627370496 = 9007199254740991", () => {
    const state = direct([
      incomeRow("d1-cash", "2026-06-22", 4503599627370495, SALES_AT_EVENTS, "cash", CONVENTION),
      incomeRow("d1-card", "2026-06-22", 4503599627370496, SALES_AT_EVENTS, "card", CONVENTION),
    ]);
    expect(eventSummary(state, EVENTS, CONVENTION)).toMatchObject({
      days: [{ date: "2026-06-22", cashCents: 4503599627370495, cardCents: 4503599627370496, otherCents: 0, totalCents: MAX }],
      takingsCents: MAX,
      resultCents: MAX,
    });
  });

  it("throws RangeError when the event costs would pass MAX_SAFE_INTEGER", () => {
    const state = direct([
      expenseRow("a", "2026-06-22", "", MAX, "Flights", "event_venue", CONVENTION),
      expenseRow("b", "2026-06-22", "", 1, "Meals", "event_venue", CONVENTION),
    ]);
    expect(() => eventSummary(state, EVENTS, CONVENTION)).toThrow(RangeError);
  });

  it("allows a result of exactly −MAX_SAFE_INTEGER (0 takings, MAX costs)", () => {
    const state = direct([expenseRow("a", "2026-06-22", "", MAX, "Flights", "event_venue", CONVENTION)]);
    expect(eventSummary(state, EVENTS, CONVENTION).resultCents).toBe(-MAX);
  });

  it("throws RangeError when the result after other costs would go below −MAX_SAFE_INTEGER (−MAX − 1)", () => {
    const state = direct([expenseRow("a", "2026-06-22", "", MAX, "Flights", "event_venue", CONVENTION)], {
      [CONVENTION]: { amountCents: 1, notes: "" },
    });
    expect(() => eventSummary(state, EVENTS, CONVENTION)).toThrow(RangeError);
  });
});

// ─── streamSummary ───────────────────────────────────────────────────────────

describe("streamSummary — which stream each cost counts toward (its tag, else its event's usual stream)", () => {
  // The owner's example plus:
  //   "banner"   event & venue, linked to the convention, TAGGED Online sales, 22 Jun, 1500
  //              → Online sales only (the tag wins over the event's usual stream)
  //   "shelf-rent" Vendor shelf rent, linked to the shelf, untagged, 1 Jun, 5000
  //              → Vendor shelf rental (the shelf's usual stream)
  //   "fees"     operating Payment fees, tagged Online sales, 30 Jun, 390 → Online sales
  //   "app"      operating Software, untagged, 15 Jun, 3299 → no stream
  //   "unassigned" event & venue Meals, no event, no tag, 23 Jun, 1200 → no stream
  //   "prints"   production Printing, 5 Jun, 15000 → no stream
  //   "etsy"     income Online sales 2599, online, 30 Jun
  //   "payout"   income Vendor shelf rental 8800, bank transfer, shelf, 30 Jun
  const streamState = () =>
    build(
      ...OWNER_ACTIONS,
      expense("banner", "2026-06-22", 1500, "Display equipment hire", { eventId: CONVENTION, streamId: ONLINE_SALES }),
      expense("shelf-rent", "2026-06-01", 5000, "Vendor shelf rent", { eventId: SHELF }),
      expense("fees", "2026-06-30", 390, "Payment fees", { streamId: ONLINE_SALES }),
      expense("app", "2026-06-15", 3299, "Software"),
      expense("unassigned", "2026-06-23", 1200, "Meals"),
      expense("prints", "2026-06-05", 15000, "Printing"),
      income("etsy", "2026-06-30", 2599, ONLINE_SALES, "online"),
      income("payout", "2026-06-30", 8800, VENDOR_SHELF, "bank_transfer", SHELF),
    );

  it("Sales at events is still exactly the owner's $3,501: the tagged banner isn't counted here", () => {
    expect(streamSummary(streamState(), EVENTS, SALES_AT_EVENTS)).toMatchObject({
      incomeCents: 450000,
      costsCents: 99900,
      resultCents: 350100,
    });
    expect(ids(streamSummary(streamState(), EVENTS, SALES_AT_EVENTS).costs)).toStrictEqual(["hotel", "food", "table"]);
  });

  it("Online sales: income 2599; costs fees 390 + banner 1500 = 1890, newest first; result 709", () => {
    expect(streamSummary(streamState(), EVENTS, ONLINE_SALES)).toStrictEqual({
      income: [incomeRow("etsy", "2026-06-30", 2599, ONLINE_SALES, "online", null)],
      incomeCents: 2599,
      costs: [
        expenseRow("fees", "2026-06-30", "", 390, "Payment fees", "operating", null, ONLINE_SALES),
        expenseRow("banner", "2026-06-22", "", 1500, "Display equipment hire", "event_venue", CONVENTION, ONLINE_SALES),
      ],
      costsCents: 1890, // 390 + 1500
      resultCents: 709, // 2599 − 1890
    });
  });

  it("Vendor shelf rental: payout 8800, shelf rent 5000 through the shelf's usual stream, result 3800", () => {
    expect(streamSummary(streamState(), EVENTS, VENDOR_SHELF)).toStrictEqual({
      income: [incomeRow("payout", "2026-06-30", 8800, VENDOR_SHELF, "bank_transfer", SHELF)],
      incomeCents: 8800,
      costs: [expenseRow("shelf-rent", "2026-06-01", "", 5000, "Vendor shelf rent", "event_venue", SHELF)],
      costsCents: 5000,
      resultCents: 3800, // 8800 − 5000
    });
  });

  it("a stream with nothing in it (Wholesale): empty lists and zeros", () => {
    expect(streamSummary(streamState(), EVENTS, WHOLESALE)).toStrictEqual({
      income: [],
      incomeCents: 0,
      costs: [],
      costsCents: 0,
      resultCents: 0,
    });
  });

  it("each cost counts toward one stream at most: the 7 streams' costs add up to 99900 + 1890 + 5000 = 106790", () => {
    // The other 3299 + 1200 + 15000 = 19499 belong to no stream.
    const state = streamState();
    const total = ALL_STREAMS.map((s) => streamSummary(state, EVENTS, s).costsCents).reduce((a, b) => a + b, 0);
    expect(total).toBe(106790);
  });

  it("no cost appears in two streams' lists, and the untagged, unlinked ones appear in none", () => {
    const state = streamState();
    const listed = ALL_STREAMS.flatMap((s) => ids(streamSummary(state, EVENTS, s).costs)).sort();
    expect(listed).toStrictEqual(["banner", "fees", "food", "hotel", "shelf-rent", "table"]);
  });

  it("the fallback uses the usual stream from the event list it's given (convention's usual stream set to Wholesale)", () => {
    const events = EVENTS.map((e) => (e.id === CONVENTION ? { ...e, usualStreamId: WHOLESALE } : e));
    const state = streamState();
    expect(streamSummary(state, events, WHOLESALE)).toMatchObject({ costsCents: 99900, resultCents: -99900 });
    expect(streamSummary(state, events, SALES_AT_EVENTS)).toMatchObject({ costsCents: 0, resultCents: 450000 });
  });

  it("an untagged cost linked to an event missing from the event list is a RangeError, not quietly dropped", () => {
    const custom = deepFreeze(
      [expense("x", "2026-06-22", 100, "Meals", { eventId: "ev-custom" })].reduce(
        entriesReducer,
        createEntriesState(["ev-custom"]),
      ),
    );
    expect(() => streamSummary(custom, EVENTS, SALES_AT_EVENTS)).toThrow(RangeError);
  });

  it("a cost tagged Commissions with no commission income gives a negative result: 0 − 2000 = −2000", () => {
    const state = build(expense("site", "2026-06-10", 2000, "Website", { streamId: COMMISSIONS }));
    expect(streamSummary(state, EVENTS, COMMISSIONS)).toMatchObject({ incomeCents: 0, costsCents: 2000, resultCents: -2000 });
  });
});

describe("streamSummary — income and other costs", () => {
  it("lists only this stream's income, newest first (later date first; same date, added later first)", () => {
    const state = build(
      income("a", "2026-06-01", 100, SOCIAL_MEDIA, "bank_transfer"),
      income("b", "2026-06-20", 200, SUBSCRIPTIONS, "online"),
      income("c", "2026-06-20", 300, SOCIAL_MEDIA, "online"),
      income("d", "2026-06-10", 400, SOCIAL_MEDIA, "other"),
      income("e", "2026-06-20", 500, SOCIAL_MEDIA, "card"),
    );
    // Social media: e (20 Jun, added after c), c (20 Jun), d (10 Jun), a (1 Jun). 500 + 300 + 400 + 100 = 1300.
    const summary = streamSummary(state, EVENTS, SOCIAL_MEDIA);
    expect(ids(summary.income)).toStrictEqual(["e", "c", "d", "a"]);
    expect(summary.incomeCents).toBe(1300);
  });

  it("other costs never count toward a stream: setting the convention's $600 leaves Sales at events at $3,501", () => {
    const without = build(...OWNER_ACTIONS.slice(0, -1));
    const withFigure = ownerState();
    expect(streamSummary(without, EVENTS, SALES_AT_EVENTS).resultCents).toBe(350100);
    expect(streamSummary(withFigure, EVENTS, SALES_AT_EVENTS).resultCents).toBe(350100);
  });

  it("never changes the state or the event list it was given", () => {
    const state = ownerState();
    const before = snapshot(state);
    const events = deepFreeze(pretendEvents(TODAY));
    streamSummary(state, events, SALES_AT_EVENTS);
    expect(state).toStrictEqual(before);
    expect(events).toStrictEqual(pretendEvents(TODAY));
  });

  for (const [bad, why] of [
    ["etsy", "not a stream"],
    ["Sales at events", "a name, not an id"],
    ["", "empty"],
  ] as const) {
    it(`throws RangeError for the stream ${JSON.stringify(bad)} (${why})`, () => {
      expect(() => streamSummary(ownerState(), EVENTS, bad)).toThrow(RangeError);
    });
  }

  // CHANGED (T1.16b): these two were built through the reducer, which now
  // refuses amounts above 999,999,999 cents; same entries, written with direct().
  it("throws RangeError when the stream's income would pass MAX_SAFE_INTEGER", () => {
    const state = direct([
      incomeRow("a", "2026-06-01", MAX, WHOLESALE, "bank_transfer", null),
      incomeRow("b", "2026-06-02", 1, WHOLESALE, "bank_transfer", null),
    ]);
    expect(() => streamSummary(state, EVENTS, WHOLESALE)).toThrow(RangeError);
  });

  it("throws RangeError when the stream's costs would pass MAX_SAFE_INTEGER", () => {
    const state = direct([
      expenseRow("a", "2026-06-01", "", MAX, "Website", "operating", null, WHOLESALE),
      expenseRow("b", "2026-06-02", "", 1, "Website", "operating", null, WHOLESALE),
    ]);
    expect(() => streamSummary(state, EVENTS, WHOLESALE)).toThrow(RangeError);
  });
});

// ─── rangeTotals ─────────────────────────────────────────────────────────────

describe("rangeTotals — income, expenses and net for an inclusive date range", () => {
  // The owner's example ($600 other costs included in the state) plus:
  //   "may-in"   income Wholesale 777, 31 May
  //   "prints"   production Printing 15000, 5 Jun
  //   "etsy"     income Online sales 2599, 30 Jun
  //   "july-in"  income Commissions 5000, 1 Jul
  //   "july-out" operating Software 1000, 1 Jul
  // June: income 450000 + 2599 = 452599; expenses 99900 + 15000 = 114900;
  //       net 452599 − 114900 = 337699.
  const rangeState = () =>
    build(
      ...OWNER_ACTIONS,
      income("may-in", "2026-05-31", 777, WHOLESALE, "bank_transfer"),
      expense("prints", "2026-06-05", 15000, "Printing"),
      income("etsy", "2026-06-30", 2599, ONLINE_SALES, "online"),
      income("july-in", "2026-07-01", 5000, COMMISSIONS, "bank_transfer"),
      expense("july-out", "2026-07-01", 1000, "Software"),
    );

  it("June 2026: income 452599, expenses 114900, net 337699 (May, July and the other costs left out)", () => {
    expect(rangeTotals(rangeState(), "2026-06-01", "2026-06-30")).toStrictEqual({
      incomeCents: 452599,
      expensesCents: 114900,
      netCents: 337699,
    });
  });

  it("includes the last day: 30 Jun to 30 Jun is the Etsy sale, 2599", () => {
    expect(rangeTotals(rangeState(), "2026-06-30", "2026-06-30")).toStrictEqual({
      incomeCents: 2599,
      expensesCents: 0,
      netCents: 2599,
    });
  });

  it("includes the first day: 5 Jun to 21 Jun is the 15000 printing only (net −15000)", () => {
    expect(rangeTotals(rangeState(), "2026-06-05", "2026-06-21")).toStrictEqual({
      incomeCents: 0,
      expensesCents: 15000,
      netCents: -15000,
    });
  });

  it("31 May to 1 Jul, across two month ends: income 777 + 452599 + 5000 = 458376; expenses 114900 + 1000 = 115900; net 342476", () => {
    expect(rangeTotals(rangeState(), "2026-05-31", "2026-07-01")).toStrictEqual({
      incomeCents: 458376,
      expensesCents: 115900,
      netCents: 342476,
    });
  });

  it("a range with no entries is all zeros", () => {
    expect(rangeTotals(rangeState(), "2026-08-01", "2026-08-31")).toStrictEqual({
      incomeCents: 0,
      expensesCents: 0,
      netCents: 0,
    });
  });

  it("other costs never count: the owner's June is net 350100 with or without the $600 figure", () => {
    expect(rangeTotals(build(...OWNER_ACTIONS.slice(0, -1)), "2026-06-01", "2026-06-30").netCents).toBe(350100);
    expect(rangeTotals(ownerState(), "2026-06-01", "2026-06-30").netCents).toBe(350100);
  });

  it("never changes the state it was given", () => {
    const state = rangeState();
    const before = snapshot(state);
    rangeTotals(state, "2026-06-01", "2026-06-30");
    expect(state).toStrictEqual(before);
  });

  for (const [from, to, why] of [
    ["2026-06-30", "2026-06-01", "from is after to"],
    ["2026-02-29", "2026-03-31", "2026 has no 29 February"],
    ["2026-06-01", "2026-6-30", "to isn't YYYY-MM-DD"],
    ["01/06/2026", "2026-06-30", "a display format"],
    ["", "2026-06-30", "empty"],
  ] as const) {
    it(`throws RangeError for ${JSON.stringify(from)} to ${JSON.stringify(to)} (${why})`, () => {
      expect(() => rangeTotals(rangeState(), from, to)).toThrow(RangeError);
    });
  }

  // CHANGED (T1.16b): these two were built through the reducer, which now
  // refuses amounts above 999,999,999 cents; same entries, written with direct().
  it("throws RangeError when the range's income would pass MAX_SAFE_INTEGER", () => {
    const state = direct([
      incomeRow("a", "2026-06-01", MAX, WHOLESALE, "bank_transfer", null),
      incomeRow("b", "2026-06-02", 1, WHOLESALE, "bank_transfer", null),
    ]);
    expect(() => rangeTotals(state, "2026-06-01", "2026-06-30")).toThrow(RangeError);
  });

  it("allows a net of exactly −MAX_SAFE_INTEGER (no income, MAX expenses)", () => {
    const state = direct([expenseRow("a", "2026-06-01", "", MAX, "Website", "operating", null)]);
    expect(rangeTotals(state, "2026-06-01", "2026-06-30")).toStrictEqual({ incomeCents: 0, expensesCents: MAX, netCents: -MAX });
  });

  // ADDED (T1.18): carried over from the removed totalsForDate tests (see the header).
  it("ADDED (T1.18): counts every one of the seven streams: 1 + 10 + 100 + 1000 + 10000 + 100000 + 1000000 = 1111111", () => {
    // One income per stream, each a different power of ten, so a stream left
    // out would show as a missing digit 1 in the total.
    const state = build(...ALL_STREAMS.map((streamId, i) => income(`s${i}`, "2026-06-10", 10 ** i, streamId, "card")));
    expect(rangeTotals(state, "2026-06-01", "2026-06-30")).toStrictEqual({
      incomeCents: 1111111,
      expensesCents: 0,
      netCents: 1111111,
    });
  });

  it("ADDED (T1.18): follows an edit and a delete: Etsy 2599 → 3000 (+401) and the 15000 printing deleted give income 453000, expenses 99900, net 353100", () => {
    // June before: income 452599, expenses 114900.
    // Income 452599 − 2599 + 3000 = 453000; expenses 114900 − 15000 = 99900;
    // net 453000 − 99900 = 353100.
    const edited = entriesReducer(rangeState(), { type: "edit", id: "etsy", changes: { amountCents: 3000 } });
    const after = entriesReducer(deepFreeze(edited), { type: "delete", id: "prints" });
    expect(rangeTotals(after, "2026-06-01", "2026-06-30")).toStrictEqual({
      incomeCents: 453000,
      expensesCents: 99900,
      netCents: 353100,
    });
  });

  it("ADDED (T1.18): moving an entry's date out of the range takes it out: the Etsy sale moved to 1 Jul leaves June's income at 450000", () => {
    // 452599 − 2599 = 450000; net 450000 − 114900 = 335100.
    const after = entriesReducer(rangeState(), { type: "edit", id: "etsy", changes: { date: "2026-07-01" } });
    expect(rangeTotals(after, "2026-06-01", "2026-06-30")).toStrictEqual({
      incomeCents: 450000,
      expensesCents: 114900,
      netCents: 335100,
    });
  });

  it("ADDED (T1.18): is exact right up to MAX_SAFE_INTEGER: 4503599627370495 + 4503599627370496 = 9007199254740991", () => {
    const state = direct([
      incomeRow("a", "2026-06-01", 4503599627370495, WHOLESALE, "bank_transfer", null),
      incomeRow("b", "2026-06-30", 4503599627370496, WHOLESALE, "bank_transfer", null),
    ]);
    expect(rangeTotals(state, "2026-06-01", "2026-06-30")).toStrictEqual({
      incomeCents: MAX,
      expensesCents: 0,
      netCents: MAX,
    });
  });

  it("ADDED (T1.18): throws RangeError when the range's expenses would pass MAX_SAFE_INTEGER", () => {
    const state = direct([
      expenseRow("a", "2026-06-01", "", MAX, "Website", "operating", null),
      expenseRow("b", "2026-06-02", "", 1, "Website", "operating", null),
    ]);
    expect(() => rangeTotals(state, "2026-06-01", "2026-06-30")).toThrow(RangeError);
  });
});

// ─── Decision H, pinned directly (T1.16 carry-over) ──────────────────────────
// The summaries' lists hold the store's OWN entry objects (the very same
// objects, not copies), so a screen can show and later edit them.

describe("decision H: the summary lists hold the store's own entries", () => {
  it("eventSummary(...).costs[0] is the very same object as the store's table entry", () => {
    const state = ownerState();
    const table = state.entries.find((e) => e.id === "table");
    expect(table).toBeDefined();
    // costs are oldest first: the table (22 June) comes first.
    expect(eventSummary(state, EVENTS, CONVENTION).costs[0]).toBe(table);
  });

  it("streamSummary(...).income[0] is the very same object as the store's day-3 card entry", () => {
    const state = ownerState();
    const d3Card = state.entries.find((e) => e.id === "d3-card");
    expect(d3Card).toBeDefined();
    // income is newest first: 24 June, card (added after cash) first.
    expect(streamSummary(state, EVENTS, SALES_AT_EVENTS).income[0]).toBe(d3Card);
  });

  it("streamSummary(...).costs[0] is the very same object as the store's hotel entry", () => {
    const state = ownerState();
    const hotel = state.entries.find((e) => e.id === "hotel");
    expect(hotel).toBeDefined();
    // costs are newest first: the hotel (24 June) comes first.
    expect(streamSummary(state, EVENTS, SALES_AT_EVENTS).costs[0]).toBe(hotel);
  });

  it("every entry in the convention's costs is one of the store's entries, each once", () => {
    const state = ownerState();
    const costs = eventSummary(state, EVENTS, CONVENTION).costs;
    expect(costs.map((c) => state.entries.indexOf(c)).every((i) => i >= 0)).toBe(true);
    expect(new Set(costs).size).toBe(costs.length);
  });
});


// ─── expensesSummary (T1.17, decision I) ─────────────────────────────────────

describe("expensesSummary — every expense, newest first, with a total per group (T1.17)", () => {
  // THE OWNER'S EXAMPLE FOR THE EXPENSES TAB (lead, T1.17): the convention's
  // three costs (table 50000, hotel 29900, food 20000, all event & venue) plus
  //   "prints" production Printing 12000, 20 Jun, "Zine printer"
  //   "adobe"  operating  Software  1500, 30 Jun, "Adobe", tagged Online sales
  // The state also holds the six takings rows and the $600 other costs.
  //   production   12000                      → $120.00
  //   event_venue  50000 + 29900 + 20000 = 99900 → $999.00
  //   operating    1500                       → $15.00
  //   total        12000 + 99900 + 1500 = 113400 → $1,134.00
  // Newest first: adobe 30/06, hotel 24/06, food 23/06, table 22/06, prints 20/06.
  const PRINTS = expenseRow("prints", "2026-06-20", "Zine printer", 12000, "Printing", "production", null);
  const ADOBE = expenseRow("adobe", "2026-06-30", "Adobe", 1500, "Software", "operating", null, ONLINE_SALES);
  const ownerExpensesState = () =>
    build(
      ...OWNER_ACTIONS,
      expense("prints", "2026-06-20", 12000, "Printing", { supplier: "Zine printer" }),
      expense("adobe", "2026-06-30", 1500, "Software", { supplier: "Adobe", streamId: ONLINE_SALES }),
    );

  // A HAND-WORKED MIX of all three groups (on top of the owner's convention):
  //   "boxes"   production  Packaging          3450, 26 Jun
  //   "ads"     operating   Marketing          2599, 23 Jun (added after "food", same date)
  //   "parking" event_venue Parking            3330,  1 Jul, linked to the market
  //   "free"    event_venue Meals                 0, 24 Jun, linked to the market ($0 still listed)
  //   "etsy"    INCOME Online sales           12345, 30 Jun (never in the summary)
  //   production   12000 + 3450                 = 15450
  //   event_venue  99900 + 3330 + 0              = 103230
  //   operating    1500 + 2599                  = 4099
  //   total        15450 + 103230 + 4099        = 122779
  // Newest first (same date: added later first):
  //   parking 01/07; adobe 30/06; boxes 26/06; free 24/06 (added after hotel), hotel 24/06;
  //   ads 23/06 (added after food), food 23/06; table 22/06; prints 20/06.
  const mixedState = () =>
    build(
      ...OWNER_ACTIONS,
      expense("prints", "2026-06-20", 12000, "Printing", { supplier: "Zine printer" }),
      expense("adobe", "2026-06-30", 1500, "Software", { supplier: "Adobe", streamId: ONLINE_SALES }),
      expense("boxes", "2026-06-26", 3450, "Packaging"),
      expense("ads", "2026-06-23", 2599, "Marketing"),
      expense("parking", "2026-07-01", 3330, "Parking", { eventId: MARKET }),
      expense("free", "2026-06-24", 0, "Meals", { eventId: MARKET }),
      income("etsy", "2026-06-30", 12345, ONLINE_SALES, "online"),
    );

  it("the owner's example: production 12000, event & venue 99900, operating 1500, total 113400, newest first", () => {
    expect(expensesSummary(ownerExpensesState())).toStrictEqual({
      expenses: [ADOBE, HOTEL, FOOD, TABLE, PRINTS],
      productionCents: 12000,
      eventVenueCents: 99900,
      operatingCents: 1500,
      totalCents: 113400,
    });
  });

  it("the mix: production 15450, event & venue 103230, operating 4099, total 122779", () => {
    const { productionCents, eventVenueCents, operatingCents, totalCents } = expensesSummary(mixedState());
    expect({ productionCents, eventVenueCents, operatingCents, totalCents }).toStrictEqual({
      productionCents: 15450,
      eventVenueCents: 103230,
      operatingCents: 4099,
      totalCents: 122779,
    });
  });

  it("the mix lists all nine expenses newest first (same date: added later first), and no income", () => {
    expect(ids(expensesSummary(mixedState()).expenses)).toEqual([
      "parking",
      "adobe",
      "boxes",
      "free",
      "hotel",
      "ads",
      "food",
      "table",
      "prints",
    ]);
  });

  it("an empty state: no expenses and four zeros", () => {
    expect(expensesSummary(build())).toStrictEqual({
      expenses: [],
      productionCents: 0,
      eventVenueCents: 0,
      operatingCents: 0,
      totalCents: 0,
    });
  });

  it("income is never included: a state with only the owner's six takings rows (450000) is empty and all zeros", () => {
    expect(expensesSummary(build(...OWNER_ACTIONS.slice(0, 3)))).toStrictEqual({
      expenses: [],
      productionCents: 0,
      eventVenueCents: 0,
      operatingCents: 0,
      totalCents: 0,
    });
  });

  it("income is never included: adding the 12345 Etsy income leaves the owner's example exactly as it was", () => {
    const withIncome = build(...OWNER_ACTIONS, income("etsy", "2026-06-30", 12345, ONLINE_SALES, "online"));
    expect(expensesSummary(withIncome)).toStrictEqual({
      expenses: [HOTEL, FOOD, TABLE],
      productionCents: 0,
      eventVenueCents: 99900,
      operatingCents: 0,
      totalCents: 99900,
    });
  });

  it("other costs never count: the convention's 60000 figure is in the state, yet event & venue is 99900 and total 113400", () => {
    const state = ownerExpensesState();
    expect(state.otherCosts[CONVENTION]?.amountCents).toBe(60000); // the figure really is there
    const s = expensesSummary(state);
    expect([s.eventVenueCents, s.totalCents]).toEqual([99900, 113400]);
  });

  it("other costs never count: the summary is the same with or without the 60000 figure", () => {
    const withoutFigure = build(
      ...OWNER_ACTIONS.slice(0, -1),
      expense("prints", "2026-06-20", 12000, "Printing", { supplier: "Zine printer" }),
      expense("adobe", "2026-06-30", 1500, "Software", { supplier: "Adobe", streamId: ONLINE_SALES }),
    );
    expect(expensesSummary(ownerExpensesState())).toStrictEqual(expensesSummary(withoutFigure));
  });

  it("each group counts only its own: a single 777 operating cost gives 0 / 0 / 777 / 777", () => {
    const s = expensesSummary(build(expense("x", "2026-06-01", 777, "Insurance")));
    expect([s.productionCents, s.eventVenueCents, s.operatingCents, s.totalCents]).toEqual([0, 0, 777, 777]);
  });

  it("each group counts only its own: a single 888 production cost gives 888 / 0 / 0 / 888", () => {
    const s = expensesSummary(build(expense("x", "2026-06-01", 888, "Art materials")));
    expect([s.productionCents, s.eventVenueCents, s.operatingCents, s.totalCents]).toEqual([888, 0, 0, 888]);
  });

  it("each group counts only its own: a single unlinked 999 event & venue cost gives 0 / 999 / 0 / 999", () => {
    const s = expensesSummary(build(expense("x", "2026-06-01", 999, "Flights")));
    expect([s.productionCents, s.eventVenueCents, s.operatingCents, s.totalCents]).toEqual([0, 999, 0, 999]);
  });

  it("follows edits and deletes: after the hotel goes to 30000 and the food is deleted, event & venue is 50000 + 30000 = 80000", () => {
    const state = build(
      ...OWNER_ACTIONS,
      { type: "edit", id: "hotel", changes: { amountCents: 30000 } },
      { type: "delete", id: "food" },
    );
    const s = expensesSummary(state);
    expect(ids(s.expenses)).toEqual(["hotel", "table"]);
    expect([s.eventVenueCents, s.totalCents]).toEqual([80000, 80000]);
  });

  it("an edit doesn't move an entry: the table edited last still sorts by its date (22 Jun, after food 23 Jun)", () => {
    const state = build(...OWNER_ACTIONS, { type: "edit", id: "table", changes: { supplier: "Con HQ Pty Ltd" } });
    expect(ids(expensesSummary(state).expenses)).toEqual(["hotel", "food", "table"]);
  });

  it("holds the store's own entries (decision H): expenses[0] is the very same object as the store's 'parking'", () => {
    const state = mixedState();
    const parking = state.entries.find((e) => e.id === "parking");
    expect(parking).toBeDefined();
    expect(expensesSummary(state).expenses[0]).toBe(parking);
  });

  it("holds every expense entry of the store exactly once, and nothing else", () => {
    const state = mixedState();
    const listed = expensesSummary(state).expenses;
    const storeExpenses = state.entries.filter((e) => e.kind === "expense");
    expect(listed.length).toBe(9);
    expect(new Set(listed).size).toBe(9);
    expect(listed.every((e) => storeExpenses.includes(e))).toBe(true);
  });

  it("never changes the state it was given", () => {
    const state = mixedState();
    const before = snapshot(state);
    expensesSummary(state);
    expect(state).toStrictEqual(before);
  });

  it("doesn't reorder the state's own entries list", () => {
    const state = mixedState();
    const order = ids(state.entries);
    expensesSummary(state);
    expect(ids(state.entries)).toEqual(order);
  });

  it("isn't limited by the owner's cap: two capped amounts, 999999999 + 999999999 = 1999999998", () => {
    const state = build(
      expense("a", "2026-06-01", 999999999, "Printing"),
      expense("b", "2026-06-02", 999999999, "Website"),
    );
    const s = expensesSummary(state);
    expect([s.productionCents, s.eventVenueCents, s.operatingCents, s.totalCents]).toEqual([
      999999999, 0, 999999999, 1999999998,
    ]);
  });

  // Built with direct() (no reducer), as the other MAX_SAFE_INTEGER tests are (T1.16b).
  it("throws RangeError when the production total would pass MAX_SAFE_INTEGER (MAX + 1)", () => {
    const state = direct([
      expenseRow("a", "2026-06-01", "", MAX, "Printing", "production", null),
      expenseRow("b", "2026-06-02", "", 1, "Packaging", "production", null),
    ]);
    expect(() => expensesSummary(state)).toThrow(RangeError);
  });

  it("throws RangeError when the event & venue total would pass MAX_SAFE_INTEGER (MAX + 1)", () => {
    const state = direct([
      expenseRow("a", "2026-06-01", "", MAX, "Flights", "event_venue", null),
      expenseRow("b", "2026-06-02", "", 1, "Parking", "event_venue", null),
    ]);
    expect(() => expensesSummary(state)).toThrow(RangeError);
  });

  it("throws RangeError when the operating total would pass MAX_SAFE_INTEGER (MAX + 1)", () => {
    const state = direct([
      expenseRow("a", "2026-06-01", "", MAX, "Website", "operating", null),
      expenseRow("b", "2026-06-02", "", 1, "Phone", "operating", null),
    ]);
    expect(() => expensesSummary(state)).toThrow(RangeError);
  });

  it("throws RangeError when only the TOTAL would pass MAX_SAFE_INTEGER (production MAX, operating 1)", () => {
    const state = direct([
      expenseRow("a", "2026-06-01", "", MAX, "Printing", "production", null),
      expenseRow("b", "2026-06-02", "", 1, "Website", "operating", null),
    ]);
    expect(() => expensesSummary(state)).toThrow(RangeError);
  });

  it("is exact right at the limit: production 4503599627370495 + operating 4503599627370496 = 9007199254740991", () => {
    const state = direct([
      expenseRow("a", "2026-06-01", "", 4503599627370495, "Printing", "production", null),
      expenseRow("b", "2026-06-02", "", 4503599627370496, "Website", "operating", null),
    ]);
    const s = expensesSummary(state);
    expect([s.productionCents, s.eventVenueCents, s.operatingCents, s.totalCents]).toEqual([
      4503599627370495, 0, 4503599627370496, 9007199254740991,
    ]);
  });

  it("income past MAX_SAFE_INTEGER doesn't matter: it is never added (MAX + 1 income, one 500 cost)", () => {
    const state = direct([
      incomeRow("i1", "2026-06-01", MAX, WHOLESALE, "bank_transfer", null),
      incomeRow("i2", "2026-06-02", 1, WHOLESALE, "bank_transfer", null),
      expenseRow("c", "2026-06-03", "", 500, "Website", "operating", null),
    ]);
    const s = expensesSummary(state);
    expect([s.productionCents, s.eventVenueCents, s.operatingCents, s.totalCents]).toEqual([0, 0, 500, 500]);
  });
});
