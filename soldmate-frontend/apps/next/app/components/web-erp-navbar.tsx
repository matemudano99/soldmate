"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, BarChart2,
  FileText, Calendar, Power, ChevronDown, PanelLeftClose, PanelLeftOpen, X,
  Sparkles, Wrench, Truck, Package, Activity, ChevronLeft, ChevronRight
} from "lucide-react";
import { useAuthStore } from "app/lib/store";
import { HelpCenterPopover } from "../shared/ui/alerts-help-popovers";

const NAV_MAIN = [
  { href: "/dashboard",  label: "Dashboard",    Icon: LayoutDashboard },
  { href: "/inventory",  label: "Inventario",   Icon: Package         },
  { href: "/activity",   label: "Actividad",    Icon: Activity        },
  { href: "/people",     label: "Usuarios",     Icon: Users           },
  { href: "/incidents",  label: "Incidencias",  Icon: Wrench          },
  { href: "/suppliers",  label: "Proveedores",  Icon: Truck           },
  { href: "/finances",   label: "Finanzas",     Icon: CreditCard      },
  { href: "/stats",      label: "Estadisticas",   Icon: BarChart2       },
  { href: "/documents",  label: "Documentos",    Icon: FileText        },
  { href: "/calendar",   label: "Calendario",   Icon: Calendar        },
] as const;

export function WebErpNavbar() {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem("sm_navbar_collapsed");
    if (saved) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sm_navbar_collapsed", String(next));
      return next;
    });
  };
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const firstName = useAuthStore((s) => s.firstName);
  const lastName = useAuthStore((s) => s.lastName);
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayName = fullName || email || "Usuario";
  const roleLabel =
    role === "OWNER" ? "Owner" :
    role === "MANAGER" ? "Manager" :
    role === "EMPLOYEE" || role === "STAFF" ? "Employee" :
    "Usuario";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const collapseLabel = collapsed ? "Expandir menu" : "Colapsar menu";

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar menu"
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/30"
        />
      ) : null}

      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden fixed top-4 left-4 z-50 inline-flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 bg-white text-[#1e2040] shadow-[0_8px_24px_rgba(15,23,42,0.14)]"
        title={mobileOpen ? "Cerrar menu" : "Abrir menu"}
      >
        {mobileOpen ? <X size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-20 h-screen bg-white flex flex-col border-r border-gray-100 shadow-[2px_0_20px_rgba(149,157,165,0.10)] transition-all duration-200 ${
          collapsed ? "w-[76px]" : "w-[220px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
      {/* Logo */}
      <div className={`px-4 pt-5 pb-4 flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
        <Link href="/dashboard" className={`flex items-center hover:opacity-90 transition-opacity ${collapsed ? "justify-center" : "gap-2 flex-1"}`}>
          <div className="w-9 h-9 bg-[#4f6ef7] rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(79,110,247,0.35)]">
            <Sparkles size={17} color="white" />
          </div>
          {!collapsed ? (
            <span className="font-bold text-[#1e2040] text-base tracking-tight">Soldmate</span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={toggleCollapse}
          title={collapseLabel}
          className={`hidden md:inline-flex items-center justify-center text-gray-400 hover:text-[#1e2040] transition-colors ${collapsed ? "ml-0" : "ml-auto"}`}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {!collapsed ? (
        <div className="px-4 pb-2">
          <div className="h-px bg-gray-100" />
        </div>
      ) : null}

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pt-2">
        {NAV_MAIN.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`relative flex items-center ${collapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl transition-colors ${
                active
                  ? "bg-[#f0f3ff] text-[#4f6ef7]"
                  : "text-[#9095a0] hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#4f6ef7] rounded-r-full" />
              )}
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {!collapsed ? <span className="text-sm font-medium">{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5 pt-3 border-t border-gray-50 space-y-0.5">
        {!collapsed ? <HelpCenterPopover /> : null}

        <div className={`pt-3 flex items-center px-3 ${collapsed ? "justify-center" : "gap-2"}`}>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-red-200 hover:text-red-400 transition-colors"
          >
            <Power size={14} />
          </button>
          {!collapsed ? (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#1e2040] truncate">{displayName}</p>
              <p className="text-[10px] text-gray-400">{roleLabel}</p>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
    </>
  );
}
