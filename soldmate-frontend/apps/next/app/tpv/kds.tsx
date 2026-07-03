"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChefHat, Clock, Loader2 } from "lucide-react";
import { notify } from "../shared/ui";
import { tpvKitchenApi, type TpvKitchenOrder, type TpvKitchenStatus } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { CHANNEL_LABEL } from "./shared";

const COLUMNS: { status: TpvKitchenStatus; title: string; tint: string }[] = [
  { status: "PENDING", title: "Pendiente", tint: "#ef4444" },
  { status: "PREPARING", title: "En preparación", tint: "#f59e0b" },
  { status: "READY", title: "Listo", tint: "#22c55e" },
];

export function KitchenView({ token, onBack }: { token: string; onBack: () => void }) {
  const companyId = useAuthStore((s) => s.companyId);
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());

  // Reloj para que los tiempos de espera avancen suavemente.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const boardQ = useQuery({
    queryKey: ["tpv-kitchen-board", companyId],
    queryFn: () => tpvKitchenApi.board(token),
    enabled: !!token,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const orders = boardQ.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tpv-kitchen-board"] });

  const statusMut = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: TpvKitchenStatus | "SERVED" }) =>
      tpvKitchenApi.setOrderStatus(token, orderId, status),
    onSuccess: invalidate,
    onError: (e: Error) => notify.error(e.message),
  });
  const doneMut = useMutation({
    mutationFn: ({ orderId, lineId, done }: { orderId: number; lineId: number; done: boolean }) =>
      tpvKitchenApi.setLineDone(token, orderId, lineId, done),
    onSuccess: invalidate,
    onError: (e: Error) => notify.error(e.message),
  });

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#4f6ef7]"
          >
            <ArrowLeft size={16} /> Sala
          </button>
          <h2 className="text-lg font-bold text-[#1e2040] flex items-center gap-2">
            <ChefHat size={18} className="text-[#4f6ef7]" /> Cocina (KDS)
          </h2>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {boardQ.isFetching ? <Loader2 size={13} className="animate-spin" /> : <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          En vivo · {orders.length} comandas
        </span>
      </div>

      {boardQ.isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 py-16 justify-center">
          <Loader2 className="animate-spin" size={20} /> Cargando cocina…
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-400 py-16 text-center border border-dashed border-gray-200 rounded-2xl">
          No hay comandas en cocina ahora mismo.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.status);
            return (
              <div key={col.status} className="rounded-2xl bg-gray-50/60 border border-gray-100 p-2">
                <div className="flex items-center justify-between px-1.5 py-1 mb-2">
                  <span className="text-sm font-bold" style={{ color: col.tint }}>{col.title}</span>
                  <span className="text-xs font-bold text-white rounded-full px-2 py-0.5" style={{ backgroundColor: col.tint }}>
                    {colOrders.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-0.5">
                  {colOrders.map((o) => (
                    <KitchenCard
                      key={o.orderId}
                      order={o}
                      now={now}
                      pending={statusMut.isPending || doneMut.isPending}
                      onToggleLine={(lineId, done) => doneMut.mutate({ orderId: o.orderId, lineId, done })}
                      onStatus={(status) => statusMut.mutate({ orderId: o.orderId, status })}
                    />
                  ))}
                  {colOrders.length === 0 ? <p className="text-xs text-gray-400 text-center py-3">—</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KitchenCard({
  order,
  now,
  pending,
  onToggleLine,
  onStatus,
}: {
  order: TpvKitchenOrder;
  now: number;
  pending: boolean;
  onToggleLine: (lineId: number, done: boolean) => void;
  onStatus: (status: TpvKitchenStatus | "SERVED") => void;
}) {
  const started = order.openedAt ? new Date(order.openedAt).getTime() : now;
  const mins = Math.max(0, Math.floor((now - started) / 60000));
  const timeColor = mins >= 20 ? "text-red-600" : mins >= 10 ? "text-amber-600" : "text-emerald-600";
  const where = order.tableLabel ? `Mesa ${order.tableLabel}` : CHANNEL_LABEL[order.channel];

  return (
    <div className={`rounded-xl bg-white border p-2.5 shadow-sm ${order.status === "PENDING" ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-bold text-[#1e2040]">
          {where} <span className="text-xs font-normal text-gray-400">{order.number}</span>
        </span>
        <span className={`text-xs font-bold flex items-center gap-1 ${timeColor}`}>
          <Clock size={12} /> {mins}m
        </span>
      </div>
      {order.customerName ? <div className="text-[11px] text-gray-400 mb-1 -mt-1">{order.customerName}</div> : null}

      <ul className="space-y-0.5 mb-2">
        {order.lines.map((l) =>
          l.modifier ? (
            <li key={l.id} className={`pl-3 text-[11px] ${l.removal ? "text-red-500 font-semibold" : "text-gray-500"}`}>
              {l.removal ? `✕ ${l.name}` : `+ ${Number(l.qty) > 1 ? `${Number(l.qty)}× ` : ""}${l.name}`}
            </li>
          ) : (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onToggleLine(l.id, !l.done)}
                className="w-full flex items-center gap-2 text-left"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${l.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300"}`}>
                  {l.done ? <Check size={11} /> : null}
                </span>
                <span className={`text-sm font-semibold ${l.done ? "text-gray-300 line-through" : "text-[#1e2040]"}`}>
                  {Number(l.qty)}× {l.name}
                </span>
              </button>
              {l.note ? <div className="pl-6 text-[11px] text-amber-700 italic">→ {l.note}</div> : null}
            </li>
          ),
        )}
      </ul>

      <div className="flex gap-1.5">
        {order.status === "PENDING" ? (
          <CardBtn disabled={pending} color="#f59e0b" onClick={() => onStatus("PREPARING")}>Empezar</CardBtn>
        ) : null}
        {order.status === "PREPARING" ? (
          <>
            <CardBtn disabled={pending} ghost onClick={() => onStatus("PENDING")}>↩</CardBtn>
            <CardBtn disabled={pending} color="#22c55e" onClick={() => onStatus("READY")}>Listo</CardBtn>
          </>
        ) : null}
        {order.status === "READY" ? (
          <>
            <CardBtn disabled={pending} ghost onClick={() => onStatus("PREPARING")}>↩</CardBtn>
            <CardBtn disabled={pending} color="#1e2040" onClick={() => onStatus("SERVED")}>Servido</CardBtn>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CardBtn({
  children,
  color,
  ghost,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  color?: string;
  ghost?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  if (ghost) {
    return (
      <button type="button" disabled={disabled} onClick={onClick} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold text-gray-500 hover:border-gray-400 disabled:opacity-50">
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ backgroundColor: color }}
      className="flex-1 rounded-lg text-white px-2 py-1.5 text-sm font-bold hover:brightness-95 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
