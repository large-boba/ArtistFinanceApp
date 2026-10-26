// Tests for the pretend data in src/lib/pretend-data.ts:
//   - T1.5 (docs/stages/stage-01.md): the draft expense category list;
//   - T1.10: the seven income streams, and the three pretend events, each
//     with its usual income stream.
//
// Written by test-engineer BEFORE the code. The builder must not edit this
// file; disputes go to the project lead.
//
// PRETEND DATA. The real expense category list is still to decide
// (DECISIONS.md "Still to decide": "Exact expense category list. Draft with
// real artists"). This draft uses only the examples in guide §7's "Expense
// groups" table, word for word (first letter capitalised), so nothing here
// pre-empts the owner's decision.
//
// The seven income streams are DECIDED (DECISIONS.md "Income streams", guide
// §10 "The seven starting income streams"); only their ids are new (lead's
// decision for T1.10, 2026-10-25).
//
// ─── CONTRACT FOR src/lib/pretend-data.ts (the builder follows this exactly) ─
//
//   The file starts with a comment saying it is pretend/draft data and that
//   the real category list is still to decide.
//
//   import type { ExpenseGroup } from "@/lib/entries";   // type-only import
//
//   export type ExpenseCategory = { id: string; name: string; group: ExpenseGroup };
//   export const DRAFT_CATEGORIES: readonly ExpenseCategory[]
//     Exactly the 20 guide §7 examples below. `id` is a stable, unique slug
//     you choose, made of lowercase ASCII letters, digits, "-" and "_" (e.g.
//     "stall-table-fees"). Tests look categories up by name, never by id.
//
//   export type IncomeStream = { id: string; name: string };          (T1.10)
//   export const INCOME_STREAMS: readonly IncomeStream[]
//     Exactly these 7, in this order (guide §10's table order), each object
//     holding only `id` and `name`. Frozen like DRAFT_CATEGORIES: the list and
//     every stream in it, so no screen can change them by accident.
//       sales-at-events      Sales at events
//       online-sales         Online sales
//       wholesale            Wholesale
//       commissions          Commissions
//       vendor-shelf-rental  Vendor shelf rental
//       social-media         Social media
//       subscription-income  Subscription income
//
//   export type EventType =
//     "market" | "convention" | "exhibition" | "workshop" | "shelf_rental" | "other";
//   export type PretendEvent = {
//     id: string; name: string; type: EventType;
//     startDate: string;          // YYYY-MM-DD
//     endDate: string | null;     // YYYY-MM-DD, or null for an ongoing shelf
//     usualStreamId: string;      // an INCOME_STREAMS id (T1.10)
//   };
//   export function pretendEvents(today: string): PretendEvent[]     (T1.10)
//     Exactly these three objects, in this order, with dates worked out from
//     `today` with addDays (src/lib/dates.ts):
//       1. id "pretend-event-comic-con", name "Pretend comic convention",
//          type "convention", startDate today − 9, endDate today − 7
//          (a finished 3-day convention: days −9, −8 and −7),
//          usualStreamId "sales-at-events";
//       2. id "pretend-event-todays-market", name "Pretend weekend market (today)",
//          type "market", startDate today, endDate today,
//          usualStreamId "sales-at-events";
//       3. id "pretend-event-shelf", name "Pretend gallery shelf",
//          type "shelf_rental", startDate today − 60, endDate null (ongoing),
//          usualStreamId "vendor-shelf-rental".
//     The usual stream follows one rule (guide §10): a shelf rental's is
//     "vendor-shelf-rental"; every other type's is "sales-at-events".
//     The ids, names and order are the same whatever `today` is, so entries
//     that point at an event stay valid. (The order is the card's order; the
//     expense form's Event list shows them in it, see expense-form.spec.ts F6.)
//     Throws RangeError when `today` isn't a real YYYY-MM-DD date.
//
// Every expected date below is counted by hand on a calendar (working shown).

import { describe, expect, it } from "vitest";
import { DRAFT_CATEGORIES, INCOME_STREAMS, pretendEvents } from "@/lib/pretend-data";

const EVENT_TYPES = ["market", "convention", "exhibition", "workshop", "shelf_rental", "other"];

/** Names in one group, sorted so the order the builder chose doesn't matter. */
function namesIn(group: string): string[] {
  return DRAFT_CATEGORIES.filter((c) => c.group === group)
    .map((c) => c.name)
    .sort();
}

/** True when the event is running on `date` (an open end means ongoing). */
function runsOn(event: { startDate: string; endDate: string | null }, date: string): boolean {
  return event.startDate <= date && (event.endDate === null || date <= event.endDate);
}

