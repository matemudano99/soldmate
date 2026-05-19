import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "app/lib/api";
import { usePresenceStore } from "app/lib/presence-store";
import { useAuthStore } from "app/lib/store";

const HEARTBEAT_MS = 45_000;

export function useHeartbeat() {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const markOnline = usePresenceStore((s) => s.markOnline);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    const ping = () => {
      authApi
        .heartbeat(token)
        .then((res) => {
          const id = Number(res.userId) || userId;
          if (id) markOnline(id);
          void queryClient.invalidateQueries({ queryKey: ["users"] });
          void queryClient.invalidateQueries({ queryKey: ["users", token] });
        })
        .catch(() => {});
    };

    if (userId) markOnline(userId);

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
  }, [token, userId, markOnline, queryClient]);
}
