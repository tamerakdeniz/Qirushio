import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultRoomSettings, medicalYears } from "@/lib/constants";

const state = vi.hoisted(() => ({ writes: [] as Array<{ table: string; values: Record<string, unknown> }> }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  from: (table: string) => {
    const write = (values: Record<string, unknown>) => {
      state.writes.push({ table, values });
      const result = { data: { id: table === "rooms" ? "room-id" : "player-id", code: "ABCDEF" }, error: null };
      const query = { select: () => query, single: async () => result, eq: async () => result,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
      return query;
    };
    return { insert: write, update: write };
  },
}) }));
vi.mock("@/lib/server/realtime", () => ({ notifyRoomChanged: vi.fn() }));
vi.mock("@/lib/server/list-public-rooms", () => ({ listPublicRooms: vi.fn() }));
vi.mock("@/lib/server/http", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/http")>(),
  findRoom: async () => ({ id: "room-id", phase: "lobby" }),
  requireHost: vi.fn(),
}));
import { POST } from "./route";
import { PATCH } from "./[code]/settings/route";

beforeEach(() => { state.writes = []; });
describe("medical year persistence through room APIs", () => {
  it.each(medicalYears)("creates a medicine room for year %i", async (medicalYear) => {
    const response = await POST(new Request("http://localhost/api/rooms", { method: "POST", body: JSON.stringify({
      nickname: "Test", settings: { ...defaultRoomSettings, category: "medicine", medicalYear, difficulty: "hard" },
    }) }));
    expect(response.status).toBe(201);
    expect(state.writes[0]).toMatchObject({ table: "rooms", values: { category: "medicine", medical_year: medicalYear, difficulty: "hard", scope: "local" } });
  });
  it("saves a changed medical year in an existing lobby", async () => {
    const response = await PATCH(new Request("http://localhost/api/rooms/ABCDEF/settings", {
      method: "PATCH", body: JSON.stringify({ ...defaultRoomSettings, category: "medicine", medicalYear: 3, medicalYears: [2, 3], medicalSubject: "physiology", difficulty: "easy" }),
    }), { params: Promise.resolve({ code: "ABCDEF" }) });
    expect(response.status).toBe(200);
    expect(state.writes[0].values).toMatchObject({ category: "medicine", medical_year: 3, medical_years: [2, 3], medical_subject: "physiology", difficulty: "easy" });
  });
});
