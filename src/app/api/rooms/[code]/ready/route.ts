import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { findRoom, requirePlayer, routeErrorResponse, ApiError } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";
import { readySchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const input = readySchema.parse(await request.json());
    const room = await findRoom((await params).code);
    if (room.phase !== "lobby") {
      throw new ApiError(409, "Hazır durumu yalnızca lobide değiştirilebilir.");
    }
    const { player } = await requirePlayer(request, room.id);
    if (player.isHost && !input.isReady) {
      throw new ApiError(409, "Oda kurucusu hazır olarak kalır.");
    }

    const { error } = await getSupabaseAdmin()
      .from("players")
      .update({ is_ready: input.isReady })
      .eq("id", player.id);
    if (error) {
      throw new Error(error.message);
    }
    await notifyRoomChanged(room.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return routeErrorResponse(error);
  }
}

