import type { QuestionDifficulty, QuizLanguage } from "@/lib/types";

export const questionDifficulties = ["easy", "medium", "hard"] as const;
export type DifficultyCounts = Record<QuestionDifficulty, number>;

// Largest-remainder rounding keeps the total exact; ties favor medium, then hard.
export function mixedDifficultyCounts(questionCount: number): DifficultyCounts {
  const weights = { easy: 2, medium: 5, hard: 3 };
  const counts: DifficultyCounts = {
    easy: Math.floor(questionCount * weights.easy / 10),
    medium: Math.floor(questionCount * weights.medium / 10),
    hard: Math.floor(questionCount * weights.hard / 10),
  };
  const remainderOrder: QuestionDifficulty[] = ["medium", "hard", "easy"];
  remainderOrder.sort((a, b) => (questionCount * weights[b]) % 10 - (questionCount * weights[a]) % 10);
  const remaining = questionCount - counts.easy - counts.medium - counts.hard;
  for (let i = 0; i < remaining; i++) counts[remainderOrder[i]]++;
  return counts;
}

export function mixedDifficultyLabel(questionCount: number, locale: QuizLanguage): string {
  const { easy, medium, hard } = mixedDifficultyCounts(questionCount);
  return locale === "tr"
    ? `${easy} kolay · ${medium} orta · ${hard} zor`
    : `${easy} easy · ${medium} medium · ${hard} hard`;
}
