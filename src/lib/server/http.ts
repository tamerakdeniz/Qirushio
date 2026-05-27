import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { questionPauseFromMs } from "@/lib/constants";
import type { PlayerView, RoomView } from "@/lib/types";

interface RoomRow {
  id: string;
  code: string;
  phase: RoomView["phase"];
  host_player_id: string;
  language: RoomView["language"];
  category: RoomView["category"];
  difficulty: RoomView["difficulty"];
  scope: RoomView["scope"];
  question_count: number;
  question_time_seconds: number;
  speedrun_mode: boolean;
  question_pause_ms: number;
  is_public: boolean;
  max_players: number;
  round_number: number;
  current_question_index: number;
  phase_ends_at: string | null;
  generation_error: string | null;
}

interface PlayerRow {
  id: string;
  nickname: string;
  is_host: boolean;
  is_ready: boolean;
  score: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function issuePlayerToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPlayerToken(token) };
}

export function hashPlayerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function mapRoom(row: RoomRow): RoomView {
  return {
    id: row.id,
    code: row.code,
    phase: row.phase,
    hostPlayerId: row.host_player_id,
    language: row.language,
    category: row.category,
    difficulty: row.difficulty,
    scope: row.scope,
    questionCount: row.question_count,
    questionTimeSeconds: row.question_time_seconds,
    speedrunMode: row.speedrun_mode,
    questionPauseSeconds: questionPauseFromMs(row.question_pause_ms ?? 1500),
    isPublic: row.is_public,
    maxPlayers: row.max_players,
    roundNumber: row.round_number,
    currentQuestionIndex: row.current_question_index,
    phaseEndsAt: row.phase_ends_at,
    generationError: row.generation_error,
  };
}

export function mapPlayer(row: PlayerRow): PlayerView {
  return {
    id: row.id,
    nickname: row.nickname,
    isHost: row.is_host,
    isReady: row.is_ready,
    score: row.score,
  };
}

export async function findRoom(code: string): Promise<RoomView> {
  const { data, error } = await getSupabaseAdmin()
    .from("rooms")
    .select(
      "id, code, phase, host_player_id, language, category, difficulty, scope, question_count, question_time_seconds, speedrun_mode, question_pause_ms, is_public, max_players, round_number, current_question_index, phase_ends_at, generation_error",
    )
    .eq("code", code.toUpperCase())
    .maybeSingle<RoomRow>();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new ApiError(404, "Oda bulunamadı.");
  }

  return mapRoom(data);
}

export interface AuthorizedPlayer {
  player: PlayerView;
  tokenHash: string;
}

export async function authorizePlayer(
  request: Request,
  roomId: string,
): Promise<AuthorizedPlayer | null> {
  const playerId = request.headers.get("x-player-id");
  const playerToken = request.headers.get("x-player-token");

  if (!playerId || !playerToken) {
    return null;
  }

  const admin = getSupabaseAdmin();
  const tokenHash = hashPlayerToken(playerToken);
  const [{ data: player, error: playerError }, { data: session, error: sessionError }] =
    await Promise.all([
      admin
        .from("players")
        .select("id, nickname, is_host, is_ready, score")
        .eq("id", playerId)
        .eq("room_id", roomId)
        .maybeSingle<PlayerRow>(),
      admin
        .from("player_sessions")
        .select("token_hash")
        .eq("player_id", playerId)
        .eq("token_hash", tokenHash)
        .maybeSingle<{ token_hash: string }>(),
    ]);

  if (playerError || sessionError) {
    throw new Error(playerError?.message ?? sessionError?.message);
  }

  return player && session ? { player: mapPlayer(player), tokenHash } : null;
}

export async function requirePlayer(
  request: Request,
  roomId: string,
): Promise<AuthorizedPlayer> {
  const authorized = await authorizePlayer(request, roomId);
  if (!authorized) {
    throw new ApiError(401, "Bu oda için oyuncu oturumu bulunamadı.");
  }
  return authorized;
}

export async function requireHost(
  request: Request,
  roomId: string,
): Promise<AuthorizedPlayer> {
  const authorized = await requirePlayer(request, roomId);
  if (!authorized.player.isHost) {
    throw new ApiError(403, "Bu işlemi yalnızca oda kurucusu yapabilir.");
  }
  return authorized;
}

export function routeErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  const errorMap: Record<string, string> = {
    room_not_found: "Oda bulunamadı.",
    host_required: "Bu işlemi yalnızca oda kurucusu yapabilir.",
    round_already_active: "Bu odada bir oyun zaten devam ediyor.",
    players_not_ready: "Oyunu başlatmadan önce tüm oyuncular hazır olmalı.",
    question_closed: "Bu soru için cevap süresi sona erdi.",
    invalid_player: "Oyuncu oturumu doğrulanamadı.",
    invalid_question: "Aktif soru bulunamadı.",
  };

  const knownError = Object.entries(errorMap).find(([code]) => message.includes(code));
  if (knownError) {
    return NextResponse.json({ error: knownError[1] }, { status: 409 });
  }

  console.error(error);
  return NextResponse.json({ error: "Sunucu isteği tamamlanamadı." }, { status: 500 });
}

