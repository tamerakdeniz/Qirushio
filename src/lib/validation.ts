import { z } from "zod";

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "Takma ad en az 2 karakter olmalı.")
  .max(24, "Takma ad en fazla 24 karakter olabilir.")
  .regex(/^[\p{L}\p{N} ._-]+$/u, "Takma ad geçersiz karakter içeriyor.");

export const roomSettingsSchema = z
  .object({
    language: z.enum(["tr", "en"]),
    category: z.enum(["general", "science", "sports", "arts", "history", "random"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    scope: z.enum(["global", "local"]),
    questionCount: z.number().int().min(5).max(20),
    questionTimeSeconds: z.number().int().min(3).max(30),
    questionPauseSeconds: z.union([z.literal(0), z.literal(1.5), z.literal(3)]),
    speedrunMode: z.boolean(),
    isPublic: z.boolean(),
  })
  .superRefine((settings, context) => {
    const allowed = settings.speedrunMode ? [3, 5] : [5, 10, 15, 20, 30];
    if (!allowed.includes(settings.questionTimeSeconds)) {
      context.addIssue({
        code: "custom",
        path: ["questionTimeSeconds"],
        message: settings.speedrunMode
          ? "Speedrun modunda soru süresi 3 veya 5 saniye olmalı."
          : "Soru süresi geçersiz.",
      });
    }
  });

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  settings: roomSettingsSchema,
});

export const joinRoomSchema = z.object({
  nickname: nicknameSchema,
});

export const nicknameUpdateSchema = z.object({
  nickname: nicknameSchema,
});

export const readySchema = z.object({
  isReady: z.boolean(),
});

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOption: z.number().int().min(0).max(4),
  timeRemainingMs: z.number().int().min(0).max(30_000).optional(),
});

export const answerSyncSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selectedOption: z.number().int().min(0).max(4),
        timeRemainingMs: z.number().int().min(0).max(30_000),
      }),
    )
    .min(1)
    .max(25),
});

export const generatedQuestionSchema = z.object({
  category: z.string().trim().min(1).max(60),
  prompt: z.string().trim().min(5).max(350),
  options: z
    .array(z.string().trim().min(1).max(160))
    .length(5)
    .transform((options) => options as [string, string, string, string, string]),
  correctOption: z.number().int().min(0).max(4),
  explanation: z.string().trim().min(5).max(450),
});

export const generatedQuestionsSchema = z.array(generatedQuestionSchema);
