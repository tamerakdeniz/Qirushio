import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }) }), rpc: mocks.rpc,
}) }));
import { findRoom } from "./http";

const room = {
  id: "room-id", code: "ABCDEF", phase: "generating", mode: "classic", round_number: 2,
  question_pause_ms: 1500, phase_ends_at: new Date(Date.now() - 5000).toISOString(),
};
beforeEach(() => vi.resetAllMocks());

describe("generation recovery on room reads", () => {
  it("returns the recovered lobby after a process timeout", async () => {
    mocks.read.mockResolvedValueOnce({ data: room, error: null })
      .mockResolvedValueOnce({ data: { ...room, phase: "lobby", phase_ends_at: null }, error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect((await findRoom("ABCDEF")).phase).toBe("lobby");
    expect(mocks.rpc).toHaveBeenCalledWith("recover_expired_generation", { p_room_id: "room-id" });
  });
  it("re-reads when publication wins the race with recovery", async () => {
    mocks.read.mockResolvedValueOnce({ data: room, error: null })
      .mockResolvedValueOnce({ data: { ...room, phase: "countdown" }, error: null });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await findRoom("ABCDEF")).phase).toBe("countdown");
  });
  it("adds no RPC to a healthy generation request", async () => {
    mocks.read.mockResolvedValue({ data: { ...room, phase_ends_at: new Date(Date.now() + 60_000).toISOString() }, error: null });
    expect((await findRoom("ABCDEF")).phase).toBe("generating");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
