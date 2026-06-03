import { isNavbarHrefVisible } from "./rbac";
import { MOBILE_DASHBOARD_HREF } from "./erp-nav-main";

export const MOBILE_PIN_STORAGE_KEY = "sm_mobile_pinned_nav";
export const MAX_MOBILE_PINS = 4;

export const MOBILE_PINS_CHANGED_EVENT = "sm-mobile-pins-changed";

function parseStored(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.startsWith("/"));
  } catch {
    return [];
  }
}

export function readPinnedHrefs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStored(localStorage.getItem(MOBILE_PIN_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writePinnedHrefs(hrefs: string[]): void {
  if (typeof window === "undefined") return;
  const unique = [...new Set(hrefs.filter((h) => h !== MOBILE_DASHBOARD_HREF))].slice(0, MAX_MOBILE_PINS);
  try {
    localStorage.setItem(MOBILE_PIN_STORAGE_KEY, JSON.stringify(unique));
    window.dispatchEvent(new Event(MOBILE_PINS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function filterPinsForRole(hrefs: string[], role: string | null): string[] {
  return hrefs.filter((href) => href !== MOBILE_DASHBOARD_HREF && isNavbarHrefVisible(href, role));
}

export function getPinnedHrefsForRole(role: string | null): string[] {
  return filterPinsForRole(readPinnedHrefs(), role);
}

export function isHrefPinned(href: string): boolean {
  return readPinnedHrefs().includes(href);
}

export type TogglePinResult = { ok: true; pinned: boolean } | { ok: false; reason: "max" | "invalid" | "dashboard" };

export function togglePinnedHref(href: string, role: string | null): TogglePinResult {
  if (href === MOBILE_DASHBOARD_HREF) {
    return { ok: false, reason: "dashboard" };
  }
  if (!isNavbarHrefVisible(href, role)) {
    return { ok: false, reason: "invalid" };
  }

  const current = getPinnedHrefsForRole(role);
  if (current.includes(href)) {
    writePinnedHrefs(current.filter((h) => h !== href));
    return { ok: true, pinned: false };
  }

  if (current.length >= MAX_MOBILE_PINS) {
    return { ok: false, reason: "max" };
  }

  writePinnedHrefs([...current, href]);
  return { ok: true, pinned: true };
}
