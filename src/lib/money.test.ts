// Tests for T1.4 — turning typed amounts into cents (docs/stages/stage-01.md).
//
// Written by test-engineer BEFORE src/lib/money.ts exists. The builder must
// not edit this file; disputes go to the project lead.
//
// The rules come from the owner (stage-01.md "Owner decisions", 2026-10-25,
// and DECISIONS.md "Typed amounts (Stage 1)"):
//   - A leading `$` is ignored ("$110" means 110.00).
//   - Commas are thousands separators and are ignored ("1,100.00" = 1100.00).
//   - At most 2 decimals; "10.505" is rejected, not rounded.
//   - Zero is allowed.
//   - Negative amounts, other symbols, letters and empty input are rejected.
//   - A full stop is the only decimal mark (comma decimals come in Stage 4).
// Plus guide §7: money is integer minor units, and the card says no
// floating-point arithmetic on money.
//
// Where the owner's rules don't settle a case, the decision taken here is
// written next to the case as "DECISION:". The lead confirms these.
//
// Every expected value below was worked out by hand: cents = whole × 100 +
// the two fraction digits. None comes from the code under test.
//
// T1.16b (owner's amount cap, 2026-10-26): every amount is at most
// $9,999,999.99 per entry (999,999,999 cents). Tests that expected larger
// amounts to be accepted are marked "CHANGED (T1.16b, owner cap)". The new
// amountProblem() is tested on the same table as parseAmountToCents. formatCents
// is a general helper and is NOT capped: its large-number tests are unchanged.

import { describe, expect, it } from "vitest";
import { amountProblem, formatCents, parseAmountToCents } from "@/lib/money";

type Accepted = { input: string; cents: number; why: string };

/** Shows whitespace and unusual characters in the test name. */
const show = (s: string) => JSON.stringify(s);

function expectCents(input: string, cents: number) {
  const result = parseAmountToCents(input);
  // toBe uses Object.is: 0 must be 0 (not -0), and the type must be number.
  expect(result).toBe(cents);
  expect(Number.isInteger(result)).toBe(true);
  expect(Number.isSafeInteger(result)).toBe(true);
}

function expectRejected(input: string) {
  // Exactly null: not undefined, NaN, 0 or a thrown error.
  expect(parseAmountToCents(input)).toBeNull();
}

describe("parseAmountToCents — accepts the card's valid cases", () => {
  const cases: Accepted[] = [
    { input: "110", cents: 11000, why: "whole dollars: 110 × 100" },
    { input: "110.5", cents: 11050, why: "one decimal means tens of cents: 110 × 100 + 50" },
    { input: "110.50", cents: 11050, why: "two decimals: 110 × 100 + 50" },
    { input: "$110", cents: 11000, why: "owner: a leading $ is ignored" },
    { input: "1,100.00", cents: 110000, why: "owner: commas are thousands separators; 1100 × 100" },
    { input: "0", cents: 0, why: "owner: zero is allowed" },
    { input: "0.00", cents: 0, why: "owner: zero is allowed" },
    { input: "  12.30  ", cents: 1230, why: "spaces around are trimmed; 12 × 100 + 30" },
  ];
  for (const c of cases) {
    it(`reads ${show(c.input)} as ${c.cents} cents (${c.why})`, () => {
      expectCents(c.input, c.cents);
    });
  }
});

describe("parseAmountToCents — rejects the card's invalid cases", () => {
  const cases: { input: string; why: string }[] = [
    { input: "10.505", why: "owner: more than 2 decimals is rejected, not rounded" },
    { input: "-5", why: "owner: negative amounts are rejected" },
    { input: "abc", why: "owner: letters are rejected" },
    { input: "", why: "owner: empty input is rejected" },
    { input: "1,10,0", why: "commas must be real thousands groups of 3 digits" },
    { input: "€5", why: "owner: other symbols are rejected (only a leading $ is ignored)" },
  ];
  for (const c of cases) {
    it(`rejects ${show(c.input)} (${c.why})`, () => {
      expectRejected(c.input);
    });
  }
});

