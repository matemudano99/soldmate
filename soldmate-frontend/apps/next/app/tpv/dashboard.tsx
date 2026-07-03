"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthStore } from "app/lib/store";
import { tpvSalesApi, type TpvDashboard } from "app/lib/api";
import { CHANNEL_LABEL, money, paymentLabel, todayIso } from "./shared";

const daysAgoIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
};

export function DashboardView({ token, onBack }: { token: string; onBack: () => void }) {
  const companyId = useAuthStore((s) => s.companyId);
  const [from, setFrom] = useState(daysAgoIso(6));
  const [to, setTo] = useState(todayIso());

  const q = useQuery<TpvDashboard>({
    queryKey: ["tpv-dashboard", companyId, from, to],
    queryFn: () => tpvSalesApi.dashboard(token, from, to),
    enabled: !!token,
  });
  const d = q.data;

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
            <TrendingUp size={18} className="text-[#4f6ef7]" /> Informes de ventas
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 outline-none focus:border-[#4f6ef7]" />
          <label className="text-gray-500">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 outline-none focus:border-[#4f6ef7]" />
        </div>
      </div>

      {q.isLoading || !d ? (
        <div className="flex items-center gap-2 text-gray-500 py-16 justify-center">
          <Loader2 className="animate-spin" size={20} /> Cargando informe…
        </div>
      ) : (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Ventas" value={money(d.totalSales)} accent />
            <Kpi label="Tickets" value={String(d.ticketCount)} />
            <Kpi label="Ticket medio" value={money(d.avgTicket)} />
            <Kpi label="Propinas" value={money(d.totalTips)} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Ventas por día */}
            <Panel title="Ventas por día">
              {d.byDay.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.byDay.map((r) => ({ ...r, label: r.day.slice(5) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l) => `Día ${l}`} />
                    <Bar dataKey="total" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            {/* Ventas por hora */}
            <Panel title="Ventas por hora (horas punta)">
              {d.byHour.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.byHour.map((r) => ({ ...r, label: `${r.hour}h` }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l) => `${l}`} />
                    <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]}>
                      {d.byHour.map((_, i) => (
                        <Cell key={i} fill="#22c55e" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            {/* Top productos */}
            <Panel title="Productos más vendidos">
              {d.topProducts.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {(() => {
                    const max = Math.max(...d.topProducts.map((p) => p.qty), 1);
                    return d.topProducts.map((p) => (
                      <li key={p.name}>
                        <div className="flex items-center justify-between gap-2 text-sm mb-0.5">
                          <span className="text-[#1e2040] truncate">{p.name}</span>
                          <span className="text-gray-500 shrink-0">
                            <b className="text-[#1e2040]">{Number(p.qty)}</b> ud · {money(p.total)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-[#4f6ef7]" style={{ width: `${(p.qty / max) * 100}%` }} />
                        </div>
                      </li>
                    ));
                  })()}
                </ul>
              )}
            </Panel>

            {/* Por canal y método */}
            <Panel title="Por canal y método de pago">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Canal</p>
              {d.byChannel.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-1 mb-3">
                  {d.byChannel.map((c) => (
                    <li key={c.channel} className="flex justify-between text-sm">
                      <span className="text-gray-600">{CHANNEL_LABEL[c.channel]} · {c.count}</span>
                      <span className="font-semibold text-[#1e2040]">{money(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Método de pago</p>
              {d.byPaymentMethod.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-1">
                  {d.byPaymentMethod.map((p) => (
                    <li key={p.method} className="flex justify-between text-sm">
                      <span className="text-gray-600">{paymentLabel(p.method)}</span>
                      <span className="font-semibold text-[#1e2040]">{money(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${accent ? "bg-[#1e2040] border-[#1e2040] text-white" : "bg-white border-gray-100"}`}>
      <span className={`text-xs block ${accent ? "text-white/60" : "text-gray-400"}`}>{label}</span>
      <span className={`text-xl font-bold ${accent ? "text-white" : "text-[#1e2040]"}`}>{value}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <h3 className="text-sm font-bold text-[#1e2040] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-gray-400 py-6 text-center">Sin datos en este rango.</p>;
}
