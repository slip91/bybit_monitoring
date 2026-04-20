import { useEffect } from "react";

const RETRY_DELAYS = [1000, 3000, 8000];

export function useAsyncEffect(effect: (signal: AbortSignal) => Promise<void>, deps: Array<unknown>) {
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function run(attempt: number): Promise<void> {
      try {
        await effect(signal);
      } catch {
        if (signal.aborted) return;
        const delay = RETRY_DELAYS[attempt];
        if (delay === undefined) return;
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (!signal.aborted) await run(attempt + 1);
      }
    }

    void run(0);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
