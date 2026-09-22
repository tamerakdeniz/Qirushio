import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRoom: vi.fn(), requireHost: vi.fn(), notify: vi.fn(), generate: vi.fn(), recent: vi.fn(),
  filter: vi.fn(), rpc: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(),
}));
vi.mock("@/lib/server/ai", () => ({ generateQuestions: mocks.generate }));
vi.mock("@/lib/server/question-history", () => ({ recentQuestionPrompts: mocks.recent, filterNewQuestions: mocks.filter }));
vi.mock("@/lib/server/realtime", () => ({ notifyRoomChanged: mocks.notify }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/server/http", () => ({
  findRoom: mocks.findRoom, requireHost: mocks.requireHost,
  routeErrorResponse: () => new Response(null, { status: 400 }),
}));

import { POST } from "./route";

const start = () => POST(new Request("http://localhost/api/rooms/ABCDEF/start", { method: "POST" }), { params: Promise.resolve({ code: "ABCDEF" }) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.findRoom.mockResolvedValue({ id: "room-id", phase: "lobby" });
  mocks.requireHost.mockResolvedValue({ player: { id: "host-id" }, tokenHash: "token" });
  mocks.recent.mockResolvedValue(["Previously used question"]);
  mocks.generate.mockResolvedValue([{ prompt: "New question" }]);
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq });
});

describe("start round history integration", () => {
  it("does not reset another request's generation when begin_round is rejected", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "round_already_active" } });
    expect((await start()).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("retries a publication collision with fresh history and publishes atomically", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 7, error: null })
      .mockResolvedValueOnce({ error: { code: "P0001", message: "duplicate_question" } })
      .mockResolvedValueOnce({ data: true, error: null });
    expect((await start()).status).toBe(200);
    expect(mocks.recent).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[1][1]).toContain("New question");
    expect(mocks.generate.mock.calls[0][2]).toBe(mocks.filter);
    expect(mocks.rpc.mock.calls[2][0]).toBe("publish_generated_round");
    expect(mocks.rpc.mock.calls[2][1].p_round_number).toBe(7);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("fails closed on history errors and resets only the round it owns", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 8, error: null });
    mocks.recent.mockRejectedValue(new Error("history offline"));
    expect((await start()).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("round_number", 8);
    expect(mocks.eq).toHaveBeenCalledWith("phase", "generating");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
