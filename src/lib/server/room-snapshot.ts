import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, mapPlayer, type AuthorizedPlayer } from "@/lib/server/http";
import type { AnswerReview, QuestionView, RoomSnapshot, RoomView } from "@/lib/types";

interface QuestionRow {
  id: string;
  position: number;
  category: string;
  prompt: string;
  options: string[];
  correct_option: number;
  explanation: string;
}

// Shared by reads and transitions so advancing never needs a second HTTP request.
export async function loadRoomSnapshot(room: RoomView, authorized: AuthorizedPlayer | null): Promise<RoomSnapshot> {
  if (room.phase !== "lobby" && !authorized) {
    throw new ApiError(401, "Oyunu görüntülemek için odaya katılın.");
  }
  const admin = getSupabaseAdmin();
  const playersQuery = admin
    .from("players")
    .select("id, nickname, is_host, is_ready, score")
    .eq("room_id", room.id)
    .order("score", { ascending: false })
    .order("joined_at", { ascending: true });

  const [playersResult, questionState] = await Promise.all([
    playersQuery,
    loadQuestionState(room, authorized),
  ]);
  if (playersResult.error) throw new Error(playersResult.error.message);

  const snapshot: RoomSnapshot = {
    serverNow: new Date().toISOString(),
    room,
    players: (playersResult.data ?? []).map(mapPlayer),
    ...questionState,
  };

  return snapshot;
}

async function loadQuestionState(room: RoomView, authorized: AuthorizedPlayer | null) {
  const admin = getSupabaseAdmin();
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

    const [countResult, answerResult] = await Promise.all([
      admin
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", data.id),
      authorized
        ? admin
            .from("answers")
            .select("selected_option")
            .eq("question_id", data.id)
            .eq("player_id", authorized.player.id)
            .maybeSingle<{ selected_option: number }>()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (countResult.error || answerResult.error) {
      throw new Error(countResult.error?.message ?? answerResult.error?.message);
    }
    answeredCount = countResult.count ?? 0;
    myAnswer = answerResult.data ? { selectedOption: answerResult.data.selected_option } : null;
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

  return { question, myAnswer, answeredCount, reviews };
}