describe("parseAmountToCents — the $ sign", () => {
  it('reads "$1,234.56" as 123456 cents ($ and a thousands comma together: 1234 × 100 + 56)', () => {
    expectCents("$1,234.56", 123456);
  });

  it('reads "$0" as 0 cents (zero is allowed with a $ too)', () => {
    expectCents("$0", 0);
  });

  // DECISION: "$ 5" is rejected. Only whitespace AROUND the whole input is
  // trimmed; no space is allowed between the $ and the number. One simple
  // rule: no whitespace inside the amount.
  it('rejects "$ 5" (no space allowed between $ and the number)', () => {
    expectRejected("$ 5");
  });

  // Owner says a LEADING $ is ignored; a trailing one is "another symbol".
  it('rejects "5$" (only a leading $ is ignored)', () => {
    expectRejected("5$");
  });

  // DECISION: at most one $.
  it('rejects "$$5" (only one leading $)', () => {
    expectRejected("$$5");
  });

  it('rejects "1$00" ($ in the middle is another symbol)', () => {
    expectRejected("1$00");
  });

  it('rejects "$" on its own (no number)', () => {
    expectRejected("$");
  });

  // DECISION: currency codes and other dollar prefixes are "other symbols or
  // letters", so they are rejected. Only a bare $ is ignored.
  it('rejects "A$5" (letters before the $)', () => {
    expectRejected("A$5");
  });

  it('rejects "5 AUD" (letters after the number)', () => {
    expectRejected("5 AUD");
  });
});

describe("parseAmountToCents — signs and negatives", () => {
  it('rejects "$-5" (negative after the $)', () => {
    expectRejected("$-5");
  });

  it('rejects "-$5" (negative before the $)', () => {
    expectRejected("-$5");
  });

  // DECISION: "+" is "another symbol", so it is rejected.
  it('rejects "+5" (a plus sign is another symbol)', () => {
    expectRejected("+5");
  });

  // DECISION: "-0" is rejected. The owner rejects negatives by their sign,
  // even when the value would be zero.
  it('rejects "-0" (the minus sign is rejected even for zero)', () => {
    expectRejected("-0");
  });

  // Accountants' brackets mean negative (guide §13), so they are rejected here.
  it('rejects "(5.00)" (brackets mean negative)', () => {
    expectRejected("(5.00)");
  });
});

describe("parseAmountToCents — the decimal point", () => {
  // DECISION: ".5" and "5." are rejected, following the guide's Stage 1
  // pattern /^\d+(\.\d{1,2})?$/: at least one digit before the point, and
  // at least one digit after it when there is a point.
  it('rejects ".5" (needs a digit before the point; type "0.5")', () => {
    expectRejected(".5");
  });

  it('rejects "5." (needs a digit after the point; type "5")', () => {
    expectRejected("5.");
  });

  it('rejects "$.5" (same rule with a $)', () => {
    expectRejected("$.5");
  });

  it('rejects "." on its own', () => {
    expectRejected(".");
  });

  it('rejects "1.2.3" (only one decimal point)', () => {
    expectRejected("1.2.3");
  });

  it('rejects "10.5050" (four decimals, even with a trailing zero)', () => {
    expectRejected("10.5050");
  });

  it('rejects "1.005" (three decimals is never rounded)', () => {
    expectRejected("1.005");
  });

  // Owner: a full stop is the only decimal mark until Stage 4.
  it('rejects "12,50" (a comma is not a decimal mark in Stage 1)', () => {
    expectRejected("12,50");
  });

  it('reads "0.05" as 5 cents (a leading zero in the fraction is kept: 0 × 100 + 05)', () => {
    expectCents("0.05", 5);
  });

  it('reads "0.5" as 50 cents (0 × 100 + 50)', () => {
    expectCents("0.5", 50);
  });

  it('reads "0.01" as 1 cent (the smallest amount)', () => {
    expectCents("0.01", 1);
  });
});

