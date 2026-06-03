"use client";

import React from "react";
import { useAuthStore } from "app/lib/store";
import { WebErpNavbar } from "../../components/web-erp-navbar";
import { MobileBottomNav } from "./mobile-bottom-nav";

export type ErpPageShellProps = {
  children: React.ReactNode;
  /** Clases adicionales en el contenedor exterior. */
  className?: string;
};

/**
 * Marco común del ERP: altura de viewport (`100dvh`), sin scroll en el documento.
 * Coloca `AppTopHeader` (búsqueda global ⌘K) y luego un `<main className="flex-1 min-h-0 overflow-y-auto …">` para que
 * solo el contenido haga scroll; la sidebar queda alineada con el dashboard y el resto de vistas.
 */
export function ErpPageShell({ children, className = "" }: ErpPageShellProps) {
  const companyId = useAuthStore((s) => s.companyId);
  return (
    <div
      className={`flex h-[100dvh] min-h-0 overflow-hidden bg-[#eef1f8] text-[#1e2040] ${className}`.trim()}
    >
      <WebErpNavbar />
      <div
        key={companyId ?? "no-company"}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-20 md:pb-0">
          {children}
        </div>
        <MobileBottomNav />
      </div>
    </div>
  );
}
