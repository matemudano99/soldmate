"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "app/lib/store";
import { authApi, businessProfileApi, describeNetworkError } from "app/lib/api";
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
 * Si el usuario tiene varios negocios vinculados, permite cambiar el tenant activo (nuevo JWT).
 */
export function AppTopHeader() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const companyId = useAuthStore((s) => s.companyId);
  const linkedCompanies = useAuthStore((s) => s.linkedCompanies);
  const switchCompanySession = useAuthStore((s) => s.switchCompany);
  const syncSession = useAuthStore((s) => s.syncSession);
  const firstName = useAuthStore((s) => s.firstName);
  const lastName = useAuthStore((s) => s.lastName);
  const email = useAuthStore((s) => s.email);
  const [businessName, setBusinessName] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);
  const [switchError, setSwitchError] = React.useState<string | null>(null);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fromLinks = linkedCompanies.find((c) => c.companyId === companyId)?.companyName?.trim();
  const displayName = fromLinks || businessName || firstName || fullName || email?.split("@")[0] || "Usuario";
  const todayCap = formatTodayEs();
  const showCompanyPicker = linkedCompanies.length > 1;

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
    if (linkedCompanies.length > 0) return;
    let alive = true;
    void authApi
      .me(token)
      .then((data) => {
        if (!alive) return;
        syncSession(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, linkedCompanies.length, syncSession]);

  React.useEffect(() => {
    if (!token) return;
    if (fromLinks) {
      setBusinessName(fromLinks);
      return;
    }
    let alive = true;
    void businessProfileApi
      .get(token)
      .then((b) => {
        if (!alive) return;
        setBusinessName(b.businessName?.trim() || null);
      })
      .catch(() => {
        if (alive) setBusinessName(null);
      });
    return () => {
      alive = false;
    };
  }, [token, companyId, fromLinks]);

  const openSearch = () => setSearchOpen(true);

  const onCompanyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = Number(e.target.value);
    if (!token || !Number.isFinite(nextId) || nextId === companyId) return;
    setSwitchError(null);
    setSwitching(true);
    try {
      const data = await authApi.switchCompany(token, nextId);
      switchCompanySession(data);
      router.refresh();
    } catch (err) {
      setSwitchError(describeNetworkError(err));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="flex flex-shrink-0 items-center justify-between gap-4 py-4 pl-16 pr-7 md:px-7">
      <div>
        <p className="text-xs text-gray-400">{todayCap}</p>
        <h1 className="text-xl font-bold text-[#1e2040]">{displayName}</h1>
        {showCompanyPicker ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Negocio activo</span>
            <select
              value={companyId ?? ""}
              onChange={onCompanyChange}
              disabled={switching}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-[#1e2040] outline-none focus:border-[#4f6ef7] disabled:opacity-50"
              aria-label="Cambiar de negocio"
            >
              {linkedCompanies.map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.companyName}
                </option>
              ))}
            </select>
            {switchError ? <span className="text-xs text-red-500">{switchError}</span> : null}
          </div>
        ) : null}
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
