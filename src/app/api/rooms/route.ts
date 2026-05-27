import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { questionPauseMs } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createRoomSchema } from "@/lib/validation";
import {
  ApiError,
  issuePlayerToken,
  routeErrorResponse,
} from "@/lib/server/http";
import { listPublicRooms } from "@/lib/server/list-public-rooms";
import { notifyRoomChanged } from "@/lib/server/realtime";
import type { RoomSession, RoomSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function roomCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => roomAlphabet[byte % roomAlphabet.length]).join("");
}

function invalidBody(error: ZodError): NextResponse {
  return NextResponse.json({ error: error.issues[0]?.message ?? "Geçersiz istek." }, { status: 400 });
}

export async function GET(): Promise<NextResponse> {
  try {
    const admin = getSupabaseAdmin();
    const rooms = await listPublicRooms(admin);
    return NextResponse.json({ rooms });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = createRoomSchema.parse(await request.json());
    const admin = getSupabaseAdmin();
    const { token, tokenHash } = issuePlayerToken();
    let createdRoom: { id: string; code: string } | null = null;

    for (let attempt = 0; attempt < 5 && !createdRoom; attempt += 1) {
      const code = roomCode();
      const { data, error } = await admin
        .from("rooms")
        .insert({
          code,
          language: input.settings.language,
          category: input.settings.category,
          difficulty: input.settings.difficulty,
          scope: input.settings.scope,
          question_count: input.settings.questionCount,
          question_time_seconds: input.settings.questionTimeSeconds,
          speedrun_mode: input.settings.speedrunMode,
          question_pause_ms: questionPauseMs(input.settings.questionPauseSeconds),
          is_public: input.settings.isPublic,
        })
        .select("id, code")
        .single<{ id: string; code: string }>();

      if (!error) {
        createdRoom = data;
      } else if (error.code !== "23505") {
        throw new Error(error.message);
      }
    }

    if (!createdRoom) {
      throw new ApiError(503, "Oda kodu oluşturulamadı, tekrar deneyin.");
    }

    const { data: player, error: playerError } = await admin
      .from("players")
      .insert({
        room_id: createdRoom.id,
        nickname: input.nickname,
        is_host: true,
        is_ready: true,
      })
      .select("id")
      .single<{ id: string }>();

    if (playerError || !player) {
      await admin.from("rooms").delete().eq("id", createdRoom.id);
      throw new Error(playerError?.message ?? "Host oluşturulamadı.");
    }

    const [{ error: sessionError }, { error: roomError }] = await Promise.all([
      admin.from("player_sessions").insert({ player_id: player.id, token_hash: tokenHash }),
      admin.from("rooms").update({ host_player_id: player.id }).eq("id", createdRoom.id),
    ]);

    if (sessionError || roomError) {
      await admin.from("rooms").delete().eq("id", createdRoom.id);
      throw new Error(sessionError?.message ?? roomError?.message);
    }

    const session: RoomSession = {
      roomCode: createdRoom.code,
      playerId: player.id,
      playerToken: token,
      nickname: input.nickname,
    };
    await notifyRoomChanged(createdRoom.id);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return invalidBody(error);
    }
    return routeErrorResponse(error);
  }
}

