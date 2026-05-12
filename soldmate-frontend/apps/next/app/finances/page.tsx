"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CalendarDays,
  Download,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import {
  AppTopHeader,
  ErpPageShell,
  notify,
  useConfirm,
  EmptyState,
} from "../shared/ui";
import {
  financeApi,
  describeNetworkError,
  type DailyFinanceEntryResponse,
} from "app/lib/api";
import { useAuthStore } from "app/lib/store";

const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;

const TABS = ["Todos", "Ingresos", "Gastos"] as const;
type Tab = (typeof TABS)[number];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function financeRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 370);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function num(v: number | string): number {
  return typeof v === "number" ? v : Number(v);
}

function formatEuro(n: number): string {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function monthKeyFromEntryDate(entryDate: string): string {
  return entryDate.slice(0, 7);
}

function buildLast12MonthsChart(entries: DailyFinanceEntryResponse[]) {
  const now = new Date();
  const buckets: { month: string; key: string; ingresos: number; gastos: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    buckets.push({ key, month: MONTH_SHORT[m], ingresos: 0, gastos: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const e of entries) {
    const k = monthKeyFromEntryDate(e.entryDate);
    const b = byKey.get(k);
    if (b) {
      b.ingresos += num(e.revenue);
      b.gastos += num(e.expenses);
    }
  }
  return buckets.map(({ month, ingresos, gastos }) => ({
    month,
    ingresos,
    gastos,
    neto: ingresos - gastos,
  }));
}

function sumForMonthPrefix(entries: DailyFinanceEntryResponse[], yyyymm: string) {
  let revenue = 0;
  let expenses = 0;
  for (const e of entries) {
    if (!e.entryDate.startsWith(yyyymm)) continue;
    revenue += num(e.revenue);
    expenses += num(e.expenses);
  }
  return { revenue, expenses, profit: revenue - expenses };
}

function currentAndPrevMonthKeys() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const cur = `${y}-${String(m).padStart(2, "0")}`;
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const prev = `${py}-${String(pm).padStart(2, "0")}`;
  return { current: cur, previous: prev };
}

function pctDelta(cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return "sin cambio";
  if (prev === 0) return "sin mes anterior";
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p >= 0 ? "+" : ""}${p}% vs mes anterior`;
}

function exportDailyCSV(rows: DailyFinanceEntryResponse[]) {
  const headers = ["Fecha", "Ingresos", "Gastos", "Beneficio_dia", "Notas"];
  const lines = [
    headers.join(","),
    ...rows.map((r) => {
      const rev = num(r.revenue);
      const exp = num(r.expenses);
      const note = (r.notes ?? "").replace(/"/g, '""');
      return [r.entryDate, rev, exp, rev - exp, `"${note}"`].join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finanzas-cierres-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notify.success("CSV exportado");
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-[#1e2040]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatEuro(p.value)}
        </p>
      ))}
    </div>
  );
}

type DailyModalProps = {
  onClose: () => void;
  mode: "create" | "edit";
  initial?: DailyFinanceEntryResponse | null;
  onSubmit: (payload: { date: string; revenue: number; expenses: number; notes: string | null }) => Promise<void>;
  submitting: boolean;
};

function DailyFinanceModal({ onClose, mode, initial, onSubmit, submitting }: DailyModalProps) {
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? toIsoDate(new Date()));
  const [revenue, setRevenue] = useState(initial ? String(num(initial.revenue)) : "");
  const [expenses, setExpenses] = useState(initial ? String(num(initial.expenses)) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = Number(String(revenue).replace(",", "."));
    const x = Number(String(expenses).replace(",", "."));
    if (!Number.isFinite(r) || r < 0 || !Number.isFinite(x) || x < 0) {
      notify.error("Ingresos y gastos deben ser números mayores o iguales a 0.");
      return;
    }
    const n = notes.trim();
    await onSubmit({ date: entryDate, revenue: r, expenses: x, notes: n.length ? n : null });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-50 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-[#1e2040]">
              {mode === "create" ? "Registrar cierre del día" : "Editar cierre"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">Un registro por día: total ingresado y total gastado ese día.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Fecha</label>
              <input
                type="date"
                value={entryDate}
                onChange={(ev) => setEntryDate(ev.target.value)}
                disabled={mode === "edit"}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] disabled:cursor-not-allowed disabled:bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Ingresos del día (€)</label>
              <input
                type="text"
                inputMode="decimal"
                value={revenue}
                onChange={(ev) => setRevenue(ev.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Gastos del día (€)</label>
              <input
                type="text"
                inputMode="decimal"
                value={expenses}
                onChange={(ev) => setExpenses(ev.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
                maxLength={500}
                rows={3}
                className="min-h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
              />
            </div>
          </div>
          <div className="flex shrink-0 gap-3 border-t border-gray-50 px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-[#4f6ef7] py-2.5 text-sm font-semibold text-white hover:bg-[#3d5ae0] disabled:opacity-60"
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FinancesPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const canWrite = role === "OWNER" || role === "MANAGER";
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Todos");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; initial?: DailyFinanceEntryResponse | null } | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
  }, []);

  const financeQuery = useQuery({
    queryKey: ["finance-daily", token],
    queryFn: () => {
      const { from, to } = financeRange();
      return financeApi.listDaily(token!, from, to);
    },
    enabled: authReady && !!token,
  });

  const upsertMut = useMutation({
    mutationFn: async (p: { date: string; revenue: number; expenses: number; notes: string | null }) => {
      return financeApi.upsertDaily(token!, p.date, {
        revenue: p.revenue,
        expenses: p.expenses,
        notes: p.notes,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance-daily", token] });
      notify.success("Cierre guardado");
      setModal(null);
    },
    onError: (err) => notify.error(describeNetworkError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (date: string) => financeApi.deleteDaily(token!, date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance-daily", token] });
      notify.success("Cierre eliminado");
    },
    onError: (err) => notify.error(describeNetworkError(err)),
  });

  const entries = financeQuery.data ?? [];
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => (a.entryDate < b.entryDate ? 1 : a.entryDate > b.entryDate ? -1 : 0)),
    [entries],
  );

  const monthlyChart = useMemo(() => buildLast12MonthsChart(entries), [entries]);
  const { current: curMonth, previous: prevMonth } = useMemo(() => currentAndPrevMonthKeys(), []);
  const curTotals = useMemo(() => sumForMonthPrefix(entries, curMonth), [entries, curMonth]);
  const prevTotals = useMemo(() => sumForMonthPrefix(entries, prevMonth), [entries, prevMonth]);

  const daysInCurMonth = useMemo(() => {
    const [y, m] = curMonth.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }, [curMonth]);

  const daysRegisteredCurMonth = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.entryDate.startsWith(curMonth)) set.add(e.entryDate);
    }
    return set.size;
  }, [entries, curMonth]);

  const kpis = useMemo(() => {
    const revDelta = pctDelta(curTotals.revenue, prevTotals.revenue);
    const expDelta = pctDelta(curTotals.expenses, prevTotals.expenses);
    const profDelta = pctDelta(curTotals.profit, prevTotals.profit);
    return [
      {
        label: "Ingresos este mes",
        value: formatEuro(curTotals.revenue),
        sub: revDelta,
        up: curTotals.revenue >= prevTotals.revenue,
        color: "text-emerald-600",
        bg: "bg-emerald-50 border-emerald-100",
        Icon: TrendingUp,
      },
      {
        label: "Gastos este mes",
        value: formatEuro(curTotals.expenses),
        sub: expDelta,
        up: curTotals.expenses <= prevTotals.expenses,
        color: "text-red-500",
        bg: "bg-red-50 border-red-100",
        Icon: TrendingDown,
      },
      {
        label: "Beneficio neto (mes)",
        value: formatEuro(curTotals.profit),
        sub: profDelta,
        up: curTotals.profit >= prevTotals.profit,
        color: "text-[#4f6ef7]",
        bg: "bg-blue-50 border-blue-100",
        Icon: DollarSign,
      },
      {
        label: "Días registrados",
        value: `${daysRegisteredCurMonth} / ${daysInCurMonth}`,
        sub: "Cierres con datos en el mes en curso",
        up: daysRegisteredCurMonth > 0,
        color: "text-amber-600",
        bg: "bg-amber-50 border-amber-100",
        Icon: CalendarDays,
      },
    ];
  }, [curTotals, prevTotals, daysInCurMonth, daysRegisteredCurMonth]);

  const chartRangeLabel = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return `${from.toLocaleDateString("es-ES", { month: "short", year: "numeric" })} – ${to.toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`;
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedEntries.filter((row) => {
      if (activeTab === "Ingresos" && num(row.revenue) <= 0) return false;
      if (activeTab === "Gastos" && num(row.expenses) <= 0) return false;
      if (q) {
        const hay = `${row.entryDate} ${row.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedEntries, activeTab, search]);

  const headerMonthLabel = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const onDeleteRow = (row: DailyFinanceEntryResponse) => {
    void (async () => {
      const ok = await confirm("Eliminar cierre", `¿Eliminar el cierre del ${row.entryDate}?`, "danger");
      if (ok) deleteMut.mutate(row.entryDate);
    })();
  };

  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="px-4 sm:px-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1e2040]">Finanzas</h1>
              <p className="mt-0.5 text-sm text-gray-400">
                Cierres diarios manuales · resumen de {headerMonthLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setModal({ mode: "create", initial: null })}
                  className="flex items-center gap-2 rounded-xl border border-[#4f6ef7] bg-[#4f6ef7] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#3d5ae0]"
                >
                  <Plus size={16} />
                  Registrar cierre
                </button>
              )}
              <button
                type="button"
                onClick={() => exportDailyCSV(filteredRows)}
                disabled={filteredRows.length === 0}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={15} />
                Exportar CSV
              </button>
            </div>
          </div>

          {financeQuery.isLoading && (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="animate-spin" size={28} />
            </div>
          )}

          {financeQuery.isError && !financeQuery.isLoading && (
            <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {describeNetworkError(financeQuery.error)}
            </div>
          )}

          {!financeQuery.isLoading && financeQuery.isSuccess && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
                {kpis.map((k) => (
                  <div
                    key={k.label}
                    className={`rounded-2xl border p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] ${k.bg}`}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <p className="max-w-[70%] text-xs font-semibold uppercase leading-tight tracking-wider text-gray-500">
                        {k.label}
                      </p>
                      <k.Icon size={16} className={k.color} />
                    </div>
                    <p className="text-2xl font-bold text-[#1e2040]">{k.value}</p>
                    <p
                      className={`mt-1 text-xs font-medium ${
                        k.up ? "text-emerald-600" : "text-gray-500"
                      }`}
                    >
                      {k.sub}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-gray-50 bg-white p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-[#1e2040]">Ingresos vs gastos</h2>
                      <p className="mt-0.5 text-xs text-gray-400">Últimos 12 meses · {chartRangeLabel}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#4f6ef7]" />
                        Ingresos
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f87171]" />
                        Gastos
                      </span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyChart} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#9095a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ingresos" name="Ingresos" fill="#4f6ef7" radius={[5, 5, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="gastos" name="Gastos" fill="#f87171" radius={[5, 5, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-2xl border border-gray-50 bg-white p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)]">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold text-[#1e2040]">Beneficio neto</h2>
                    <p className="mt-0.5 text-xs text-gray-400">Tendencia mensual (ingresos − gastos)</p>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthlyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#9095a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="neto"
                        name="Beneficio"
                        stroke="#34d399"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#34d399", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#34d399" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-50 bg-white shadow-[0_2px_16px_rgba(149,157,165,0.10)]">
                <div className="flex flex-col gap-3 border-b border-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold text-[#1e2040]">Cierres por día</h2>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por fecha o notas…"
                      className="hidden rounded-xl border border-gray-100 px-3 py-1.5 text-xs outline-none focus:border-[#4f6ef7] sm:block"
                    />
                    <div className="flex gap-1 rounded-xl bg-[#f8f9fc] p-1">
                      {TABS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setActiveTab(t)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                            activeTab === t ? "bg-white text-[#4f6ef7] shadow-sm" : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {sortedEntries.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={CalendarDays}
                      title="Sin cierres todavía"
                      description={
                        canWrite
                          ? "Registra ingresos y gastos de cada día para ver gráficas y totales del mes."
                          : "Tu empresa aún no ha registrado cierres diarios. Solo el administrador puede añadirlos."
                      }
                      action={
                        canWrite ? (
                          <button
                            type="button"
                            onClick={() => setModal({ mode: "create", initial: null })}
                            className="rounded-xl bg-[#4f6ef7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3d5ae0]"
                          >
                            Registrar primer cierre
                          </button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 border-b border-gray-50 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:grid-cols-[1fr_auto_auto_auto_auto_auto] sm:gap-4 sm:px-5">
                      <span>Fecha / notas</span>
                      <span className="text-right">Ingresos</span>
                      <span className="text-right">Gastos</span>
                      <span className="hidden text-right sm:block">Neto</span>
                      <span className="text-right"> </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {filteredRows.map((row) => {
                        const rev = num(row.revenue);
                        const exp = num(row.expenses);
                        const net = rev - exp;
                        const fecha = new Date(row.entryDate + "T12:00:00").toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        });
                        return (
                          <div
                            key={row.id}
                            className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-3 py-3.5 transition-colors hover:bg-[#fafbff] sm:grid-cols-[1fr_auto_auto_auto_auto_auto] sm:gap-4 sm:px-5"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium capitalize text-[#1e2040]">{fecha}</p>
                              {row.notes ? (
                                <p className="mt-0.5 truncate text-xs text-gray-400">{row.notes}</p>
                              ) : (
                                <p className="mt-0.5 text-xs text-gray-300">—</p>
                              )}
                            </div>
                            <span className="whitespace-nowrap text-right text-sm font-semibold text-emerald-600">
                              {formatEuro(rev)}
                            </span>
                            <span className="whitespace-nowrap text-right text-sm font-semibold text-red-500">
                              {formatEuro(exp)}
                            </span>
                            <span
                              className={`hidden whitespace-nowrap text-right text-sm font-bold sm:block ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}
                            >
                              {formatEuro(net)}
                            </span>
                            <div className="flex justify-end gap-1">
                              {canWrite && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setModal({ mode: "edit", initial: row })}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#4f6ef7]"
                                    aria-label="Editar"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteRow(row)}
                                    disabled={deleteMut.isPending}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                                    aria-label="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {modal && (
        <DailyFinanceModal
          mode={modal.mode}
          initial={modal.initial ?? undefined}
          submitting={upsertMut.isPending}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            await upsertMut.mutateAsync(payload);
          }}
        />
      )}
      {confirmDialog}
    </ErpPageShell>
  );
}
