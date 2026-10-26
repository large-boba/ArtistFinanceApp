// Date helpers for Stage 1 (guide §6, "store a date, not a moment").
//
// A transaction date is a calendar date such as "2026-07-01", kept as a
// "YYYY-MM-DD" string from start to finish. It is never a moment in time, so
// it can't drift to the day before or after when the phone changes time zone.
//
// Two rules from the guide shape everything here:
//   - Never turn a "YYYY-MM-DD" string into a Date by parsing it: JavaScript
//     reads it as midnight UTC, which is still the previous day in the Americas.
//   - Never add or subtract hours by hand for time zones or daylight saving.
//     Intl and the IANA time zone database already know every zone's rules.

// Exactly four digits, a hyphen, two digits, a hyphen, two digits, and nothing
// else. Without the "u" flag \d only matches the ASCII digits 0-9, and in
// JavaScript "$" only matches at the very end, so "2026-07-01\n" fails.
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The calendar date ("YYYY-MM-DD") at the instant `now`, as seen in the IANA
 * time zone `timeZone`. With no zone it uses the device's own zone; with no
 * instant it uses the current time. Throws RangeError for an unknown zone or
 * an invalid Date.
 *
 * Example: 15:30 UTC on 30 June 2026 is 23:30 on 30 June in Perth
 * ("2026-06-30") but 01:30 on 1 July in Sydney ("2026-07-01").
 */
export function todayOnDevice(now: Date = new Date(), timeZone?: string): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new RangeError("todayOnDevice needs a valid Date");
  }

  // "en-CA" writes dates as year-month-day. We still read the pieces one by
  // one (formatToParts) instead of trusting the whole formatted string, and
  // pin the Gregorian calendar and Latin digits, so the result is always
  // "YYYY-MM-DD" in ASCII whatever language the device uses. Leaving
  // `timeZone` undefined tells Intl to use the device's zone. An unknown zone
  // makes Intl throw a RangeError for us.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: "year" | "month" | "day"): string => {
    const found = parts.find((p) => p.type === type);
    if (found === undefined) throw new RangeError(`todayOnDevice: Intl gave no ${type}`);
    return found.value;
  };

  const result = `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
  // A last safety net: never hand back something that isn't a real date.
  if (!isIsoDate(result)) throw new RangeError("todayOnDevice: unexpected date format from Intl");
  return result;
}

/** True when the year has a 29 February: every 4th year, except centuries not divisible by 400. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** How many days the month has (month is 1-12). */
function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Splits a valid "YYYY-MM-DD" into numbers, or returns null if it isn't one. */
function splitIsoDate(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== "string") return null;
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // The Gregorian calendar has no year 0.
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * True only for a string written exactly as "YYYY-MM-DD" that is also a real
 * calendar date: "2028-02-29" passes (leap year), "2026-02-29" and
 * "2026-04-31" don't.
 */
export function isIsoDate(value: unknown): value is string {
  return splitIsoDate(value) !== null;
}

/**
 * Shows a stored date the person's way, e.g. "2026-07-01" is "7/1/2026" for
 * "en-US" and "01/07/2026" for "en-AU". The same day in every device time zone.
 * Throws RangeError when `iso` isn't a real "YYYY-MM-DD" date.
 */
export function formatDateForDisplay(iso: string, locale: string): string {
  const parts = splitIsoDate(iso);
  if (parts === null) throw new RangeError("formatDateForDisplay needs a real YYYY-MM-DD date");

  // Build the moment "noon UTC on that day" from the numbers (never from the
  // string), then format it in UTC as well. Both sides use UTC, so the device's
  // own zone never comes into it and the day can't shift. setUTCFullYear is
  // used because Date.UTC would treat years 0-99 as 1900-1999.
  const instant = new Date(0);
  instant.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  instant.setUTCHours(12, 0, 0, 0);

  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(instant);
}

// ─── Adding days to a date (T1.10) ───────────────────────────────────────────
//
// addDays works only with the year, month and day numbers. It never makes a
// Date, so neither the phone's time zone nor daylight saving (a 23- or 25-hour
// day) can move the answer, and the clock is never read.
//
// The idea: give every calendar day a serial number (a "day number"), add the
// days to that number, then turn the number back into a year, month and day.
// The two conversions are Howard Hinnant's well-known days_from_civil and
// civil_from_days formulas, which use only whole-number maths. Their one trick is to start each
// year on 1 March, so the awkward leap day (29 February) falls at the very
// end of the year and the month lengths before it never change.

/** Day number of 1970-01-01 is 0; each day after adds 1, each day before takes 1 away. */
function dayNumberOf(year: number, month: number, day: number): number {
  // Count January and February as months 11 and 12 of the year before.
  const y = month <= 2 ? year - 1 : year;
  // The calendar repeats exactly every 400 years (146,097 days): an "era".
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400; // 0..399
  const monthFromMarch = month > 2 ? month - 3 : month + 9; // March 0 .. February 11
  // Days from 1 March to the 1st of this month (31, 30, 31, 30, 31 ... pattern), plus the day.
  const dayOfYear = Math.floor((153 * monthFromMarch + 2) / 5) + day - 1;
  // A year has 365 days, plus a leap day every 4th year, minus one every 100th, plus one every 400th.
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  // 0000-03-01 is 719,468 days before 1970-01-01, so taking 719,468 away makes 1970-01-01 come out as 0.
  return era * 146097 + dayOfEra - 719468;
}

/** The reverse of dayNumberOf: turns a day number back into year, month and day. */
function dateOfDayNumber(dayNumber: number): { year: number; month: number; day: number } {
  const z = dayNumber + 719468; // days since 0000-03-01
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097; // 0..146096
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  ); // 0..399
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthFromMarch = Math.floor((5 * dayOfYear + 2) / 153); // March 0 .. February 11
  const day = dayOfYear - Math.floor((153 * monthFromMarch + 2) / 5) + 1;
  const month = monthFromMarch < 10 ? monthFromMarch + 3 : monthFromMarch - 9;
  // January and February belong to the next calendar year (see dayNumberOf).
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

// The first and last days a "YYYY-MM-DD" string can hold (there is no year 0).
const FIRST_DAY_NUMBER = dayNumberOf(1, 1, 1);
const LAST_DAY_NUMBER = dayNumberOf(9999, 12, 31);

/**
 * The calendar date `days` days after `iso` (before it when `days` is
 * negative), e.g. addDays("2026-03-01", -1) is "2026-02-28" and
 * addDays("2028-03-01", -1) is "2028-02-29" (a leap year).
 * Throws RangeError when `iso` isn't a real "YYYY-MM-DD" date, when `days`
 * isn't a whole number, or when the answer would be before 0001-01-01 or
 * after 9999-12-31.
 */
export function addDays(iso: string, days: number): string {
  const parts = splitIsoDate(iso);
  if (parts === null) throw new RangeError("addDays needs a real YYYY-MM-DD date");
  // Number.isInteger is false for 1.5, NaN, Infinity and anything that isn't a number (such as "1").
  if (!Number.isInteger(days)) throw new RangeError("addDays needs a whole number of days");

  const target = dayNumberOf(parts.year, parts.month, parts.day) + days;
  if (target < FIRST_DAY_NUMBER || target > LAST_DAY_NUMBER) {
    throw new RangeError("addDays: the answer would be outside 0001-01-01 to 9999-12-31");
  }

  const { year, month, day } = dateOfDayNumber(target);
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}
