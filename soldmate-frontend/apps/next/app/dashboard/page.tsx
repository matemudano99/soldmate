"use client";

import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  DollarSign, Wrench, Package, Users, TrendingUp,
  ChevronRight, Circle,
  CheckCircle2, Clock, Activity, CloudRain,
} from "lucide-react";
import { ErpPageShell, AppTopHeader, PageListSearchField } from "../shared/ui";
import Link from "next/link";
import { useAuthStore } from "app/lib/store";
import {
  activityApi,
  businessProfileApi,
  dashboardApi,
  describeNetworkError,
  forecastApi,
  inventoryApi,
  predictionsApi,
  type ActivityItemResponse,
  type BusinessProfileResponse,
  type DashboardSummaryResponse,
  type PredictiveDay,
  type ProductResponse,
  type ForecastImpactDay,
} from "app/lib/api";
import { compareProductsByCategoryThenName } from "app/lib/inventorySort";
import { isBusinessOpenNow } from "app/lib/weather";

const RAIN_DASHBOARD_MM = 1.0;

// ─── Mock Data ────────────────────────────────────────────────────────────────

const WEEKLY = [
  { day: "LUN", incidents: 0 },
  { day: "MAR", incidents: 0 },
  { day: "MIE", incidents: 0 },
  { day: "JUE", incidents: 0 },
  { day: "VIE", incidents: 0 },
  { day: "SAB", incidents: 0 },
  { day: "DOM", incidents: 0 },
];

