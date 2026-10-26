// Tests for T1.5, part 1: today's date and showing a date
// (docs/stages/stage-01.md "T1.5 — Pretend-data store and today's date"),
// and for T1.10: adding days to a date (addDays, at the end of this file).
//
// Written by test-engineer BEFORE src/lib/dates.ts exists. The builder must
// not edit this file; disputes go to the project lead.
//
// Guide §6, "store a date, not a moment":
//   - A transaction date is a calendar date, kept as a "YYYY-MM-DD" string.
//   - The default date on a new entry is the date on the device right now.
//   - Never turn "YYYY-MM-DD" into a Date just to show it: passing the string
//     "2026-07-01" to new Date() means midnight UTC, which shows as 30 June in
//     the Americas.
//   - Never add or subtract hours yourself; let Intl and the IANA database do it.
//
// ─── CONTRACT FOR src/lib/dates.ts (the builder follows this exactly) ────────
//
//   export function todayOnDevice(now?: Date, timeZone?: string): string
//     The calendar date at the instant `now` (default: the current time) in
//     the IANA zone `timeZone` (default: the device's own zone, i.e. leave
//     Intl's timeZone option unset). Always "YYYY-MM-DD" with ASCII digits,
//     whatever the device's language. Throws RangeError for an unknown time
//     zone or an invalid Date (Intl already does both).
//
//   export function isIsoDate(value: unknown): value is string
//     True only for a string that is exactly "YYYY-MM-DD" (ASCII digits, no
//     spaces, no time part) AND a real calendar date (leap years included).
//     The reducer in entries.ts uses this to check dates.
//
//   export function formatDateForDisplay(iso: string, locale: string): string
//     Shows a stored date the person's way, using Intl.DateTimeFormat with
//     numeric day, month and year. It must give the same day in every device
//     time zone. It must NOT pass the "YYYY-MM-DD" string to new Date() or
//     Date.parse() (check-rules blocks that). Split the string into year, month and day yourself, then e.g.
//     format Date.UTC(year, month - 1, day) with { timeZone: "UTC" }.
//     Throws RangeError when `iso` fails isIsoDate.
//
//   export function addDays(iso: string, days: number): string      (T1.10)
//     The calendar date `days` days after `iso` (before it when `days` is
//     negative), e.g. addDays("2026-03-01", -1) is "2026-02-28". Lead's
//     decision, 2026-10-25. It is PURE CALENDAR MATHS on the year, month and
//     day numbers: it must not pass the string to new Date() or Date.parse(),
//     must not use the device's time zone or clock, and must not add 24 hours
//     of milliseconds to a local midnight (a 23- or 25-hour daylight-saving day
//     would then land on the wrong date). Throws RangeError when:
//       - `iso` fails isIsoDate;
//       - `days` isn't an integer number (1.5, NaN, Infinity, "1", ...);
//       - the answer would fall outside 0001-01-01 .. 9999-12-31, which is
//         all a "YYYY-MM-DD" string can hold (DECISION, test engineer: a
//         RangeError rather than a 5-digit or year-0 string).
//
// DECISION (display style): the expected strings below are what Intl's
// numeric day/month/year style gives in Node 22 and 24 (ICU 77, CLDR 47).
// For en-AU that is "01/07/2026", not the guide's "1/7/2026": we follow the
// standard locale data (Intl) rather than hand-made per-country formats.
// en-US is "7/1/2026" and en-MY "01/07/2026", as in the guide.
//
// Every expected value below was worked out by hand from the zone's offset at
// that moment (written next to each case). None comes from the code under test.

import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays, formatDateForDisplay, isIsoDate, todayOnDevice } from "@/lib/dates";

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** An exact instant, given in UTC. Months are 1-12 here (not 0-11). */
function utc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

/**
 * Runs `fn` as if the device were set to time zone `tz`, then puts it back.
 * Node re-reads process.env.TZ when it changes. The first expect is a
 * precondition: if the switch didn't take effect, the test fails instead of
 * proving nothing.
 */
