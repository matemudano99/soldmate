import { useEffect } from "react";
import { authApi } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

export function useHeartbeat() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Ejecuta inmediatamente
    authApi.heartbeat(token).catch(() => {});

    // Y luego cada 60s
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        authApi.heartbeat(token).catch(() => {});
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [token, isAuthenticated]);
}