describe("parseAmountToCents — thousands commas", () => {
  it('reads "1,000" as 100000 cents (a comma without decimals: 1000 × 100)', () => {
    expectCents("1,000", 100000);
  });

  it('reads "1,000,000.50" as 100000050 cents (several groups: 1000000 × 100 + 50)', () => {
    expectCents("1,000,000.50", 100000050);
  });

  // Commas are optional: "1000" with no commas is fine.
  it('reads "1000" as 100000 cents (commas are optional)', () => {
    expectCents("1000", 100000);
  });

  it('rejects "1,0000" (a group after a comma must be exactly 3 digits)', () => {
    expectRejected("1,0000");
  });

  it('rejects "1,00.00" (a 2-digit group is not a thousands group)', () => {
    expectRejected("1,00.00");
  });

  it('rejects "1000,000" (the first group before a comma is at most 3 digits)', () => {
    expectRejected("1000,000");
  });

  it('rejects "1,000000" (mixing grouped and ungrouped digits)', () => {
    expectRejected("1,000000");
  });

  it('rejects ",100" (a comma cannot start the number)', () => {
    expectRejected(",100");
  });

  it('rejects "$,100" (a comma cannot follow the $)', () => {
    expectRejected("$,100");
  });

  it('rejects "100," (a comma cannot end the number)', () => {
    expectRejected("100,");
  });

  it('rejects "1,,000" (two commas in a row)', () => {
    expectRejected("1,,000");
  });

  it('rejects "1,000.5,0" (no commas after the decimal point)', () => {
    expectRejected("1,000.5,0");
  });

  it('rejects "," on its own', () => {
    expectRejected(",");
  });
});

describe("parseAmountToCents — digits", () => {
  // DECISION: leading zeros are accepted, as in the guide's pattern (\d+).
  it('reads "00012" as 1200 cents (leading zeros are allowed: 12 × 100)', () => {
    expectCents("00012", 1200);
  });

  // Letters inside JavaScript's number syntax are still letters.
  it('rejects "1e3" (exponent notation contains a letter)', () => {
    expectRejected("1e3");
  });

  it('rejects "0x10" (hex notation contains a letter)', () => {
    expectRejected("0x10");
  });

  it('rejects "Infinity" (a word, even though Number() accepts it)', () => {
    expectRejected("Infinity");
  });

  it('rejects "NaN" (a word)', () => {
    expectRejected("NaN");
  });

  it('rejects "1_000" (an underscore separator is another symbol)', () => {
    expectRejected("1_000");
  });

  // DECISION: only ASCII digits 0–9. Other scripts' digits come with the
  // number-format work in Stage 4, if at all.
  it('rejects "١٢" (Arabic-Indic digits)', () => {
    expectRejected("١٢");
  });

  it('rejects "１２" (full-width digits)', () => {
    expectRejected("１２");
  });
});

describe("parseAmountToCents — whitespace", () => {
  it('reads "\\t12.30\\n" as 1230 cents (tabs and newlines around are trimmed)', () => {
    expectCents("\t12.30\n", 1230);
  });

  it('reads "\\r\\n 5 \\r\\n" as 500 cents (Windows line endings around are trimmed)', () => {
    expectCents("\r\n 5 \r\n", 500);
  });

  // DECISION: the trim is JavaScript's String.prototype.trim, which also
  // removes non-breaking spaces (common when pasting from other apps).
  it('reads "\\u00a012.30\\u00a0" as 1230 cents (non-breaking spaces around are trimmed)', () => {
    expectCents(" 12.30 ", 1230);
  });

  it('rejects "   " (only spaces counts as empty)', () => {
    expectRejected("   ");
  });

  it('rejects "\\t\\n" (only tabs and newlines counts as empty)', () => {
    expectRejected("\t\n");
  });

  it('rejects "1 000" (no spaces inside the number)', () => {
    expectRejected("1 000");
  });

  it('rejects "12. 30" (no spaces inside the number)', () => {
    expectRejected("12. 30");
  });
});

