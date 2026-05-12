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

/**
 * Cabecera ERP: fecha, negocio, búsqueda global (⌘K / foco → modal), alertas y menú de usuario.
 * El campo de búsqueda no filtra la página actual; abre siempre `GlobalSearchModal`.
 */
export function AppTopHeader() {
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

  const openSearch = () => setSearchOpen(true);

  return (
    <header className="flex flex-shrink-0 items-center justify-between gap-4 py-4 pl-16 pr-7 md:px-7">
      <div>
        <p className="text-xs text-gray-400">{todayCap}</p>
        <h1 className="text-xl font-bold text-[#1e2040]">{displayName}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden w-full max-w-56 cursor-text items-center md:flex">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            readOnly
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            onFocus={openSearch}
            onClick={openSearch}
            className="w-full cursor-pointer rounded-xl border border-gray-100 bg-white py-2 pl-9 pr-16 text-sm shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-[#4f6ef7]"
            placeholder="Buscar..."
          />
          <kbd className="pointer-events-none absolute right-2 rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-[10px] text-gray-400">
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
