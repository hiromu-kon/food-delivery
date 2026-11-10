'use client';

import { useEffect, useState } from 'react';
import { OrderAccessError, OrderNotFoundError, OrderReadError } from './requests';

// A new request starts only after the previous one settles; unmount aborts it.
export function useOrdersResource<T>(load: (signal: AbortSignal) => Promise<T>, poll = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function refresh() {
      try {
        const result = await load(controller.signal);
        if (active) {
          setData(result);
          setError('');
        }
      } catch (cause) {
        if (active) {
          if (cause instanceof OrderAccessError || cause instanceof OrderNotFoundError) {
            setData(null);
            active = false;
            setLoading(false);
          }
          setError(
            cause instanceof OrderReadError
              ? cause.message
              : '注文を取得できませんでした。もう一度お試しください。',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          if (poll) timer = setTimeout(() => void refresh(), 15_000);
        }
      }
    }
    void refresh();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [load, poll, reload]);
  return { data, error, loading, retry: () => setReload((value) => value + 1) };
}
