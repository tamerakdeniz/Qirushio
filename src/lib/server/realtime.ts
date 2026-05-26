import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function notifyRoomChanged(roomId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const channel = admin.channel(`room:${roomId}`);

  try {
    await channel.httpSend("room_updated", { roomId });
  } catch (error) {
    console.error("Realtime broadcast failed", error);
  }
}
