/** Ventana alineada con heartbeat (~45s): dos latidos + margen. */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const AWAY_WINDOW_MS = 15 * 60 * 1000;

export function parseLastSeenAt(lastSeenAt: string): number {
  const normalized = lastSeenAt.trim();
  if (!normalized) return NaN;
  const t = new Date(normalized).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export type PresenceStatus = { color: string; label: string };

export function getPresenceStatus(
  lastSeenAt: string | null,
  active: boolean,
  options?: { isSelf?: boolean },
): PresenceStatus {
  if (!active) return { color: "bg-gray-300", label: "Cuenta desactivada" };
  if (options?.isSelf) return { color: "bg-emerald-400", label: "En línea (tú)" };

  if (!lastSeenAt) {
    return { color: "bg-gray-300", label: "Sin actividad reciente" };
  }

  const ts = parseLastSeenAt(lastSeenAt);
  if (!Number.isFinite(ts)) {
    return { color: "bg-gray-300", label: "Desconectado" };
  }

  const diffMs = Date.now() - ts;
  if (diffMs < ONLINE_WINDOW_MS) return { color: "bg-emerald-400", label: "En línea" };
  if (diffMs < AWAY_WINDOW_MS) return { color: "bg-amber-400", label: "Ausente" };
  return { color: "bg-gray-300", label: "Desconectado" };
}

export function isSameUserEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
