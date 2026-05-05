"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "app/lib/store";

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
  const menuRef = useRef<HTMLDivElement>(null);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayName = fullName || email || "Usuario";
  const initials = ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "U";
  const roleLabel =
    role === "OWNER" ? "Owner" :
    role === "MANAGER" ? "Manager" :
    role === "EMPLOYEE" || role === "STAFF" ? "Employee" :
    "Usuario";

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function onLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-2 py-1.5 shadow-sm hover:bg-gray-50 transition-colors"
      >
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full ring-2 ring-white shadow-sm object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full ring-2 ring-white shadow-sm bg-[#4f6ef7] text-white text-[11px] font-semibold flex items-center justify-center">
              {initials}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-64 bg-white border border-gray-100 rounded-2xl shadow-[0_8px_28px_rgba(149,157,165,0.24)] overflow-hidden z-40">
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
        </div>
      )}
    </div>
  );
}