function onDeviceIn<T>(tz: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz);
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("todayOnDevice — the date in a given time zone", () => {
  it("23:30 on 30 June in Perth (UTC+8, 15:30 UTC) is still 30 June", () => {
    expect(todayOnDevice(utc(2026, 6, 30, 15, 30), "Australia/Perth")).toBe("2026-06-30");
  });

  it("the same instant (15:30 UTC) is 01:30 on 1 July in Sydney (UTC+10)", () => {
    expect(todayOnDevice(utc(2026, 6, 30, 15, 30), "Australia/Sydney")).toBe("2026-07-01");
  });

  it("23:30 UTC on 30 June is 09:30 on 1 July in Sydney", () => {
    expect(todayOnDevice(utc(2026, 6, 30, 23, 30), "Australia/Sydney")).toBe("2026-07-01");
  });

  it("an early-morning Sydney entry (05:45 on 1 July = 19:45 UTC on 30 June) is 1 July", () => {
    expect(todayOnDevice(utc(2026, 6, 30, 19, 45), "Australia/Sydney")).toBe("2026-07-01");
  });

  it("23:30 on 30 June in Los Angeles (PDT, UTC-7, = 06:30 UTC 1 July) is still 30 June", () => {
    expect(todayOnDevice(utc(2026, 7, 1, 6, 30), "America/Los_Angeles")).toBe("2026-06-30");
  });

  it("00:30 on 1 July in Los Angeles (= 07:30 UTC) is 1 July", () => {
    expect(todayOnDevice(utc(2026, 7, 1, 7, 30), "America/Los_Angeles")).toBe("2026-07-01");
  });

  it("uses daylight saving from the zone database: 13:30 UTC on 31 Dec is 00:30 on 1 Jan 2027 in Sydney (AEDT, UTC+11)", () => {
    // A hand-added +10 would give 23:30 on 31 Dec 2026.
    expect(todayOnDevice(utc(2026, 12, 31, 13, 30), "Australia/Sydney")).toBe("2027-01-01");
  });

  it("handles half-hour offsets: 18:29 UTC is 23:59 on 30 June in Kolkata (UTC+5:30)", () => {
    expect(todayOnDevice(utc(2026, 6, 30, 18, 29), "Asia/Kolkata")).toBe("2026-06-30");
  });

  it("handles half-hour offsets: 18:30 UTC is 00:00 on 1 July in Kolkata", () => {
    expect(todayOnDevice(utc(2026, 6, 30, 18, 30), "Asia/Kolkata")).toBe("2026-07-01");
  });

  it("one instant (10:00 UTC on 30 June) is three different dates across the world", () => {
    const instant = utc(2026, 6, 30, 10, 0);
    expect(todayOnDevice(instant, "Pacific/Kiritimati")).toBe("2026-07-01"); // UTC+14: 00:00 1 July
    expect(todayOnDevice(instant, "UTC")).toBe("2026-06-30");
    expect(todayOnDevice(instant, "Pacific/Pago_Pago")).toBe("2026-06-29"); // UTC-11: 23:00 29 June
  });

  it("does not change the Date it is given", () => {
    const instant = utc(2026, 6, 30, 15, 30);
    todayOnDevice(instant, "Australia/Perth");
    expect(instant.getTime()).toBe(Date.UTC(2026, 5, 30, 15, 30));
  });

  it("throws RangeError for an unknown time zone", () => {
    expect(() => todayOnDevice(utc(2026, 6, 30, 15, 30), "Mars/Olympus_Mons")).toThrow(RangeError);
  });

  it("throws RangeError for an invalid Date", () => {
    expect(() => todayOnDevice(new Date(Number.NaN), "Australia/Perth")).toThrow(RangeError);
  });
});

