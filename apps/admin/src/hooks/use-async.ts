"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface AsyncResult<T> {
  status: "idle" | "loading" | "success" | "error";
  data: T | undefined;
  error: string | undefined;
  refetch: () => void;
}

/**
 * Generic hook for async data fetching with loading/error/success states.
 * Re-fetches when `deps` change. Provides `refetch()` for manual refresh.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): AsyncResult<T> {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setStatus("loading");
    setError(undefined);
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        setStatus("success");
      }
    } catch (err) {
      if (mountedRef.current) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
        setStatus("error");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => {
      mountedRef.current = false;
    };
  }, [execute]);

  return { status, data, error, refetch: execute };
}

/**
 * Hook for async mutations (create, update, delete).
 * Returns execute function + state, does NOT auto-fire.
 */
export function useMutation<TInput, TResult>(
  mutator: (input: TInput) => Promise<TResult>
): {
  execute: (input: TInput) => Promise<TResult | undefined>;
  status: "idle" | "loading" | "success" | "error";
  data: TResult | undefined;
  error: string | undefined;
  reset: () => void;
} {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [data, setData] = useState<TResult | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const execute = useCallback(
    async (input: TInput): Promise<TResult | undefined> => {
      setStatus("loading");
      setError(undefined);
      try {
        const result = await mutator(input);
        setData(result);
        setStatus("success");
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Mutation failed";
        setError(message);
        setStatus("error");
        return undefined;
      }
    },
    [mutator]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setData(undefined);
    setError(undefined);
  }, []);

  return { execute, status, data, error, reset };
}
