export function startOrderExpiryJob(
  run: () => Promise<{ failed: number }>,
  reportFailure: () => void,
  intervalMs = 60000,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  async function tick() {
    try {
      const result = await run();
      if (result.failed > 0) reportFailure();
    } catch {
      reportFailure();
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void tick(), intervalMs);
        timer.unref();
      }
    }
  }
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
