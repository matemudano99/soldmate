"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "app/lib/store";
import { authApi, businessProfileApi, describeNetworkError } from "app/lib/api";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { AlertsBellPopover } from "./alerts-help-popovers";
import { UserProfileMenu } from "./user-profile-menu";
import { GlobalSearchModal } from "./global-search";

function useOutsideClose(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [ref, onClose]);
}

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
  const [companyMenuOpen, setCompanyMenuOpen] = React.useState(false);
  const companyMenuRef = React.useRef<HTMLDivElement>(null);

  useOutsideClose(companyMenuRef, () => setCompanyMenuOpen(false));

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

  const selectCompany = async (nextId: number) => {
    if (!token || !Number.isFinite(nextId) || nextId === companyId) {
      setCompanyMenuOpen(false);
      return;
    }
    setSwitchError(null);
    setSwitching(true);
    try {
      const data = await authApi.switchCompany(token, nextId);
      switchCompanySession(data);
      setCompanyMenuOpen(false);
      router.refresh();
    } catch (err) {
      setSwitchError(describeNetworkError(err));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="flex flex-shrink-0 items-center justify-between gap-2 py-3 pl-14 pr-4 md:px-7 md:py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400 md:text-xs">{todayCap}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1">
          <h1 className="min-w-0 truncate text-sm font-bold text-[#1e2040] max-w-[38vw] md:max-w-none md:text-xl">{displayName}</h1>
          {showCompanyPicker ? (
            <div className="relative shrink-0" ref={companyMenuRef}>
              <button
                type="button"
                onClick={() => setCompanyMenuOpen((v) => !v)}
                disabled={switching}
                className="inline-flex items-center justify-center rounded-lg p-1 text-[#1e2040] outline-none transition hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-[#4f6ef7]/40 disabled:opacity-50"
                aria-haspopup="listbox"
                aria-expanded={companyMenuOpen}
                aria-label="Cambiar de negocio"
                title="Cambiar de negocio"
              >
                {switching ? (
                  <Loader2 className="size-5 animate-spin text-gray-500" aria-hidden />
                ) : (
                  <ChevronDown
                    className={`size-5 text-gray-500 transition-transform ${companyMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                )}
              </button>
              {companyMenuOpen && !switching ? (
                <ul
                  role="listbox"
                  aria-label="Negocios vinculados"
                  className="absolute left-0 top-full z-50 mt-1 min-w-[12rem] max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
                >
                  {linkedCompanies.map((c) => (
                    <li key={c.companyId} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={c.companyId === companyId}
                        onClick={() => void selectCompany(c.companyId)}
                        className={`flex w-full items-center px-3 py-2 text-left text-sm font-medium outline-none transition hover:bg-gray-50 ${
                          c.companyId === companyId ? "bg-[#eef1f8] text-[#4f6ef7]" : "text-[#1e2040]"
                        }`}
                      >
                        <span className="truncate">{c.companyName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        {switchError ? <p className="mt-1 text-xs text-red-500">{switchError}</p> : null}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 md:gap-3">
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
