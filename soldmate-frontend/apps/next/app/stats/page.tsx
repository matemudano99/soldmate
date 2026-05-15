"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Users, ShoppingCart, Activity, Download, Percent, AlertTriangle } from "lucide-react";
import { AppTopHeader, ErpPageShell, notify } from "../shared/ui";
import { dashboardApi, inventoryApi, financeApi } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

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

export default function StatsPage() {
  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [finances, setFinances] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        setLoading(true);
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6);

        const fromStr = sevenDaysAgo.toISOString().split("T")[0];
        const toStr = today.toISOString().split("T")[0];

        const [sum, inv, fin] = await Promise.all([
          dashboardApi.getSummary(token!),
          inventoryApi.getAll(token!),
          financeApi.listDaily(token!, fromStr, toStr).catch(() => []), // En caso de que no haya modulo activo
        ]);
        setSummary(sum);
        setInventory(inv);
        setFinances(fin);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // KPIs
  const liveKpis = useMemo(() => {
    if (!summary) return [];
    const lowStock = inventory.filter((p) => p.lowStock).length;
    const totalRev = finances.reduce((acc, f) => acc + f.revenue, 0);

    return [
      { label: "Ingresos (7 días)", value: `${totalRev.toFixed(2)} €`, Icon: Percent, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
      { label: "Productos en catálogo", value: String(summary.totalProducts), Icon: ShoppingCart, color: "text-[#4f6ef7]", bg: "bg-blue-50 border-blue-100" },
      { label: "Stock crítico", value: String(lowStock), Icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 border-amber-100" },
      { label: "Incidencias abiertas", value: String(summary.openIncidents), Icon: Activity, color: "text-red-500", bg: "bg-red-50 border-red-100" },
    ];
  }, [summary, inventory, finances]);

  // Gráfico: Rendimiento Financiero y Operativo Semanal
  const weeklyPerf = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const shortDay = d.toLocaleDateString("es-ES", { weekday: "short" });
      
      const fin = finances.find(f => f.entryDate === dayStr);
      const inc = summary?.weeklyIncidentsByDay?.find((w: any) => w.day === dayStr)?.incidents || 0;

      data.push({
        day: shortDay,
        ingresos: fin?.revenue || 0,
        gastos: fin?.expenses || 0,
        incidencias: inc,
      });
    }
    return data;
  }, [finances, summary]);

  // Gráfico: Distribución de Inventario por Categoría
  const categoryDist = useMemo(() => {
    const cats: Record<string, number> = {};
    inventory.forEach(p => {
      const c = p.category || "Sin categoría";
      cats[c] = (cats[c] || 0) + 1;
    });
    const colors = ["#4f6ef7", "#34d399", "#f59e0b", "#f87171", "#a855f7", "#64748b"];
    return Object.entries(cats).map(([name, value], i) => ({
      name, value, color: colors[i % colors.length]
    })).sort((a,b) => b.value - a.value).slice(0, 5); // top 5
  }, [inventory]);

  // Gráfico: Productos Críticos
  const criticalProducts = useMemo(() => {
    return inventory
      .filter(p => p.lowStock)
      .map(p => ({
        name: p.name,
        stock: p.currentStock,
        min: p.minStock,
        deficit: p.minStock - p.currentStock,
      }))
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 5);
  }, [inventory]);

  const exportCSV = () => {
    if (!finances.length && !inventory.length) {
      notify.error("No hay datos para exportar");
      return;
    }
    const rows = weeklyPerf;
    const csv = [Object.keys(rows[0]).join(","), ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "estadisticas.csv"; a.click();
    notify.success("CSV exportado");
  };

  return (
    <ErpPageShell>
        <AppTopHeader />
        <main className="flex-1 min-h-0 overflow-y-auto pb-6">
        <div className="px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1e2040]">Estadísticas Globales</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 leading-snug">
              Análisis en tiempo real sobre los datos operativos
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center justify-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2.5 sm:py-1.5 text-sm sm:text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm min-h-[44px] sm:min-h-0"
            >
              <Download size={15} className="sm:w-[13px] sm:h-[13px]" /> CSV
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {liveKpis.map((k) => (
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
                <h2 className="text-base font-semibold text-[#1e2040]">Flujo Financiero (7 días)</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ingresos vs Gastos diarios</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={weeklyPerf}>
                <defs>
                  <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#9095a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ingresos"  name="Ingresos (€)"  stroke="#34d399" strokeWidth={2} fill="url(#gradIngresos)"  dot={false} />
                <Area type="monotone" dataKey="gastos" name="Gastos (€)" stroke="#ef4444" strokeWidth={2} fill="url(#gradGastos)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#1e2040]">Catálogo por Categoría</h2>
              <p className="text-xs text-gray-400 mt-0.5">Distribución de productos</p>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={categoryDist}
                  cx="50%" cy="50%"
                  innerRadius={52} outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                >
                  {categoryDist.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} uds`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {categoryDist.map((c) => (
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
          {/* Hourly traffic (Replaced with Incident Frequency) */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-[#1e2040]">Incidencias reportadas</h2>
              <p className="text-xs text-gray-400 mt-0.5">Últimos 7 días</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyPerf} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#9095a0", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="incidencias" name="Incidencias" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top products (Replaced with Critical Products) */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#1e2040]">Productos Críticos</h2>
                <p className="text-xs text-gray-400 mt-0.5">Con mayor déficit frente al mínimo</p>
              </div>
            </div>
            <div className="space-y-3">
              {criticalProducts.length > 0 ? criticalProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    i === 0 ? "bg-red-100 text-red-600" :
                    i === 1 ? "bg-orange-100 text-orange-500" :
                    "bg-amber-50 text-amber-500"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#1e2040] truncate">{p.name}</span>
                      <span className="text-xs text-red-500 font-medium ml-2 flex-shrink-0">Faltan {p.deficit}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${Math.min(100, (p.deficit / p.min) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-right w-[60px]">
                    <span className="text-[10px] font-semibold text-gray-500">Stock: {p.stock}</span>
                    <span className="text-[10px] text-gray-400">Min: {p.min}</span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 py-4 text-center">No hay productos en estado crítico.</p>
              )}
            </div>
          </div>
        </div>
        </div>
      </main>
    </ErpPageShell>
  );
}
