"use client";

import type { RoomSession } from "@/lib/types";

const nicknameKey = "bilgi-yarisi:nickname";
const sessionPrefix = "bilgi-yarisi:room:";

export function readNickname(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem(nicknameKey) ?? "";
}

export function saveNickname(nickname: string): void {
  localStorage.setItem(nicknameKey, nickname);
}

export function readRoomSession(code: string): RoomSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = localStorage.getItem(`${sessionPrefix}${code.toUpperCase()}`);
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
}

