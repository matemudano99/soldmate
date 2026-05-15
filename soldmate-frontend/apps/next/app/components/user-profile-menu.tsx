"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "app/lib/store";
import { roleDisplayLabel } from "app/lib/rbac";

const MENU_WIDTH = 256;
const VIEW_PADDING = 8;

const QUICK_LINKS = [
  { href: "/company-settings", label: "Ajustes de cuenta", Icon: Settings },
];

export function UserProfileMenu() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const firstName = useAuthStore((s) => s.firstName);
  const lastName = useAuthStore((s) => s.lastName);
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayName = fullName || email || "Usuario";
  const initials = ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "U";
  const roleLabel = roleDisplayLabel(role);

  const updateMenuPosition = useCallback(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    let left = rect.right - MENU_WIDTH;
    left = Math.max(VIEW_PADDING, Math.min(left, window.innerWidth - MENU_WIDTH - VIEW_PADDING));
    const estHeight = 220;
    let top = rect.bottom + 6;
    if (top + estHeight > window.innerHeight - VIEW_PADDING && rect.top > estHeight + VIEW_PADDING) {
      top = rect.top - estHeight - 6;
    }
    top = Math.max(VIEW_PADDING, Math.min(top, window.innerHeight - estHeight - VIEW_PADDING));
    setMenuPos({ top, left });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    return () => window.removeEventListener("resize", updateMenuPosition);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const t = event.target as Node;
      if (buttonRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (!open) return;
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function onLogout() {
    logout();
    router.push("/login");
  }

  const dropdown =
    open &&
    menuPos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        className="fixed z-[100] w-64 max-w-[calc(100vw-16px)] bg-white border border-gray-100 rounded-2xl shadow-[0_8px_28px_rgba(149,157,165,0.24)] overflow-hidden"
        style={{ top: menuPos.top, left: menuPos.left }}
        role="menu"
      >
        <div className="px-4 py-3.5 border-b border-gray-50">
          <p className="text-sm font-semibold text-[#1e2040] truncate">{displayName}</p>
          <p className="text-xs text-gray-400 truncate">{email ?? "Sin email"}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{roleLabel}</p>
        </div>

        <div className="py-1.5">
          {QUICK_LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Icon size={14} className="text-gray-400" />
              {label}
            </Link>
          ))}
        </div>

        <div className="h-px bg-gray-100" />
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>,
      document.body,
    );

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-100 px-1.5 py-1.5 shadow-sm hover:bg-gray-50 transition-colors min-w-0"
      >
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full ring-2 ring-white shadow-sm object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full ring-2 ring-white shadow-sm bg-[#4f6ef7] text-white text-[11px] font-semibold flex items-center justify-center select-none">
              {initials}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        </div>
        <span className="hidden sm:block text-xs font-medium text-gray-700 max-w-[80px] truncate">{firstName || displayName.split(" ")[0]}</span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {dropdown}
    </div>
  );
}
