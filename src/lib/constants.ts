import type { RoomSettings } from "@/lib/types";

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
