/** Serialize refreshes and merge any burst during a request into one follow-up. */
export function createCoalescedTask(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let requested = false;
  return () => {
    requested = true;
    if (!running) {
      running = Promise.resolve().then(async () => {
        try {
          while (requested) {
            requested = false;
            await task();
          }
        } finally {
          running = null;
        }
      });
    }
    return running;
  };
}
