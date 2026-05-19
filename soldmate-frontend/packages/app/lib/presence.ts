/** Ventana «en línea» (alineada con heartbeat ~45s). */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const AWAY_WINDOW_MS = 15 * 60 * 1000;

/**
 * Parsea ISO del backend ({@code Instant}) o LocalDateTime legacy sin zona (UTC).
 */
export function parseLastSeenAt(lastSeenAt: string): number {
  const normalized = lastSeenAt.trim();
  if (!normalized) return NaN;

  if (/[Zz]$/.test(normalized) || /[+-]\d{2}:?\d{2}$/.test(normalized)) {
    const t = new Date(normalized).getTime();
    return Number.isFinite(t) ? t : NaN;
  }

  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?/);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}Z`;
    return new Date(iso).getTime();
  }

  const t = new Date(normalized).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export function isRecentlyActive(
  lastSeenAt: string | null | undefined,
  options?: { locallyOnline?: boolean },
): boolean {
  if (options?.locallyOnline) return true;
  if (!lastSeenAt) return false;
  const ts = parseLastSeenAt(lastSeenAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < ONLINE_WINDOW_MS;
}

export type PresenceStatus = { color: string; label: string };

export function getPresenceStatus(
  lastSeenAt: string | null,
  active: boolean,
  options?: { isSelf?: boolean; locallyOnline?: boolean },
): PresenceStatus {
  if (!active) return { color: "bg-gray-300", label: "Cuenta desactivada" };
  if (options?.isSelf || options?.locallyOnline || isRecentlyActive(lastSeenAt)) {
    if (options?.isSelf) return { color: "bg-emerald-400", label: "En línea (tú)" };
    return { color: "bg-emerald-400", label: "En línea" };
  }

  if (!lastSeenAt) {
    return { color: "bg-gray-300", label: "Sin actividad reciente" };
  }

  const ts = parseLastSeenAt(lastSeenAt);
  if (!Number.isFinite(ts)) {
    return { color: "bg-gray-300", label: "Desconectado" };
  }

  const diffMs = Date.now() - ts;
  if (diffMs < AWAY_WINDOW_MS) return { color: "bg-amber-400", label: "Ausente" };
  return { color: "bg-gray-300", label: "Desconectado" };
}

export function isSameUserEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isSameUserId(a: number | null | undefined, b: number | null | undefined): boolean {
  return a != null && b != null && a === b;
}

export function formatLastSeenRelative(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "";
  const ts = parseLastSeenAt(lastSeenAt);
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return "Hace más de un día";
}
