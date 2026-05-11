"use client";

import React, { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Users, ShoppingCart, Star, Activity, Download } from "lucide-react";
import { AppTopHeader, WebErpNavbar, notify } from "../shared/ui";
import { dashboardApi, inventoryApi } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { useEffect } from "react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const WEEKLY_PERF = [
  { day: "Lun", pedidos: 24, incidencias: 2, clientes: 87 },
  { day: "Mar", pedidos: 31, incidencias: 1, clientes: 102 },
  { day: "Mié", pedidos: 28, incidencias: 3, clientes: 95 },
  { day: "Jue", pedidos: 42, incidencias: 0, clientes: 134 },
  { day: "Vie", pedidos: 55, incidencias: 2, clientes: 178 },
  { day: "Sáb", pedidos: 67, incidencias: 1, clientes: 210 },
  { day: "Dom", pedidos: 48, incidencias: 0, clientes: 155 },
];

const CATEGORY_DIST = [
  { name: "Bebidas",   value: 38, color: "#4f6ef7" },
  { name: "Comida",    value: 32, color: "#34d399" },
  { name: "Postres",   value: 18, color: "#f59e0b" },
  { name: "Otros",     value: 12, color: "#f87171" },
];

const HOURLY_TRAFFIC = [
  { hour: "08h", visitas: 12 }, { hour: "10h", visitas: 28 },
  { hour: "12h", visitas: 65 }, { hour: "14h", visitas: 88 },
  { hour: "16h", visitas: 42 }, { hour: "18h", visitas: 71 },
  { hour: "20h", visitas: 95 }, { hour: "22h", visitas: 60 },
];

const TOP_PRODUCTS = [
  { name: "Paella Valenciana",   sales: 284, rating: 4.9, revenue: 5680 },
  { name: "Sangría jarra",       sales: 412, rating: 4.7, revenue: 4120 },
  { name: "Croquetas caseras",   sales: 356, rating: 4.8, revenue: 2848 },
  { name: "Tortilla española",   sales: 198, rating: 4.6, revenue: 1584 },
  { name: "Tarta de queso",      sales: 167, rating: 4.9, revenue: 1336 },
];

