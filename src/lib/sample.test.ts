// Sample test for T1.1: proves the test runner and the `@/` alias work.
// T1.4 replaces it.
import { describe, expect, it } from "vitest";
import { double } from "@/lib/sample";

describe("sample", () => {
  it("imports through the @/ alias and runs an assertion", () => {
    expect(double(21)).toBe(42);
  });
});
