import { useEffect } from "react";

export function useAsyncEffect(effect: (signal: AbortSignal) => Promise<void>, deps: Array<unknown>) {
  useEffect(() => {
    const controller = new AbortController();
    void effect(controller.signal);
    return () => controller.abort();
  }, deps);
}