const SUMMARY_KPIS = [
  { label: "Clientes esta semana", value: "961",    Icon: Users,        color: "text-[#4f6ef7]", bg: "bg-blue-50 border-blue-100" },
  { label: "Pedidos totales",      value: "295",    Icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  { label: "Valoración media",     value: "4.8 ★", Icon: Star,         color: "text-amber-500", bg: "bg-amber-50 border-amber-100" },
  { label: "Incidencias abiertas", value: "3",      Icon: Activity,     color: "text-red-500",  bg: "bg-red-50 border-red-100" },
];

const PERIODS = ["Esta semana", "Este mes", "Este año"] as const;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-[#1e2040] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function PieLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  const RADIAN = Math.PI / 180;
  const x = cx + (outerRadius + 20) * Math.cos(-midAngle * RADIAN);
  const y = cy + (outerRadius + 20) * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#9095a0" textAnchor={x > cx ? "start" : "end"} fontSize={10} fontWeight={500}>
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [period, setPeriod] = useState<typeof PERIODS[number]>("Esta semana");
  const token = useAuthStore((s) => s.token);
  const [liveKpis, setLiveKpis] = useState<typeof SUMMARY_KPIS | null>(null);

  useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        const [summary, products] = await Promise.all([
          dashboardApi.getSummary(token!),
          inventoryApi.getAll(token!),
        ]);
        const lowStock = products.filter((p) => p.lowStock).length;
        setLiveKpis([
          { label: "Productos en catálogo", value: String(summary.totalProducts), Icon: ShoppingCart, color: "text-[#4f6ef7]", bg: "bg-blue-50 border-blue-100" },
          { label: "Stock bajo", value: String(lowStock), Icon: Activity, color: "text-amber-500", bg: "bg-amber-50 border-amber-100" },
          { label: "Incidencias abiertas", value: String(summary.openIncidents), Icon: Activity, color: "text-red-500", bg: "bg-red-50 border-red-100" },
          { label: "Usuarios activos", value: String(summary.activeContacts), Icon: Users, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
        ]);
      } catch { /* fallback to mock */ }
    }
    load();
  }, [token]);

  const displayKpis = liveKpis ?? SUMMARY_KPIS;

  return (
    <div className="flex min-h-screen bg-[#eef1f8] text-[#1e2040]">
      <WebErpNavbar />

      <main className="flex-1 overflow-y-auto pb-6">
        <AppTopHeader />
        <div className="px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1e2040]">Estadísticas</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 leading-snug">
              Análisis de rendimiento operativo {liveKpis ? "· Datos en tiempo real" : "· Datos de ejemplo"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              const rows = WEEKLY_PERF;
              const csv = [Object.keys(rows[0]).join(","), ...rows.map((r) => Object.values(r).join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "estadisticas.csv"; a.click();
              notify.success("CSV exportado");
            }}
            className="inline-flex items-center justify-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2.5 sm:py-1.5 text-sm sm:text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm min-h-[44px] sm:min-h-0"
          >
            <Download size={15} className="sm:w-[13px] sm:h-[13px]" /> CSV
          </button>
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm flex-1 sm:flex-initial min-w-0">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[40px] sm:min-h-0 ${
                  period === p
                    ? "bg-[#4f6ef7] text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {displayKpis.map((k) => (
            <div key={k.label} className={`bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border ${k.bg}`}>
              <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider leading-snug flex-1 min-w-0">{k.label}</p>
                <k.Icon size={16} className={`${k.color} flex-shrink-0`} />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-[#1e2040]">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Main Charts Row */}
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 mb-6">
          {/* Weekly Performance Area */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-[#1e2040]">Rendimiento semanal</h2>
                <p className="text-xs text-gray-400 mt-0.5">Pedidos y clientes por día</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={WEEKLY_PERF}>
                <defs>
                  <linearGradient id="gradPedidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f6ef7" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#4f6ef7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradClientes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#9095a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="pedidos"  name="Pedidos"  stroke="#4f6ef7" strokeWidth={2} fill="url(#gradPedidos)"  dot={false} />
                <Area type="monotone" dataKey="clientes" name="Clientes" stroke="#34d399" strokeWidth={2} fill="url(#gradClientes)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#1e2040]">Ventas por categoría</h2>
              <p className="text-xs text-gray-400 mt-0.5">Distribución de pedidos</p>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={CATEGORY_DIST}
                  cx="50%" cy="50%"
                  innerRadius={52} outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                >
                  {CATEGORY_DIST.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v}%`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {CATEGORY_DIST.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                  <span className="text-[10px] text-gray-500 font-medium">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Second Row */}
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-4">
          {/* Hourly traffic */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-[#1e2040]">Tráfico por franja horaria</h2>
              <p className="text-xs text-gray-400 mt-0.5">Visitas promedio de hoy</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={HOURLY_TRAFFIC} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "#9095a0", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="visitas" name="Visitas" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top products */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#1e2040]">Top productos</h2>
                <p className="text-xs text-gray-400 mt-0.5">Por número de ventas</p>
              </div>
            </div>
            <div className="space-y-3">
              {TOP_PRODUCTS.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    i === 0 ? "bg-amber-100 text-amber-600" :
                    i === 1 ? "bg-gray-100 text-gray-500" :
                    i === 2 ? "bg-orange-100 text-orange-500" :
                              "bg-gray-50 text-gray-400"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#1e2040] truncate">{p.name}</span>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{p.sales} uds</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#4f6ef7]"
                        style={{ width: `${(p.sales / TOP_PRODUCTS[0].sales) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Star size={10} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-semibold text-gray-500">{p.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