const QUICK_ACTIONS = [
  { label: "Reportar avería",   href: "/incidents/new", color: "bg-red-50 text-red-500 hover:bg-red-100",       Icon: Wrench       },
  { label: "Ver inventario",    href: "/inventory",     color: "bg-blue-50 text-[#4f6ef7] hover:bg-blue-100", Icon: Package      },
  { label: "Ver actividad",     href: "/activity",      color: "bg-slate-50 text-slate-600 hover:bg-slate-100", Icon: Activity   },
  { label: "Añadir persona",    href: "/people",     color: "bg-violet-50 text-violet-500 hover:bg-violet-100", Icon: Users   },
  { label: "Ver estadísticas",  href: "/stats",      color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", Icon: TrendingUp },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  OPEN:        { label: "Abierta",  Icon: Circle,       color: "text-red-500",   bg: "bg-red-50"    },
  IN_PROGRESS: { label: "En curso", Icon: Clock,        color: "text-amber-500", bg: "bg-amber-50"  },
  CLOSED:      { label: "Cerrada",  Icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50"  },
};

const PRIORITY_CFG = {
  CRITICAL: "text-red-500",
  HIGH:     "text-orange-500",
  MEDIUM:   "text-amber-500",
  LOW:      "text-blue-400",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-[#1e2040] mb-0.5">{label}</p>
      <p className="text-[#4f6ef7] font-bold">{payload[0].value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token);
  const [summary, setSummary] = React.useState<DashboardSummaryResponse | null>(null);
  const [predictions, setPredictions] = React.useState<PredictiveDay[]>([]);
  const [allLowStockProducts, setAllLowStockProducts] = React.useState<ProductResponse[]>([]);
  const [activityFeedFull, setActivityFeedFull] = React.useState<ActivityItemResponse[]>([]);
  const [businessProfile, setBusinessProfile] = React.useState<BusinessProfileResponse | null>(null);
  const [weatherImpactRaw, setWeatherImpactRaw] = React.useState<ForecastImpactDay[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [dashSearch, setDashSearch] = React.useState("");
  React.useEffect(() => {
    const authToken = token;
    if (!authToken) return;
    async function load() {
      try {
        setError(null);
        const [summaryRes, weatherRes, predictionRes, productsRes, activityRes, businessRes] = await Promise.all([
          dashboardApi.getSummary(authToken!),
          forecastApi.getImpact(authToken!),
          predictionsApi.getOperations(authToken!),
          inventoryApi.getAll(authToken!),
          activityApi.getAll(authToken!),
          businessProfileApi.get(authToken!),
        ]);
        setSummary(summaryRes);
        setWeatherImpactRaw(weatherRes);
        setPredictions(predictionRes.slice(0, 3));
        setAllLowStockProducts(
          [...productsRes].sort(compareProductsByCategoryThenName).filter((p) => p.lowStock),
        );
        setActivityFeedFull(activityRes);
        setBusinessProfile(businessRes);
      } catch (err) {
        setError(describeNetworkError(err));
      }
    }
    load();
  }, [token]);

  const kpis = [
    {
      label: "Ventas estimadas",
      value: predictions[0] ? `€ ${Math.round(predictions[0].predictedDemand)}` : "—",
      sub: predictions[0] ? `Base: €${Math.round(predictions[0].historicalBaseline)}` : "Sin histórico",
      Icon: DollarSign,
      color: "text-[#4f6ef7]",
      bg: "bg-blue-50 border-blue-100",
    },
    {
      label: "Incidencias activas",
      value: String((summary?.openIncidents ?? 0) + (summary?.inProgressIncidents ?? 0)),
      sub: `${summary?.closedIncidents ?? 0} cerradas`,
      Icon: Wrench,
      color: "text-red-500",
      bg: "bg-red-50 border-red-100",
    },
    {
      label: "Stock bajo",
      value: `${summary?.lowStockProducts ?? 0} items`,
      sub: "Requieren reposición",
      Icon: Package,
      color: "text-amber-500",
      bg: "bg-amber-50 border-amber-100",
    },
    {
      label: "Equipo activo",
      value: `${summary?.activeContacts ?? 0} / ${summary?.totalContacts ?? 0}`,
      sub: "Contactos marcados activos",
      Icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-100",
    },
  ];

  const weekly = summary?.weeklyIncidentsByDay?.length
    ? summary.weeklyIncidentsByDay.map((p) => ({ day: p.day.slice(0, 3), incidents: p.incidents }))
    : WEEKLY;

  const recentIncidents = summary?.recentIncidents ?? [];

  const dq = dashSearch.trim().toLowerCase();

  const incidentsVisible = useMemo(() => {
    if (!dq) return recentIncidents;
    return recentIncidents.filter((inc) => {
      const hay = `${inc.title} ${inc.priority} ${inc.status} ${inc.reportedBy ?? ""}`.toLowerCase();
      return hay.includes(dq);
    });
  }, [recentIncidents, dq]);

  const lowStockVisible = useMemo(() => {
    let rows = allLowStockProducts;
    if (dq) {
      rows = rows.filter((p) => {
        const name = (p.name ?? "").toLowerCase();
        const cat = (p.category ?? "").toLowerCase();
        const sup = (p.supplierName ?? "").toLowerCase();
        return name.includes(dq) || cat.includes(dq) || sup.includes(dq);
      });
    }
    return rows.slice(0, dq ? 40 : 6);
  }, [allLowStockProducts, dq]);

  const activityVisible = useMemo(() => {
    if (!dq) return activityFeedFull.slice(0, 6);
    return activityFeedFull
      .filter((a) => {
        const hay = `${a.title ?? ""} ${a.actorName ?? ""} ${a.actorEmail ?? ""} ${a.type}`.toLowerCase();
        return hay.includes(dq);
      })
      .slice(0, 24);
  }, [activityFeedFull, dq]);

  const rainForecastDays = useMemo(() => {
    return [...weatherImpactRaw]
      .filter((d) => d.rain >= RAIN_DASHBOARD_MM)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [weatherImpactRaw]);

  return (
    <ErpPageShell>
        <AppTopHeader />

        <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 pb-6 space-y-5">
          {error && <p className="text-xs text-amber-600">{error}</p>}
          <p className="text-xs text-gray-500">
            Estado del negocio:{" "}
            <span className={isBusinessOpenNow(businessProfile?.openingHours) ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
              {isBusinessOpenNow(businessProfile?.openingHours) ? "Abierto ahora" : "Fuera de horario"}
            </span>
          </p>

          <PageListSearchField
            value={dashSearch}
            onChange={setDashSearch}
            placeholder="Filtrar incidencias, stock bajo y actividad en esta página…"
            className="max-w-xl"
          />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map((k) => {
              const inner = (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight max-w-[75%]">{k.label}</p>
                    <k.Icon size={16} className={k.color} />
                  </div>
                  <p className="text-2xl font-bold text-[#1e2040]">{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </>
              );
              const shell = `bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border ${k.bg} transition-colors`;
              if (k.label === "Stock bajo") {
                return (
                  <Link key={k.label} href="/inventory" className={`${shell} hover:shadow-md cursor-pointer block`}>
                    {inner}
                  </Link>
                );
              }
              return (
                <div key={k.label} className={shell}>
                  {inner}
                </div>
              );
            })}
          </div>

          {/* Charts + quick actions row */}
          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
            {/* Weekly sales chart */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-[#1e2040]">Incidencias esta semana</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Datos reales agregados</p>
                </div>
                <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <TrendingUp size={11} /> Live
                </span>
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={weekly} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#9095a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="incidents" fill="#4f6ef7" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
              <h2 className="text-base font-semibold text-[#1e2040] mb-4">Acciones rápidas</h2>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS.map((a) => (
                  <Link
                    key={a.label}
                    href={a.href}
                    className={`flex flex-col items-start gap-2.5 rounded-xl p-4 transition-all ${a.color} group`}
                  >
                    <a.Icon size={20} />
                    <span className="text-xs font-semibold leading-tight">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
              <h2 className="text-base font-semibold text-[#1e2040] mb-1">Días con lluvia</h2>
              <p className="text-xs text-gray-400 mb-3">
                Solo fechas con al menos {RAIN_DASHBOARD_MM} mm previstos en el pronóstico.
              </p>
              <div className="space-y-2">
                {rainForecastDays.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
                    No hay días con lluvia prevista en el pronóstico actual.
                  </p>
                ) : (
                  rainForecastDays.map((w) => {
                    const dayLabel = new Date(`${w.date.slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    });
                    const cap = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
                    return (
                      <div key={w.date} className="rounded-xl border border-sky-100 bg-sky-50/80 p-3">
                        <p className="text-sm font-semibold text-sky-900">{cap}</p>
                        <p className="text-xs text-sky-800 flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <CloudRain size={12} />
                            {w.rain.toFixed(1)} mm
                          </span>
                          <span className="text-sky-600/80">· Índice {w.impactScore}</span>
                        </p>
                        <p className="text-xs text-sky-800/90 mt-1.5 leading-relaxed">{w.recommendation}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50">
              <h2 className="text-base font-semibold text-[#1e2040] mb-3">Predicción operativa</h2>
              <div className="space-y-2">
                {predictions.map((p) => (
                  <div key={p.date} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-[#1e2040]">{p.date}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Demanda: €{Math.round(p.predictedDemand)} · Staff sugerido: {p.suggestedStaff}
                    </p>
                    <p className="text-xs text-[#4f6ef7] mt-1">{p.inventoryHint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid lg:grid-cols-[1.2fr_1fr_1fr] gap-4">
            {/* Recent incidents */}
            <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h2 className="text-base font-semibold text-[#1e2040]">Incidencias recientes</h2>
                <Link href="/incidents" className="text-xs text-[#4f6ef7] font-medium hover:underline flex items-center gap-1">
                  Ver todas <ChevronRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {incidentsVisible.map((inc) => {
                  const s = STATUS_CFG[inc.status as keyof typeof STATUS_CFG];
                  return (
                    <div key={inc.id} className="px-5 py-3.5 hover:bg-[#fafbff] transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium text-[#1e2040] truncate flex-1 mr-2">{inc.title}</p>
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.color} whitespace-nowrap`}>
                          <s.Icon size={9} />
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold ${PRIORITY_CFG[inc.priority as keyof typeof PRIORITY_CFG]}`}>
                          {inc.priority}
                        </span>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className="text-[10px] text-gray-400">{new Date(inc.createdAt).toLocaleString("es-ES")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stock alerts */}
            <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h2 className="text-base font-semibold text-[#1e2040]">Stock bajo</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
                    {allLowStockProducts.length} items
                  </span>
                  <Link href="/inventory" className="text-xs font-semibold text-[#4f6ef7] hover:underline flex items-center gap-0.5">
                    Inventario <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {lowStockVisible.map((s) => {
                  const pct =
                    s.minStock > 0 ? Math.round((Number(s.currentStock) / Number(s.minStock)) * 100) : 0;
                  return (
                    <div key={s.id} className="px-5 py-3 hover:bg-[#fafbff] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[#1e2040] truncate">{s.name}</span>
                        <span className="text-xs text-red-500 font-semibold ml-2 flex-shrink-0">
                          {s.currentStock}/{s.minStock} {s.unit}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity feed */}
            <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h2 className="text-base font-semibold text-[#1e2040]">Actividad reciente</h2>
                <Link href="/activity" className="text-xs font-semibold text-[#4f6ef7] hover:underline flex items-center gap-0.5">
                  Ver todo <ChevronRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {activityVisible.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-[#fafbff] transition-colors">
                    {a.actorAvatarUrl ? (
                      <img src={a.actorAvatarUrl} alt={a.actorName} className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5 object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#f0f3ff] text-[#4f6ef7] text-[10px] font-semibold flex items-center justify-center">
                        {(a.actorName || "U").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#1e2040] leading-tight">
                        <span className="font-semibold">{a.actorName}</span>{" "}
                        <span className="text-gray-500">actualizó «{a.title}»</span>
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleString("es-ES")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
    </ErpPageShell>
  );
}