describe("parseAmountToCents — no floating-point errors", () => {
  // Each of these goes wrong with plain float maths, e.g. 0.29 * 100 is
  // 28.999999999999996 and 4.35 * 100 is 434.99999999999994 in JavaScript.
  // Parsing the whole and fraction parts as integers gets them exactly.
  const cases: Accepted[] = [
    { input: "0.29", cents: 29, why: "0.29 × 100 is 28.999… in floats" },
    { input: "1.15", cents: 115, why: "1.15 × 100 is 114.999… in floats" },
    { input: "4.35", cents: 435, why: "4.35 × 100 is 434.999… in floats" },
    { input: "19.99", cents: 1999, why: "19 × 100 + 99" },
    { input: "8.2", cents: 820, why: "8 × 100 + 20" },
  ];
  for (const c of cases) {
    it(`reads ${show(c.input)} as exactly ${c.cents} cents (${c.why})`, () => {
      expectCents(c.input, c.cents);
    });
  }
});

describe("parseAmountToCents — very large amounts (CHANGED (T1.16b, owner cap))", () => {
  // CHANGED (T1.16b, owner cap): T1.4 accepted everything up to
  // Number.MAX_SAFE_INTEGER (9007199254740991) cents. The owner's business
  // maximum (DECISIONS.md "Typed amounts: detailed rules", 2026-10-26) is
  // $9,999,999.99 per entry = 999,999,999 cents, so each amount that used to
  // be accepted here is now rejected (null). The values are the same as
  // before; only the expected answer changed. The new cap itself is pinned
  // in "the owner's cap" below.

  it('rejects "999999999999.99" (CHANGED (T1.16b, owner cap): 99999999999999 cents is above 999999999)', () => {
    expectRejected("999999999999.99");
  });

  it('rejects "1,000,000,000,000.00" (CHANGED (T1.16b, owner cap): 10^12 dollars is above the cap)', () => {
    expectRejected("1,000,000,000,000.00");
  });

  it('rejects "90071992547409.91" (CHANGED (T1.16b, owner cap): exactly Number.MAX_SAFE_INTEGER cents, far above the cap)', () => {
    expectRejected("90071992547409.91");
  });

  it('rejects "90071992547409.01" (CHANGED (T1.16b, owner cap): above the cap)', () => {
    expectRejected("90071992547409.01");
  });

  it('rejects "90071992547409.10" (CHANGED (T1.16b, owner cap): above the cap)', () => {
    expectRejected("90071992547409.10");
  });

  it('rejects "90,071,992,547,409.91" (CHANGED (T1.16b, owner cap): above the cap, with commas)', () => {
    expectRejected("90,071,992,547,409.91");
  });

  // Unchanged: these were already rejected (above the safe limit) and are
  // still rejected (above the cap too). Never rounded to a nearby number.
  it('rejects "90071992547409.92" (one cent above Number.MAX_SAFE_INTEGER)', () => {
    expectRejected("90071992547409.92");
  });

  it('rejects "90071992547410" (whole dollars above the safe limit)', () => {
    expectRejected("90071992547410");
  });

  it('rejects "1" followed by 30 zeros (far above the safe limit)', () => {
    expectRejected("1" + "0".repeat(30));
  });
});

