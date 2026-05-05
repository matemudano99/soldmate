"use client";

import React from "react";
import { AlertTriangle, Bell, CheckCircle, Clock, HelpCircle, LifeBuoy, Mail, Phone } from "lucide-react";
import { alertsApi, describeNetworkError, type AlertResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

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

export function AlertsBellPopover() {
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = React.useState(false);
  const [alerts, setAlerts] = React.useState<AlertResponse[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  useOutsideClose(rootRef, () => setOpen(false));

  React.useEffect(() => {
    if (!open || !token) return;
    async function loadAlerts() {
      try {
        setError(null);
        const data = await alertsApi.getAll(token);
        setAlerts(data);
      } catch (err) {
        setError(describeNetworkError(err));
      }
    }
    loadAlerts();
  }, [open, token]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50"
        title="Ver alertas"
      >
        <Bell size={16} className="text-gray-500" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[340px] rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_8px_28px_rgba(149,157,165,0.24)]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Alertas</p>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {alerts.map((a, idx) => {
              const Icon = a.type === "critical" ? AlertTriangle : a.type === "warning" ? Clock : CheckCircle;
              const styles =
                a.type === "critical"
                  ? "bg-red-50 border-red-100 text-red-600"
                  : a.type === "warning"
                    ? "bg-amber-50 border-amber-100 text-amber-600"
                    : "bg-green-50 border-green-100 text-green-600";
              return (
                <div key={`${a.text}-${idx}`} className={`flex items-center gap-3 rounded-xl border p-3 ${styles}`}>
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="text-sm font-medium">{a.text}</span>
                </div>
              );
            })}
            {!alerts.length ? (
              <p className="text-xs text-gray-500 px-1 py-2">No hay alertas recientes.</p>
            ) : null}
          </div>
          {error ? <p className="text-xs text-amber-600 mt-2 px-1">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function HelpCenterPopover() {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  useOutsideClose(rootRef, () => setOpen(false));

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-[#9095a0] hover:bg-gray-50 hover:text-gray-600 w-full"
      >
        <HelpCircle size={16} strokeWidth={1.8} />
        <span className="text-sm font-medium">Centro de ayuda</span>
      </button>
      {open ? (
        <div className="absolute left-0 bottom-12 z-50 w-[320px] rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_8px_28px_rgba(149,157,165,0.24)]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Soporte</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-blue-700">
              <LifeBuoy size={15} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">Soporte operativo</p>
                <p className="text-xs">Disponible de 08:00 a 20:00</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5">
              <Mail size={15} className="text-gray-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#1e2040]">support@soldmate.app</p>
                <p className="text-xs text-gray-500">Respuesta media: 30 min</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5">
              <Phone size={15} className="text-gray-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#1e2040]">+34 900 123 456</p>
                <p className="text-xs text-gray-500">Urgencias de infraestructura</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

