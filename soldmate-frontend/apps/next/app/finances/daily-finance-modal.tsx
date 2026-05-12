"use client";

import React, { useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type {
  DailyFinanceEntryResponse,
  DailyFinanceUpsertBody,
  DailyFinanceUpsertExpenseLineBody,
} from "app/lib/api";
import { FINANCE_MAX_DAILY_AMOUNT } from "app/lib/api";
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

function expensesFromInitial(initial: DailyFinanceEntryResponse | null | undefined): ExpenseDraft[] {
  if (!initial?.expenseLines?.length) return [];
  return initial.expenseLines.map((l) => ({ detail: l.detail, amount: String(l.amount) }));
}

export type DailyFinanceModalProps = {
  onClose: () => void;
  mode: "create" | "edit";
  initial?: DailyFinanceEntryResponse | null;
  submitting: boolean;
  onSubmit: (payload: { date: string; body: DailyFinanceUpsertBody }) => Promise<void>;
  recentEntries: DailyFinanceEntryResponse[];
  confirmOutlier: (description: string) => Promise<boolean>;
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function channelTotalFromEntry(e: DailyFinanceEntryResponse): number {
  return (
    num(e.incomeDataphone) +
    num(e.incomeJustEat) +
    num(e.incomeGlovo) +
    num(e.incomeUberEats)
  );
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export function DailyFinanceModal({
  onClose,
  mode,
  initial,
  submitting,
  onSubmit,
  recentEntries,
  confirmOutlier,
}: DailyFinanceModalProps) {
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 1);
  const minDate = new Date(today);
  minDate.setFullYear(minDate.getFullYear() - 10);

  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? toIsoDate(today));
  const [cashOpening, setCashOpening] = useState(initial ? String(initial.cashOpening) : "");
  const [incomeDataphone, setIncomeDataphone] = useState(initial ? String(initial.incomeDataphone) : "");
  const [incomeJustEat, setIncomeJustEat] = useState(initial ? String(initial.incomeJustEat) : "");
  const [incomeGlovo, setIncomeGlovo] = useState(initial ? String(initial.incomeGlovo) : "");
  const [incomeUberEats, setIncomeUberEats] = useState(initial ? String(initial.incomeUberEats) : "");
  const [cashClosing, setCashClosing] = useState(initial ? String(initial.cashClosing) : "");
  const [expenses, setExpenses] = useState<ExpenseDraft[]>(() => expensesFromInitial(initial));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const saldoPreview = useMemo(() => {
    const o = parseDecimal(cashOpening) ?? 0;
    const d = parseDecimal(incomeDataphone) ?? 0;
    const j = parseDecimal(incomeJustEat) ?? 0;
    const g = parseDecimal(incomeGlovo) ?? 0;
    const u = parseDecimal(incomeUberEats) ?? 0;
    const c = parseDecimal(cashClosing) ?? 0;
    let gastos = 0;
    for (const row of expenses) {
      const a = parseDecimal(row.amount);
      if (a != null && row.detail.trim()) gastos += a;
    }
    return round2(o + d + j + g + u - gastos - c);
  }, [cashOpening, incomeDataphone, incomeJustEat, incomeGlovo, incomeUberEats, cashClosing, expenses]);

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
    const d = parseDecimal(incomeDataphone);
    const j = parseDecimal(incomeJustEat);
    const g = parseDecimal(incomeGlovo);
    const u = parseDecimal(incomeUberEats);
    const c = parseDecimal(cashClosing);
    if (o == null || o < 0 || d == null || d < 0 || j == null || j < 0 || g == null || g < 0 || u == null || u < 0 || c == null || c < 0) {
      notify.error("Todos los importes principales deben ser números válidos ≥ 0.");
      return;
    }
    const ch = round2(d + j + g + u);
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
      incomeDataphone: round2(d),
      incomeJustEat: round2(j),
      incomeGlovo: round2(g),
      incomeUberEats: round2(u),
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
              Efectivo al abrir y al cierre, ingresos por datáfono y delivery, gastos/sueldos con detalle. Saldo final = apertura
              + ingresos canales − gastos − efectivo al cierre.
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ingresos por canal (€)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Datáfono (TPV)" value={incomeDataphone} onChange={setIncomeDataphone} />
              <Field label="Just Eat" value={incomeJustEat} onChange={setIncomeJustEat} />
              <Field label="Glovo" value={incomeGlovo} onChange={setIncomeGlovo} />
              <Field label="Uber Eats" value={incomeUberEats} onChange={setIncomeUberEats} />
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
