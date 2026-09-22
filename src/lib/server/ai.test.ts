import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateQuestions, isDivingQuestion, normalizeQuestionPrompt } from "./ai";
import type { GeneratedQuestion, RoomSettings } from "../types";

const settings: RoomSettings = {
  mode: "classic", language: "en", category: "random", difficulty: "medium",
  scope: "global", questionCount: 5, questionTimeSeconds: 20,
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
