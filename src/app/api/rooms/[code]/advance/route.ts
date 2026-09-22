import { after, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findRoom, requirePlayer, routeErrorResponse } from "@/lib/server/http";
import { loadRoomSnapshot } from "@/lib/server/room-snapshot";
import { notifyRoomChanged } from "@/lib/server/realtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const room = await findRoom((await params).code);
    const authorized = await requirePlayer(request, room.id);
    const { data, error } = await getSupabaseAdmin().rpc("advance_game", {
      p_room_id: room.id,
    });
    if (error) {
      throw new Error(error.message);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.changed) {
      after(() => notifyRoomChanged(room.id));
    }
    // Always re-read: another player may have advanced while this RPC waited.
    const currentRoom = await findRoom(room.code);
    return NextResponse.json(await loadRoomSnapshot(currentRoom, authorized));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

