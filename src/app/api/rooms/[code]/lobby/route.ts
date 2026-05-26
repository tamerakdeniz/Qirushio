import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findRoom, requireHost, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const room = await findRoom((await params).code);
    const host = await requireHost(request, room.id);
    const { error } = await getSupabaseAdmin().rpc("return_to_lobby", {
      p_room_id: room.id,
      p_host_id: host.player.id,
      p_token_hash: host.tokenHash,
    });
    if (error) {
      throw new Error(error.message);
    }
    await notifyRoomChanged(room.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

