import { NextResponse } from "next/server";

import { generateQuestions } from "@/lib/server/ai";
import { findRoom, requireHost, routeErrorResponse } from "@/lib/server/http";
import { filterNewQuestions, recentQuestionPrompts } from "@/lib/server/question-history";
import { notifyRoomChanged } from "@/lib/server/realtime";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  let roomId: string | undefined;
  let ownedRound: number | undefined;

  try {
    const room = await findRoom((await params).code);
    roomId = room.id;
    const host = await requireHost(request, room.id);
    const admin = getSupabaseAdmin();
    const body = (await request.json().catch(() => ({}))) as { force?: unknown };
    const forceStart = body.force === true;

    if (forceStart && (room.phase === "lobby" || room.phase === "finished")) {
      const { error: readyError } = await admin
        .from("players")
        .update({ is_ready: true })
        .eq("room_id", room.id);
      if (readyError) {
        throw new Error(readyError.message);
      }
    }

    const { data: roundNumber, error: beginError } = await admin.rpc("begin_round", {
      p_room_id: room.id,
      p_host_id: host.player.id,
      p_token_hash: host.tokenHash,
    });
    if (beginError) {
      throw new Error(beginError.message);
    }

    ownedRound = roundNumber as number;
    await notifyRoomChanged(room.id);

    const deadline = Date.now() + 100_000;
    let published = false;
    const rejectedPrompts: string[] = [];
    for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
      const questions = await generateQuestions(
        room,
        [...await recentQuestionPrompts(), ...rejectedPrompts],
        filterNewQuestions,
        deadline,
      );
      const { error } = await admin.rpc("publish_generated_round", {
        p_room_id: room.id,
        p_round_number: ownedRound,
        p_questions: questions,
      });
      if (!error) {
        published = true;
        break;
      }
      // Another room may have published these facts after our read. The DB has
      // rolled back the entire batch; generate fresh candidates within budget.
      if (error.message.includes("duplicate_question") || error.code === "23505") {
        rejectedPrompts.push(...questions.map((question) => question.prompt));
        continue;
      }
      throw new Error(error.message);
    }
    if (!published) throw new Error("Could not publish a unique question batch.");

    await notifyRoomChanged(room.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (roomId && ownedRound !== undefined) {
      console.error("Question generation failed", error);
      await getSupabaseAdmin()
        .from("rooms")
        .update({
          phase: "lobby",
          generation_error: "Sorular hazırlanamadı. Lütfen tekrar deneyin.",
          phase_ends_at: null,
        })
        .eq("id", roomId)
        .eq("round_number", ownedRound)
        .eq("phase", "generating");
      await notifyRoomChanged(roomId);
    }
    return routeErrorResponse(error);
  }
}