// ─── T1.16b: the owner's cap, $9,999,999.99 per entry ───────────────────────
//
// Owner (DECISIONS.md "Typed amounts: detailed rules", 2026-10-26): every
// amount is at most $9,999,999.99 = 9999999 × 100 + 99 = 999,999,999 cents.
//
// LEAD'S DECISIONS (T1.16b):
//   - parseAmountToCents returns null above 999,999,999 cents.
//   - A new pure function in money.ts tells the forms WHY an amount was
//     refused, so they can show the right message:
//       amountProblem(input: string): "empty" | "format" | "too-large" | null
//     null means the amount is fine. It agrees with parseAmountToCents on
//     every input: amountProblem(x) === null exactly when
//     parseAmountToCents(x) !== null.
//
// TEST ENGINEER'S READINGS (the lead may overrule):
//   - "empty" is the input after trimming (String.prototype.trim) being "",
//     the same "only spaces counts as empty" rule as the forms.
//   - "format" wins over "too-large": a text that breaks the T1.4 rules is a
//     format mistake whatever its size. So "10000000.001" is "format", and
//     "9999999.991" stays "format" (three decimals, as before), never
//     "too-large".
//   - Anything that passes the T1.4 rules but is above the cap is
//     "too-large", however big ("1" followed by 30 zeros included), and
//     leading zeros don't matter ("00010000000" is 10,000,000 dollars).
//
// Every number below is worked out by hand: cents = dollars × 100 + cents.

type CapCase = {
  input: string;
  cents: number | null;
  problem: "empty" | "format" | "too-large" | null;
  why: string;
};

const CAP_TABLE: readonly CapCase[] = [
  // Accepted: at or below the cap.
  { input: "9999999.99", cents: 999999999, problem: null, why: "the cap itself: 9999999 × 100 + 99" },
  { input: "$9,999,999.99", cents: 999999999, problem: null, why: "the cap with $ and thousands commas" },
  { input: "9,999,999.99", cents: 999999999, problem: null, why: "the cap with thousands commas" },
  { input: "  $9,999,999.99  ", cents: 999999999, problem: null, why: "the cap with spaces around (trimmed)" },
  { input: "0009999999.99", cents: 999999999, problem: null, why: "the cap with leading zeros" },
  { input: "9999999.98", cents: 999999998, problem: null, why: "one cent below the cap: 9999999 × 100 + 98" },
  { input: "9999999.9", cents: 999999990, problem: null, why: "one decimal: 9999999 × 100 + 90" },
  { input: "9999999", cents: 999999900, problem: null, why: "whole dollars: 9999999 × 100" },
  { input: "1,000,000.50", cents: 100000050, problem: null, why: "a million and 50 cents: 1000000 × 100 + 50" },
  { input: "0", cents: 0, problem: null, why: "zero is still allowed" },
  { input: "12.30", cents: 1230, problem: null, why: "an everyday amount: 12 × 100 + 30" },

  // Too large: valid T1.4 text above 999,999,999 cents.
  { input: "10000000", cents: null, problem: "too-large", why: "$10,000,000.00 = 1,000,000,000 cents, one cent above the cap" },
  { input: "10,000,000.00", cents: null, problem: "too-large", why: "the same with commas and cents" },
  { input: "$10,000,000", cents: null, problem: "too-large", why: "the same with $" },
  { input: "10000000.00", cents: null, problem: "too-large", why: "the same, plain with two decimals" },
  { input: "10000000.01", cents: null, problem: "too-large", why: "1,000,000,001 cents" },
  { input: "00010000000", cents: null, problem: "too-large", why: "leading zeros don't hide the size" },
  { input: "99999999.99", cents: null, problem: "too-large", why: "ten times the cap" },
  { input: "90071992547409.91", cents: null, problem: "too-large", why: "the old limit, Number.MAX_SAFE_INTEGER cents" },
  { input: "90071992547409.92", cents: null, problem: "too-large", why: "one cent above the old limit" },
  { input: "1" + "0".repeat(30), cents: null, problem: "too-large", why: "a 31-digit number" },

  // Format mistakes: refused by the T1.4 rules, whatever the size.
  { input: "9999999.991", cents: null, problem: "format", why: "three decimals, as before (not too-large)" },
  { input: "10000000.001", cents: null, problem: "format", why: "three decimals AND above the cap: format wins" },
  { input: "-10000000", cents: null, problem: "format", why: "a minus sign, whatever the size" },
  { input: "10,000,00", cents: null, problem: "format", why: "a 2-digit group after a comma" },
  { input: "10.505", cents: null, problem: "format", why: "three decimals" },
  { input: "-5", cents: null, problem: "format", why: "negative" },
  { input: "abc", cents: null, problem: "format", why: "letters" },
  { input: "$ 5", cents: null, problem: "format", why: "a space after $" },
  { input: "12,50", cents: null, problem: "format", why: "comma decimals wait for Stage 4" },
  { input: ".5", cents: null, problem: "format", why: "no digit before the point" },
  { input: "1e9", cents: null, problem: "format", why: "exponent notation is letters, not a big number" },

  // Empty: nothing but whitespace.
  { input: "", cents: null, problem: "empty", why: "nothing typed" },
  { input: "   ", cents: null, problem: "empty", why: "only spaces" },
  { input: "\t\n", cents: null, problem: "empty", why: "only a tab and a newline" },
];

