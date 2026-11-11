'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OrderAccessError, OrderNotFoundError, OrderReadError } from './requests';

// Explicit refresh supersedes polling reads, so stale responses cannot undo a mutation.
export function useOrdersResource<T>(load: (signal: AbortSignal) => Promise<T>, poll = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function refresh() {
      clearTimeout(timer);
      controller?.abort();
      const request = new AbortController();
      controller = request;
      stopped = false;
      try {
        const result = await load(request.signal);
        if (active && !request.signal.aborted) {
          setData(result);
          setError('');
        }
      } catch (cause) {
        if (active && !request.signal.aborted) {
          if (cause instanceof OrderAccessError || cause instanceof OrderNotFoundError) {
            setData(null);
            stopped = true;
          }
          setError(
            cause instanceof OrderReadError
              ? cause.message
              : '注文を取得できませんでした。もう一度お試しください。',
          );
        }
      } finally {
        if (active && !request.signal.aborted) {
          setLoading(false);
          if (poll && !stopped) timer = setTimeout(() => void refresh(), 15_000);
        }
      }
    }
    refreshRef.current = refresh;
    void refresh();
    return () => {
      active = false;
      controller?.abort();
      clearTimeout(timer);
    };
  }, [load, poll]);
  const retry = useCallback(() => refreshRef.current(), []);
  return { data, error, loading, retry };
}
