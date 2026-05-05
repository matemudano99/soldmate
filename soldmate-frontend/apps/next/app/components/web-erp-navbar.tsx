"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, BarChart2,
  FileText, Calendar, Power, ChevronDown,
  Sparkles, Wrench, Truck, Package, Activity,
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

  return (
    <aside className="sticky top-0 w-[220px] flex-shrink-0 bg-white h-screen flex flex-col border-r border-gray-100 shadow-[2px_0_20px_rgba(149,157,165,0.06)]">
      {/* Logo */}
      <Link href="/dashboard" className="px-5 pt-6 pb-5 flex items-center gap-2 hover:opacity-90 transition-opacity">
        <div className="w-9 h-9 bg-[#4f6ef7] rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(79,110,247,0.35)]">
          <Sparkles size={17} color="white" />
        </div>
        <span className="font-bold text-[#1e2040] text-base tracking-tight">Soldmate</span>
        <ChevronDown size={12} className="text-gray-300 ml-auto" />
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                active
                  ? "bg-[#f0f3ff] text-[#4f6ef7]"
                  : "text-[#9095a0] hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#4f6ef7] rounded-r-full" />
              )}
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5 pt-3 border-t border-gray-50 space-y-0.5">
        <HelpCenterPopover />

        <div className="pt-3 flex items-center gap-2 px-3">
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-red-200 hover:text-red-400 transition-colors"
          >
            <Power size={14} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#1e2040] truncate">{displayName}</p>
            <p className="text-[10px] text-gray-400">
              {roleLabel}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
