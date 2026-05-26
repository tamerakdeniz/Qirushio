"use client";

import type { RoomSession } from "@/lib/types";

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  session?: RoomSession | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session) {
    headers.set("x-player-id", session.playerId);
    headers.set("x-player-token", session.playerToken);
  }

  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "İstek tamamlanamadı.");
  }
  return payload;
}

