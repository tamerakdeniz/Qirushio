import { describe, expect, it } from "vitest";

import { calculateScore } from "./utils";

describe("calculateScore", () => {
  it("awards ten points per complete remaining second for a correct answer", () => {
    expect(calculateScore(true, 19_999)).toBe(190);
    expect(calculateScore(true, 20_000)).toBe(200);
  });

  it("awards zero for wrong or expired answers", () => {
    expect(calculateScore(false, 20_000)).toBe(0);
    expect(calculateScore(true, -1)).toBe(0);
  });
});
