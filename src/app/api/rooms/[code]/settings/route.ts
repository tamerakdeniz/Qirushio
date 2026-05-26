import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, findRoom, requireHost, routeErrorResponse } from "@/lib/server/http";
import { notifyRoomChanged } from "@/lib/server/realtime";
import { roomSettingsSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const settings = roomSettingsSchema.parse(await request.json());
    const room = await findRoom((await params).code);
    if (room.phase !== "lobby") {
      throw new ApiError(409, "Ayarlar yalnızca lobide değiştirilebilir.");
    }
    await requireHost(request, room.id);

    const { error } = await getSupabaseAdmin()
      .from("rooms")
      .update({
        language: settings.language,
        category: settings.category,
        difficulty: settings.difficulty,
        scope: settings.scope,
        question_count: settings.questionCount,
        question_time_seconds: settings.questionTimeSeconds,
        is_public: settings.isPublic,
      })
      .eq("id", room.id);
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