describe("DRAFT_CATEGORIES — guide §7 examples, each in exactly one group", () => {
  it("has exactly the guide's 5 production examples", () => {
    expect(namesIn("production")).toStrictEqual(
      ["Art materials", "Merch manufacturing", "Packaging", "Printing", "Shipping of stock to you"],
    );
  });

  it("has exactly the guide's 8 event & venue examples", () => {
    expect(namesIn("event_venue")).toStrictEqual([
      "Accommodation",
      "Display equipment hire",
      "Flights",
      "Local transport",
      "Meals",
      "Parking",
      "Stall or table fees",
      "Vendor shelf rent",
    ]);
  });

  it("has exactly the guide's 7 operating examples", () => {
    expect(namesIn("operating")).toStrictEqual(
      ["Equipment", "Insurance", "Marketing", "Payment fees", "Phone", "Software", "Website"],
    );
  });

  it("has 20 categories in total, so none sits outside the three groups", () => {
    expect(DRAFT_CATEGORIES.length).toBe(20);
  });

  it("gives every category a slug id (lowercase letters, digits, - and _), never its display name", () => {
    for (const c of DRAFT_CATEGORIES) {
      expect(c.id).toMatch(/^[a-z0-9_-]+$/);
    }
  });

  it("gives every category a unique id", () => {
    expect(new Set(DRAFT_CATEGORIES.map((c) => c.id)).size).toBe(20);
  });

  it("has unique names, so a picker never shows the same name twice", () => {
    expect(new Set(DRAFT_CATEGORIES.map((c) => c.name)).size).toBe(20);
  });
});

// ─── Income streams (T1.10) ─────────────────────────────────────────────────

describe("INCOME_STREAMS — the seven default streams (guide §10)", () => {
  it("is exactly the seven streams, with the lead's ids and the guide's names, in the guide's order", () => {
    expect(INCOME_STREAMS).toStrictEqual([
      { id: "sales-at-events", name: "Sales at events" },
      { id: "online-sales", name: "Online sales" },
      { id: "wholesale", name: "Wholesale" },
      { id: "commissions", name: "Commissions" },
      { id: "vendor-shelf-rental", name: "Vendor shelf rental" },
      { id: "social-media", name: "Social media" },
      { id: "subscription-income", name: "Subscription income" },
    ]);
  });

  it("freezes the list, so no stream can be added, removed or reordered by accident", () => {
    // Object.isFrozen(undefined) is true, so first make sure there is a list to check.
    expect(Array.isArray(INCOME_STREAMS)).toBe(true);
    expect(Object.isFrozen(INCOME_STREAMS)).toBe(true);
  });

  it("freezes every stream, so no name or id can be changed by accident", () => {
    expect(INCOME_STREAMS.map((s) => Object.isFrozen(s))).toStrictEqual([true, true, true, true, true, true, true]);
  });

  it("refuses a rename at run time (a frozen object throws in strict mode)", () => {
    const first = INCOME_STREAMS[0] as { name: string };
    expect(() => {
      first.name = "Renamed";
    }).toThrow(TypeError);
    expect(INCOME_STREAMS[0].name).toBe("Sales at events");
  });
});

// ─── Pretend events (T1.10) ─────────────────────────────────────────────────

