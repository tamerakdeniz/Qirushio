import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), authorize: vi.fn(), rpc: vi.fn(), snapshot: vi.fn(), notify: vi.fn(), after: vi.fn() }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/lib/server/http", async (original) => ({ ...await original<typeof import("@/lib/server/http")>(), findRoom: mocks.find, requirePlayer: mocks.authorize }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/server/room-snapshot", () => ({ loadRoomSnapshot: mocks.snapshot }));
vi.mock("@/lib/server/realtime", () => ({ notifyRoomChanged: mocks.notify }));
import { POST } from "./route";
import { ApiError } from "@/lib/server/http";
const request = () => POST(new Request("http://localhost/api/rooms/ABCDEF/advance", { method: "POST" }), { params: Promise.resolve({ code: "ABCDEF" }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValueOnce({ id: "room", code: "ABCDEF", phase: "transition" }).mockResolvedValue({ id: "room", code: "ABCDEF", phase: "question", currentQuestionIndex: 1 });
  mocks.authorize.mockResolvedValue({ player: { id: "player" } });
  mocks.rpc.mockResolvedValue({ data: [{ changed: true }], error: null });
  mocks.snapshot.mockImplementation(async (room) => ({ room, question: { id: "next" } }));
});
describe("advance with snapshot", () => {
  it("returns the next question without waiting for a broadcast or another state request", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ room: { phase: "question", currentQuestionIndex: 1 }, question: { id: "next" } });
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.authorize).toHaveBeenCalledOnce();
  });
  it("re-reads the winner's state when another client already advanced", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ changed: false }], error: null });
    expect(await (await request()).json()).toMatchObject({ room: { phase: "question" } });
    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("never advances or exposes questions to an unauthorized caller", async () => {
    mocks.authorize.mockRejectedValue(new ApiError(401, "Unauthorized"));
    expect((await request()).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
