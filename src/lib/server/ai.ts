import "server-only";

import { generatedQuestionsSchema } from "@/lib/validation";
import type { GeneratedQuestion, RoomSettings } from "@/lib/types";

function promptForQuestions(settings: RoomSettings): string {
  const language = settings.language === "tr" ? "Turkish" : "English";
  const difficulty = { easy: "easy", medium: "medium", hard: "hard" }[settings.difficulty];
  const scope = { global: "global", local: "local context" }[settings.scope];
  const category = {
    general: "general knowledge",
    science: "science",
    sports: "sports",
    arts: "arts",
    history: "history",
    random: "mixed",
  }[settings.category];
  const categoryInstruction =
    settings.category === "random"
      ? "Category pool: mix questions across general knowledge, science, sports, arts, and history. Distribute them across multiple categories and do not concentrate the set on a single subject."
      : `Category: ${category}.`;

  return [
    `Generate exactly ${settings.questionCount} multiplayer trivia questions in ${language}.`,
    `${categoryInstruction} Difficulty: ${difficulty}. Context: ${scope}.`,
    "Each question must have exactly five credible answer options and exactly one correct answer.",
    "Avoid ambiguous, time-sensitive, political, unsafe, or duplicate questions.",
    "Use this JSON shape only, without markdown:",
    '[{"category":"...","prompt":"...","options":["...","...","...","...","..."],"correctOption":0,"explanation":"..."}]',
    "correctOption is a zero-based integer from 0 to 4. Explanations must be concise.",
  ].join("\n");
}

function parseQuestions(text: string, expectedCount: number): GeneratedQuestion[] {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(normalized);
  const questions = generatedQuestionsSchema.parse(parsed);

  if (questions.length !== expectedCount) {
    throw new Error(`AI returned ${questions.length} questions; ${expectedCount} required.`);
  }

  return questions;
}

async function generateWithGemini(settings: RoomSettings): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey ?? "")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptForQuestions(settings) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no question content.");
  }

  return parseQuestions(text, settings.questionCount);
}

async function generateWithAnthropic(settings: RoomSettings): Promise<GeneratedQuestion[]> {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      temperature: 0.8,
      messages: [{ role: "user", content: promptForQuestions(settings) }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = payload.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic returned no question content.");
  }

  return parseQuestions(text, settings.questionCount);
}

const demoBank: GeneratedQuestion[] = [
  {
    category: "Genel Kültür",
    prompt: "Türkiye'nin başkenti hangi şehirdir?",
    options: ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"],
    correctOption: 1,
    explanation: "Ankara, 1923 yılında Türkiye Cumhuriyeti'nin başkenti ilan edilmiştir.",
  },
  {
    category: "Bilim",
    prompt: "Periyodik tabloda O sembolü hangi elementi gösterir?",
    options: ["Altın", "Osmiyum", "Oksijen", "Gümüş", "Karbon"],
    correctOption: 2,
    explanation: "O, yaşam için temel gazlardan biri olan oksijenin sembolüdür.",
  },
  {
    category: "Coğrafya",
    prompt: "Dünyanın yüzölçümü en büyük okyanusu hangisidir?",
    options: ["Atlas", "Hint", "Arktik", "Pasifik", "Güney"],
    correctOption: 3,
    explanation: "Pasifik Okyanusu dünya okyanus alanının yaklaşık yarısını kaplar.",
  },
  {
    category: "Tarih",
    prompt: "İstanbul'un fethi hangi yılda gerçekleşmiştir?",
    options: ["1071", "1299", "1453", "1517", "1923"],
    correctOption: 2,
    explanation: "Fatih Sultan Mehmet komutasındaki Osmanlı ordusu İstanbul'u 1453'te fethetmiştir.",
  },
  {
    category: "Spor",
    prompt: "Bir futbol takımında sahada aynı anda kaç oyuncu bulunur?",
    options: ["9", "10", "11", "12", "13"],
    correctOption: 2,
    explanation: "Kaleci dahil her takım sahada 11 oyuncuyla yer alır.",
  },
];

const demoBankEn: GeneratedQuestion[] = [
  {
    category: "General Knowledge",
    prompt: "What is the capital of Japan?",
    options: ["Seoul", "Tokyo", "Beijing", "Bangkok", "Kyoto"],
    correctOption: 1,
    explanation: "Tokyo is Japan's capital and its most populous metropolitan area.",
  },
  {
    category: "Science",
    prompt: "Which element is represented by the symbol O?",
    options: ["Gold", "Osmium", "Oxygen", "Silver", "Carbon"],
    correctOption: 2,
    explanation: "O is the chemical symbol for oxygen.",
  },
  {
    category: "Arts",
    prompt: "Who painted The Starry Night?",
    options: ["Pablo Picasso", "Claude Monet", "Vincent van Gogh", "Salvador Dali", "Edvard Munch"],
    correctOption: 2,
    explanation: "Vincent van Gogh painted The Starry Night in 1889.",
  },
  {
    category: "History",
    prompt: "In which year did humans first land on the Moon?",
    options: ["1959", "1965", "1969", "1972", "1981"],
    correctOption: 2,
    explanation: "Apollo 11 landed on the Moon in 1969.",
  },
  {
    category: "Sports",
    prompt: "How many players does one football team field at the start of a match?",
    options: ["9", "10", "11", "12", "13"],
    correctOption: 2,
    explanation: "A football team fields eleven players, including its goalkeeper.",
  },
];

function demoQuestions(settings: RoomSettings): GeneratedQuestion[] {
  const bank = settings.language === "en" ? demoBankEn : demoBank;
  return Array.from({ length: settings.questionCount }, (_, index) => {
    const source = bank[index % bank.length];
    return {
      ...source,
      prompt:
        settings.questionCount > bank.length
          ? `${source.prompt} (${settings.language === "tr" ? "Tur" : "Round"} ${index + 1})`
          : source.prompt,
      options: [...source.options] as GeneratedQuestion["options"],
    };
  });
}

export async function generateQuestions(settings: RoomSettings): Promise<GeneratedQuestion[]> {
  if (process.env.GEMINI_API_KEY) {
    return generateWithGemini(settings);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return generateWithAnthropic(settings);
  }
  if (process.env.ALLOW_DEMO_QUESTIONS === "true") {
    return demoQuestions(settings);
  }

  throw new Error("Configure GEMINI_API_KEY or ANTHROPIC_API_KEY before starting a game.");
}
