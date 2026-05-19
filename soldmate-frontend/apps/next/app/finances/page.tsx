"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Lock,
  Unlock,
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
  type DailyFinanceUpsertBody,
} from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { DailyFinanceModal } from "./daily-finance-modal";
import { downloadDailyFinanceCsv } from "./export-daily-finance-csv";

const CHART_DAYS = 31;

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

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

function formatEuro(n: number): string {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function normalizeEntry(r: DailyFinanceEntryResponse): DailyFinanceEntryResponse {
  return {
    ...r,
    incomeChannels: r.incomeChannels ?? [],
    expenseLines: r.expenseLines ?? [],
    finalBalance: num(r.finalBalance),
    cashOpening: num(r.cashOpening),
    cashClosing: num(r.cashClosing),
    revenue: num(r.revenue),
    expenses: num(r.expenses),
    createdBy: r.createdBy ?? null,
    updatedBy: r.updatedBy ?? null,
  };
}

function buildDailyChart(entries: DailyFinanceEntryResponse[]) {
  const now = new Date();
  const buckets: { day: string; key: string; ingresos: number; gastos: number; saldoFinal: number }[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toIsoDate(d);
    const day = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    buckets.push({ key, day, ingresos: 0, gastos: 0, saldoFinal: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const e of entries) {
    const b = byKey.get(e.entryDate);
    if (b) {
      b.ingresos = num(e.revenue);
      b.gastos = num(e.expenses);
      b.saldoFinal = num(e.finalBalance);
    }
  }
  return buckets.map(({ day, ingresos, gastos, saldoFinal }) => ({
    day,
    ingresos,
    gastos,
    saldoFinal,
  }));
}

function sumForMonthPrefix(entries: DailyFinanceEntryResponse[], yyyymm: string) {
  let revenue = 0;
  let expenses = 0;
  let finalBalance = 0;
  for (const e of entries) {
    if (!e.entryDate.startsWith(yyyymm)) continue;
    revenue += num(e.revenue);
    expenses += num(e.expenses);
    finalBalance += num(e.finalBalance);
  }
  return { revenue, expenses, finalBalance };
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

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
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

export default function FinancesPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const canWrite = role === "OWNER" || role === "MANAGER" || role === "DEV";
  const isOwner = role === "OWNER" || role === "DEV";
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; initial?: DailyFinanceEntryResponse | null } | null>(
    null,
  );
  const [lockMonthInput, setLockMonthInput] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const { confirm, dialog: confirmDialog } = useConfirm();

  const confirmOutlier = useCallback(
    async (description: string) => confirm("Revisar importe", description, "warning"),
    [confirm],
  );

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
  }, []);

  const financeQuery = useQuery({
    queryKey: ["finance-daily", token],
    queryFn: async () => {
      const { from, to } = financeRange();
      const rows = await financeApi.listDaily(token!, from, to);
      return rows.map(normalizeEntry);
    },
    enabled: authReady && !!token,
  });

  const lockedMonthsQuery = useQuery({
    queryKey: ["finance-locked-months", token],
    queryFn: () => financeApi.listLockedMonths(token!),
    enabled: authReady && !!token,
  });

  const incomeChannelTemplatesQuery = useQuery({
    queryKey: ["finance-income-channel-templates", token],
    queryFn: () => financeApi.listIncomeChannelTemplates(token!),
    enabled: authReady && !!token,
  });

  const upsertMut = useMutation({
    mutationFn: async (p: { date: string; body: DailyFinanceUpsertBody }) => financeApi.upsertDaily(token!, p.date, p.body),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["finance-daily", token] });
      void qc.invalidateQueries({ queryKey: ["finance-income-channel-templates", token] });
      if (res.warnings?.length) {
        notify.info(res.warnings.join(" · "));
      }
      notify.success("Cierre guardado");
      setModal(null);
    },
    onError: (err) => notify.error(describeNetworkError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (date: string) => financeApi.deleteDaily(token!, date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance-daily", token] });
      notify.success("Cierre archivado");
    },
    onError: (err) => notify.error(describeNetworkError(err)),
  });

  const lockMut = useMutation({
    mutationFn: (ym: string) => financeApi.lockMonth(token!, ym),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance-locked-months", token] });
      notify.success("Mes bloqueado");
    },
    onError: (err) => notify.error(describeNetworkError(err)),
  });

  const unlockMut = useMutation({
    mutationFn: (ym: string) => financeApi.unlockMonth(token!, ym),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance-locked-months", token] });
      notify.success("Mes desbloqueado");
    },
    onError: (err) => notify.error(describeNetworkError(err)),
  });

  const entries = financeQuery.data ?? [];
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => (a.entryDate < b.entryDate ? 1 : a.entryDate > b.entryDate ? -1 : 0)),
    [entries],
  );

  const dailyChart = useMemo(() => buildDailyChart(entries), [entries]);
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
    const saldoDelta = pctDelta(curTotals.finalBalance, prevTotals.finalBalance);
    return [
      {
        label: "Ingresos (canales) este mes",
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
        label: "Saldo final acumulado (mes)",
        value: formatEuro(curTotals.finalBalance),
        sub: saldoDelta,
        up: curTotals.finalBalance >= prevTotals.finalBalance,
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
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (CHART_DAYS - 1));
    return `${from.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${to.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedEntries;
    return sortedEntries.filter((row) => {
      const expHay = (row.expenseLines ?? []).map((l) => `${l.detail}`).join(" ");
      const hay = `${row.entryDate} ${row.notes ?? ""} ${expHay}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sortedEntries, search]);

  const headerMonthLabel = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const lockedMonths = lockedMonthsQuery.data ?? [];

  const onDeleteRow = (row: DailyFinanceEntryResponse) => {
    void (async () => {
      const ok = await confirm("Archivar cierre", `¿Archivar el cierre del ${row.entryDate}? Podrás volver a registrar ese día después.`, "danger");
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
                Cierre de caja diario · resumen de {headerMonthLabel}
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
                onClick={() => {
                  downloadDailyFinanceCsv(filteredRows);
                  notify.success("CSV exportado");
                }}
                disabled={filteredRows.length === 0}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={15} />
                Exportar CSV
              </button>
            </div>
          </div>

          {isOwner && (
            <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-900">
              <p className="mb-2 font-semibold text-[#1e2040]">Bloqueo de meses contables</p>
              <p className="mb-3 text-xs text-gray-600">
                Un mes bloqueado impide que managers editen cierres de ese mes; tú como dueño sí puedes editar o desbloquear.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Mes</label>
                  <input
                    type="month"
                    value={lockMonthInput}
                    onChange={(e) => setLockMonthInput(e.target.value)}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={lockMut.isPending}
                  onClick={() => lockMut.mutate(lockMonthInput)}
                  className="flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  <Lock size={14} /> Bloquear
                </button>
              </div>
              {lockedMonths.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {lockedMonths.map((ym) => (
                    <span
                      key={ym}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-900"
                    >
                      {ym}
                      <button
                        type="button"
                        disabled={unlockMut.isPending}
                        onClick={() => unlockMut.mutate(ym)}
                        className="rounded p-0.5 text-amber-700 hover:bg-amber-100"
                        title="Desbloquear"
                      >
                        <Unlock size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

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
                    <p className={`mt-1 text-xs font-medium ${k.up ? "text-emerald-600" : "text-gray-500"}`}>{k.sub}</p>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-gray-50 bg-white p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-[#1e2040]">Ingresos (canales) vs gastos</h2>
                      <p className="mt-0.5 text-xs text-gray-400">Vista diaria · {chartRangeLabel}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#4f6ef7]" />
                        Canales
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f87171]" />
                        Gastos
                      </span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={dailyChart} barGap={2} margin={{ bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#9095a0", fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        angle={-40}
                        textAnchor="end"
                        height={52}
                      />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ingresos" name="Canales" fill="#4f6ef7" radius={[4, 4, 0, 0]} maxBarSize={14} />
                      <Bar dataKey="gastos" name="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-2xl border border-gray-50 bg-white p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)]">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold text-[#1e2040]">Saldo final diario</h2>
                    <p className="mt-0.5 text-xs text-gray-400">Saldo de caja por día de cierre</p>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={dailyChart} margin={{ bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#9095a0", fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        angle={-40}
                        textAnchor="end"
                        height={52}
                      />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="saldoFinal"
                        name="Saldo final"
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
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por fecha, notas o gastos…"
                    className="w-full rounded-xl border border-gray-100 px-3 py-1.5 text-xs outline-none focus:border-[#4f6ef7] sm:max-w-xs"
                  />
                </div>

                {sortedEntries.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={CalendarDays}
                      title="Sin cierres todavía"
                      description={
                        canWrite
                          ? "Registra el cierre de caja de cada día (efectivo, canales, gastos) para ver gráficas y totales."
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
                    {/* Cabecera: flex + anchos fijos evita solaparse con la columna de acciones (grid + hidden rompía el flujo). */}
                    <div className="hidden border-b border-gray-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:flex sm:items-center sm:gap-3 sm:px-5">
                      <span className="min-w-0 flex-1">Fecha / notas</span>
                      <span className="hidden w-[5.75rem] shrink-0 text-right lg:block">Apertura</span>
                      <span className="w-[5.75rem] shrink-0 text-right">Canales</span>
                      <span className="w-[5.75rem] shrink-0 text-right">Gastos</span>
                      <span className="hidden w-[5.75rem] shrink-0 text-right xl:block">Cierre</span>
                      <span className="hidden w-[5.75rem] shrink-0 text-right lg:block">Saldo</span>
                      <span className="w-[5.25rem] shrink-0 sm:text-right" aria-hidden>
                        {" "}
                      </span>
                    </div>
                    <div className="flex border-b border-gray-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:hidden">
                      <span className="min-w-0 flex-1">Día / notas</span>
                      <span className="w-[5.25rem] shrink-0 text-right">Canales</span>
                      <span className="w-[5.25rem] shrink-0 text-right">Gastos</span>
                      <span className="w-[5.25rem] shrink-0 text-right">Saldo</span>
                      <span className="w-[5.25rem] shrink-0" aria-hidden />
                    </div>
                    <div className="divide-y divide-gray-50">
                      {filteredRows.map((row) => {
                        const rev = num(row.revenue);
                        const exp = num(row.expenses);
                        const saldo = num(row.finalBalance);
                        const fecha = new Date(row.entryDate + "T12:00:00").toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        });
                        const nExp = row.expenseLines?.length ?? 0;
                        return (
                          <div
                            key={row.id}
                            className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[#fafbff] sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-3.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium capitalize text-[#1e2040]">
                                {fecha}
                                {nExp > 0 && (
                                  <span className="ml-2 text-[10px] font-normal text-[#4f6ef7]">({nExp} gastos)</span>
                                )}
                                <span className="ml-2 text-[10px] font-normal text-gray-400">
                                  ({row.incomeChannels?.length ?? 0} canales)
                                </span>
                              </p>
                              {row.notes ? (
                                <p className="mt-0.5 truncate text-xs text-gray-400">{row.notes}</p>
                              ) : (
                                <p className="mt-0.5 text-xs text-gray-300">—</p>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-gray-100 pt-2 sm:flex-nowrap sm:justify-end sm:border-t-0 sm:pt-0">
                              <div className="flex flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:flex-nowrap sm:gap-3">
                                <span className="hidden w-[5.75rem] shrink-0 whitespace-nowrap text-right text-xs font-medium text-gray-500 lg:block">
                                  {formatEuro(num(row.cashOpening))}
                                </span>
                                <span className="w-[5.75rem] shrink-0 whitespace-nowrap text-right text-sm font-semibold text-emerald-600">
                                  {formatEuro(rev)}
                                </span>
                                <span className="w-[5.75rem] shrink-0 whitespace-nowrap text-right text-sm font-semibold text-red-500">
                                  {formatEuro(exp)}
                                </span>
                                <span
                                  className={`block w-[5.75rem] shrink-0 whitespace-nowrap text-right text-sm font-bold sm:hidden ${saldo >= 0 ? "text-emerald-600" : "text-red-500"}`}
                                >
                                  {formatEuro(saldo)}
                                </span>
                                <span className="hidden w-[5.75rem] shrink-0 whitespace-nowrap text-right text-xs font-medium text-gray-500 xl:block">
                                  {formatEuro(num(row.cashClosing))}
                                </span>
                                <span
                                  className={`hidden w-[5.75rem] shrink-0 whitespace-nowrap text-right text-sm font-bold lg:block ${saldo >= 0 ? "text-emerald-600" : "text-red-500"}`}
                                >
                                  {formatEuro(saldo)}
                                </span>
                              </div>
                              {canWrite ? (
                                <div className="flex shrink-0 items-center justify-end gap-0.5 sm:w-[5.25rem]">
                                  <button
                                    type="button"
                                    onClick={() => setModal({ mode: "edit", initial: row })}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#4f6ef7]"
                                    aria-label="Editar"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteRow(row)}
                                    disabled={deleteMut.isPending}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                                    aria-label="Archivar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ) : (
                                <div className="hidden w-[5.25rem] shrink-0 sm:block" aria-hidden />
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

      {modal && token && (
        <DailyFinanceModal
          key={`${modal.mode}-${modal.initial?.entryDate ?? "new"}`}
          mode={modal.mode}
          initial={modal.initial ?? undefined}
          submitting={upsertMut.isPending}
          onClose={() => setModal(null)}
          recentEntries={entries}
          confirmOutlier={confirmOutlier}
          incomeChannelTemplateNames={incomeChannelTemplatesQuery.data ?? []}
          incomeChannelTemplatesLoading={incomeChannelTemplatesQuery.isLoading}
          token={token}
          onIncomeChannelTemplatesUpdated={() =>
            void qc.invalidateQueries({ queryKey: ["finance-income-channel-templates", token] })
          }
          canSaveIncomeTemplates={canWrite}
          onSubmit={async (payload) => {
            await upsertMut.mutateAsync({ date: payload.date, body: payload.body });
          }}
        />
      )}
      {confirmDialog}
    </ErpPageShell>
  );
}