describe("pretendEvents — three events worked out from today", () => {
  it("for today 2026-03-05: a convention 24–26 Feb, today's market, a shelf since 4 Jan", () => {
    // Convention: 5 Mar − 5 days = 28 Feb (2026 has no 29 Feb); − 4 more = 24 Feb (start, −9).
    //             5 Mar − 7 = 26 Feb (end). Days 24, 25, 26 Feb: 3 days.
    // Shelf: 5 Mar − 5 = 28 Feb; − 28 (all of February) = 31 Jan (33 so far);
    //        − 27 more = 4 Jan (60).
    expect(pretendEvents("2026-03-05")).toStrictEqual([
      {
        id: "pretend-event-comic-con",
        name: "Pretend comic convention",
        type: "convention",
        startDate: "2026-02-24",
        endDate: "2026-02-26",
        usualStreamId: "sales-at-events",
      },
      {
        id: "pretend-event-todays-market",
        name: "Pretend weekend market (today)",
        type: "market",
        startDate: "2026-03-05",
        endDate: "2026-03-05",
        usualStreamId: "sales-at-events",
      },
      {
        id: "pretend-event-shelf",
        name: "Pretend gallery shelf",
        type: "shelf_rental",
        startDate: "2026-01-04",
        endDate: null,
        usualStreamId: "vendor-shelf-rental",
      },
    ]);
  });

  it("for today 2028-03-03 (a leap year): the convention is 23–25 Feb and the shelf started 3 Jan", () => {
    // Convention: 3 Mar − 3 = 29 Feb (2028 is a leap year); − 6 more = 23 Feb (start, −9).
    //             3 Mar − 3 = 29 Feb; − 4 more = 25 Feb (end, −7).
    // Shelf: 3 Mar − 3 = 29 Feb; − 29 = 31 Jan (32 so far); − 28 more = 3 Jan (60).
    const [convention, market, shelf] = pretendEvents("2028-03-03");
    expect([convention.startDate, convention.endDate]).toStrictEqual(["2028-02-23", "2028-02-25"]);
    expect([market.startDate, market.endDate]).toStrictEqual(["2028-03-03", "2028-03-03"]);
    expect([shelf.startDate, shelf.endDate]).toStrictEqual(["2028-01-03", null]);
  });

  it("for today 2026-01-05: the convention (27–29 Dec) and the shelf (6 Nov) are in the year before", () => {
    // Convention: 5 Jan − 5 = 31 Dec 2025; − 4 more = 27 Dec (start, −9);
    //             5 Jan − 5 = 31 Dec; − 2 more = 29 Dec (end, −7).
    // Shelf: 5 Jan − 5 = 31 Dec; − 30 = 1 Dec (35 so far); − 1 = 30 Nov (36);
    //        − 24 more = 6 Nov (60).
    const [convention, market, shelf] = pretendEvents("2026-01-05");
    expect([convention.startDate, convention.endDate]).toStrictEqual(["2025-12-27", "2025-12-29"]);
    expect([market.startDate, market.endDate]).toStrictEqual(["2026-01-05", "2026-01-05"]);
    expect([shelf.startDate, shelf.endDate]).toStrictEqual(["2025-11-06", null]);
  });

  it("for today 2026-10-25: the convention is 16–18 Oct and the shelf started 26 Aug", () => {
    // Convention: 25 − 9 = 16 Oct; 25 − 7 = 18 Oct.
    // Shelf: 25 Oct − 25 = 30 Sep; − 30 = 31 Aug (55 so far); − 5 more = 26 Aug (60).
    const [convention, market, shelf] = pretendEvents("2026-10-25");
    expect([convention.startDate, convention.endDate]).toStrictEqual(["2026-10-16", "2026-10-18"]);
    expect([market.startDate, market.endDate]).toStrictEqual(["2026-10-25", "2026-10-25"]);
    expect([shelf.startDate, shelf.endDate]).toStrictEqual(["2026-08-26", null]);
  });

  for (const today of ["2026-03-05", "2026-07-01", "2026-10-25", "2027-01-01"]) {
    it(`on ${today}, exactly two events are running: today's market and the ongoing shelf`, () => {
      const running = pretendEvents(today)
        .filter((e) => runsOn(e, today))
        .map((e) => e.id);
      expect(running).toStrictEqual(["pretend-event-todays-market", "pretend-event-shelf"]);
    });

    it(`on ${today}, the convention has already finished`, () => {
      const convention = pretendEvents(today)[0];
      expect(convention.endDate !== null && convention.endDate < today).toBe(true);
    });
  }

  it("keeps the same ids, names, types and usual streams, in the same order, whatever today is", () => {
    const fixed = (today: string) =>
      pretendEvents(today).map(({ id, name, type, usualStreamId }) => ({ id, name, type, usualStreamId }));
    expect(fixed("2026-07-01")).toStrictEqual(fixed("2027-01-01"));
    expect(fixed("2026-03-05")).toStrictEqual(fixed("2028-03-03"));
  });

  it("gives a shelf rental the usual stream vendor-shelf-rental and every other type sales-at-events", () => {
    for (const e of pretendEvents("2026-10-25")) {
      expect(e.usualStreamId, e.id).toBe(e.type === "shelf_rental" ? "vendor-shelf-rental" : "sales-at-events");
    }
  });

  it("uses only usual streams that are in INCOME_STREAMS", () => {
    const streamIds = INCOME_STREAMS.map((s) => s.id);
    for (const e of pretendEvents("2026-10-25")) {
      expect(streamIds, e.id).toContain(e.usualStreamId);
    }
  });

  it("uses only the guide §7 event types", () => {
    for (const e of pretendEvents("2026-10-25")) {
      expect(EVENT_TYPES).toContain(e.type);
    }
  });

  for (const bad of ["2026-7-1", "2026-02-30", "01/07/2026", ""]) {
    it(`throws RangeError when today is ${JSON.stringify(bad)}`, () => {
      expect(() => pretendEvents(bad)).toThrow(RangeError);
    });
  }
});
