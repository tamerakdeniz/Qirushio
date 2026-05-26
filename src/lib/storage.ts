"use client";

import type { AppTheme, QuizLanguage, RoomSession } from "@/lib/types";

const nicknameKey = "qirushio:nickname";
const sessionPrefix = "qirushio:room:";
const languageKey = "qirushio:language";
const themeKey = "qirushio:theme";
const legacyNicknameKey = "bilgi-yarisi:nickname";
const legacySessionPrefix = "bilgi-yarisi:room:";

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
