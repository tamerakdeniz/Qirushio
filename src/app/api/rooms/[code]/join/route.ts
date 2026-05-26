import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findRoom, issuePlayerToken, routeErrorResponse, ApiError } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";
import type { RoomSession } from "@/lib/types";
import { joinRoomSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const input = joinRoomSchema.parse(await request.json());
    const room = await findRoom((await params).code);
    if (room.phase !== "lobby") {
      throw new ApiError(409, "Oyun başladıktan sonra bu odaya katılamazsınız.");
    }

    const admin = getSupabaseAdmin();
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

    const { token, tokenHash } = issuePlayerToken();
    const { data: player, error } = await admin
      .from("players")
      .insert({ room_id: room.id, nickname: input.nickname })
      .select("id")
      .single<{ id: string }>();
    if (error?.code === "23505") {
      throw new ApiError(409, "Bu takma ad odada zaten kullanılıyor.");
    }
    if (error || !player) {
      throw new Error(error?.message ?? "Oyuncu eklenemedi.");
    }

    const { error: sessionError } = await admin
      .from("player_sessions")
      .insert({ player_id: player.id, token_hash: tokenHash });
    if (sessionError) {
      await admin.from("players").delete().eq("id", player.id);
      throw new Error(sessionError.message);
    }

    const session: RoomSession = {
      roomCode: room.code,
      playerId: player.id,
      playerToken: token,
      nickname: input.nickname,
    };
    await notifyRoomChanged(room.id);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return routeErrorResponse(error);
  }
}

