'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StoreOrderError } from '@/api/store-orders';

export function useStoreOrders<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function read() {
      clearTimeout(timer);
      controller?.abort();
      const request = new AbortController();
      controller = request;
      let stopped = false;
      try {
        const result = await load(request.signal);
        if (active && !request.signal.aborted) {
          setData(result);
          setError('');
        }
      } catch (cause) {
        if (active && !request.signal.aborted) {
          stopped = cause instanceof StoreOrderError && cause.stop;
          if (stopped) setData(null);
          setError(
            cause instanceof StoreOrderError
              ? cause.message
              : '接続を確認して再読み込みしてください。',
          );
        }
      } finally {
        if (active && !request.signal.aborted) {
          setLoading(false);
          if (!stopped) timer = setTimeout(() => void read(), 5000);
        }
      }
    }
    refresh.current = read;
    void read();
    return () => {
      active = false;
      controller?.abort();
      clearTimeout(timer);
    };
  }, [load]);
  return { data, error, loading, refresh: useCallback(() => refresh.current(), []) };
}
