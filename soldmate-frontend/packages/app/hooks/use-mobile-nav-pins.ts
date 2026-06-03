"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPinnedHrefsForRole,
  isHrefPinned,
  MOBILE_PINS_CHANGED_EVENT,
  togglePinnedHref,
  type TogglePinResult,
} from "../lib/mobile-nav-pins";

export function useMobileNavPins(role: string | null) {
  const [pins, setPins] = useState<string[]>([]);

  const refresh = useCallback(() => {
    setPins(getPinnedHrefsForRole(role));
  }, [role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(MOBILE_PINS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(MOBILE_PINS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const togglePin = useCallback(
    (href: string): TogglePinResult => {
      const result = togglePinnedHref(href, role);
      refresh();
      return result;
    },
    [role, refresh]
  );

  const isPinned = useCallback((href: string) => pins.includes(href), [pins]);

  return { pins, isPinned, togglePin, refresh };
}
