// Tests for T1.5, part 2: the pretend category list and pretend events
// (docs/stages/stage-01.md "T1.5 — Pretend-data store and today's date").
//
// Written by test-engineer BEFORE src/lib/pretend-data.ts exists. The builder
// must not edit this file; disputes go to the project lead.
//
// PRETEND DATA. The real expense category list is still to decide
// (DECISIONS.md "Still to decide": "Exact expense category list. Draft with
// real artists"). This draft uses only the examples in guide §7's "Expense
// groups" table, word for word (first letter capitalised), so nothing here
// pre-empts the owner's decision.
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
//   export type EventType =
//     "market" | "convention" | "exhibition" | "workshop" | "shelf_rental" | "other";
//   export type PretendEvent = {
//     id: string; name: string; type: EventType;
//     startDate: string;          // YYYY-MM-DD
//     endDate: string | null;     // YYYY-MM-DD, or null for an ongoing shelf
//   };
//   export function pretendEvents(today: string): PretendEvent[]
//     2 or 3 events. Exactly one of them runs on `today` and starts on `today`
//     (so the quick-sale screen has a "today's event" to default to). The
//     others are fixed dates that end before 2026-07-01. Event ids are the same
//     whatever `today` is, so entries that point at an event stay valid.
//     Throws RangeError when `today` isn't a real YYYY-MM-DD date.

import { describe, expect, it } from "vitest";
import { DRAFT_CATEGORIES, pretendEvents } from "@/lib/pretend-data";

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
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

describe("pretendEvents — a small set of pretend events", () => {
  for (const today of ["2026-07-01", "2026-10-25", "2027-01-01"]) {
    it(`has exactly one event running on ${today}, and it starts that day`, () => {
      const running = pretendEvents(today).filter((e) => runsOn(e, today));
      expect(running.length).toBe(1);
      expect(running[0].startDate).toBe(today);
    });
  }

  it("has 2 or 3 events", () => {
    expect([2, 3]).toContain(pretendEvents("2026-10-25").length);
  });

  it("gives every event a unique, non-empty string id", () => {
    const ids = pretendEvents("2026-10-25").map((e) => e.id);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id).not.toBe("");
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the same event ids whatever today is", () => {
    const ids = (today: string) => pretendEvents(today).map((e) => e.id).sort();
    expect(ids("2026-07-01")).toStrictEqual(ids("2027-01-01"));
  });

  it("keeps today's event's id the same whatever today is", () => {
    const todaysId = (today: string) => pretendEvents(today).find((e) => runsOn(e, today))?.id;
    expect(todaysId("2026-07-01")).toBe(todaysId("2027-01-01"));
  });

  it("stores event dates as YYYY-MM-DD strings, with the end (if any) on or after the start", () => {
    for (const e of pretendEvents("2026-10-25")) {
      expect(e.startDate).toMatch(ISO_DATE_SHAPE);
      if (e.endDate !== null) {
        expect(e.endDate).toMatch(ISO_DATE_SHAPE);
        expect(e.endDate >= e.startDate).toBe(true);
      }
    }
  });

  it("uses only the guide §7 event types", () => {
    for (const e of pretendEvents("2026-10-25")) {
      expect(EVENT_TYPES).toContain(e.type);
    }
  });

  it("gives every event a non-empty name", () => {
    for (const e of pretendEvents("2026-10-25")) {
      expect(typeof e.name).toBe("string");
      expect(e.name.trim()).not.toBe("");
    }
  });

  for (const bad of ["2026-7-1", "2026-02-30", "01/07/2026", ""]) {
    it(`throws RangeError when today is ${JSON.stringify(bad)}`, () => {
      expect(() => pretendEvents(bad)).toThrow(RangeError);
    });
  }
});
