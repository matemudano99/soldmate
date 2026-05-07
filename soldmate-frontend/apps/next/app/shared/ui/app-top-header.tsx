"use client";

import React from "react";
import { useAuthStore } from "app/lib/store";
import { businessProfileApi } from "app/lib/api";
import { Search } from "lucide-react";
import { AlertsBellPopover } from "./alerts-help-popovers";
import { UserProfileMenu } from "./user-profile-menu";
import { GlobalSearchModal } from "./global-search";

function formatTodayEs(): string {
  const dateStr = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

export function AppTopHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
}: {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
}) {
  const token = useAuthStore((s) => s.token);
  const firstName = useAuthStore((s) => s.firstName);
  const lastName = useAuthStore((s) => s.lastName);
  const email = useAuthStore((s) => s.email);
  const [companyName, setCompanyName] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayName = companyName || firstName || fullName || email?.split("@")[0] || "Usuario";
  const todayCap = formatTodayEs();

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  React.useEffect(() => {
    if (!token) return;
    let alive = true;
    async function loadCompanyName() {
      try {
        const business = await businessProfileApi.get(token);
        if (!alive) return;
        setCompanyName(business.businessName?.trim() || null);
      } catch {
        if (alive) setCompanyName(null);
      }
    }
    loadCompanyName();
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <header className="flex-shrink-0 px-7 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-gray-400">{todayCap}</p>
        <h1 className="text-xl font-bold text-[#1e2040]">{displayName}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-56 hidden md:flex items-center">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={onSearchChange ? searchValue ?? "" : ""}
            readOnly={!onSearchChange}
            onFocus={() => {
              if (!onSearchChange) setSearchOpen(true);
            }}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-xl pl-9 pr-16 py-2 text-sm placeholder:text-gray-400 shadow-sm outline-none focus:border-[#4f6ef7] transition-colors"
            placeholder={onSearchChange ? searchPlaceholder : "Buscar..."}
          />
          <kbd className="absolute right-2 text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-gray-50 text-gray-400">
            ⌘K
          </kbd>
        </div>
        <AlertsBellPopover />
        <UserProfileMenu />
      </div>
      {searchOpen && <GlobalSearchModal onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
