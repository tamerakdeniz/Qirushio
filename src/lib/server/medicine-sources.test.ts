import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { defaultRoomSettings, medicalYears } from "../constants";
import { medicineQuestionContext } from "./medicine-sources";
import { roomSettingsSchema } from "../validation";
import { medicalSelectionLabel, medicalSubjects, medicalSubjectGroups } from "../medicine";

describe("medical filters", () => {
  it.each(medicalYears)("preserves legacy cumulative year %i", (medicalYear) => {
    const context = medicineQuestionContext({ ...defaultRoomSettings, category: "medicine", medicalYear });
    for (const year of medicalYears) {
      if (year <= medicalYear) expect(context).toContain(`Year ${year}:`);
      else expect(context).not.toContain(`Year ${year}:`);
    }
  });
  it.each([[2], [3], [2, 3]] as const)("includes only explicitly selected years: %j", (...years) => {
    const medicalYears = [...years] as Array<2 | 3>;
    const settings = { ...defaultRoomSettings, category: "medicine" as const, medicalYear: 6 as const, medicalYears };
    const context = medicineQuestionContext(settings);
    for (const year of [1, 2, 3, 4, 5, 6]) {
      expect(context?.includes(`Year ${year}:`)).toBe(medicalYears.includes(year as 2 | 3));
    }
    expect(medicalSelectionLabel(settings, "tr")).toContain("Yalnızca");
  });
  it("does not inject medicine into random or scuba", () => {
    expect(medicineQuestionContext({ ...defaultRoomSettings, category: "random" })).toBeNull();
    expect(medicineQuestionContext({ ...defaultRoomSettings, category: "scuba" })).toBeNull();
  });
  it("keeps difficulty and subject while fixing Turkey context", () => {
    const result = roomSettingsSchema.parse({ ...defaultRoomSettings, category: "medicine", medicalYears: [3, 2], medicalSubject: "physiology", difficulty: "hard", scope: "global" });
    expect(result).toMatchObject({ medicalYears: [2, 3], medicalSubject: "physiology", difficulty: "hard", scope: "local" });
    expect(medicineQuestionContext(result)).toContain("Difficulty: hard");
    expect(medicineQuestionContext(result)).toContain("Subject: Physiology");
  });
  it.each([[], [0], [7], [2.5], ["3"], [2, 2]])("rejects invalid year selection: %j", (...years) => {
    expect(roomSettingsSchema.safeParse({ ...defaultRoomSettings, category: "medicine", medicalYears: years }).success).toBe(false);
  });
  it("supports the expanded clinical catalog throughout validation and generation", () => {
    for (const medicalSubject of ["biophysics", "forensic", "ophthalmology", "anesthesiology", "family_medicine"] as const) {
      const settings = roomSettingsSchema.parse({ ...defaultRoomSettings, category: "medicine", medicalYears: [6], medicalSubject });
      expect(medicineQuestionContext(settings)).toContain(`subject ID (${medicalSubject})`);
    }
    const mixed = medicineQuestionContext({ ...defaultRoomSettings, category: "medicine" });
    for (const subject of medicalSubjects.filter((value) => value !== "mixed")) expect(mixed).toContain(subject);
  });
  it("keeps selectable subjects compatible with the database constraint", () => {
    const migration = readFileSync("supabase/migrations/0017_medical_subject_catalog.sql", "utf8");
    const allowedByDatabase = [...migration.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    const selectable = ["mixed", ...medicalSubjectGroups.flatMap((group) => [...group.subjects])];
    expect(new Set(selectable)).toEqual(new Set(medicalSubjects));
    expect(new Set(allowedByDatabase)).toEqual(new Set(selectable));
  });
  it("rejects unknown subjects", () => {
    expect(roomSettingsSchema.safeParse({ ...defaultRoomSettings, medicalSubject: "unknown" }).success).toBe(false);
  });
});
