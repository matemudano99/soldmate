import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

const HEARTBEAT_MS = 45_000;

export function useHeartbeat() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    const ping = () => {
      authApi
        .heartbeat(token)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ["users"] });
        })
        .catch(() => {});
    };

    ping();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, queryClient]);
}