describe("todayOnDevice — defaults to the device's zone and the current time", () => {
  // 23:30 UTC on 30 June: 07:30 on 1 July in Perth, 19:30 on 30 June in New York (EDT).
  const instant = utc(2026, 6, 30, 23, 30);

  it("with no zone given, a device set to Perth gets 1 July", () => {
    onDeviceIn("Australia/Perth", () => {
      expect(todayOnDevice(instant)).toBe("2026-07-01");
    });
  });

  it("with no zone given, a device set to New York gets 30 June", () => {
    onDeviceIn("America/New_York", () => {
      expect(todayOnDevice(instant)).toBe("2026-06-30");
    });
  });

  it("with no time given, it uses the clock (fake clock at 15:30 UTC 30 June, Perth) → 30 June", () => {
    vi.useFakeTimers();
    vi.setSystemTime(utc(2026, 6, 30, 15, 30));
    expect(todayOnDevice(undefined, "Australia/Perth")).toBe("2026-06-30");
  });

  it("with no time given, it uses the clock (same fake clock, Sydney) → 1 July", () => {
    vi.useFakeTimers();
    vi.setSystemTime(utc(2026, 6, 30, 15, 30));
    expect(todayOnDevice(undefined, "Australia/Sydney")).toBe("2026-07-01");
  });

  it("todayOnDevice() with no arguments on a Perth device at 23:30 on 30 June is 30 June", () => {
    vi.useFakeTimers();
    vi.setSystemTime(utc(2026, 6, 30, 15, 30));
    onDeviceIn("Australia/Perth", () => {
      expect(todayOnDevice()).toBe("2026-06-30");
    });
  });
});

describe("todayOnDevice — always a YYYY-MM-DD string", () => {
  const zones = [
    "UTC",
    "Australia/Perth",
    "Australia/Sydney",
    "America/Los_Angeles",
    "America/New_York",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Pacific/Chatham",
    "Pacific/Kiritimati",
    "Pacific/Pago_Pago",
  ];
  for (const zone of zones) {
    it(`gives a real YYYY-MM-DD date at every hour of 1-2 Jan and 30 Jun-1 Jul 2026 in ${zone}`, () => {
      for (const [month, day] of [[1, 1], [1, 2], [6, 30], [7, 1]]) {
        for (let hour = 0; hour < 24; hour++) {
          const result = todayOnDevice(utc(2026, month, day, hour, 0), zone);
          expect(typeof result).toBe("string");
          expect(result).toMatch(ISO_DATE_SHAPE);
          // Within a day either side of the UTC date, so it's 2025-12-31 .. 2026-07-02.
          expect(result >= "2025-12-31" && result <= "2026-07-02").toBe(true);
        }
      }
    });
  }
});

describe("isIsoDate — a real calendar date written exactly as YYYY-MM-DD", () => {
  const valid = [
    ["2026-07-01", "an ordinary date"],
    ["2026-01-01", "first day of the year"],
    ["2026-12-31", "last day of the year"],
    ["2028-02-29", "leap year (divisible by 4)"],
    ["2000-02-29", "leap year (divisible by 400)"],
    ["2026-04-30", "30-day month, last day"],
  ];
  for (const [value, why] of valid) {
    it(`accepts ${JSON.stringify(value)} (${why})`, () => {
      expect(isIsoDate(value)).toBe(true);
    });
  }

  const invalid: Array<[unknown, string]> = [
    ["2026-02-29", "2026 is not a leap year"],
    ["2100-02-29", "2100 is not a leap year (divisible by 100, not 400)"],
    ["0000-01-01", "there is no year 0 (Postgres `date` rejects it too)"],
    ["2026-02-30", "February never has 30 days"],
    ["2026-04-31", "April has 30 days"],
    ["2026-06-31", "June has 30 days"],
    ["2026-13-01", "no month 13"],
    ["2026-00-10", "no month 0"],
    ["2026-01-00", "no day 0"],
    ["2026-01-32", "no day 32"],
    ["2026-7-1", "month and day must be two digits"],
    ["26-07-01", "year must be four digits"],
    ["2026/07/01", "slashes"],
    ["01/07/2026", "a display format, not the stored format"],
    ["2026-07-01T00:00:00Z", "a timestamp, not a date"],
    ["2026-07-01 ", "trailing space"],
    [" 2026-07-01", "leading space"],
    ["2026-07-01\n", "trailing newline"],
    ["２０２６-07-01", "full-width digits"],
    ["", "empty string"],
    [20260701, "a number"],
    [null, "null"],
    [undefined, "undefined"],
    [new Date(Date.UTC(2026, 6, 1)), "a Date object"],
  ];
  for (const [value, why] of invalid) {
    it(`rejects ${typeof value === "string" ? JSON.stringify(value) : String(value)} (${why})`, () => {
      expect(isIsoDate(value)).toBe(false);
    });
  }
});

