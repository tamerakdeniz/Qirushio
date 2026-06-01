import type {
  QuestionPauseSeconds,
  QuizCategory,
  QuizDifficulty,
  QuizLanguage,
  QuizScope,
  RoomSettings,
} from "@/lib/types";

export const normalQuestionTimeOptions = [5, 10, 15, 20, 30] as const;
export const speedrunQuestionTimeOptions = [3, 5] as const;
export const questionPauseOptions = [0, 1.5, 3] as const satisfies readonly QuestionPauseSeconds[];
export const preGameCountdownSeconds = 3;
export const defaultQuestionPauseSeconds: QuestionPauseSeconds = 1.5;

export function questionPauseMs(seconds: QuestionPauseSeconds): number {
  return seconds === 0 ? 0 : seconds * 1000;
}

export function questionPauseFromMs(ms: number): QuestionPauseSeconds {
  if (ms === 3000) {
    return 3;
  }
  if (ms === 1500) {
    return 1.5;
  }
  return 0;
}

export function scoringPauseSeconds(pauseSeconds: QuestionPauseSeconds): QuestionPauseSeconds {
  return pauseSeconds > 0 ? pauseSeconds : 1.5;
}

export const defaultRoomSettings: RoomSettings = {
  language: "tr",
  category: "general",
  difficulty: "medium",
  scope: "global",
  questionCount: 10,
  questionTimeSeconds: 20,
  questionPauseSeconds: defaultQuestionPauseSeconds,
  speedrunMode: false,
  isPublic: true,
  maxPlayers: 10,
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
