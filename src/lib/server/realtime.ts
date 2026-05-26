import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function notifyRoomChanged(roomId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const channel = admin.channel(`room:${roomId}`);

  try {
    await channel.send({
      type: "broadcast",
      event: "room_updated",
      payload: { roomId },
    });
  } catch (error) {
    console.error("Realtime broadcast failed", error);
  } finally {
    await admin.removeChannel(channel);
  }
}

