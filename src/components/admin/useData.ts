import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { api, ApiError } from "@/services/api";
export function useData<T>(path: string, poll = false, body?: unknown) {
  const router = useRouter({ warn: false });
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(undefined);
    setError("");
    const load = () => {
      if (document.visibilityState === "hidden") return;
      api<T>(
        path,
        serializedBody === undefined ? undefined : JSON.parse(serializedBody),
        controller.signal,
      )
        .then((value) => {
          if (!controller.signal.aborted) {
            setData(value);
            setError("");
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setData(undefined);
            setError(e.message);
            if (e instanceof ApiError && [401, 403].includes(e.status)) {
              if (router) void router.navigate({ to: "/login", replace: true });
              else window.location.replace("/login");
            }
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    };
    void load();
    const timer = poll ? setInterval(load, 30000) : undefined;
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [path, poll, revision, serializedBody, router]);
  return { data, error, loading, refresh };
}
