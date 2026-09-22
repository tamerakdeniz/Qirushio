import { selectedMedicalYears, selectedMedicalSubjects } from "@/lib/medicine";
import "server-only";

import { randomInt, randomUUID } from "node:crypto";

import { mixedDifficultyCounts, questionDifficulties, type DifficultyCounts } from "@/lib/difficulty";
import { fortyTwoQuestionContext } from "@/lib/server/forty-two-sources";
import { medicineQuestionContext } from "@/lib/server/medicine-sources";
import { scubaQuestionContext } from "@/lib/server/scuba-sources";
import { generatedQuestionsSchema } from "@/lib/validation";
import type { ClassicQuizCategory, GeneratedQuestion, RoomSettings } from "@/lib/types";

const BATCH_SIZE = 8;
const MAX_USED_PROMPTS_IN_PROMPT = 80;
const MAX_GENERATION_ATTEMPTS = 8;

const GEMINI_PRIMARY_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash-lite";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly provider: "gemini" | "anthropic",
    readonly status: number,
    readonly rateLimited: boolean,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export function normalizeQuestionPrompt(prompt: string): string {
  return prompt
    .replace(/[İı]/g, "i")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicate(prompt: string, seen: Set<string>): boolean {
  const normalized = normalizeQuestionPrompt(prompt);
  return !normalized || seen.has(normalized);
}

function maxOutputTokens(questionCount: number): number {
  return Math.min(16_384, 700 + questionCount * 520);
}

function isRateLimited(status: number, message: string): boolean {
  if (status === 429 || status === 503) {
    return true;
  }
  return /rate.?limit|quota|resource.?exhausted|overloaded|too many requests|capacity/i.test(
    message,
  );
}

interface PromptContext {
  difficultyCounts?: DifficultyCounts;
  batchSize: number;
  batchIndex: number;
  totalBatches: number;
  usedPrompts: string[];
  attempt: number;
  variationSeed: string;
  deadline: number;
}

function requestSignal(context: PromptContext): AbortSignal {
  const remaining = context.deadline - Date.now();
  if (remaining <= 0) throw new Error("Question generation timed out.");
  return AbortSignal.timeout(Math.min(50_000, remaining));
}

function promptForQuestions(settings: RoomSettings, context: PromptContext): string {
  const language = settings.language === "tr" ? "Turkish" : "English";
  const difficulty = settings.difficulty;
  const scope = { global: "global", local: "local context" }[settings.scope];
  const usedInDb = context.usedPrompts.slice(-MAX_USED_PROMPTS_IN_PROMPT);
  const usedSection =
    usedInDb.length > 0
      ? [
          "These are examples from permanent question history. Do not repeat or paraphrase them, or test the same fact:",
          ...usedInDb.map((prompt) => `- ${prompt}`),
        ].join("\n")
      : "No recent examples are provided. All candidates will still be checked against permanent history.";
  const varietyInstructions = [
    ...(context.difficultyCounts ? [
      `This batch must contain exactly ${context.difficultyCounts.easy} easy, ${context.difficultyCounts.medium} medium, and ${context.difficultyCounts.hard} hard questions.`,
      'Include a "difficulty" field on EVERY question with exactly "easy", "medium", or "hard". Never use "mixed" as a question difficulty.',
      "Match the actual reasoning required to the label: easy = direct recall, medium = connecting concepts, hard = multi-step reasoning. Do not relabel a question just to fill a quota.",
    ] : []),
    `Variation seed: ${context.variationSeed}; attempt ${context.attempt + 1}. Choose fresh subtopics, entities, eras and scenarios.`,
    "Avoid common stock trivia. Changing punctuation, options, word order or translating an old question does not make it new.",
    "Include knowledgeKey: a concise canonical English subject|relationship|answer identifier of the tested fact, independent of wording, language, options and difficulty.",
    "Example: turkey|capital|ankara. Different facts about the same subject must have different keys. Never add a random ID to knowledgeKey.",
  ].join("\n");
  const medicineContext = medicineQuestionContext(settings);
  if (medicineContext) {
    return [
      `Generate exactly ${context.batchSize} original medical-student quiz questions in ${language}.`,
      medicineContext,
      "Each question must have exactly five plausible options and one correct answer.",
      varietyInstructions,
      usedSection,
      "Return JSON only, without markdown:",
      '[{"category":"Medicine / topic","curriculumYear":1,"medicalSubject":"anatomy","prompt":"...","options":["...","...","...","...","..."],"correctOption":0,"explanation":"...","knowledgeKey":"subject|relationship|answer"}]',
      "Use the actual eligible curriculumYear for each question. correctOption is zero-based (0–4).",
    ].join("\n");
  }

  const fortyTwoContext = fortyTwoQuestionContext(settings);

  if (fortyTwoContext) {
    return [
      `Generate exactly ${context.batchSize} multiplayer quiz questions in ${language}.`,
      `Batch ${context.batchIndex + 1}/${context.totalBatches}. Difficulty: ${difficulty}.`,
      fortyTwoContext,
      "Each question must have exactly five credible answer options and exactly one correct answer.",
      "Every prompt in this batch must be unique and must not match any prompt listed below.",
      varietyInstructions,
      usedSection,
      "Use this JSON shape only, without markdown:",
      '[{"category":"...","prompt":"...","options":["...","...","...","...","..."],"correctOption":0,"explanation":"...","knowledgeKey":"subject|relationship|answer"}]',
      "correctOption is a zero-based integer from 0 to 4. Explanations must be concise and cite the relevant rule/process in plain language.",
    ].join("\n");
  }

  const scubaContext = scubaQuestionContext(settings);

  if (scubaContext) {
    return [
      `Generate exactly ${context.batchSize} multiplayer quiz questions in ${language}.`,
      `Batch ${context.batchIndex + 1}/${context.totalBatches}. Difficulty: ${difficulty}. Context: ${scope}.`,
      scubaContext,
      "Each question must have exactly five credible answer options and exactly one correct answer.",
      "Every prompt in this batch must be unique and must not match any prompt listed below.",
      varietyInstructions,
      usedSection,
      "Use this JSON shape only, without markdown:",
      '[{"category":"...","prompt":"...","options":["...","...","...","...","..."],"correctOption":0,"explanation":"...","knowledgeKey":"subject|relationship|answer"}]',
      "correctOption is a zero-based integer from 0 to 4. Explanations must be concise and should identify the relevant scuba concept in plain language.",
    ].join("\n");
  }

  const classicCategory = settings.category as ClassicQuizCategory;
  const category = {
    general: "general knowledge",
    science: "science",
    sports: "sports",
    arts: "arts",
    history: "history",
    medicine: "medical student knowledge",
    scuba: "scuba diving theory, safety, equipment, dive planning, and instructor-candidate knowledge",
    random: "mixed",
  }[classicCategory];
  const categoryInstruction =
    classicCategory === "random"
      ? "Category pool: mix questions ONLY across general knowledge, science, sports, arts, and history. Exclude scuba diving, diving theory, underwater diving equipment, dive planning, and diver certification questions, even when they could be classified as science or sports. Also exclude medical-school questions, clinical cases, diagnosis, pharmacology and specialist medical terminology. Everyday general biology is allowed; the Medicine category is opt-in."
      : `Category: ${category}.`;

  return [
    `Generate exactly ${context.batchSize} multiplayer trivia questions in ${language}.`,
    `Batch ${context.batchIndex + 1}/${context.totalBatches}.`,
    `${categoryInstruction} Difficulty: ${difficulty}. Context: ${scope}.`,
    "Each question must have exactly five credible answer options and exactly one correct answer.",
    "Every prompt in this batch must be unique and must not match any prompt listed below.",
    varietyInstructions,
    usedSection,
    "Use this JSON shape only, without markdown:",
    '[{"category":"...","prompt":"...","options":["...","...","...","...","..."],"correctOption":0,"explanation":"...","knowledgeKey":"subject|relationship|answer"}]',
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

  if (questions.length < expectedCount) {
    throw new Error(`AI returned ${questions.length} questions; ${expectedCount} required.`);
  }

  return questions.slice(0, expectedCount);
}

export function isDivingQuestion(question: GeneratedQuestion): boolean {
  const text = normalizeQuestionPrompt([question.category, question.prompt, question.explanation, question.knowledgeKey ?? ""].join(" "));
  return /\b(scuba|diving|diver|divers|dive|dalis\w*|dalic\w*|padi|cmas|nitrox|decompression|dekompresyon)\b/u.test(text);
}

export function isMedicalQuestion(question: GeneratedQuestion): boolean {
  if (question.curriculumYear !== undefined) return true;
  const category = normalizeQuestionPrompt(question.category);
  if (/\b(tip|medicine|medical|klinik|clinical|farmakoloji|pharmacology)\b/.test(category)) return true;
  const content = normalizeQuestionPrompt([question.prompt, question.explanation, question.knowledgeKey ?? ""].join(" "));
  return /\b(diagnos\w*|clinical|pharmacolog\w*|pathophysiolog\w*|histolog\w*|klin(?:ik|ig)\w*|patofizyoloj\w*|farmakoloj\w*|histoloj\w*|tani(?:si|sal)?|hastanin)\b/.test(content);
}

function similarQuestions(left: GeneratedQuestion, right: GeneratedQuestion): boolean {
  if (normalizeQuestionPrompt(left.options[left.correctOption]) !== normalizeQuestionPrompt(right.options[right.correctOption])) {
    return false;
  }
  const a = new Set(normalizeQuestionPrompt(left.prompt).split(" "));
  const b = new Set(normalizeQuestionPrompt(right.prompt).split(" "));
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(a.size, b.size) >= 0.8;
}

export type QuestionFilter = (questions: GeneratedQuestion[]) => Promise<GeneratedQuestion[]>;

function geminiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: { message?: string } }).error?.message;
    if (error) {
      return error;
    }
  }
  return `Gemini request failed (${status}).`;
}

