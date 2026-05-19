"use client";

import React from "react";
import { Monitor } from "lucide-react";
import { AppTopHeader, ErpPageShell, SectionCard } from "../shared/ui";

export default function TpvPage() {
  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 pb-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#1e2040]">TPV</h1>
          <p className="mt-0.5 text-sm text-gray-400">Terminal punto de venta · no implementado</p>
        </div>

        <SectionCard title="Módulo en desarrollo" subtitle="Próximamente">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Monitor size={28} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm text-gray-600 leading-relaxed">
                Aquí podrás consultar el resumen del datáfono y del TPV: tickets del día, desglose por medios de pago y
                conciliación automática con el cierre de caja en Finanzas.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-500">
                <li>Ventas del turno en tiempo real</li>
                <li>Tickets y anulaciones</li>
                <li>Enlace con canales de ingreso del cierre diario</li>
              </ul>
              <span className="inline-flex rounded-full border border-dashed border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                No implementado
              </span>
            </div>
          </div>
        </SectionCard>
      </main>
    </ErpPageShell>
  );
}
