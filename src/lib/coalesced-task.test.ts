import { describe, expect, it, vi } from "vitest";
import { createCoalescedTask } from "./coalesced-task";

describe("coalesced refresh", () => {
  it("merges broadcasts into one follow-up without overlapping requests", async () => {
    let finish!: () => void;
    const task = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockResolvedValue(undefined);
    const run = createCoalescedTask(task);
    const first = run();
    await Promise.resolve();
    const followups = Array.from({ length: 20 }, () => run());
    expect(task).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, ...followups]);
    expect(task).toHaveBeenCalledTimes(2);
    await run();
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("allows recovery after a failed refresh", async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const run = createCoalescedTask(task);
    await expect(run()).rejects.toThrow("offline");
    await run();
    expect(task).toHaveBeenCalledTimes(2);
  });
});
