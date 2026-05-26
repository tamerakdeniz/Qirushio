import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError, findRoom, requirePlayer, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { nicknameUpdateSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const input = nicknameUpdateSchema.parse(await request.json());
    const room = await findRoom((await params).code);
    if (room.phase !== "lobby") {
      throw new ApiError(409, "Takma ad yalnızca lobide değiştirilebilir.");
    }

    const { player } = await requirePlayer(request, room.id);
    const { data, error } = await getSupabaseAdmin()
      .from("players")
      .update({ nickname: input.nickname })
      .eq("id", player.id)
      .eq("room_id", room.id)
      .select("nickname")
      .single<{ nickname: string }>();

    if (error?.code === "23505") {
      throw new ApiError(409, "Bu takma ad odada zaten kullanılıyor.");
    }
    if (error || !data) {
      throw new Error(error?.message ?? "Takma ad güncellenemedi.");
    }

    await notifyRoomChanged(room.id);
    return NextResponse.json({ nickname: data.nickname });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return routeErrorResponse(error);
  }
}

