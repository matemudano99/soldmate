"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import type {
  DailyFinanceEntryResponse,
  DailyFinanceIncomeChannelBody,
  DailyFinanceUpsertBody,
  DailyFinanceUpsertExpenseLineBody,
} from "app/lib/api";
import { describeNetworkError, FINANCE_MAX_DAILY_AMOUNT, financeApi } from "app/lib/api";
import { notify } from "../shared/ui";

function parseDecimal(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ExpenseDraft = { detail: string; amount: string };
type ChannelDraft = { name: string; amount: string };

const DEFAULT_CHANNEL_NAME = "Datáfono (TPV)";

function expensesFromInitial(initial: DailyFinanceEntryResponse | null | undefined): ExpenseDraft[] {
  if (!initial?.expenseLines?.length) return [];
  return initial.expenseLines.map((l) => ({ detail: l.detail, amount: String(l.amount) }));
}

function channelsFromInitial(initial: DailyFinanceEntryResponse | null | undefined): ChannelDraft[] {
  if (!initial?.incomeChannels?.length) return [{ name: DEFAULT_CHANNEL_NAME, amount: "" }];
  return initial.incomeChannels.map((c) => ({ name: c.name, amount: String(c.amount) }));
}

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

function channelNamesFromDrafts(rows: ChannelDraft[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const n = r.name.trim();
    if (!n) continue;
    const k = normKey(n);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

export type DailyFinanceModalProps = {
  onClose: () => void;
  mode: "create" | "edit";
  initial?: DailyFinanceEntryResponse | null;
  submitting: boolean;
  onSubmit: (payload: { date: string; body: DailyFinanceUpsertBody }) => Promise<void>;
  recentEntries: DailyFinanceEntryResponse[];
  confirmOutlier: (description: string) => Promise<boolean>;
  incomeChannelTemplateNames: string[];
  incomeChannelTemplatesLoading: boolean;
  token: string;
  onIncomeChannelTemplatesUpdated: () => void;
  canSaveIncomeTemplates: boolean;
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

function channelTotalFromEntry(e: DailyFinanceEntryResponse): number {
  return (e.incomeChannels ?? []).reduce((acc, c) => acc + num(c.amount), 0);
}

function mergeEditChannels(entry: DailyFinanceEntryResponse, templateNames: string[]): ChannelDraft[] {
  const entryByKey = new Map<string, { name: string; amount: number }>();
  for (const c of entry.incomeChannels ?? []) {
    entryByKey.set(normKey(c.name), { name: c.name, amount: num(c.amount) });
  }
  const seen = new Set<string>();
  const out: ChannelDraft[] = [];
  for (const t of templateNames) {
    const k = normKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const m = entryByKey.get(k);
    out.push({ name: m?.name ?? t.trim(), amount: m != null ? String(m.amount) : "" });
  }
  for (const c of entry.incomeChannels ?? []) {
    const k = normKey(c.name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: c.name, amount: String(c.amount) });
  }
  return out;
}

export function DailyFinanceModal({
  onClose,
  mode,
  initial,
  submitting,
  onSubmit,
  recentEntries,
  confirmOutlier,
  incomeChannelTemplateNames,
  incomeChannelTemplatesLoading,
  token,
  onIncomeChannelTemplatesUpdated,
  canSaveIncomeTemplates,
}: DailyFinanceModalProps) {
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 1);
  const minDate = new Date(today);
  minDate.setFullYear(minDate.getFullYear() - 10);

  const templateSig = useMemo(() => incomeChannelTemplateNames.join("\0"), [incomeChannelTemplateNames]);
  const createSeededRef = useRef(false);
  const editSeededRef = useRef(false);
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(() => {
    createSeededRef.current = false;
    editSeededRef.current = false;
  }, [mode, initial?.entryDate]);

  useEffect(() => {
    if (mode !== "create" || initial) return;
    if (incomeChannelTemplatesLoading) return;
    if (createSeededRef.current) return;
    createSeededRef.current = true;
    const names = incomeChannelTemplateNames.length ? incomeChannelTemplateNames : [DEFAULT_CHANNEL_NAME];
    setChannels(names.map((n) => ({ name: n, amount: "" })));
  }, [mode, initial, incomeChannelTemplatesLoading, templateSig]);

  useEffect(() => {
    if (mode !== "edit" || !initial) return;
    if (incomeChannelTemplatesLoading) return;
    if (editSeededRef.current) return;
    editSeededRef.current = true;
    setChannels(mergeEditChannels(initial, incomeChannelTemplateNames));
  }, [mode, initial?.id, incomeChannelTemplatesLoading, templateSig, initial, incomeChannelTemplateNames]);

  const handleSaveIncomeTemplate = async () => {
    const names = channelNamesFromDrafts(channels);
    if (!names.length) {
      notify.error("Añade al menos un nombre de canal para guardar la plantilla.");
      return;
    }
    setSavingTpl(true);
    try {
      await financeApi.putIncomeChannelTemplates(token, names);
      notify.success("Plantilla de canales guardada para toda la empresa.");
      onIncomeChannelTemplatesUpdated();
    } catch (err) {
      notify.error(describeNetworkError(err));
    } finally {
      setSavingTpl(false);
    }
  };

  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? toIsoDate(today));
  const [cashOpening, setCashOpening] = useState(initial ? String(initial.cashOpening) : "");
  const [channels, setChannels] = useState<ChannelDraft[]>(() => channelsFromInitial(initial));
  const [cashClosing, setCashClosing] = useState(initial ? String(initial.cashClosing) : "");
  const [expenses, setExpenses] = useState<ExpenseDraft[]>(() => expensesFromInitial(initial));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const saldoPreview = useMemo(() => {
    const o = parseDecimal(cashOpening) ?? 0;
    let channelsIncome = 0;
    for (const row of channels) {
      const a = parseDecimal(row.amount);
      if (a != null && row.name.trim()) channelsIncome += a;
    }
    const c = parseDecimal(cashClosing) ?? 0;
    let gastos = 0;
    for (const row of expenses) {
      const a = parseDecimal(row.amount);
      if (a != null && row.detail.trim()) gastos += a;
    }
    return round2(-o + channelsIncome + gastos + c);
  }, [cashOpening, channels, cashClosing, expenses]);

  const medianRecentChannels = useMemo(() => {
    const vals = recentEntries
      .filter((e) => e.entryDate !== entryDate)
      .map((e) => channelTotalFromEntry(e))
      .filter((r) => r > 0)
      .sort((a, b) => a - b);
    if (!vals.length) return 0;
    return vals[Math.floor(vals.length / 2)] ?? 0;
  }, [recentEntries, entryDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const o = parseDecimal(cashOpening);
    const c = parseDecimal(cashClosing);
    if (o == null || o < 0 || c == null || c < 0) {
      notify.error("Todos los importes principales deben ser números válidos ≥ 0.");
      return;
    }
    const incomeChannels: DailyFinanceIncomeChannelBody[] = [];
    for (const row of channels) {
      if (!row.name.trim() && !row.amount.trim()) continue;
      const amt = parseDecimal(row.amount);
      if (!row.name.trim() || amt == null || amt < 0) {
        notify.error("Cada canal debe tener nombre e importe válido (≥ 0).");
        return;
      }
      incomeChannels.push({ name: row.name.trim(), amount: round2(amt) });
    }
    if (!incomeChannels.length) {
      notify.error("Debes añadir al menos un canal de ingreso.");
      return;
    }
    const ch = round2(incomeChannels.reduce((s, l) => s + l.amount, 0));
    if (ch > FINANCE_MAX_DAILY_AMOUNT) {
      notify.error("La suma de ingresos por canales supera el máximo permitido.");
      return;
    }

    const expenseLines: DailyFinanceUpsertExpenseLineBody[] = [];
    for (const row of expenses) {
      if (!row.detail.trim() && !row.amount.trim()) continue;
      const amt = parseDecimal(row.amount);
      if (!row.detail.trim() || amt == null || amt < 0) {
        notify.error("Cada gasto debe tener detalle e importe válido (≥ 0).");
        return;
      }
      expenseLines.push({ detail: row.detail.trim(), amount: round2(amt) });
    }
    const gastosSum = expenseLines.reduce((s, l) => s + l.amount, 0);
    if (gastosSum > FINANCE_MAX_DAILY_AMOUNT) {
      notify.error("La suma de gastos supera el máximo permitido.");
      return;
    }

    if (medianRecentChannels > 0 && ch > medianRecentChannels * 5) {
      const ok = await confirmOutlier(
        `Los ingresos por canales (${ch.toLocaleString("es-ES")} €) superan 5× la mediana reciente (${medianRecentChannels.toLocaleString("es-ES")} €). ¿Guardar?`,
      );
      if (!ok) return;
    }

    const body: DailyFinanceUpsertBody = {
      cashOpening: round2(o),
      incomeChannels,
      cashClosing: round2(c),
      notes: notes.trim() ? notes.trim() : null,
      expenseLines: expenseLines.length ? expenseLines : [],
    };
    await onSubmit({ date: entryDate, body });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-4 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-w-xl"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-50 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-[#1e2040]">
              {mode === "create" ? "Cierre de caja del día" : "Editar cierre de caja"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Efectivo al abrir y al cierre, ingresos por datáfono y delivery, gastos/sueldos con detalle. Saldo final =
              -efectivo al abrir + ingresos canales + gastos + efectivo al cierre.
            </p>
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
                min={toIsoDate(minDate)}
                max={toIsoDate(maxDate)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] disabled:cursor-not-allowed disabled:bg-gray-50"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Efectivo al abrir (€)" value={cashOpening} onChange={setCashOpening} />
              <Field label="Efectivo al cierre (€)" value={cashClosing} onChange={setCashClosing} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ingresos por canal (€)</p>
              <p className="mb-2 text-xs text-gray-400">
                Los nombres de canal se recuerdan para toda la empresa (se actualizan al guardar un cierre o con el botón de
                plantilla). Puedes añadir o quitar filas en cada día.
              </p>
              {mode === "create" && incomeChannelTemplatesLoading && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
                  <Loader2 className="size-3.5 animate-spin" /> Cargando canales guardados…
                </p>
              )}
              <div className="space-y-2">
                {channels.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 bg-[#fafbff] p-2">
                    <input
                      placeholder="Canal (ej. Just Eat)"
                      value={row.name}
                      onChange={(ev) =>
                        setChannels((prev) => prev.map((r, i) => (i === idx ? { ...r, name: ev.target.value } : r)))
                      }
                      className="min-w-[140px] flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                    />
                    <input
                      placeholder="Importe €"
                      value={row.amount}
                      onChange={(ev) =>
                        setChannels((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: ev.target.value } : r)))
                      }
                      className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      inputMode="decimal"
                    />
                    <button
                      type="button"
                      onClick={() => setChannels((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Quitar canal"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setChannels((prev) => [...prev, { name: "", amount: "" }])}
                  className="flex items-center gap-1 text-xs font-semibold text-[#4f6ef7]"
                >
                  <Plus size={14} /> Añadir canal
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Gastos / sueldos</p>
              <p className="mb-2 text-xs text-gray-400">Detalle + importe (cada línea suma al total de gastos del día).</p>
              <div className="space-y-2">
                {expenses.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 bg-[#fafbff] p-2">
                    <input
                      placeholder="Detalle (ej. sueldo cocina)"
                      value={row.detail}
                      onChange={(ev) =>
                        setExpenses((prev) => prev.map((r, i) => (i === idx ? { ...r, detail: ev.target.value } : r)))
                      }
                      className="min-w-[140px] flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                    />
                    <input
                      placeholder="Importe €"
                      value={row.amount}
                      onChange={(ev) =>
                        setExpenses((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: ev.target.value } : r)))
                      }
                      className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      inputMode="decimal"
                    />
                    <button
                      type="button"
                      onClick={() => setExpenses((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Quitar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setExpenses((prev) => [...prev, { detail: "", amount: "" }])}
                  className="flex items-center gap-1 text-xs font-semibold text-[#4f6ef7]"
                >
                  <Plus size={14} /> Añadir gasto
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#4f6ef7]/30 bg-blue-50/60 px-3 py-2.5 text-sm">
              <span className="font-semibold text-[#1e2040]">Saldo final (vista previa): </span>
              <span className="font-bold text-[#4f6ef7]">{formatEuro(saldoPreview)}</span>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
                maxLength={500}
                rows={2}
                className="min-h-20 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-gray-50 px-4 py-4 sm:px-6">
            {canSaveIncomeTemplates && (
              <button
                type="button"
                onClick={() => void handleSaveIncomeTemplate()}
                disabled={savingTpl || submitting || incomeChannelTemplatesLoading}
                className="w-full rounded-xl border border-[#4f6ef7]/40 bg-[#fafbff] py-2.5 text-sm font-semibold text-[#4f6ef7] hover:bg-blue-50 disabled:opacity-50"
              >
                {savingTpl ? "Guardando plantilla…" : "Guardar plantilla de canales (empresa)"}
              </button>
            )}
            <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || (mode === "create" && incomeChannelTemplatesLoading)}
              className="flex-1 rounded-xl bg-[#4f6ef7] py-2.5 text-sm font-semibold text-white hover:bg-[#3d5ae0] disabled:opacity-60"
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatEuro(n: number): string {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
      />
    </div>
  );
}
