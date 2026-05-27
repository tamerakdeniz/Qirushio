import type { SupabaseClient } from "@supabase/supabase-js";

import { mapRoom } from "@/lib/server/http";
import type { RoomSummary } from "@/lib/types";

const roomListingInactiveMs = 10 * 60 * 1000;

const roomColumns = [
  "id",
  "code",
  "phase",
  "host_player_id",
  "language",
  "category",
  "difficulty",
  "scope",
  "question_count",
  "question_time_seconds",
  "speedrun_mode",
  "is_public",
  "max_players",
  "round_number",
  "current_question_index",
  "phase_ends_at",
  "generation_error",
] as const;

const playerEmbed = "players!players_room_id_fkey(nickname, is_host)";

type ListedRoomRow = Parameters<typeof mapRoom>[0] & {
  players: Array<{ nickname: string; is_host: boolean }>;
  last_active_at?: string;
  updated_at?: string;
};

function isListingSchemaDrift(message: string): boolean {
  return /last_active_at|question_pause_ms|schema cache|relationship|players_room_id_fkey/i.test(
    message,
  );
}

function mapListedRooms(rows: ListedRoomRow[]): RoomSummary[] {
  return rows
    .filter((row) => row.players.length > 0)
    .map((row) => {
      const room = mapRoom(row);
      return {
        code: room.code,
        language: room.language,
        category: room.category,
        difficulty: room.difficulty,
        scope: room.scope,
        questionCount: room.questionCount,
        questionTimeSeconds: room.questionTimeSeconds,
        speedrunMode: room.speedrunMode,
        questionPauseSeconds: room.questionPauseSeconds,
        isPublic: room.isPublic,
        maxPlayers: room.maxPlayers,
        playerCount: row.players.length,
        hostNickname: row.players.find((player) => player.is_host)?.nickname ?? "-",
      };
    });
}

function filterActiveRooms(rows: ListedRoomRow[], activeSinceMs: number): ListedRoomRow[] {
  return rows.filter((row) => {
    const stamp = row.last_active_at ?? row.updated_at;
    if (!stamp) {
      return true;
    }
    return new Date(stamp).getTime() >= activeSinceMs;
  });
}

async function queryListedRooms(
  admin: SupabaseClient,
  select: string,
  activeColumn: "last_active_at" | "updated_at",
  activeSince: string,
) {
  return admin
    .from("rooms")
    .select(select)
    .eq("phase", "lobby")
    .eq("is_public", true)
    .gte(activeColumn, activeSince)
    .order(activeColumn, { ascending: false })
    .limit(20);
}

export async function listPublicRooms(admin: SupabaseClient): Promise<RoomSummary[]> {
  const activeSinceMs = Date.now() - roomListingInactiveMs;
  const activeSince = new Date(activeSinceMs).toISOString();

  const modernSelect = [...roomColumns, "question_pause_ms", "last_active_at", playerEmbed].join(", ");
  const modern = await queryListedRooms(admin, modernSelect, "last_active_at", activeSince);

  if (!modern.error) {
    return mapListedRooms(
      filterActiveRooms((modern.data ?? []) as unknown as ListedRoomRow[], activeSinceMs),
    );
  }

  if (!isListingSchemaDrift(modern.error.message)) {
    throw new Error(modern.error.message);
  }

  const legacySelect = [...roomColumns, "updated_at", playerEmbed].join(", ");
  let legacy = await queryListedRooms(admin, legacySelect, "updated_at", activeSince);

  if (legacy.error && isListingSchemaDrift(legacy.error.message)) {
    const plainSelect = [...roomColumns, "updated_at", "players(nickname, is_host)"].join(", ");
    legacy = await queryListedRooms(admin, plainSelect, "updated_at", activeSince);
  }

  if (legacy.error) {
    throw new Error(legacy.error.message);
  }

  return mapListedRooms(
    filterActiveRooms((legacy.data ?? []) as unknown as ListedRoomRow[], activeSinceMs),
  );
}
