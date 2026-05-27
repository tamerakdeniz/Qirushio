import { NextResponse } from "next/server";

import { preGameCountdownSeconds } from "@/lib/constants";
import { generateQuestions, usedPromptsSince } from "@/lib/server/ai";
import { findRoom, requireHost, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  let roomId: string | undefined;

  try {
    const room = await findRoom((await params).code);
    roomId = room.id;
    const host = await requireHost(request, room.id);
    const admin = getSupabaseAdmin();

    const { data: usedQuestions, error: usedError } = await admin
      .from("questions")
      .select("prompt")
      .gte("created_at", usedPromptsSince());
    if (usedError) {
      throw new Error(usedError.message);
    }

    const { data: roundNumber, error: beginError } = await admin.rpc("begin_round", {
      p_room_id: room.id,
      p_host_id: host.player.id,
      p_token_hash: host.tokenHash,
    });
    if (beginError) {
      throw new Error(beginError.message);
    }

    await notifyRoomChanged(room.id);

    const questions = await generateQuestions(
      room,
      (usedQuestions ?? []).map((row) => row.prompt),
    );
    const { error: questionsError } = await admin.from("questions").insert(
      questions.map((question, position) => ({
        room_id: room.id,
        round_number: roundNumber as number,
        position,
        category: question.category,
        prompt: question.prompt,
        options: question.options,
        correct_option: question.correctOption,
        explanation: question.explanation,
      })),
    );
    if (questionsError) {
      throw new Error(questionsError.message);
    }

    const { error: updateError } = await admin
      .from("rooms")
      .update({
        phase: "countdown",
        current_question_index: -1,
        phase_ends_at: new Date(Date.now() + preGameCountdownSeconds * 1000).toISOString(),
      })
      .eq("id", room.id)
      .eq("round_number", roundNumber as number);
    if (updateError) {
      throw new Error(updateError.message);
    }

    await notifyRoomChanged(room.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (roomId) {
      console.error("Question generation failed", error);
      await getSupabaseAdmin()
        .from("rooms")
        .update({
          phase: "lobby",
          generation_error: "Sorular hazırlanamadı. Lütfen tekrar deneyin.",
          phase_ends_at: null,
        })
        .eq("id", roomId)
        .eq("phase", "generating");
      await notifyRoomChanged(roomId);
    }
    return routeErrorResponse(error);
  }
}
