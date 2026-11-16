import { afterEach, expect, it, vi } from 'vitest';
import { startOrderExpiryJob } from './order-expiry.job';

afterEach(() => vi.useRealTimers());
it('runs at startup, waits for completion before scheduling and stops on shutdown', async () => {
  vi.useFakeTimers();
  let complete!: (value: { failed: number }) => void;
  const run = vi.fn(
    () =>
      new Promise<{ failed: number }>((resolve) => {
        complete = resolve;
      }),
  );
  const report = vi.fn();
  const stop = startOrderExpiryJob(run, report);
  expect(run).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(120000);
  expect(run).toHaveBeenCalledOnce();
  complete({ failed: 1 });
  await vi.advanceTimersByTimeAsync(60000);
  expect(run).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenCalledOnce();
  stop();
  complete({ failed: 0 });
  await vi.advanceTimersByTimeAsync(120000);
  expect(run).toHaveBeenCalledTimes(2);
});
it('reports scan failures and retries on the next interval', async () => {
  vi.useFakeTimers();
  const run = vi
    .fn()
    .mockRejectedValueOnce(new Error('DB unavailable'))
    .mockResolvedValue({ failed: 0 });
  const report = vi.fn();
  const stop = startOrderExpiryJob(run, report);
  await vi.advanceTimersByTimeAsync(60000);
  expect(run).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenCalledOnce();
  stop();
});
