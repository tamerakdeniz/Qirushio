import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { defaultRoomSettings, medicalYears } from "../constants";
import { medicineQuestionContext } from "./medicine-sources";
import { roomSettingsSchema } from "../validation";

describe("cumulative medical years", () => {
  it.each(medicalYears)("includes only years 1 through %i", (medicalYear) => {
    const context = medicineQuestionContext({ ...defaultRoomSettings, category: "medicine", medicalYear });
    for (const year of medicalYears) {
      if (year <= medicalYear) expect(context).toContain(`Year ${year}:`);
      else expect(context).not.toContain(`Year ${year}:`);
    }
  });
  it("does not inject medicine into random or scuba", () => {
    expect(medicineQuestionContext({ ...defaultRoomSettings, category: "random" })).toBeNull();
    expect(medicineQuestionContext({ ...defaultRoomSettings, category: "scuba" })).toBeNull();
  });
  it("uses year selection instead of generic difficulty and scope", () => {
    const result = roomSettingsSchema.parse({ ...defaultRoomSettings, category: "medicine", medicalYear: 4, difficulty: "hard", scope: "global" });
    expect(result).toMatchObject({ category: "medicine", medicalYear: 4, difficulty: "medium", scope: "local" });
    expect(roomSettingsSchema.parse({ ...result, category: "random", difficulty: "hard", scope: "global" })).toMatchObject({ difficulty: "hard", scope: "global" });
  });
  it.each([0, 7, 2.5, "3"])("rejects an invalid medical year: %s", (medicalYear) => {
    expect(roomSettingsSchema.safeParse({ ...defaultRoomSettings, category: "medicine", medicalYear }).success).toBe(false);
  });
});
