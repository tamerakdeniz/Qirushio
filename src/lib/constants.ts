import type {
  ClassicQuizCategory,
  FortyTwoQuizCategory,
  QuestionPauseSeconds,
  QuizCategory,
  QuizDifficulty,
  QuizLanguage,
  QuizMode,
  QuizScope,
  RoomSettings,
} from "@/lib/types";

export const fortyTwoModeEnabled = false;

export function isQuizModeEnabled(mode: QuizMode): boolean {
  return mode === "classic" || fortyTwoModeEnabled;
}

export const normalQuestionTimeOptions = [5, 10, 15, 20, 30] as const;
export const speedrunQuestionTimeOptions = [3, 5] as const;
export const questionPauseOptions = [0, 1.5, 3] as const satisfies readonly QuestionPauseSeconds[];
export const preGameCountdownSeconds = 3;
export const defaultQuestionPauseSeconds: QuestionPauseSeconds = 1.5;
export const classicQuizCategories = [
  "general",
  "science",
  "sports",
  "arts",
  "history",
  "scuba",
  "medicine",
  "random",
] as const satisfies readonly ClassicQuizCategory[];
export const fortyTwoQuizCategories = [
  "ft_norm_internal_mix",
  "ft_norm",
  "ft_internal",
  "ft_git_github",
  "ft_general",
  "ft_mixed",
] as const satisfies readonly FortyTwoQuizCategory[];
export const quizCategoriesByMode: Record<QuizMode, readonly QuizCategory[]> = {
  classic: classicQuizCategories,
  fortyTwo: fortyTwoQuizCategories,
};

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
  mode: "classic",
  language: "tr",
  category: "general",
  difficulty: "medium",
  medicalYear: 1,
  scope: "global",
  questionCount: 10,
  questionTimeSeconds: 20,
  questionPauseSeconds: defaultQuestionPauseSeconds,
  speedrunMode: false,
  isPublic: true,
  maxPlayers: 10,
};

export const defaultMedicalRoomSettings: RoomSettings = {
  ...defaultRoomSettings,
  category: "medicine",
  medicalYear: 2,
  medicalYears: [2],
  medicalSubject: "mixed",
  scope: "local",
  questionTimeSeconds: 30,
};

export const defaultFortyTwoRoomSettings: RoomSettings = {
  ...defaultRoomSettings,
  mode: "fortyTwo",
  category: "ft_norm_internal_mix",
  questionCount: 10,
  questionTimeSeconds: 20,
};

export const categoryLabels = {
  general: "Genel Kültür",
  science: "Bilim",
  sports: "Spor",
  arts: "Sanat",
  history: "Tarih",
  scuba: "Scuba Dalış",
  medicine: "Tıp",
  random: "Rastgele",
  ft_general: "42 Genel Bilgi",
  ft_norm: "Norm Kuralları",
  ft_internal: "42 Türkiye İç Yönerge",
  ft_norm_internal_mix: "Norm + Yönerge",
  ft_git_github: "Git & GitHub",
  ft_mixed: "42 Karma",
} as const satisfies Record<QuizCategory, string>;

export const difficultyLabels = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
  mixed: "Karma",
} as const;

export const scopeLabels = {
  global: "Global",
  local: "Yerel",
} as const;

export const languageLabels = {
  tr: "Türkçe",
  en: "English",
} as const;

export const modeLabelsByLanguage: Record<QuizLanguage, Record<QuizMode, string>> = {
  tr: {
    classic: "Klasik",
    fortyTwo: "42 İstanbul",
  },
  en: {
    classic: "Classic",
    fortyTwo: "42 Istanbul",
  },
};

export const categoryLabelsByLanguage: Record<QuizLanguage, Record<QuizCategory, string>> = {
  tr: categoryLabels,
  en: {
    general: "General",
    science: "Science",
    sports: "Sports",
    arts: "Arts",
    history: "History",
    scuba: "Scuba Diving",
    medicine: "Medicine",
    random: "Random",
    ft_general: "42 General Knowledge",
    ft_norm: "Norm Rules",
    ft_internal: "42 Turkey Internal Rules",
    ft_norm_internal_mix: "Norm + Rules",
    ft_git_github: "Git & GitHub",
    ft_mixed: "42 Mixed",
  },
};

export const difficultyLabelsByLanguage: Record<QuizLanguage, Record<QuizDifficulty, string>> = {
  tr: difficultyLabels,
  en: {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    mixed: "Mixed",
  },
};

export const scopeLabelsByLanguage: Record<QuizLanguage, Record<QuizScope, string>> = {
  tr: scopeLabels,
  en: {
    global: "Global",
    local: "Local",
  },
};

export const medicalYears = [1, 2, 3, 4, 5, 6] as const;
export function medicalYearLabel(year: RoomSettings["medicalYear"], locale: QuizLanguage): string {
  return locale === "tr" ? `${year}. Sınıf` : `Year ${year}`;
}
export function medicalCoverageLabel(year: RoomSettings["medicalYear"], locale: QuizLanguage): string {
  if (locale === "tr") return year === 1 ? "Yalnızca 1. sınıf konuları" : `1–${year}. sınıf konuları dahil`;
  return year === 1 ? "Year 1 topics only" : `Includes years 1–${year}`;
}