async function generateWithGeminiModel(
  model: string,
  settings: RoomSettings,
  context: PromptContext,
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptForQuestions(settings, context) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: Math.min(1, 0.75 + context.attempt * 0.05),
          maxOutputTokens: maxOutputTokens(context.batchSize),
        },
      }),
      signal: requestSignal(context),
    },
  );

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null;

  if (!response.ok) {
    const message = geminiErrorMessage(payload, response.status);
    throw new ProviderRequestError(message, "gemini", response.status, isRateLimited(response.status, message));
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini (${model}) returned no question content.`);
  }

  return parseQuestions(text, context.batchSize);
}

async function generateWithGeminiChain(
  settings: RoomSettings,
  context: PromptContext,
): Promise<GeneratedQuestion[]> {
  const models = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL].filter(
    (model, index, list) => list.indexOf(model) === index,
  );
  let lastRateLimitError: ProviderRequestError | null = null;

  for (const model of models) {
    try {
      return await generateWithGeminiModel(model, settings, context);
    } catch (error) {
      if (error instanceof ProviderRequestError && error.provider === "gemini" && error.rateLimited) {
        lastRateLimitError = error;
        continue;
      }
      throw error;
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return generateWithAnthropic(settings, context);
  }

  throw (
    lastRateLimitError ??
    new Error("Gemini rate limits were exceeded and no Anthropic fallback is configured.")
  );
}

async function generateWithAnthropic(
  settings: RoomSettings,
  context: PromptContext,
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxOutputTokens(context.batchSize),
      temperature: Math.min(1, 0.75 + context.attempt * 0.05),
      messages: [{ role: "user", content: promptForQuestions(settings, context) }],
    }),
    signal: requestSignal(context),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    content?: Array<{ type: string; text?: string }>;
  } | null;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Anthropic request failed (${response.status}).`;
    throw new ProviderRequestError(
      message,
      "anthropic",
      response.status,
      isRateLimited(response.status, message),
    );
  }

  const text = payload?.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic returned no question content.");
  }

  return parseQuestions(text, context.batchSize);
}

