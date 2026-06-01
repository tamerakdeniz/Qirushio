import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, findRoom, requireHost, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";

export const runtime = "nodejs";

interface PlayerRow {
  id: string;
  is_host: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; playerId: string }> },
): Promise<NextResponse> {
  try {
    const { code, playerId } = await params;
    const room = await findRoom(code);
    if (room.phase !== "lobby") {
      throw new ApiError(409, "Oyuncular yalnızca oyun başlamadan önce lobideyken odadan çıkarılabilir.");
    }

    const host = await requireHost(request, room.id);
    if (playerId === host.player.id) {
      throw new ApiError(409, "Oda sahibi kendisini odadan çıkaramaz.");
    }

    const admin = getSupabaseAdmin();
    const { data: player, error: playerError } = await admin
      .from("players")
      .select("id, is_host")
      .eq("id", playerId)
      .eq("room_id", room.id)
      .maybeSingle<PlayerRow>();

    if (playerError) {
      throw new Error(playerError.message);
    }
    if (!player) {
      throw new ApiError(404, "Oyuncu bulunamadı.");
    }
    if (player.is_host) {
      throw new ApiError(409, "Oda sahibi odadan çıkarılamaz.");
    }

    const { error: deleteError } = await admin
      .from("players")
      .delete()
      .eq("id", player.id)
      .eq("room_id", room.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    await notifyRoomChanged(room.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
