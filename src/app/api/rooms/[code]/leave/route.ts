import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, findRoom, requirePlayer, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";

export const runtime = "nodejs";

interface PlayerRow {
  id: string;
  is_host: boolean;
  joined_at: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const room = await findRoom((await params).code);
    if (room.phase !== "lobby" && room.phase !== "finished") {
      throw new ApiError(409, "Oyun devam ederken odadan ayrılamazsınız.");
    }

    const { player } = await requirePlayer(request, room.id);
    const admin = getSupabaseAdmin();

    const { data: players, error: playersError } = await admin
      .from("players")
      .select("id, is_host, joined_at")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });
    if (playersError) {
      throw new Error(playersError.message);
    }

    const remaining = (players as PlayerRow[] | null)?.filter((row) => row.id !== player.id) ?? [];

    const { error: deleteError } = await admin.from("players").delete().eq("id", player.id);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (player.isHost) {
      const nextHost = remaining[0];
      const [{ error: hostPlayerError }, { error: hostRoomError }] = await Promise.all([
        admin.from("players").update({ is_host: false }).eq("room_id", room.id),
        admin.from("rooms").update({ host_player_id: nextHost.id }).eq("id", room.id),
      ]);
      if (hostPlayerError || hostRoomError) {
        throw new Error(hostPlayerError?.message ?? hostRoomError?.message);
      }

      const { error: promoteError } = await admin
        .from("players")
        .update({ is_host: true, is_ready: true })
        .eq("id", nextHost.id);
      if (promoteError) {
        throw new Error(promoteError.message);
      }
    }

    await notifyRoomChanged(room.id);
    return NextResponse.json({ ok: true, roomDeleted: false });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
