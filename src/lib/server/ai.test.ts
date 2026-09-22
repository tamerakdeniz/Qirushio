import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateQuestions, isDivingQuestion, isMedicalQuestion, normalizeQuestionPrompt } from "./ai";
import type { GeneratedQuestion, RoomSettings } from "../types";

const settings: RoomSettings = {
  mode: "classic", language: "en", category: "random", difficulty: "medium",
  medicalYear: 1, scope: "global", questionCount: 5, questionTimeSeconds: 20,
  questionPauseSeconds: 3, speedrunMode: false, isPublic: true, maxPlayers: 10,
};
const prompts = [
  "Who composed The Magic Flute?", "Which element uses the symbol Au?",
  "Where did the ancient Olympic Games originate?", "What year marked the fall of the Berlin Wall?",
  "Which ocean surrounds the Maldives?", "Who wrote the novel Frankenstein?",
  "What instrument measures atmospheric pressure?", "Which planet has the largest rings?",
  "Who developed the theory of continental drift?", "Where is Machu Picchu located?",
];
const question = (prompt: string, key = prompt): GeneratedQuestion => ({
  prompt, knowledgeKey: key, category: "General", options: ["A", "B", "C", "D", "E"],
  correctOption: 0, explanation: "An explanation of this fact.",
});
function response(questions: GeneratedQuestion[]) {
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(questions) }] } }] }) };
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("ALLOW_DEMO_QUESTIONS", "false");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("question generation", () => {
  it("normalizes Turkish case, accents, punctuation and whitespace", () => {
    expect(normalizeQuestionPrompt("  İSTANBUL’ın   başkenti? ")).toBe("istanbul in baskenti");
  });

  it("rejects diving content even when labelled science, but preserves explicit scuba mode", async () => {
    const diving = question("Why must a scuba diver breathe continuously?", "diving|ascent|breathing");
    diving.category = "Science";
    expect(isDivingQuestion(diving)).toBe(true);
    expect(isDivingQuestion(question("Dalışta basınç nasıl değişir?"))).toBe(true);
    expect(isDivingQuestion(question("Who invented the printing press?"))).toBe(false);
    const batch = [diving, ...prompts.slice(0, 6).map((p) => question(p))];
    const fetchMock = vi.fn().mockResolvedValue(response(batch));
    vi.stubGlobal("fetch", fetchMock);
    const random = await generateQuestions(settings);
    expect(random).toHaveLength(5);
    expect(random.some(isDivingQuestion)).toBe(false);
    expect(fetchMock.mock.calls[0][1].body).toContain("Exclude scuba diving");
    expect((await generateQuestions({ ...settings, category: "scuba" }))[0]).toEqual(diving);
  });

  it("replaces historical rejections without returning an incomplete round", async () => {
    const first = prompts.slice(0, 7).map((p) => question(p));
    const second = prompts.slice(7).map((p) => question(p));
    const fetchMock = vi.fn().mockResolvedValueOnce(response(first)).mockResolvedValueOnce(response(second));
    vi.stubGlobal("fetch", fetchMock);
    const filter = vi.fn().mockResolvedValueOnce(first.slice(0, 4)).mockImplementationOnce(async (q) => q);
    const result = await generateQuestions(settings, [], filter);
    expect(result).toHaveLength(5);
    expect(result.map((q) => q.prompt)).not.toContain(prompts[4]);
    expect(filter).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).toContain(prompts[4]);
  });

  it("rejects paraphrases with the same fact key in a batch", async () => {
    const batch = [question("What is the capital of Turkey?", "turkey|capital|ankara"),
      question("Which city serves as Turkey's seat of government?", "turkey|capital|ankara"),
      ...prompts.slice(0, 5).map((p) => question(p))];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(batch)));
    const result = await generateQuestions(settings);
    expect(result.filter((q) => q.knowledgeKey === "turkey|capital|ankara")).toHaveLength(1);
  });

  it("keeps similar templates when they test different facts", async () => {
    const france = question("What is the capital of France?", "france|capital|paris");
    france.options[0] = "Paris";
    const italy = question("What is the capital of Italy?", "italy|capital|rome");
    italy.options[0] = "Rome";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([
      france, italy, ...prompts.slice(0, 5).map((p) => question(p)),
    ])));
    const result = await generateQuestions(settings);
    expect(result).toContainEqual(france);
    expect(result).toContainEqual(italy);
  });

  it("excludes medical-school questions from random while keeping general biology", async () => {
    const clinical = { ...question("Which diagnosis best explains this patient's presentation?", "clinical|diagnosis|example"), category: "Science" };
    expect(isMedicalQuestion(clinical)).toBe(true);
    expect(isMedicalQuestion(question("Which organ pumps blood through the body?"))).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([clinical, ...prompts.slice(0, 6).map((p) => question(p))])));
    expect((await generateQuestions(settings)).some(isMedicalQuestion)).toBe(false);
  });

  it("accepts cumulative medical years and rejects missing or higher-year metadata", async () => {
    const valid = prompts.slice(0, 5).map((p, index) => ({ ...question(p), curriculumYear: (index % 3 + 1) as 1 | 2 | 3 }));
    const higher = { ...question(prompts[5]), curriculumYear: 6 as const };
    const missing = question(prompts[6]);
    const fetchMock = vi.fn().mockResolvedValue(response([higher, missing, ...valid]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateQuestions({ ...settings, category: "medicine", medicalYear: 3, difficulty: "hard" });
    expect(result).toEqual(valid);
    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(prompt).toContain("Eligible curriculum years: 1, 2, 3.");
    expect(prompt).toContain("Difficulty: hard");
    expect(prompt).not.toContain("Year 4:");
  });

  it("rejects unselected earlier years and the wrong subject", async () => {
    const valid = prompts.slice(0, 5).map((p, index) => ({ ...question(p), curriculumYear: (index % 2 + 2) as 2 | 3, medicalSubject: "physiology" as const }));
    const earlier = { ...question(prompts[5]), curriculumYear: 1 as const, medicalSubject: "physiology" as const };
    const wrongSubject = { ...question(prompts[6]), curriculumYear: 2 as const, medicalSubject: "anatomy" as const };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([earlier, wrongSubject, ...valid])));
    const result = await generateQuestions({ ...settings, category: "medicine", medicalYear: 3, medicalYears: [2, 3], medicalSubject: "physiology" });
    expect(result).toEqual(valid);
  });

  it("accepts each selected subject and rejects unselected or missing subject metadata", async () => {
    const valid = prompts.slice(0, 5).map((p, i) => ({ ...question(p), curriculumYear: 2 as const, medicalSubject: i % 2 ? "physiology" as const : "anatomy" as const }));
    const wrong = { ...question(prompts[5]), curriculumYear: 2 as const, medicalSubject: "pathology" as const };
    const missing = { ...question(prompts[6]), curriculumYear: 2 as const };
    const fetchMock = vi.fn().mockResolvedValue(response([wrong, missing, ...valid]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateQuestions({ ...settings, category: "medicine", medicalYears: [2], medicalSubjects: ["anatomy", "physiology"] });
    expect(result).toEqual(valid);
    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(prompt).toContain("Subject: Anatomy, Physiology.");
    expect(prompt).toContain("subject ID (anatomy, physiology)");
  });

  it("fails closed when permanent history is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(prompts.slice(0, 7).map((p) => question(p)))));
    await expect(generateQuestions(settings, [], async () => { throw new Error("history unavailable"); })).rejects.toThrow("history unavailable");
  });

  it("does not pad an exhausted demo bank with duplicates or start an empty round", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ALLOW_DEMO_QUESTIONS", "true");
    const first = await generateQuestions(settings);
    expect(first).toHaveLength(5);
    await expect(generateQuestions(settings, first.map((q) => q.prompt))).rejects.toThrow("unique questions (0/5)");
    await expect(generateQuestions({ ...settings, questionCount: 10 })).rejects.toThrow("unique questions (5/10)");
  });

  it("stops before provider calls when the generation budget has expired", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(generateQuestions(settings, [], async (q) => q, Date.now() - 1)).rejects.toThrow("unique questions");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});


