import { describe, expect, it } from "vitest";
import { mixedDifficultyCounts, mixedDifficultyLabel } from "./difficulty";

describe("mixed difficulty distribution", () => {
  it.each([
    [5, { easy: 1, medium: 3, hard: 1 }],
    [10, { easy: 2, medium: 5, hard: 3 }],
    [15, { easy: 3, medium: 8, hard: 4 }],
    [20, { easy: 4, medium: 10, hard: 6 }],
  ])("allocates %i questions", (total, expected) => {
    expect(mixedDifficultyCounts(total)).toEqual(expected);
  });

  it("keeps every supported question count exact and close to the target ratio", () => {
    for (let total = 5; total <= 20; total++) {
      const { easy, medium, hard } = mixedDifficultyCounts(total);
      expect(easy + medium + hard).toBe(total);
      expect(Math.abs(easy - total * 0.2)).toBeLessThan(1);
      expect(Math.abs(medium - total * 0.5)).toBeLessThan(1);
      expect(Math.abs(hard - total * 0.3)).toBeLessThan(1);
    }
  });

  it("shows the distribution in the selected language", () => {
    expect(mixedDifficultyLabel(10, "tr")).toBe("2 kolay · 5 orta · 3 zor");
    expect(mixedDifficultyLabel(10, "en")).toBe("2 easy · 5 medium · 3 hard");
  });
});