describe("parseAmountToCents — the owner's cap, $9,999,999.99 (T1.16b)", () => {
  for (const c of CAP_TABLE) {
    if (c.cents === null) {
      it(`rejects ${show(c.input)} (${c.why})`, () => {
        expectRejected(c.input);
      });
    } else {
      it(`reads ${show(c.input)} as ${c.cents} cents (${c.why})`, () => {
        expectCents(c.input, c.cents as number);
      });
    }
  }
});

describe("amountProblem — why an amount is refused (T1.16b)", () => {
  for (const c of CAP_TABLE) {
    it(`gives ${JSON.stringify(c.problem)} for ${show(c.input)} (${c.why})`, () => {
      // toBe: exactly the string (or exactly null), not undefined or "".
      expect(amountProblem(c.input)).toBe(c.problem);
    });
  }

  for (const c of CAP_TABLE) {
    it(`agrees with parseAmountToCents on ${show(c.input)}: no problem exactly when there are cents`, () => {
      expect(amountProblem(c.input) === null).toBe(parseAmountToCents(c.input) !== null);
    });
  }

  it('gives the same answer twice in a row ("10000000" is "too-large" both times)', () => {
    expect(amountProblem("10000000")).toBe("too-large");
    expect(amountProblem("10000000")).toBe("too-large");
  });

  it("gives the right answer after a different one (no hidden state between calls)", () => {
    expect(amountProblem("abc")).toBe("format");
    expect(amountProblem("9999999.99")).toBeNull();
    expect(amountProblem("10000000")).toBe("too-large");
    expect(amountProblem("")).toBe("empty");
    expect(amountProblem("9999999.99")).toBeNull();
  });
});

describe("parseAmountToCents — no hidden state between calls", () => {
  // Catches a regex with the /g flag, whose lastIndex makes every second
  // .test() call fail.
  it('reads "110.50" as 11050 cents on two calls in a row', () => {
    expect(parseAmountToCents("110.50")).toBe(11050);
    expect(parseAmountToCents("110.50")).toBe(11050);
  });

  it("gives the right answer for a valid input after a rejected one", () => {
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("12.30")).toBe(1230);
    expect(parseAmountToCents("12.30")).toBe(1230);
  });
});

