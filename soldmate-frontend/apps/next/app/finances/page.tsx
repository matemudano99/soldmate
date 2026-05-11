"use client";

import React, { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Clock, Download, Plus, Trash2 } from "lucide-react";
import { AppTopHeader, WebErpNavbar, notify } from "../shared/ui";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MONTHLY = [
  { month: "Ene", ingresos: 18400, gastos: 12100 },
  { month: "Feb", ingresos: 22300, gastos: 14200 },
  { month: "Mar", ingresos: 19800, gastos: 11900 },
  { month: "Abr", ingresos: 26100, gastos: 15300 },
  { month: "May", ingresos: 24500, gastos: 13800 },
  { month: "Jun", ingresos: 29200, gastos: 16400 },
  { month: "Jul", ingresos: 31000, gastos: 17200 },
];

const TRANSACTIONS = [
  { id: "TXN-001", date: "30 Abr 2026", desc: "Proveedor Frutas Martínez",   type: "gasto",   amount: -1240, status: "pagado" },
  { id: "TXN-002", date: "29 Abr 2026", desc: "Venta servicio mesa 12",       type: "ingreso", amount: 380,   status: "cobrado" },
  { id: "TXN-003", date: "28 Abr 2026", desc: "Bebidas Ibérica - Pedido #44", type: "gasto",   amount: -2100, status: "pagado" },
  { id: "TXN-004", date: "27 Abr 2026", desc: "Evento privado - reserva",     type: "ingreso", amount: 1800,  status: "cobrado" },
  { id: "TXN-005", date: "26 Abr 2026", desc: "Mantenimiento equipo frío",    type: "gasto",   amount: -450,  status: "pendiente" },
  { id: "TXN-006", date: "25 Abr 2026", desc: "Comidas del día",              type: "ingreso", amount: 920,   status: "cobrado" },
  { id: "TXN-007", date: "24 Abr 2026", desc: "Suministros limpieza",         type: "gasto",   amount: -310,  status: "pagado" },
];

const KPIS = [
  { label: "Ingresos este mes", value: "€31.000", change: "+12%", up: true,  color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", Icon: TrendingUp },
  { label: "Gastos este mes",   value: "€17.200", change: "+5%",  up: false, color: "text-red-500",     bg: "bg-red-50 border-red-100",         Icon: TrendingDown },
  { label: "Beneficio neto",    value: "€13.800", change: "+22%", up: true,  color: "text-[#4f6ef7]",   bg: "bg-blue-50 border-blue-100",       Icon: DollarSign },
  { label: "Facturas pendientes", value: "€450",  change: "1 factura", up: false, color: "text-amber-600", bg: "bg-amber-50 border-amber-100", Icon: Clock },
];

const TABS = ["Todos", "Ingresos", "Gastos"] as const;
type Tab = typeof TABS[number];

type Transaction = typeof TRANSACTIONS[number];

function exportCSV(rows: Transaction[]) {
  const headers = ["ID", "Fecha", "Descripción", "Tipo", "Importe", "Estado"];
  const lines = [headers.join(","), ...rows.map((r) =>
    [r.id, r.date, `"${r.desc}"`, r.type, r.amount, r.status].join(",")
  )];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finanzas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notify.success("CSV exportado correctamente");
}

// ─── Components ───────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-[#1e2040] mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: €{p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Todos");
  const [search, setSearch] = useState("");

  const filtered = TRANSACTIONS.filter((t) => {
    if (activeTab === "Ingresos" && t.type !== "ingreso") return false;
    if (activeTab === "Gastos"   && t.type !== "gasto")   return false;
    if (search.trim() && !t.desc.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-[#eef1f8] text-[#1e2040]">
      <WebErpNavbar />

      <main className="flex-1 overflow-y-auto pb-6">
        <AppTopHeader />
        <div className="px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e2040]">Finanzas</h1>
            <p className="text-sm text-gray-400 mt-0.5">Resumen financiero · Julio 2026</p>
          </div>
          <button
            type="button"
            onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-all"
          >
            <Download size={15} />
            Exportar CSV
          </button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {KPIS.map((k) => (
            <div key={k.label} className={`bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border ${k.bg}`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight max-w-[70%]">{k.label}</p>
                <k.Icon size={16} className={k.color} />
              </div>
              <p className="text-2xl font-bold text-[#1e2040]">{k.value}</p>
              <p className={`text-xs font-medium mt-1 ${k.up ? "text-emerald-500" : "text-red-400"}`}>
                {k.up ? "↑" : "↓"} {k.change} vs mes anterior
              </p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 mb-6">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-[#1e2040]">Ingresos vs Gastos</h2>
                <p className="text-xs text-gray-400 mt-0.5">Enero – Julio 2026</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#4f6ef7] inline-block" />
                  Ingresos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#f87171] inline-block" />
                  Gastos
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#9095a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#4f6ef7" radius={[5, 5, 0, 0]} maxBarSize={28} />
                <Bar dataKey="gastos"   name="Gastos"   fill="#f87171" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-[#1e2040]">Beneficio neto</h2>
              <p className="text-xs text-gray-400 mt-0.5">Tendencia mensual</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={MONTHLY.map((m) => ({ ...m, neto: m.ingresos - m.gastos }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#9095a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone" dataKey="neto" name="Beneficio"
                  stroke="#34d399" strokeWidth={2.5} dot={{ r: 3, fill: "#34d399", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#34d399" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-50">
            <h2 className="text-base font-semibold text-[#1e2040]">Movimientos recientes</h2>
            <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar movimiento..."
              className="text-xs border border-gray-100 rounded-xl px-3 py-1.5 outline-none focus:border-[#4f6ef7] hidden md:block"
            />
            <div className="flex gap-1 bg-[#f8f9fc] rounded-xl p-1">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === t
                      ? "bg-white text-[#4f6ef7] shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              <span>Descripción</span>
              <span className="text-right">Fecha</span>
              <span className="text-right">Estado</span>
              <span className="text-right">Importe</span>
            </div>

            {filtered.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-[#fafbff] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1e2040] truncate">{tx.desc}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tx.id}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{tx.date}</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                  tx.status === "cobrado"   ? "bg-emerald-50 text-emerald-600" :
                  tx.status === "pagado"    ? "bg-blue-50 text-blue-600" :
                                              "bg-amber-50 text-amber-600"
                }`}>
                  {tx.status}
                </span>
                <span className={`text-sm font-bold whitespace-nowrap ${
                  tx.amount > 0 ? "text-emerald-600" : "text-red-500"
                }`}>
                  {tx.amount > 0 ? "+" : ""}€{Math.abs(tx.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
