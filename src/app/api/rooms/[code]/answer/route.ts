import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { answerSchema } from "@/lib/validation";
import { findRoom, requirePlayer, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const input = answerSchema.parse(await request.json());
    const room = await findRoom((await params).code);
    const authorized = await requirePlayer(request, room.id);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("submit_answer", {
      p_room_id: room.id,
      p_player_id: authorized.player.id,
      p_token_hash: authorized.tokenHash,
      p_question_id: input.questionId,
      p_selected_option: input.selectedOption,
    });
    if (error) {
      throw new Error(error.message);
    }

    await notifyRoomChanged(room.id);
    const { data: advanceResult, error: advanceError } = await admin.rpc("advance_game", {
      p_room_id: room.id,
    });
    if (advanceError) {
      throw new Error(advanceError.message);
    }
    const changed = Array.isArray(advanceResult) && advanceResult[0]?.changed;
    if (changed) {
      await notifyRoomChanged(room.id);
    }

    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ accepted: result?.accepted ?? false });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return routeErrorResponse(error);
  }
}