describe("mixed difficulty", () => {
  const mixed = { ...settings, category: "medicine", difficulty: "mixed", questionCount: 10 } as RoomSettings;
  const candidate = (index: number, difficulty?: GeneratedQuestion["difficulty"]): GeneratedQuestion => ({
    ...question(prompts[index % prompts.length] + ` Example ${index}.`, `unique|fact|${index}`),
    options: [`Answer ${index}`, "B", "C", "D", "E"], difficulty, curriculumYear: 1,
  });
  const initial = () => [
    ...Array.from({ length: 2 }, (_, i) => candidate(i, "easy")),
    ...Array.from({ length: 5 }, (_, i) => candidate(i + 2, "medium")),
    ...Array.from({ length: 3 }, (_, i) => candidate(i + 7, "hard")),
  ];
  const counts = (questions: GeneratedQuestion[]) => ["easy", "medium", "hard"].map(
    (difficulty) => questions.filter((q) => q.difficulty === difficulty).length,
  );

  it("produces the exact 2/5/3 distribution with medical filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(initial()));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateQuestions(mixed);
    expect(counts(result)).toEqual([2, 5, 3]);
    expect(fetchMock.mock.calls[0][1].body).toContain("exactly 2 easy, 5 medium, and 3 hard");
  });

  it("replenishes the rejected difficulty after permanent history filtering", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(initial()))
      .mockResolvedValueOnce(response([candidate(10, "hard")]));
    vi.stubGlobal("fetch", fetchMock);
    const filter = vi.fn().mockImplementationOnce(async (batch: GeneratedQuestion[]) => batch.slice(0, 9))
      .mockImplementationOnce(async (batch: GeneratedQuestion[]) => batch);
    expect(counts(await generateQuestions(mixed, [], filter))).toEqual([2, 5, 3]);
    expect(fetchMock.mock.calls[1][1].body).toContain("exactly 0 easy, 0 medium, and 1 hard");
  });

  it("rejects excess and missing difficulty labels and requests the missing quota", async () => {
    const batch = initial();
    batch[8] = candidate(8, "easy");
    batch[9] = candidate(9);
    const fetchMock = vi.fn().mockResolvedValueOnce(response(batch))
      .mockResolvedValueOnce(response([candidate(10, "hard"), candidate(11, "hard")]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateQuestions(mixed);
    expect(counts(result)).toEqual([2, 5, 3]);
    expect(result.some((q) => q.knowledgeKey === "unique|fact|8" || q.knowledgeKey === "unique|fact|9")).toBe(false);
    expect(fetchMock.mock.calls[1][1].body).toContain("exactly 0 easy, 0 medium, and 2 hard");
  });

  it("preserves quotas across multiple batches for twenty questions", async () => {
    const batch1 = [4, 3, 3].flatMap((count, level) => Array.from({ length: count }, (_, i) =>
      candidate(level * 10 + i, (["easy", "medium", "hard"] as const)[level])));
    const batch2 = [7, 3].flatMap((count, level) => Array.from({ length: count }, (_, i) =>
      candidate(30 + level * 10 + i, (["medium", "hard"] as const)[level])));
    const fetchMock = vi.fn().mockResolvedValueOnce(response(batch1)).mockResolvedValueOnce(response(batch2));
    vi.stubGlobal("fetch", fetchMock);
    expect(counts(await generateQuestions({ ...mixed, questionCount: 20 }))).toEqual([4, 10, 6]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not silently publish a round with the wrong distribution", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(initial().map((q) => ({ ...q, difficulty: "easy" })))));
    await expect(generateQuestions(mixed)).rejects.toThrow("Could not produce enough unique questions (2/10)");
  });
});