describe("formatCents", () => {
  // Some locales put a non-breaking space (U+00A0) or a narrow one (U+202F)
  // between the number and the currency. Turn them into plain spaces so the
  // expected strings below can be typed by hand.
  const plainSpaces = (s: string) => s.replace(/[  ]/g, " ");

  it('shows 11000 cents as "$110.00" in AUD for en-AU', () => {
    expect(formatCents(11000, "AUD", "en-AU")).toBe("$110.00");
  });

  it('shows 0 cents as "$0.00" in AUD for en-AU', () => {
    expect(formatCents(0, "AUD", "en-AU")).toBe("$0.00");
  });

  it('shows 123456 cents as "$1,234.56" in AUD for en-AU', () => {
    expect(formatCents(123456, "AUD", "en-AU")).toBe("$1,234.56");
  });

  it('shows 5 cents as "$0.05" (the leading zero of the cents is kept)', () => {
    expect(formatCents(5, "AUD", "en-AU")).toBe("$0.05");
  });

  it('shows 50 cents as "$0.50" (always two decimal places)', () => {
    expect(formatCents(50, "AUD", "en-AU")).toBe("$0.50");
  });

  it('shows 29 cents as "$0.29" (no float rounding artefacts)', () => {
    expect(formatCents(29, "AUD", "en-AU")).toBe("$0.29");
  });

  // 9007199254740901 / 100 is 90071992547409.02 in floats.
  it('shows 9007199254740901 cents as "$90,071,992,547,409.01" (exact, no float division)', () => {
    expect(formatCents(9007199254740901, "AUD", "en-AU")).toBe("$90,071,992,547,409.01");
  });

  it('shows 99999999999999 cents as "$999,999,999,999.99"', () => {
    expect(formatCents(99999999999999, "AUD", "en-AU")).toBe("$999,999,999,999.99");
  });

  // 9007199254740991 / 100 is 90071992547409.9 in floats, which would show
  // "…409.90". The card says no floating-point arithmetic on money, so the
  // largest amount parseAmountToCents accepts must show to the exact cent.
  it('shows Number.MAX_SAFE_INTEGER cents as "$90,071,992,547,409.91" (exact, no float division)', () => {
    expect(formatCents(9007199254740991, "AUD", "en-AU")).toBe("$90,071,992,547,409.91");
  });

  // The currency argument is used: en-AU shows foreign dollars by code.
  it('shows 123456 cents in USD for en-AU as "USD 1,234.56"', () => {
    expect(plainSpaces(formatCents(123456, "USD", "en-AU"))).toBe("USD 1,234.56");
  });

  // The locale argument is used, through Intl.NumberFormat: these grouping
  // and decimal styles come from Intl's locale data, not from hand-written
  // formatting. Indian grouping (lakh) is 1,23,456.78, not 123,456.78.
  it('shows 12345678 cents in INR for en-IN as "₹1,23,456.78" (Intl\'s Indian grouping)', () => {
    expect(formatCents(12345678, "INR", "en-IN")).toBe("₹1,23,456.78");
  });

  it('shows 123456 cents in EUR for de-DE as "1.234,56 €" (Intl\'s German format)', () => {
    expect(plainSpaces(formatCents(123456, "EUR", "de-DE"))).toBe("1.234,56 €");
  });

  it('shows 123456 cents in USD for en-US as "$1,234.56"', () => {
    expect(formatCents(123456, "USD", "en-US")).toBe("$1,234.56");
  });
});

describe("parseAmountToCents and formatCents together", () => {
  // What the artist types comes back as the tidy amount they meant.
  const roundTrips: [typed: string, shown: string][] = [
    ["110.5", "$110.50"],
    ["$1,234.56", "$1,234.56"],
    ["1000", "$1,000.00"],
    ["0", "$0.00"],
    // CHANGED (T1.16b, owner cap): the largest accepted amount is now the
    // owner's cap. It was "90071992547409.91" → "$90,071,992,547,409.91".
    ["9999999.99", "$9,999,999.99"],
  ];
  for (const [typed, shown] of roundTrips) {
    it(`shows typed ${show(typed)} as ${show(shown)} in AUD for en-AU`, () => {
      const cents = parseAmountToCents(typed);
      expect(cents).not.toBeNull();
      expect(formatCents(cents as number, "AUD", "en-AU")).toBe(shown);
    });
  }
});
