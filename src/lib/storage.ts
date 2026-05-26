"use client";

import type { AppTheme, PendingAnswer, QuizLanguage, RoomSession } from "@/lib/types";

const nicknameKey = "qirushio:nickname";
const sessionPrefix = "qirushio:room:";
const languageKey = "qirushio:language";
const themeKey = "qirushio:theme";
const legacyNicknameKey = "bilgi-yarisi:nickname";
const legacySessionPrefix = "bilgi-yarisi:room:";
const pendingAnswersPrefix = "qirushio:pending:";

function pendingAnswersKey(code: string): string {
  return `${pendingAnswersPrefix}${code.toUpperCase()}`;
}

export function readNickname(): string {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem(nicknameKey) ?? localStorage.getItem(legacyNicknameKey) ?? "";
}

export function saveNickname(nickname: string): void {
  localStorage.setItem(nicknameKey, nickname);
}

export function readRoomSession(code: string): RoomSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const normalizedCode = code.toUpperCase();
    const value =
      localStorage.getItem(`${sessionPrefix}${normalizedCode}`) ??
      localStorage.getItem(`${legacySessionPrefix}${normalizedCode}`);
    return value ? (JSON.parse(value) as RoomSession) : null;
  } catch {
    return null;
  }
}

export function saveRoomSession(session: RoomSession): void {
  localStorage.setItem(
    `${sessionPrefix}${session.roomCode.toUpperCase()}`,
    JSON.stringify(session),
  );
  saveNickname(session.nickname);
}

export function removeRoomSession(code: string): void {
  localStorage.removeItem(`${sessionPrefix}${code.toUpperCase()}`);
  localStorage.removeItem(`${legacySessionPrefix}${code.toUpperCase()}`);
}

export function readLanguage(): QuizLanguage {
  if (typeof window === "undefined") {
    return "tr";
  }

  return localStorage.getItem(languageKey) === "en" ? "en" : "tr";
}

export function saveLanguage(language: QuizLanguage): void {
  localStorage.setItem(languageKey, language);
}

export function readTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  return localStorage.getItem(themeKey) === "light" ? "light" : "dark";
}

export function saveTheme(theme: AppTheme): void {
  localStorage.setItem(themeKey, theme);
  document.documentElement.dataset.theme = theme;
}

export function readPendingAnswers(code: string): PendingAnswer[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = localStorage.getItem(pendingAnswersKey(code));
    return value ? (JSON.parse(value) as PendingAnswer[]) : [];
  } catch {
    return [];
  }
}

export function upsertPendingAnswer(code: string, answer: PendingAnswer): void {
  const pending = readPendingAnswers(code).filter((item) => item.questionId !== answer.questionId);
  pending.push(answer);
  localStorage.setItem(pendingAnswersKey(code), JSON.stringify(pending));
}

export function removePendingAnswer(code: string, questionId: string): void {
  const pending = readPendingAnswers(code).filter((item) => item.questionId !== questionId);
  if (pending.length === 0) {
    localStorage.removeItem(pendingAnswersKey(code));
    return;
  }
  localStorage.setItem(pendingAnswersKey(code), JSON.stringify(pending));
}

export function clearPendingAnswers(code: string): void {
  localStorage.removeItem(pendingAnswersKey(code));
}
