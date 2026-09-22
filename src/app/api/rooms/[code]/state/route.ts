import { NextResponse } from "next/server";
import { authorizePlayer, findRoom, routeErrorResponse } from "@/lib/server/http";
import { loadRoomSnapshot } from "@/lib/server/room-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }): Promise<NextResponse> {
  try {
    const room = await findRoom((await params).code);
    const authorized = await authorizePlayer(request, room.id);
    return NextResponse.json(await loadRoomSnapshot(room, authorized));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
