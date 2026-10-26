// Tests for safeBackPath (T1.12, hardened in T1.12b; docs/stages/stage-01.md).
//
// Written by test-engineer BEFORE the T1.12b fix. The builder must not edit
// this file; disputes go to the project lead.
//
// The rule (T1.12 card, unchanged): `?back=` is used only when it is a SAFE
// internal path. It starts with a single "/", has no "//", "\" or scheme, and
// is made only of ASCII letters, digits, "-" and "/". Anything else, and
// anything that isn't a string, gives "/" (Home). It never throws.
// New in T1.12b (the security review's finding, taken by the lead): a value
// longer than 200 characters gives "/". Exactly 200 is still accepted.
//
// The attack list below is the T1.12 security reviewer's, turned into a table
// so the rule can't be loosened by accident. Each case says why it's
// dangerous. Every expected value is written out by hand.
//
// Accepted paths are returned UNCHANGED (the same string, not a cleaned-up
// copy). "/a/" (a trailing slash) and "/-" are accepted today; they are kept
// here as documented behaviour, so a change to them is a deliberate decision.

import { describe, expect, it } from "vitest";
import { safeBackPath } from "@/lib/navigation";

/** Shows whitespace and unusual characters in the test name. */
const show = (s: string) => JSON.stringify(s);

const HOME = "/";

type Rejected = { value: string; why: string };

const REJECTED: readonly Rejected[] = [
  // Another website, written as a path.
  { value: "//evil.example", why: "protocol-relative: another site" },
  { value: "///evil.example", why: "three slashes still reach another site in browsers" },
  { value: "//user@evil.example", why: "protocol-relative with a user name" },
  { value: "/a//b", why: "a double slash anywhere" },
  { value: "/.//evil", why: "a dot, then a double slash" },
  // Backslashes (browsers treat "\" like "/").
  { value: "/\\evil.example", why: '"/\\" is read as "//"' },
  { value: "\\\\evil.example", why: '"\\\\" is read as "//"' },
  { value: "/\\/evil.example", why: '"/\\/" is read as "///"' },
  // Whitespace and control characters (browsers strip tab, newline and CR from URLs).
  { value: "/\t/evil.example", why: 'a tab between slashes: stripped, it becomes "//"' },
  { value: "/\n/evil.example", why: 'a newline between slashes: stripped, it becomes "//"' },
  { value: "/\r/evil.example", why: 'a carriage return between slashes: stripped, it becomes "//"' },
  { value: " //evil", why: "a leading space before //" },
  { value: "/ /evil", why: "a space between slashes" },
  { value: "/events\n", why: "a trailing newline (a regex $ mistake would allow it)" },
  { value: "/events\r\n", why: "a trailing CRLF" },
  { value: "/events\n//evil", why: "a newline, then a second line starting //" },
  { value: "\n/events", why: "a leading newline" },
  { value: "/events\u0000", why: "a NUL character" },
  { value: "/\u0000/evil", why: "a NUL between slashes" },
  // Look-alike slashes (some systems fold them to "/").
  { value: "／／evil.example", why: "two fullwidth solidus U+FF0F" },
  { value: "/／evil.example", why: "a slash then a fullwidth solidus" },
  { value: "/∕evil", why: "division slash U+2215" },
  { value: "/⁄evil", why: "fraction slash U+2044" },
  { value: "/⧸evil", why: "big solidus U+29F8" },
  { value: "/〳evil", why: "vertical kana repeat mark U+3033" },
  // Non-ASCII letters that change under case folding.
  { value: "/Kelvin", why: "Kelvin sign U+212A (lower-cases to an ASCII k)" },
  { value: "/İ", why: "dotted capital I U+0130" },
  { value: "/ı", why: "dotless small i U+0131" },
  // Percent-encoding (decodes to something else later).
  { value: "/%2F%2Fevil.example", why: '"%2F%2F" decodes to "//"' },
  { value: "/%252F%252Fevil", why: "double-encoded slashes" },
  { value: "%2F%2Fevil", why: "encoded slashes with no leading /" },
  { value: "/%5Cevil", why: '"%5C" decodes to a backslash' },
  { value: "/%09/evil", why: '"%09" decodes to a tab' },
  // Dot segments.
  { value: "/.", why: "a dot segment" },
  { value: "/./", why: "a dot segment with a slash" },
  { value: "/..", why: "a parent segment" },
  { value: "/../evil", why: "climbing out of the app's paths" },
  { value: "/events/.", why: "a trailing dot segment" },
  { value: "/events/..", why: "a trailing parent segment" },
  // User info, ports and schemes.
  { value: "/@evil.example", why: "an @ (user info)" },
  { value: "/evil.example@", why: "a trailing @" },
  { value: "/x@evil", why: "an @ inside" },
  { value: "/:evil", why: "a colon" },
  { value: "javascript:alert(1)", why: "the javascript: scheme" },
  { value: "JaVaScRiPt:alert(1)", why: "the javascript: scheme in mixed case" },
  { value: "/javascript:alert(1)", why: "a colon after a slash" },
  { value: "data:text/html,x", why: "the data: scheme" },
  { value: "https://evil.example", why: "a full address" },
  { value: "https:/evil.example", why: "a scheme with one slash" },
  { value: "https:evil.example", why: "a scheme with no slash" },
  // Not a plain path.
  { value: "/events?x=1", why: "a query string" },
  { value: "/events#x", why: "a fragment" },
  { value: "/events;x", why: "a semicolon (path parameters)" },
  { value: "/ev ents", why: "a space" },
  { value: "events", why: "no leading slash" },
  { value: "", why: "empty" },
];

