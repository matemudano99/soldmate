"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavItem, MOBILE_DASHBOARD_HREF } from "app/lib/erp-nav-main";
import { useMobileNavPins } from "app/hooks/use-mobile-nav-pins";
import { useAuthStore } from "app/lib/store";

function isNavActive(pathname: string, href: string) {
  if (href === MOBILE_DASHBOARD_HREF) {
    return pathname === MOBILE_DASHBOARD_HREF || pathname === "/";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/";
  const role = useAuthStore((s) => s.role);
  const { pins } = useMobileNavPins(role);

  const dashboard = findNavItem(MOBILE_DASHBOARD_HREF);
  const pinnedItems = pins.map((href) => findNavItem(href)).filter((item) => item != null);

  const items = dashboard ? [dashboard, ...pinnedItems] : pinnedItems;
  if (items.length === 0) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      aria-label="Accesos rápidos móvil"
    >
      <div
        className="flex items-stretch justify-around px-1 pt-1"
        style={{ minHeight: "3.5rem" }}
      >
        {items.map(({ href, label, Icon }) => {
          const active = isNavActive(pathname, href);
          const shortLabel =
            href === MOBILE_DASHBOARD_HREF
              ? "Inicio"
              : label.length > 10
                ? label.slice(0, 9) + "…"
                : label;
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-lg transition-colors ${
                active ? "text-[#4f6ef7]" : "text-[#9095a0]"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-[10px] font-medium leading-tight ${active ? "font-semibold" : ""}`}>
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
