import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { GeneratedQuestion } from "@/lib/types";

export async function recentQuestionPrompts(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("question_history")
    .select("prompt")
    .order("id", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.prompt as string).reverse();
}

export async function filterNewQuestions(questions: GeneratedQuestion[]): Promise<GeneratedQuestion[]> {
  const { data, error } = await getSupabaseAdmin().rpc("filter_new_questions", {
    p_questions: questions,
  });
  if (error) throw new Error(error.message);
  // Fail closed: never bypass history when its response is unavailable/invalid.
  if (!Array.isArray(data) || data.some((index) => !Number.isInteger(index) || index < 0 || index >= questions.length)) {
    throw new Error("Invalid question history response.");
  }
  return [...new Set(data as number[])].map((index) => questions[index]);
}