const ACCEPTED: readonly { value: string; why: string }[] = [
  { value: "/", why: "Home itself" },
  { value: "/events", why: "a tab" },
  { value: "/events/pretend-event-shelf", why: "an event page (T1.15)" },
  { value: "/income/sales-at-events", why: "a stream page (T1.16)" },
  { value: "/a/", why: "a trailing slash (documented: accepted today)" },
  { value: "/-", why: "a lone hyphen (documented: accepted today)" },
];

describe("safeBackPath — the security review's attack list gives Home", () => {
  for (const { value, why } of REJECTED) {
    it(`${show(value)} → "/" (${why})`, () => {
      expect(safeBackPath(value)).toBe(HOME);
    });
  }
});

describe("safeBackPath — safe internal paths are returned unchanged", () => {
  for (const { value, why } of ACCEPTED) {
    it(`${show(value)} → itself (${why})`, () => {
      expect(safeBackPath(value)).toBe(value);
    });
  }
});

describe("safeBackPath — anything that isn't a string gives Home and never throws", () => {
  const NON_STRINGS: readonly { value: unknown; name: string }[] = [
    { value: null, name: "null" },
    { value: undefined, name: "undefined" },
    { value: 42, name: "the number 42" },
    { value: {}, name: "an empty object" },
    { value: ["/events"], name: 'an array holding "/events"' },
    { value: { toString: () => "//evil" }, name: 'an object whose toString returns "//evil"' },
    // The String wrapper object (not a plain string) is the case under test.
    { value: new String("/events"), name: 'a String object wrapping "/events"' },
    { value: Symbol(), name: "a Symbol" },
  ];
  for (const { value, name } of NON_STRINGS) {
    it(`${name} → "/" without throwing`, () => {
      let result: unknown;
      expect(() => {
        result = safeBackPath(value as string);
      }).not.toThrow();
      expect(result).toBe(HOME);
    });
  }
});

describe("safeBackPath — length cap (T1.12b): at most 200 characters", () => {
  // Hand-built: "/" plus 199 "a"s is 1 + 199 = 200 characters; one more is 201.
  const AT_LIMIT = "/" + "a".repeat(199);
  const OVER_LIMIT = "/" + "a".repeat(200);
  // Segments: "/events" (7) + "/x" × 96 (192) + "/" (1) = 200 characters.
  const SEGMENTS_AT_LIMIT = "/events" + "/x".repeat(96) + "/";
  const SEGMENTS_OVER_LIMIT = SEGMENTS_AT_LIMIT + "y";

  it("the hand-built test values have the intended lengths (200, 201, 200, 201)", () => {
    expect([AT_LIMIT.length, OVER_LIMIT.length, SEGMENTS_AT_LIMIT.length, SEGMENTS_OVER_LIMIT.length]).toEqual([
      200, 201, 200, 201,
    ]);
  });

  it('a safe-looking path of exactly 200 characters ("/" + 199 × "a") is returned unchanged', () => {
    expect(safeBackPath(AT_LIMIT)).toBe(AT_LIMIT);
  });

  it('a safe-looking path of 201 characters ("/" + 200 × "a") → "/"', () => {
    expect(safeBackPath(OVER_LIMIT)).toBe(HOME);
  });

  it("a 200-character path made of segments is returned unchanged", () => {
    expect(safeBackPath(SEGMENTS_AT_LIMIT)).toBe(SEGMENTS_AT_LIMIT);
  });

  it('a 201-character path made of segments → "/"', () => {
    expect(safeBackPath(SEGMENTS_OVER_LIMIT)).toBe(HOME);
  });

  it('a 10,000-character safe-looking path → "/"', () => {
    expect(safeBackPath("/" + "a".repeat(9999))).toBe(HOME);
  });
});
