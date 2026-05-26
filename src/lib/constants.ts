import type { QuizCategory, QuizDifficulty, QuizLanguage, QuizScope, RoomSettings } from "@/lib/types";

export const defaultRoomSettings: RoomSettings = {
  language: "tr",
  category: "general",
  difficulty: "medium",
  scope: "global",
  questionCount: 10,
  questionTimeSeconds: 20,
  isPublic: true,
};

export const categoryLabels = {
  general: "Genel Kültür",
  science: "Bilim",
  sports: "Spor",
  arts: "Sanat",
  history: "Tarih",
  random: "Rastgele",
} as const;

export const difficultyLabels = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
} as const;

export const scopeLabels = {
  global: "Global",
  local: "Yerel",
} as const;

export const languageLabels = {
  tr: "Türkçe",
  en: "English",
} as const;

export const categoryLabelsByLanguage: Record<QuizLanguage, Record<QuizCategory, string>> = {
  tr: categoryLabels,
  en: {
    general: "General",
    science: "Science",
    sports: "Sports",
    arts: "Arts",
    history: "History",
    random: "Random",
  },
};

export const difficultyLabelsByLanguage: Record<QuizLanguage, Record<QuizDifficulty, string>> = {
  tr: difficultyLabels,
  en: {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  },
};

export const scopeLabelsByLanguage: Record<QuizLanguage, Record<QuizScope, string>> = {
  tr: scopeLabels,
  en: {
    global: "Global",
    local: "Local",
  },
};
