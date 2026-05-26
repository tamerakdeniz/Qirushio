import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("cleanup_expired_rooms");
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Cleanup failed." }, { status: 500 });
  }

  return NextResponse.json({ deletedRooms: data ?? 0 });
}

