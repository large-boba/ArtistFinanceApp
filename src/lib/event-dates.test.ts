// Tests for formatEventDates (T1.16 carry-over from T1.15, docs/stages/stage-01.md):
// how an event's dates are written on screen. T1.15 built it as
// eventDatesText in src/components/event-dates.ts; T1.16 moves it to
// src/lib/event-dates.ts and names it formatEventDates, so it sits with the
// other pure date helpers and can be unit-tested. These tests are written to
// that new home and name, so they fail until the move is done.
//
// Written by test-engineer BEFORE the move. The builder must not edit this
// file; disputes go to the project lead.
//
// CONTRACT (the T1.15 lead decisions, events.spec.ts E1):
//   formatEventDates(event: PretendEvent, locale: string): string
//     one-day event (endDate === startDate):  "<start>"
//     several days:                           "<start> to <end>"
//     ongoing (endDate === null):             "From <start>, ongoing"
//   Each date is formatDateForDisplay(date, locale): the calendar date as
//   written, never shifted by the device's time zone. Pure: it doesn't change
//   the event it is given.
//
// Every expected string is written out by hand.

import { describe, expect, it } from "vitest";
import { formatEventDates } from "@/lib/event-dates";
import { pretendEvents, type PretendEvent } from "@/lib/pretend-data";

function event(startDate: string, endDate: string | null): PretendEvent {
  return Object.freeze({
    id: "test-event",
    name: "Test event",
    type: "market",
    startDate,
    endDate,
    usualStreamId: "sales-at-events",
  });
}

describe("formatEventDates, en-AU (day/month/year)", () => {
  it('a one-day event shows one date: 2026-07-01 → "01/07/2026"', () => {
    expect(formatEventDates(event("2026-07-01", "2026-07-01"), "en-AU")).toBe("01/07/2026");
  });

  it('a multi-day event shows "<start> to <end>": 2026-06-22..2026-06-24 → "22/06/2026 to 24/06/2026"', () => {
    expect(formatEventDates(event("2026-06-22", "2026-06-24"), "en-AU")).toBe("22/06/2026 to 24/06/2026");
  });

  it('an ongoing event shows "From <start>, ongoing": 2026-05-02 → "From 02/05/2026, ongoing"', () => {
    expect(formatEventDates(event("2026-05-02", null), "en-AU")).toBe("From 02/05/2026, ongoing");
  });

  it('an event across the new year: 2026-12-31..2027-01-02 → "31/12/2026 to 02/01/2027"', () => {
    expect(formatEventDates(event("2026-12-31", "2027-01-02"), "en-AU")).toBe("31/12/2026 to 02/01/2027");
  });

  it('a two-day event over 29 February 2028: 2028-02-28..2028-02-29 → "28/02/2028 to 29/02/2028"', () => {
    expect(formatEventDates(event("2028-02-28", "2028-02-29"), "en-AU")).toBe("28/02/2028 to 29/02/2028");
  });
});

describe("formatEventDates follows the locale (en-US: month/day/year, no padding)", () => {
  it('one day: 2026-07-01 → "7/1/2026"', () => {
    expect(formatEventDates(event("2026-07-01", "2026-07-01"), "en-US")).toBe("7/1/2026");
  });

  it('several days: 2026-06-22..2026-06-24 → "6/22/2026 to 6/24/2026"', () => {
    expect(formatEventDates(event("2026-06-22", "2026-06-24"), "en-US")).toBe("6/22/2026 to 6/24/2026");
  });

  it('ongoing: 2026-05-02 → "From 5/2/2026, ongoing"', () => {
    expect(formatEventDates(event("2026-05-02", null), "en-US")).toBe("From 5/2/2026, ongoing");
  });
});

describe("formatEventDates with the pretend events (today = 2026-07-01)", () => {
  // Convention: today−9..today−7 = 2026-06-22..2026-06-24; market: today;
  // shelf: today−60 = 2026-05-02, no end (pinned in pretend-data.test.ts).
  it("gives the three texts the events list and event pages show", () => {
    expect(pretendEvents("2026-07-01").map((e) => formatEventDates(e, "en-AU"))).toEqual([
      "22/06/2026 to 24/06/2026",
      "01/07/2026",
      "From 02/05/2026, ongoing",
    ]);
  });
});

describe("formatEventDates is pure", () => {
  it("leaves the event as it was (a frozen event doesn't throw)", () => {
    const e = event("2026-06-22", "2026-06-24");
    const before = JSON.stringify(e);
    formatEventDates(e, "en-AU");
    expect(JSON.stringify(e)).toBe(before);
  });
});
