// Money helpers for Stage 1: turning what the artist types into cents, and
// showing cents as a tidy amount again.
//
// Guide §7: money is stored as whole minor units (cents), never as a decimal
// number like 110.5. Guide §17 Stage 1 has the starting exercise this extends.
// Rules: docs/stages/stage-01.md "Owner decisions" and the DECISIONS.md row
// "Typed amounts: detailed rules (T1.4 tests)".
//
// T1.16b: the owner set a business maximum of $9,999,999.99 per entry
// (DECISIONS.md, 2026-10-26). parseAmountToCents refuses anything bigger, and
// amountProblem tells a form WHY an amount was refused (empty, a format
// mistake, or too large) so it can show the right message.
//
// Stage 1 assumes every currency has 2 decimal places and that a full stop is
// the decimal mark. Stage 4 generalises both: decimal places per currency
// from ISO 4217 (JPY has 0, KWD has 3) and the person's own decimal mark.

// What an accepted amount looks like, read left to right:
//   ^\$?                      an optional single "$" at the very start
//   (\d{1,3}(?:,\d{3})+|\d+)  the dollars: either properly grouped with commas
//                             ("1,234,567") or plain digits ("1234567")
//   (?:\.(\d{1,2}))?$         optionally a full stop and 1 or 2 cent digits
// \d (without the "u" flag) only matches the ASCII digits 0-9. There is no
// "g" flag on purpose: a "g" regex remembers where it stopped last time, which
// makes every second call give the wrong answer.
const AMOUNT_PATTERN = /^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/**
 * The largest amount one entry may hold: $9,999,999.99 = 9,999,999 × 100 + 99
 * = 999,999,999 cents. This is an owner decision (DECISIONS.md "Typed
 * amounts: detailed rules", 2026-10-26): no artist's single expense or sale
 * is that big, so a bigger number is almost certainly a typo.
 *
 * It also keeps totals safe. JavaScript numbers hold whole numbers exactly
 * only up to Number.MAX_SAFE_INTEGER (about 9 million billion cents). With
 * each entry at most about a billion cents, millions of entries could be added
 * together before a total got anywhere near that limit.
 */
export const MAX_AMOUNT_CENTS = 999_999_999;

// The same cap as a BigInt, for comparing with the BigInt sum below.
const MAX_AMOUNT_BIG = BigInt(MAX_AMOUNT_CENTS);

/** Why a typed amount can't be used; null means it's fine. */
export type AmountProblem = "empty" | "format" | "too-large";

/**
 * Reads the text into cents as a BigInt (any size, exactly), or null when it
 * breaks the format rules. The size isn't checked here; both public functions
 * below share this one reading, so they can never disagree.
 */
function readCents(input: string): bigint | null {
  // Spaces, tabs and newlines around the amount are fine; inside it they aren't.
  const match = AMOUNT_PATTERN.exec(input.trim());
  if (match === null) return null;

  // The regex already checked the commas sit in groups of 3, so now it's
  // safe to drop them: "1,234" becomes "1234".
  const wholeDigits = match[1].replaceAll(",", "");
  // "5" means 50 cents and "05" means 5 cents, so pad on the right to 2 digits.
  const centDigits = (match[2] ?? "").padEnd(2, "0");

  // Whole-number maths only: dollars × 100 + cents. BigInt holds integers of
  // any size exactly, so even a 30-digit typo can't be mis-rounded before
  // we check it against the cap.
  return BigInt(wholeDigits) * BigInt(100) + BigInt(centDigits);
}

/**
 * Reads a typed amount such as "$1,234.5" and returns it in cents (123450).
 * Returns null when the text isn't a valid amount or is above the owner's cap
 * of $9,999,999.99 (MAX_AMOUNT_CENTS). Nothing is ever rounded: "10.505" is
 * rejected rather than guessed at.
 */
export function parseAmountToCents(input: string): number | null {
  const cents = readCents(input);
  if (cents === null || cents > MAX_AMOUNT_BIG) return null;
  // At most 999,999,999, so turning it into a normal number is exact.
  return Number(cents);
}

/**
 * Says why a typed amount can't be used, so a form can show the right message:
 *   "empty"     nothing but spaces was typed;
 *   "format"    the text breaks the rules above (e.g. "10.505", "-5", "abc"),
 *               whatever its size;
 *   "too-large" a proper amount, but above $9,999,999.99;
 *   null        the amount is fine.
 * It always agrees with parseAmountToCents: null here exactly when that gives
 * a number of cents.
 */
export function amountProblem(input: string): AmountProblem | null {
  if (input.trim() === "") return "empty";
  const cents = readCents(input);
  if (cents === null) return "format";
  if (cents > MAX_AMOUNT_BIG) return "too-large";
  return null;
}

/**
 * Shows cents as money in the person's style, e.g. 123456 cents in AUD for
 * "en-AU" is "$1,234.56". Stage 1: assumes the currency has 2 decimal places.
 */
export function formatCents(cents: number, currency: string, locale: string): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError("formatCents needs a whole number of cents");
  }

  // Build the exact decimal text ("1234.56") by splitting the digits, instead
  // of dividing by 100: 9007199254740991 / 100 comes out as …409.9 in floats.
  const sign = cents < 0 ? "-" : "";
  const digits = String(Math.abs(cents)).padStart(3, "0"); // 5 -> "005"
  const whole = digits.slice(0, -2);
  const frac = digits.slice(-2);
  const decimalText = `${sign}${whole}.${frac}` as `${number}`;

  // Intl.NumberFormat accepts a decimal string and formats it exactly, adding
  // the currency symbol, grouping and decimal mark for the locale.
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(decimalText);
}
