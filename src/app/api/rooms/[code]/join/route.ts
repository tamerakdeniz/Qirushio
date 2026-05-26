import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findRoom, issuePlayerToken, routeErrorResponse, ApiError } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";
import type { RoomSession, RoomView } from "@/lib/types";
import { joinRoomSchema } from "@/lib/validation";

export const runtime = "nodejs";

function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

async function issueSessionForPlayer(
  admin: ReturnType<typeof getSupabaseAdmin>,
  room: RoomView,
  player: { id: string; nickname: string },
): Promise<RoomSession> {
  const { token, tokenHash } = issuePlayerToken();
  const { error: deleteError } = await admin
    .from("player_sessions")
    .delete()
    .eq("player_id", player.id);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: sessionError } = await admin
    .from("player_sessions")
    .insert({ player_id: player.id, token_hash: tokenHash });
  if (sessionError) {
    throw new Error(sessionError.message);
  }

  return {
    roomCode: room.code,
    playerId: player.id,
    playerToken: token,
    nickname: player.nickname,
  };
}

async function reconnectExistingPlayer(
  admin: ReturnType<typeof getSupabaseAdmin>,
  room: RoomView,
  nickname: string,
): Promise<RoomSession | null> {
  const { data: player, error } = await admin
    .from("players")
    .select("id, nickname")
    .eq("room_id", room.id)
    .eq("normalized_nickname", normalizeNickname(nickname))
    .maybeSingle<{ id: string; nickname: string }>();

  if (error) {
    throw new Error(error.message);
  }
  if (!player) {
    return null;
  }

  return issueSessionForPlayer(admin, room, player);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const input = joinRoomSchema.parse(await request.json());
    const room = await findRoom((await params).code);
    const admin = getSupabaseAdmin();

    const existingSession = await reconnectExistingPlayer(admin, room, input.nickname);
    if (existingSession) {
      await notifyRoomChanged(room.id);
      return NextResponse.json({ session: existingSession }, { status: 200 });
    }

    if (room.phase !== "lobby") {
      throw new ApiError(409, "Oyun başladıktan sonra bu odaya katılamazsınız.");
    }

    const { count, error: countError } = await admin
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if (countError) {
      throw new Error(countError.message);
    }
    if ((count ?? 0) >= room.maxPlayers) {
      throw new ApiError(409, "Oda dolu.");
    }

    const { data: player, error } = await admin
      .from("players")
      .insert({ room_id: room.id, nickname: input.nickname })
      .select("id, nickname")
      .single<{ id: string; nickname: string }>();
    if (error?.code === "23505") {
      const racedSession = await reconnectExistingPlayer(admin, room, input.nickname);
      if (racedSession) {
        await notifyRoomChanged(room.id);
        return NextResponse.json({ session: racedSession }, { status: 200 });
      }
      throw new ApiError(409, "Bu takma ad odada zaten kullanılıyor.");
    }
    if (error || !player) {
      throw new Error(error?.message ?? "Oyuncu eklenemedi.");
    }

    const session = await issueSessionForPlayer(admin, room, player);
    await notifyRoomChanged(room.id);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return routeErrorResponse(error);
  }
}
