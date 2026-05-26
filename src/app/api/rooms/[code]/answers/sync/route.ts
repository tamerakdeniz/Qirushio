import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { findRoom, requirePlayer, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { answerSyncSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const input = answerSyncSchema.parse(await request.json());
    const room = await findRoom((await params).code);
    if (!room.speedrunMode) {
      return NextResponse.json({ error: "Speedrun dışı odalarda senkron kullanılamaz." }, { status: 400 });
    }

    const authorized = await requirePlayer(request, room.id);
    const admin = getSupabaseAdmin();
    const synced: string[] = [];

    for (const answer of input.answers) {
      const { data, error } = await admin.rpc("submit_answer", {
        p_room_id: room.id,
        p_player_id: authorized.player.id,
        p_token_hash: authorized.tokenHash,
        p_question_id: answer.questionId,
        p_selected_option: answer.selectedOption,
        p_time_remaining_ms: answer.timeRemainingMs,
      });
      if (error) {
        if (error.message.includes("question_closed") || error.message.includes("invalid_question")) {
          continue;
        }
        throw new Error(error.message);
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (result?.accepted) {
        synced.push(answer.questionId);
      }
    }

    if (synced.length > 0) {
      await notifyRoomChanged(room.id);
    }

    return NextResponse.json({ synced });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return routeErrorResponse(error);
  }
}
