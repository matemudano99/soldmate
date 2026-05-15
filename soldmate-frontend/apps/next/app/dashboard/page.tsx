"use client";

import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  DollarSign, Wrench, Package, Users, TrendingUp,
  ChevronRight, Circle,
  CheckCircle2, Clock, Activity, CloudRain,
  FileText
} from "lucide-react";
import { ErpPageShell, AppTopHeader, PageListSearchField, KpiCard, SectionCard } from "../shared/ui";
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
  financeApi,
  type ActivityItemResponse,
  type BusinessProfileResponse,
  type DashboardSummaryResponse,
  type PredictiveDay,
  type ProductResponse,
  type ForecastImpactDay,
  type DailyFinanceEntryResponse
} from "app/lib/api";
import { compareProductsByCategoryThenName } from "app/lib/inventorySort";
import { isBusinessOpenNow } from "app/lib/weather";

const RAIN_DASHBOARD_MIN_MM = 5.0;

function calendarYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isForecastDateAfterToday(dateIso: string): boolean {
  const ymd = dateIso.slice(0, 10);
  return ymd > calendarYmdLocal(new Date());
}

const QUICK_ACTIONS = [
  { label: "Cierre de caja",    href: "/finances",      color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", Icon: DollarSign },
  { label: "Ver inventario",    href: "/inventory",     color: "bg-blue-50 text-[#4f6ef7] hover:bg-blue-100",         Icon: Package    },
  { label: "Subir documento",   href: "/documents",     color: "bg-violet-50 text-violet-500 hover:bg-violet-100",    Icon: FileText   },
  { label: "Reportar avería",   href: "/incidents/new", color: "bg-red-50 text-red-500 hover:bg-red-100",             Icon: Wrench     },
  { label: "Ver equipo",        href: "/people",        color: "bg-amber-50 text-amber-600 hover:bg-amber-100",       Icon: Users      },
];

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

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [predictions, setPredictions] = useState<PredictiveDay[]>([]);
  const [allLowStockProducts, setAllLowStockProducts] = useState<ProductResponse[]>([]);
  const [activityFeedFull, setActivityFeedFull] = useState<ActivityItemResponse[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileResponse | null>(null);
  const [weatherImpactRaw, setWeatherImpactRaw] = useState<ForecastImpactDay[]>([]);
  const [todayFinance, setTodayFinance] = useState<DailyFinanceEntryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashSearch, setDashSearch] = useState("");

  React.useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        setError(null);
        const todayStr = calendarYmdLocal(new Date());
        
        const [summaryRes, weatherRes, predictionRes, productsRes, activityRes, businessRes, financeRes] = await Promise.all([
          dashboardApi.getSummary(token!),
          forecastApi.getImpact(token!),
          predictionsApi.getOperations(token!),
          inventoryApi.getAll(token!),
          activityApi.getAll(token!),
          businessProfileApi.get(token!),
          financeApi.listDaily(token!, todayStr, todayStr).catch(() => [])
        ]);
        
        setSummary(summaryRes);
        setWeatherImpactRaw(weatherRes);
        setPredictions(predictionRes.slice(0, 3));
        setAllLowStockProducts([...productsRes].sort(compareProductsByCategoryThenName).filter((p) => p.lowStock));
        setActivityFeedFull(activityRes);
        setBusinessProfile(businessRes);
        setTodayFinance(financeRes[0] || null);
      } catch (err) {
        setError(describeNetworkError(err));
      }
    }
    load();
  }, [token]);

  const dq = dashSearch.trim().toLowerCase();

  const incidentsVisible = useMemo(() => {
    const list = summary?.recentIncidents ?? [];
    if (!dq) return list.slice(0, 5);
    return list.filter((inc) => {
      const hay = `${inc.title} ${inc.priority} ${inc.status} ${inc.reportedBy ?? ""}`.toLowerCase();
      return hay.includes(dq);
    }).slice(0, 5);
  }, [summary?.recentIncidents, dq]);

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
    return rows.slice(0, 6);
  }, [allLowStockProducts, dq]);

  const activityVisible = useMemo(() => {
    if (!dq) return activityFeedFull.slice(0, 6);
    return activityFeedFull
      .filter((a) => {
        const hay = `${a.title ?? ""} ${a.actorName ?? ""} ${a.actorEmail ?? ""} ${a.type}`.toLowerCase();
        return hay.includes(dq);
      })
      .slice(0, 6);
  }, [activityFeedFull, dq]);

  const rainForecastDays = useMemo(() => {
    return [...weatherImpactRaw]
      .filter((d) => isForecastDateAfterToday(d.date) && d.rain >= RAIN_DASHBOARD_MIN_MM)
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
          placeholder="Filtrar en esta página…"
          className="max-w-xl"
        />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Caja de hoy"
            value={todayFinance ? `€${todayFinance.revenue.toLocaleString("es-ES")}` : "Sin cierre"}
            Icon={DollarSign}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50 border-emerald-100"
          />
          <KpiCard
            label="Stock bajo"
            value={`${summary?.lowStockProducts ?? 0} items`}
            Icon={Package}
            colorClass="text-amber-500"
            bgClass="bg-amber-50 border-amber-100"
          />
          <KpiCard
            label="Incidencias activas"
            value={String((summary?.openIncidents ?? 0) + (summary?.inProgressIncidents ?? 0))}
            Icon={Wrench}
            colorClass="text-red-500"
            bgClass="bg-red-50 border-red-100"
          />
          <KpiCard
            label="Equipo activo"
            value={`${summary?.activeContacts ?? 0} / ${summary?.totalContacts ?? 0}`}
            Icon={Users}
            colorClass="text-blue-500"
            bgClass="bg-blue-50 border-blue-100"
          />
        </div>

        <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
          {/* Quick actions */}
          <SectionCard title="Acciones rápidas">
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
          </SectionCard>

          {/* Predictive operations */}
          <SectionCard title="Predicción operativa (próximos días)">
            <div className="grid sm:grid-cols-3 gap-3">
              {predictions.map((p) => {
                const isRainy = p.weatherImpact < 100;
                return (
                  <div key={p.date} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-[#1e2040] mb-2">{p.date}</p>
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-600 flex justify-between">
                        <span>Demanda esp.</span>
                        <span className="font-semibold text-[#1e2040]">€{Math.round(p.predictedDemand)}</span>
                      </p>
                      <p className="text-xs text-gray-600 flex justify-between">
                        <span>Staff req.</span>
                        <span className="font-semibold text-[#1e2040]">{p.suggestedStaff}</span>
                      </p>
                    </div>
                    {isRainy && (
                      <div className="mt-3 inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-1 rounded-md text-[10px] font-medium w-full justify-center">
                        <CloudRain size={12} /> Impacto por clima
                      </div>
                    )}
                  </div>
                )
              })}
              {predictions.length === 0 && (
                <p className="col-span-3 text-center text-sm text-gray-500 py-6">
                  No hay datos predictivos suficientes (se requiere histórico de ventas).
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Bottom row */}
        <div className="grid lg:grid-cols-[1.2fr_1fr_1fr] gap-4">
          <SectionCard
            title="Incidencias recientes"
            noPadding
            className="flex flex-col"
          >
            <div className="divide-y divide-gray-50 flex-1">
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
              {incidentsVisible.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500">No hay incidencias.</div>
              )}
            </div>
            <div className="p-3 border-t border-gray-50 bg-gray-50/50 text-center">
              <Link href="/incidents" className="text-xs font-semibold text-[#4f6ef7] hover:underline">Ver todas</Link>
            </div>
          </SectionCard>

          <SectionCard
            title="Stock bajo"
            noPadding
            className="flex flex-col"
          >
            <div className="divide-y divide-gray-50 flex-1">
              {lowStockVisible.map((s) => {
                const pct = s.minStock > 0 ? Math.round((Number(s.currentStock) / Number(s.minStock)) * 100) : 0;
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
              {lowStockVisible.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500">Todo el stock está correcto.</div>
              )}
            </div>
            <div className="p-3 border-t border-gray-50 bg-gray-50/50 text-center">
              <Link href="/inventory" className="text-xs font-semibold text-[#4f6ef7] hover:underline">Ir a inventario</Link>
            </div>
          </SectionCard>

          <SectionCard
            title="Actividad"
            noPadding
            className="flex flex-col"
          >
            <div className="divide-y divide-gray-50 flex-1">
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
              {activityVisible.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500">No hay actividad.</div>
              )}
            </div>
            <div className="p-3 border-t border-gray-50 bg-gray-50/50 text-center">
              <Link href="/activity" className="text-xs font-semibold text-[#4f6ef7] hover:underline">Ver feed completo</Link>
            </div>
          </SectionCard>
        </div>
      </main>
    </ErpPageShell>
  );
}
