"use client";

import React from "react";
import { AlertTriangle, Bell, CheckCircle, Clock, HelpCircle, LifeBuoy, Mail, Phone } from "lucide-react";
import { alertsApi, notificationsApi, describeNetworkError, type AlertResponse, type NotificationResponse } from "app/lib/api";
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
  const [notifications, setNotifications] = React.useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  useOutsideClose(rootRef, () => setOpen(false));

  // Fetch unread count on mount (to show badge)
  React.useEffect(() => {
    if (!token) return;
    notificationsApi.getUnreadCount(token).then(setUnreadCount).catch(() => {});
  }, [token]);

  React.useEffect(() => {
    if (!open || !token) return;
    async function loadAll() {
      try {
        setError(null);
        const [alertData, notifData, count] = await Promise.all([
          alertsApi.getAll(token),
          notificationsApi.getAll(token),
          notificationsApi.getUnreadCount(token),
        ]);
        setAlerts(alertData);
        setNotifications(notifData);
        setUnreadCount(count);
      } catch (err) {
        setError(describeNetworkError(err));
      }
    }
    loadAll();
  }, [open, token]);

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await notificationsApi.markAllRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const handleMarkRead = async (id: number) => {
    if (!token) return;
    try {
      await notificationsApi.markRead(token, id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50"
        title="Ver alertas"
      >
        <Bell size={16} className="text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-1rem))] rounded-2xl border border-gray-100 bg-white shadow-[0_8px_28px_rgba(149,157,165,0.24)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-[#1e2040]">Notificaciones</p>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs text-[#4f6ef7] hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {/* Persistent notifications */}
            {notifications.map((n) => {
              const Icon = n.type === "ALERT" ? AlertTriangle : n.type === "WARNING" ? Clock : CheckCircle;
              const styles = n.type === "ALERT" ? "text-red-500" : n.type === "WARNING" ? "text-amber-500" : "text-[#4f6ef7]";
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${n.read ? "opacity-60" : ""}`}
                >
                  <Icon size={14} className={`mt-0.5 flex-shrink-0 ${styles}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-[#1e2040] ${n.read ? "" : "font-semibold"}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-gray-400 truncate mt-0.5">{n.body}</p>}
                  </div>
                  {!n.read && <span className="w-2 h-2 bg-[#4f6ef7] rounded-full mt-1 flex-shrink-0" />}
                </button>
              );
            })}
            {/* Legacy inventory alerts */}
            {alerts.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Alertas de inventario</p>
              </div>
            )}
            {alerts.map((a, idx) => {
              const Icon = a.type === "critical" ? AlertTriangle : a.type === "warning" ? Clock : CheckCircle;
              const styles = a.type === "critical" ? "text-red-600" : a.type === "warning" ? "text-amber-600" : "text-green-600";
              return (
                <div key={`alert-${idx}`} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <Icon size={14} className={`flex-shrink-0 ${styles}`} />
                  <span className="text-sm text-gray-700">{a.text}</span>
                </div>
              );
            })}
            {!notifications.length && !alerts.length ? (
              <p className="text-xs text-gray-400 px-4 py-8 text-center">Sin notificaciones</p>
            ) : null}
          </div>
          {error ? <p className="text-xs text-amber-600 px-4 pb-3">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export type HelpCenterPopoverProps = {
  /** Solo icono (p. ej. navbar colapsada), panel anclado a la derecha del botón. */
  compact?: boolean;
};

export function HelpCenterPopover({ compact = false }: HelpCenterPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  useOutsideClose(rootRef, () => setOpen(false));

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={compact ? "Centro de ayuda" : undefined}
        aria-label="Centro de ayuda"
        className={
          compact
            ? "relative flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-[#9095a0] transition-colors hover:bg-gray-50 hover:text-gray-600"
            : "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[#9095a0] transition-colors hover:bg-gray-50 hover:text-gray-600"
        }
      >
        <HelpCircle size={16} strokeWidth={1.8} />
        {!compact ? <span className="text-sm font-medium">Centro de ayuda</span> : null}
      </button>
      {open ? (
        <div
          className={`absolute z-50 w-[min(320px,calc(100vw-6rem))] rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_8px_28px_rgba(149,157,165,0.24)] ${
            compact ? "left-full bottom-0 ml-2" : "bottom-12 left-0"
          }`}
        >
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