describe("formatDateForDisplay — the person's local format", () => {
  const cases = [
    { iso: "2026-07-01", locale: "en-AU", shown: "01/07/2026", why: "Australia: day/month/year (CLDR pads to 2 digits)" },
    { iso: "2026-07-01", locale: "en-US", shown: "7/1/2026", why: "US: month/day/year" },
    { iso: "2026-07-01", locale: "en-MY", shown: "01/07/2026", why: "Malaysia, as in guide §6" },
    { iso: "2026-07-01", locale: "ja-JP", shown: "2026/7/1", why: "Japan: year/month/day" },
    { iso: "2026-07-01", locale: "de-DE", shown: "1.7.2026", why: "dots, no padding" },
    { iso: "2026-12-31", locale: "en-US", shown: "12/31/2026", why: "last day of the year" },
    { iso: "2027-01-01", locale: "en-US", shown: "1/1/2027", why: "first day of the year" },
    { iso: "2028-02-29", locale: "en-US", shown: "2/29/2028", why: "leap day" },
    { iso: "2026-06-30", locale: "en-AU", shown: "30/06/2026", why: "Australian FY end" },
  ];

  // The day must never shift, whatever zone the phone is in. Parsing the string
  // with new Date() would show 30 June in the Americas (UTC-), and a
  // local-midnight Date shown in UTC would also land on the day before in
  // the far Pacific (UTC+14).
  const deviceZones = [
    "America/Los_Angeles",
    "Pacific/Pago_Pago",
    "Pacific/Kiritimati",
    "Australia/Perth",
    "UTC",
  ];

  for (const c of cases) {
    for (const zone of deviceZones) {
      it(`shows ${c.iso} as ${JSON.stringify(c.shown)} for ${c.locale} on a device in ${zone} (${c.why})`, () => {
        onDeviceIn(zone, () => {
          expect(formatDateForDisplay(c.iso, c.locale)).toBe(c.shown);
        });
      });
    }
  }

  for (const bad of ["2026-02-30", "2026-02-29", "2026-7-1", "2026-07-01T00:00:00Z", "01/07/2026", ""]) {
    it(`throws RangeError for ${JSON.stringify(bad)} instead of showing a made-up date`, () => {
      expect(() => formatDateForDisplay(bad, "en-AU")).toThrow(RangeError);
    });
  }
});

// ─── addDays (T1.10) ─────────────────────────────────────────────────────────
//
// Every answer below was counted by hand on a calendar (the working is next to
// each case). Month lengths: 31 for Jan, Mar, May, Jul, Aug, Oct, Dec; 30 for
// Apr, Jun, Sep, Nov; February 28, or 29 in a leap year (every 4th year,
// except century years not divisible by 400: 2000 is a leap year, 2100 isn't).

describe("addDays — rolls over months and years", () => {
  const cases: Array<[string, number, string, string]> = [
    ["2026-07-01", 0, "2026-07-01", "adding nothing gives the same day"],
    ["2026-07-01", 1, "2026-07-02", "the next day"],
    ["2026-07-02", -1, "2026-07-01", "the day before"],
    ["2026-01-31", 1, "2026-02-01", "January has 31 days"],
    ["2026-04-30", 1, "2026-05-01", "April has 30 days"],
    ["2026-06-30", 1, "2026-07-01", "Australian FY end → FY start"],
    ["2026-12-31", 1, "2027-01-01", "into the next year"],
    ["2027-01-01", -1, "2026-12-31", "back into the previous year"],
    ["2026-03-31", -31, "2026-02-28", "30 days back is 1 March, one more is 28 Feb"],
  ];
  for (const [iso, days, expected, why] of cases) {
    it(`${iso} ${days >= 0 ? "+" : "−"} ${Math.abs(days)} = ${expected} (${why})`, () => {
      expect(addDays(iso, days)).toBe(expected);
    });
  }
});

