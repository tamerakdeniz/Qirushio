import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ApiError,
  authorizePlayer,
  findRoom,
  mapPlayer,
  routeErrorResponse,
} from "@/lib/server/http";
import type { AnswerReview, QuestionView, RoomSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QuestionRow {
  id: string;
  position: number;
  category: string;
  prompt: string;
  options: string[];
  correct_option: number;
  explanation: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const room = await findRoom((await params).code);
    const authorized = await authorizePlayer(request, room.id);
    if (room.phase !== "lobby" && !authorized) {
      throw new ApiError(401, "Oyunu görüntülemek için odaya katılın.");
    }

    const admin = getSupabaseAdmin();
    const { data: playerRows, error: playersError } = await admin
      .from("players")
      .select("id, nickname, is_host, is_ready, score")
      .eq("room_id", room.id)
      .order("score", { ascending: false })
      .order("joined_at", { ascending: true });
    if (playersError) {
      throw new Error(playersError.message);
    }

    let question: QuestionView | null = null;
    let myAnswer: { selectedOption: number } | null = null;
    let answeredCount = 0;
    let reviews: AnswerReview[] | null = null;

    if (room.phase === "question") {
      const { data, error } = await admin
        .from("questions")
        .select("id, position, category, prompt, options")
        .eq("room_id", room.id)
        .eq("round_number", room.roundNumber)
        .eq("position", room.currentQuestionIndex)
        .single<Omit<QuestionRow, "correct_option" | "explanation">>();
      if (error) {
        throw new Error(error.message);
      }
      question = data;

      const { count } = await admin
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", data.id);
      answeredCount = count ?? 0;

      if (authorized) {
        const { data: answer } = await admin
          .from("answers")
          .select("selected_option")
          .eq("question_id", data.id)
          .eq("player_id", authorized.player.id)
          .maybeSingle<{ selected_option: number }>();
        myAnswer = answer ? { selectedOption: answer.selected_option } : null;
      }
    }

    if (room.phase === "finished" && authorized) {
      const [{ data: questionRows, error: questionsError }, { data: answerRows, error: answersError }] =
        await Promise.all([
          admin
            .from("questions")
            .select("id, position, category, prompt, options, correct_option, explanation")
            .eq("room_id", room.id)
            .eq("round_number", room.roundNumber)
            .order("position", { ascending: true }),
          admin
            .from("answers")
            .select("question_id, selected_option, is_correct, score, time_remaining_ms")
            .eq("room_id", room.id)
            .eq("round_number", room.roundNumber)
            .eq("player_id", authorized.player.id),
        ]);
      if (questionsError || answersError) {
        throw new Error(questionsError?.message ?? answersError?.message);
      }
      const answerByQuestion = new Map(
        (answerRows ?? []).map((answer) => [answer.question_id, answer]),
      );
      reviews = (questionRows as QuestionRow[]).map((value) => {
        const answer = answerByQuestion.get(value.id);
        return {
          id: value.id,
          position: value.position,
          category: value.category,
          prompt: value.prompt,
          options: value.options,
          correctOption: value.correct_option,
          explanation: value.explanation,
          selectedOption: answer?.selected_option ?? null,
          isCorrect: answer?.is_correct ?? false,
          score: answer?.score ?? 0,
          timeRemainingMs: answer?.time_remaining_ms ?? null,
        };
      });
    }

    const snapshot: RoomSnapshot = {
      serverNow: new Date().toISOString(),
      room,
      players: (playerRows ?? []).map(mapPlayer),
      question,
      myAnswer,
      answeredCount,
      reviews,
    };

    return NextResponse.json(snapshot);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

