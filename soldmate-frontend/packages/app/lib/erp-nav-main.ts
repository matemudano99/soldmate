import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Calendar,
  CalendarClock,
  CreditCard,
  FileText,
  LayoutDashboard,
  Monitor,
  Package,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

export type ErpNavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

/** Rutas del menú principal ERP (sidebar y barra inferior móvil). */
export const ERP_NAV_MAIN: ErpNavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/inventory", label: "Inventario", Icon: Package },
  { href: "/activity", label: "Actividad", Icon: Activity },
  { href: "/people", label: "Usuarios", Icon: Users },
  { href: "/incidents", label: "Incidencias", Icon: Wrench },
  { href: "/suppliers", label: "Proveedores", Icon: Truck },
  { href: "/finances", label: "Finanzas", Icon: CreditCard },
  { href: "/tpv", label: "TPV", Icon: Monitor },
  { href: "/documents", label: "Documentos", Icon: FileText },
  { href: "/calendar", label: "Calendario", Icon: Calendar },
  { href: "/shifts", label: "Turnos", Icon: CalendarClock },
];

export const MOBILE_DASHBOARD_HREF = "/dashboard";

export function findNavItem(href: string): ErpNavItem | undefined {
  return ERP_NAV_MAIN.find((item) => item.href === href);
}
