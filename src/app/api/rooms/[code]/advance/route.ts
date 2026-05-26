import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findRoom, requirePlayer, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const room = await findRoom((await params).code);
    await requirePlayer(request, room.id);
    const { data, error } = await getSupabaseAdmin().rpc("advance_game", {
      p_room_id: room.id,
    });
    if (error) {
      throw new Error(error.message);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.changed) {
      await notifyRoomChanged(room.id);
    }
    return NextResponse.json({ changed: result?.changed ?? false });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