describe("addDays — leap years", () => {
  const cases: Array<[string, number, string, string]> = [
    ["2026-03-01", -1, "2026-02-28", "2026 isn't a leap year"],
    ["2026-02-28", 1, "2026-03-01", "2026 isn't a leap year"],
    ["2028-03-01", -1, "2028-02-29", "2028 is a leap year (divisible by 4)"],
    ["2028-02-28", 1, "2028-02-29", "2028 is a leap year"],
    ["2028-02-29", 1, "2028-03-01", "the leap day rolls into March"],
    ["2100-02-28", 1, "2100-03-01", "2100 isn't a leap year (century, not divisible by 400)"],
    ["2000-02-28", 1, "2000-02-29", "2000 is a leap year (divisible by 400)"],
    ["2026-07-01", 365, "2027-07-01", "no 29 February between them, so a year is 365 days"],
    ["2027-07-01", 366, "2028-07-01", "29 Feb 2028 is in between, so a year is 366 days"],
    ["2028-07-01", -366, "2027-07-01", "the same year, counted backwards"],
    // 2026 has 365 days → 2027-01-01 is +365; 2027 has 365 → 2028-01-01 is +730.
    // 270 days left in leap 2028: Jan 31 + Feb 29 + Mar 31 + Apr 30 + May 31 +
    // Jun 30 + Jul 31 + Aug 31 = 244 → 1 Sep is +974; 26 more → 27 Sep.
    ["2026-01-01", 1000, "2028-09-27", "a long jump across a leap year"],
  ];
  for (const [iso, days, expected, why] of cases) {
    it(`${iso} ${days >= 0 ? "+" : "−"} ${Math.abs(days)} = ${expected} (${why})`, () => {
      expect(addDays(iso, days)).toBe(expected);
    });
  }
});

describe("addDays — early years stay four digits and use the same calendar", () => {
  // JavaScript's Date.UTC(99, ...) means 1999, not the year 99, so code that
  // leans on it gets these wrong. isIsoDate uses the same calendar back to year 1.
  const cases: Array<[string, number, string, string]> = [
    ["0099-12-31", 1, "0100-01-01", "year 99 is not 1999"],
    ["0100-01-01", -1, "0099-12-31", "back across the year 100"],
    ["0999-12-31", 1, "1000-01-01", "three-digit year to four"],
    ["0050-03-01", -1, "0050-02-28", "50 isn't divisible by 4, so no leap day"],
    ["0048-03-01", -1, "0048-02-29", "48 is divisible by 4, so a leap day"],
    ["0001-01-02", -1, "0001-01-01", "the first day of year 1 is fine"],
    ["9999-12-30", 1, "9999-12-31", "the last day a YYYY-MM-DD string can hold is fine"],
  ];
  for (const [iso, days, expected, why] of cases) {
    it(`${iso} ${days >= 0 ? "+" : "−"} ${Math.abs(days)} = ${expected} (${why})`, () => {
      expect(addDays(iso, days)).toBe(expected);
    });
  }
});