async function generateBatch(
  settings: RoomSettings,
  context: PromptContext,
): Promise<GeneratedQuestion[]> {
  if (process.env.GEMINI_API_KEY) {
    return generateWithGeminiChain(settings, context);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return generateWithAnthropic(settings, context);
  }
  if (process.env.ALLOW_DEMO_QUESTIONS === "true") {
    if (settings.category === "medicine") {
      throw new Error("Medicine questions require GEMINI_API_KEY or ANTHROPIC_API_KEY.");
    }
    if (settings.difficulty === "mixed") {
      throw new Error("Mixed difficulty questions require GEMINI_API_KEY or ANTHROPIC_API_KEY.");
    }
    return demoQuestions({ ...settings, questionCount: context.batchSize }, context);
  }

  throw new Error("Configure GEMINI_API_KEY or ANTHROPIC_API_KEY before starting a game.");
}

async function generateUniqueQuestions(
  settings: RoomSettings,
  usedPrompts: string[],
  filterQuestions: QuestionFilter,
  deadline: number,
): Promise<GeneratedQuestion[]> {
  const seen = new Set(usedPrompts.map(normalizeQuestionPrompt));
  const seenKeys = new Set<string>();
  const attemptedPrompts: string[] = [];
  const result: GeneratedQuestion[] = [];
  const target = settings.questionCount;
  const difficultyRemaining = settings.difficulty === "mixed" ? mixedDifficultyCounts(target) : undefined;
  const subjects = selectedMedicalSubjects(settings);
  const totalBatches = Math.ceil(target / BATCH_SIZE);
  const variationSeed = randomUUID();

  for (let attempt = 0; result.length < target && attempt < MAX_GENERATION_ATTEMPTS && Date.now() < deadline; attempt++) {
    const remaining = target - result.length;
    const batchSize = Math.min(BATCH_SIZE + 2, difficultyRemaining ? remaining : remaining + 2);
    let difficultyCounts: DifficultyCounts | undefined;
    if (difficultyRemaining) {
      difficultyCounts = { easy: 0, medium: 0, hard: 0 };
      let allocated = 0;
      while (allocated < batchSize) {
        for (const difficulty of questionDifficulties) {
          if (allocated < batchSize && difficultyCounts[difficulty] < difficultyRemaining[difficulty]) {
            difficultyCounts[difficulty]++;
            allocated++;
          }
        }
      }
    }
    const context: PromptContext = {
      batchSize,
      difficultyCounts,
      batchIndex: Math.floor(result.length / BATCH_SIZE),
      totalBatches,
      usedPrompts: [...usedPrompts, ...attemptedPrompts],
      attempt,
      variationSeed,
      deadline,
    };
    const generated = await generateBatch(settings, context);
    const unique: GeneratedQuestion[] = [];
    for (const question of generated) {
      const key = question.knowledgeKey ? normalizeQuestionPrompt(question.knowledgeKey) : null;
      const duplicate = isDuplicate(question.prompt, seen)
        || (key !== null && seenKeys.has(key))
        || [...result, ...unique].some((previous) => similarQuestions(previous, question));
      seen.add(normalizeQuestionPrompt(question.prompt));
      if (key) seenKeys.add(key);
      attemptedPrompts.push(question.prompt);
      if (duplicate) continue;
      if (settings.category === "random" && (isDivingQuestion(question) || isMedicalQuestion(question))) continue;
      if (settings.category === "medicine" && (question.curriculumYear === undefined || !selectedMedicalYears(settings).includes(question.curriculumYear))) continue;
      if (settings.category === "medicine" && !subjects.includes("mixed")
        && (!question.medicalSubject || !subjects.includes(question.medicalSubject))) continue;
      unique.push(question);
    }
    if (unique.length) {
      // This checks ALL permanent history, not just the sample in the AI prompt.
      const eligible = await filterQuestions(unique);
      for (const question of eligible) {
        if (result.length === target) break;
        if (difficultyRemaining) {
          if (!question.difficulty || difficultyRemaining[question.difficulty] === 0) continue;
          difficultyRemaining[question.difficulty]--;
        }
        result.push(question);
      }
    }
  }

  if (result.length !== target) {
    throw new Error(`Could not produce enough unique questions (${result.length}/${target}).`);
  }
  if (difficultyRemaining) {
    // Interleave difficulties instead of exposing provider-generated difficulty groups.
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
  }
  return result;
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

const demoBankScuba: GeneratedQuestion[] = [
  {
    category: "Scuba Dalış",
    prompt: "Dalışta asla nefes tutmama kuralının temel nedeni nedir?",
    options: [
      "Maskenin buğulanmasını önlemek",
      "Akciğerlerdeki havanın çıkışta genişleyebilmesi",
      "Palet vuruşunu hızlandırmak",
      "Tüp basıncını sabit tutmak",
      "El işaretlerini daha net görmek",
    ],
    correctOption: 1,
    explanation: "Çıkışta çevre basıncı azalır ve akciğerdeki hava genişler; bu yüzden sürekli nefes vermek kritik bir güvenlik prensibidir.",
  },
  {
    category: "Scuba Dalış",
    prompt: "Bir BCD'nin dalıştaki ana görevi hangisidir?",
    options: [
      "Solunan gazı filtrelemek",
      "Yüzerliği ayarlamaya yardımcı olmak",
      "Derinliği otomatik sınırlamak",
      "Azot narkozunu engellemek",
      "Pusula yönünü kilitlemek",
    ],
    correctOption: 1,
    explanation: "BCD, dalıcının pozitif, negatif veya nötr yüzerliğe yaklaşmasına yardımcı olur.",
  },
  {
    category: "Scuba Dalış",
    prompt: "Boyle yasası scuba dalışta en çok hangi ilişkiyi açıklamak için kullanılır?",
    options: [
      "Işık renginin derinlikle değişmesi",
      "Gaz hacmi ile mutlak basınç arasındaki ters ilişki",
      "Tuzluluk ile akıntı hızı arasındaki ilişki",
      "Suyun sıcaklığı ile görüş arasındaki doğru ilişki",
      "Dalış bilgisayarının pil ömrü",
    ],
    correctOption: 1,
    explanation: "Boyle yasası, sabit sıcaklıkta gaz hacminin mutlak basınçla ters orantılı olduğunu anlatır.",
  },
  {
    category: "Scuba Dalış",
    prompt: "Azot narkozu belirtileri görülen bir dalıcı için en güvenli genel yaklaşım hangisidir?",
    options: [
      "Daha derine inip belirtileri karşılaştırmak",
      "Belirtileri yok sayıp plana devam etmek",
      "Buddy ile kontrolü koruyup daha sığ derinliğe çıkmak",
      "Regülatörü çıkarıp yeniden takmak",
      "Daha hızlı yüzerek aktiviteyi artırmak",
    ],
    correctOption: 2,
    explanation: "Narkoz riski derinlikle artar ve daha sığa çıkmak belirtilerin azalmasına yardımcı olabilir.",
  },
  {
    category: "Scuba Dalış",
    prompt: "İyi bir buddy check'in amacı hangisidir?",
    options: [
      "Sadece fotoğraf ekipmanını hazırlamak",
      "Dalıştan önce temel ekipman ve gaz kontrollerini karşılıklı doğrulamak",
      "Yalnız dalışı daha hızlı başlatmak",
      "Dalış sonrası log kaydını otomatik doldurmak",
      "Su altı canlılarını listelemek",
    ],
    correctOption: 1,
    explanation: "Buddy check, ekipmanın ve temel güvenlik hazırlıklarının iki dalıcı tarafından doğrulanmasını sağlar.",
  },
  {
    category: "Scuba Dalış",
    prompt: "IDC/ITC tarzı bir öğretim sunumunda zayıf kontrol örneği hangisidir?",
    options: [
      "Öğrencileri net pozisyonlandırmak",
      "Beceriyi yavaş ve görünür göstermek",
      "Hata yapan öğrenciyi fark etmeden grubu ilerletmek",
      "Briefingde sinyalleri açıklamak",
      "Debriefingde düzeltici geri bildirim vermek",
    ],
    correctOption: 2,
    explanation: "Eğitmen adayından beklenen, öğrenciyi gözlemlemek, hatayı güvenli şekilde durdurmak ve düzeltici geri bildirim vermektir.",
  },
  {
    category: "Scuba Dalış",
    prompt: "Resif üzerinde iyi çevresel uygulama hangisidir?",
    options: [
      "Nötr yüzerliği koruyup canlılara dokunmamak",
      "Hatıra için küçük mercan parçası almak",
      "Dip tortusunu bilerek kaldırmak",
      "Balıkları elle beslemek",
      "Paletleri resife dayayarak dinlenmek",
    ],
    correctOption: 0,
    explanation: "Nötr yüzerlik ve dokunmama yaklaşımı, resif ve canlı yaşamı üzerindeki etkiyi azaltır.",
  },
  {
    category: "Scuba Dalış",
    prompt: "PADI IDC yoluyla ilgili doğru ifade hangisidir?",
    options: [
      "IDC yalnızca tek bir teorik sınavdan oluşur",
      "IDC, Assistant Instructor ve OWSI bölümlerini içeren bir eğitmen geliştirme sürecidir",
      "IDC'ye başlamak için hiç kayıtlı dalış gerekmez",
      "IE, Divemaster sertifikasından önce tamamlanır",
      "IDC sadece serbest dalış eğitimidir",
    ],
    correctOption: 1,
    explanation: "PADI'nin kamuya açık açıklamasına göre IDC, AI ve OWSI bölümlerinden oluşur; çoğu aday ardından IE'ye girer.",
  },
];

const demoBankScubaEn: GeneratedQuestion[] = [
  {
    category: "Scuba Diving",
    prompt: "Why is continuous breathing a core scuba safety rule during ascent?",
    options: [
      "It keeps the mask clear",
      "It lets expanding air leave the lungs as pressure decreases",
      "It increases tank pressure",
      "It prevents all nitrogen absorption",
      "It makes hand signals easier to see",
    ],
    correctOption: 1,
    explanation: "As ambient pressure decreases on ascent, gas expands; continuous breathing helps avoid lung overexpansion risk.",
  },
  {
    category: "Scuba Diving",
    prompt: "What is the primary role of a BCD?",
    options: [
      "Filtering breathing gas",
      "Helping the diver control buoyancy",
      "Automatically limiting depth",
      "Preventing nitrogen narcosis",
      "Locking compass direction",
    ],
    correctOption: 1,
    explanation: "A BCD helps the diver adjust buoyancy throughout the dive.",
  },
  {
    category: "Scuba Diving",
    prompt: "Which relationship does Boyle's law describe for scuba divers?",
    options: [
      "Light color and depth",
      "Gas volume and absolute pressure",
      "Salinity and current speed",
      "Water temperature and visibility",
      "Battery life and depth",
    ],
    correctOption: 1,
    explanation: "At constant temperature, gas volume changes inversely with absolute pressure.",
  },
  {
    category: "Scuba Diving",
    prompt: "A diver shows signs of nitrogen narcosis at depth. What is the best general response?",
    options: [
      "Descend deeper to compare symptoms",
      "Ignore it and continue the plan",
      "Maintain buddy control and ascend to a shallower depth",
      "Remove and replace the regulator",
      "Swim faster to increase activity",
    ],
    correctOption: 2,
    explanation: "Narcosis risk increases with depth and often improves after ascending to a shallower depth.",
  },
  {
    category: "Scuba Diving",
    prompt: "What is the purpose of a buddy check before a dive?",
    options: [
      "Preparing only camera gear",
      "Mutually confirming essential equipment and gas checks",
      "Starting solo dives faster",
      "Automatically filling the logbook",
      "Cataloging marine life",
    ],
    correctOption: 1,
    explanation: "A buddy check helps both divers confirm key equipment and safety readiness before entering the water.",
  },
  {
    category: "Scuba Diving",
    prompt: "In an ITC/IDC-style teaching scenario, which behavior shows weak control?",
    options: [
      "Positioning students clearly",
      "Demonstrating a skill slowly and visibly",
      "Moving on without noticing a student's unsafe mistake",
      "Explaining signals in the briefing",
      "Giving corrective feedback in the debriefing",
    ],
    correctOption: 2,
    explanation: "Instructor candidates are expected to observe students, stop unsafe errors, and give useful corrective feedback.",
  },
  {
    category: "Scuba Diving",
    prompt: "Which practice best protects a reef during a dive?",
    options: [
      "Maintaining neutral buoyancy and avoiding contact",
      "Taking a small piece of coral as a souvenir",
      "Deliberately stirring sediment",
      "Hand-feeding fish",
      "Resting fins on the reef",
    ],
    correctOption: 0,
    explanation: "Neutral buoyancy and no-contact behavior reduce damage to fragile reef ecosystems.",
  },
  {
    category: "Scuba Diving",
    prompt: "Which statement about the PADI IDC pathway is correct?",
    options: [
      "The IDC is only one written theory exam",
      "The IDC includes Assistant Instructor and OWSI development before most candidates attend an IE",
      "No logged dives are needed to start an IDC",
      "The IE is completed before Divemaster certification",
      "The IDC is a freediving-only course",
    ],
    correctOption: 1,
    explanation: "Public PADI material describes the IDC as AI plus OWSI development, with most candidates then attending an Instructor Examination.",
  },
];

const demoBank42: GeneratedQuestion[] = [
  {
    category: "Norm Kuralları",
    prompt: "Norm'a göre bir C fonksiyonu, kendi süslü parantezleri hariç en fazla kaç satır olabilir?",
    options: ["15", "20", "25", "30", "42"],
    correctOption: 2,
    explanation: "Norm, fonksiyon gövdesini kendi parantezleri hariç en fazla 25 satırla sınırlar.",
  },
  {
    category: "Norm Kuralları",
    prompt: "Norm'a göre bir fonksiyon en fazla kaç isimlendirilmiş parametre alabilir?",
    options: ["3", "4", "5", "6", "Sınır yoktur"],
    correctOption: 1,
    explanation: "Bir fonksiyon en fazla 4 isimlendirilmiş parametre alabilir.",
  },
  {
    category: "42 Türkiye İç Yönerge",
    prompt: "42 Türkiye'de genel ziyaretçi talebi en az ne kadar önce iletilmelidir?",
    options: ["2 saat önce", "Aynı gün", "1 iş günü / 24 saat önce", "1 hafta önce", "Sadece kapıda"],
    correctOption: 2,
    explanation: "Genel ziyaretçi talebi en az 1 iş günü, yani 24 saat önce Issue Sistemi üzerinden iletilir.",
  },
  {
    category: "42 Türkiye İç Yönerge",
    prompt: "Piscine süreci yönergeye göre kaç gün sürer?",
    options: ["14", "21", "26", "30", "42"],
    correctOption: 2,
    explanation: "Havuz Eğitimi 26 gün süren bir seçim sürecidir.",
  },
  {
    category: "42 Türkiye İç Yönerge",
    prompt: "Sınav sırasında telefon veya akıllı saat için doğru davranış hangisidir?",
    options: [
      "Masada sessizde durabilir",
      "Kapalı şekilde çantada durmalıdır",
      "Sadece mola sırasında kontrol edilebilir",
      "Tutor onayı olmadan kullanılabilir",
      "Cluster zemininde bırakılmalıdır",
    ],
    correctOption: 1,
    explanation: "Telefonlar ve akıllı saatler kapatılıp çantaya konulmalıdır; kontrol etmek kopya sayılabilir.",
  },
  {
    category: "Git & GitHub",
    prompt: "Commit'e girecek değişiklikleri son kez görmek için hangi komut kullanılır?",
    options: ["git diff", "git diff --staged", "git status --short", "git fetch", "git remote -v"],
    correctOption: 1,
    explanation: "git diff --staged, staging alanındaki yani commit'e hazırlanmış değişiklikleri gösterir.",
  },
  {
    category: "Git & GitHub",
    prompt: "Paylaşılmış bir commit'i güvenli şekilde geri almak için genellikle hangi komut tercih edilir?",
    options: ["git reset --hard HEAD", "git restore .", "git revert <hash>", "git rm -r .git", "git stash pop"],
    correctOption: 2,
    explanation: "Paylaşılmış geçmişte git revert yeni bir ters commit oluşturduğu için en güvenli yoldur.",
  },
  {
    category: "42 Genel Bilgi",
    prompt: "Havuz Eğitimini tamamlayıp ana eğitime başlayan öğrencinin statüsü nedir?",
    options: ["Applicant", "Pisciner", "Cadet", "Transcender", "Graduate"],
    correctOption: 2,
    explanation: "Havuz Eğitimini tamamlayıp ana eğitime başlayan öğrenci Cadet statüsünü kazanır.",
  },
];

const demoBank42En: GeneratedQuestion[] = [
  {
    category: "Norm Rules",
    prompt: "Under the Norm, what is the maximum number of lines in a C function, excluding its own braces?",
    options: ["15", "20", "25", "30", "42"],
    correctOption: 2,
    explanation: "The Norm limits a function to 25 lines, excluding the function's own braces.",
  },
  {
    category: "42 Turkey Internal Rules",
    prompt: "How early must a general visitor request be submitted?",
    options: ["2 hours before", "The same day", "1 business day / 24 hours before", "1 week before", "Only at the door"],
    correctOption: 2,
    explanation: "A general visitor request must be submitted at least 1 business day, or 24 hours, before the visit.",
  },
  {
    category: "Git & GitHub",
    prompt: "Which command shows the changes already selected for the next commit?",
    options: ["git diff", "git diff --staged", "git fetch", "git remote -v", "git stash list"],
    correctOption: 1,
    explanation: "git diff --staged shows the changes currently in the staging area.",
  },
  {
    category: "42 General Knowledge",
    prompt: "Which status belongs to a student who has completed the Piscine and started the main curriculum?",
    options: ["Applicant", "Pisciner", "Cadet", "Transcender", "Graduate"],
    correctOption: 2,
    explanation: "After completing the Piscine and starting the main curriculum, the student becomes a Cadet.",
  },
];

function demoQuestionBank(settings: RoomSettings): GeneratedQuestion[] {
  if (settings.mode === "classic" && settings.category === "scuba") {
    return settings.language === "en" ? demoBankScubaEn : demoBankScuba;
  }
  if (settings.mode === "fortyTwo") {
    return settings.language === "en" ? demoBank42En : demoBank42;
  }
  return settings.language === "en" ? demoBankEn : demoBank;
}

function demoQuestions(settings: RoomSettings, context: PromptContext): GeneratedQuestion[] {
  const sourceBank = demoQuestionBank(settings);
  const seen = new Set(context.usedPrompts.map(normalizeQuestionPrompt));
  const picked: GeneratedQuestion[] = [];

  for (const question of sourceBank) {
    if (picked.length >= context.batchSize) {
      break;
    }
    if (isDuplicate(question.prompt, seen)) {
      continue;
    }
    seen.add(normalizeQuestionPrompt(question.prompt));
    picked.push({
      ...question,
      options: [...question.options] as GeneratedQuestion["options"],
    });
  }

  return picked;
}

export async function generateQuestions(
  settings: RoomSettings,
  usedPrompts: string[] = [],
  filterQuestions: QuestionFilter = async (questions) => questions,
  deadline = Date.now() + 100_000,
): Promise<GeneratedQuestion[]> {
  return generateUniqueQuestions(settings, usedPrompts, filterQuestions, deadline);
}
