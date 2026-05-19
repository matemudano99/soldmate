"use client";

import { useEffect } from "react";
import { authApi } from "app/lib/api";
import { usePresenceStore } from "app/lib/presence-store";
import { useAuthStore } from "app/lib/store";
import { useHeartbeat } from "../hooks/use-heartbeat";

/** Debe montarse dentro de QueryClientProvider. */
export function HeartbeatRunner() {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const syncSession = useAuthStore((s) => s.syncSession);
  const markOnline = usePresenceStore((s) => s.markOnline);

  useEffect(() => {
    if (!token || userId != null) return;
    authApi
      .me(token)
      .then((data) => {
        syncSession(data);
        if (data.userId) markOnline(data.userId);
      })
      .catch(() => {});
  }, [token, userId, syncSession, markOnline]);

  useHeartbeat();
  return null;
}