describe("addDays — the phone's time zone and clock make no difference", () => {
  // Days around the 2026 daylight-saving changes. Code that adds 24 hours of
  // milliseconds to a local midnight lands on the wrong date on a 23- or
  // 25-hour day:
  //   New York falls back on Sun 1 Nov 2026 (25 hours): midnight 1 Nov + 24 h
  //     is 23:00 on 1 Nov.
  //   New York springs forward on Sun 8 Mar 2026 (23 hours): midnight 9 Mar
  //     − 24 h is 23:00 on 7 Mar.
  //   Sydney falls back on Sun 5 Apr 2026 and springs forward on Sun 4 Oct 2026.
  // Code that parses the string as midnight UTC lands a day early in the
  // Americas (UTC−) and code that mixes local and UTC goes wrong at UTC+14.
  const cases: Array<[string, string, number, string]> = [
    ["America/New_York", "2026-11-01", 1, "2026-11-02"],
    ["America/New_York", "2026-11-02", -1, "2026-11-01"],
    ["America/New_York", "2026-03-08", 1, "2026-03-09"],
    ["America/New_York", "2026-03-09", -1, "2026-03-08"],
    ["Australia/Sydney", "2026-04-05", 1, "2026-04-06"],
    ["Australia/Sydney", "2026-10-05", -1, "2026-10-04"],
    ["Australia/Sydney", "2026-10-04", -1, "2026-10-03"],
    ["America/Los_Angeles", "2026-07-01", 0, "2026-07-01"],
    ["Pacific/Pago_Pago", "2026-12-31", 1, "2027-01-01"],
    ["Pacific/Kiritimati", "2026-12-31", 1, "2027-01-01"],
    ["Pacific/Kiritimati", "2026-03-01", -1, "2026-02-28"],
  ];
  for (const [zone, iso, days, expected] of cases) {
    it(`on a device in ${zone}, ${iso} ${days >= 0 ? "+" : "−"} ${Math.abs(days)} = ${expected}`, () => {
      onDeviceIn(zone, () => {
        expect(addDays(iso, days)).toBe(expected);
      });
    });
  }

  it("doesn't read the clock: with the clock frozen on 1 Jan 2030, 2026-07-01 + 1 is still 2026-07-02", () => {
    vi.useFakeTimers();
    vi.setSystemTime(utc(2030, 1, 1, 0, 0));
    expect(addDays("2026-07-01", 1)).toBe("2026-07-02");
  });
});

describe("addDays — refuses bad input with RangeError", () => {
  const badDates: Array<[unknown, string]> = [
    ["2026-02-29", "2026 has no 29 February"],
    ["2026-04-31", "April has 30 days"],
    ["2026-7-1", "month and day must be two digits"],
    ["01/07/2026", "a display format"],
    ["2026-07-01T00:00:00Z", "a timestamp, not a date"],
    ["0000-01-01", "there is no year 0"],
    ["", "empty"],
    [20260701, "a number"],
    [null, "null"],
    [new Date(Date.UTC(2026, 6, 1)), "a Date object"],
  ];
  for (const [value, why] of badDates) {
    it(`throws for the date ${typeof value === "string" ? JSON.stringify(value) : String(value)} (${why})`, () => {
      expect(() => addDays(value as string, 1)).toThrow(RangeError);
    });
  }

  const badDays: Array<[unknown, string]> = [
    [1.5, "half a day"],
    [-0.25, "part of a day"],
    [Number.NaN, "NaN"],
    [Number.POSITIVE_INFINITY, "Infinity"],
    [Number.NEGATIVE_INFINITY, "-Infinity"],
    ["1", "a string"],
    [null, "null"],
    [undefined, "missing"],
  ];
  for (const [value, why] of badDays) {
    it(`throws for days = ${typeof value === "string" ? JSON.stringify(value) : String(value)} (${why})`, () => {
      expect(() => addDays("2026-07-01", value as number)).toThrow(RangeError);
    });
  }

  const outOfRange: Array<[string, number, string]> = [
    ["9999-12-31", 1, "past the last date a 4-digit year can hold"],
    ["0001-01-01", -1, "before year 1 (there is no year 0)"],
    ["2026-07-01", 3_000_000, "about 8,200 years later: a 5-digit year"],
    ["2026-07-01", -800_000, "about 2,190 years earlier: before year 1"],
  ];
  for (const [iso, days, why] of outOfRange) {
    it(`throws for ${iso} ${days >= 0 ? "+" : "−"} ${Math.abs(days)} (${why})`, () => {
      expect(() => addDays(iso, days)).toThrow(RangeError);
    });
  }
});
