import type { DailyFinanceEntryResponse } from "app/lib/api";

const CSV_SEP = ";";
const UTF8_BOM = "\uFEFF";

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

/** Importe con coma decimal, legible en Excel con locale español. */
function csvAmount(v: number | string | null | undefined): string {
  return toNumber(v).toFixed(2).replace(".", ",");
}

function csvCell(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[;\n"]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function formatDisplayDate(entryDate: string): string {
  const [y, m, d] = entryDate.split("-");
  if (!y || !m || !d) return entryDate;
  return `${d}/${m}/${y}`;
}

function formatIncomeChannels(row: DailyFinanceEntryResponse): string {
  const channels = row.incomeChannels ?? [];
  if (channels.length === 0) return "—";
  return channels.map((c) => `${c.name}: ${csvAmount(c.amount)} €`).join(" | ");
}

function formatExpenseLines(row: DailyFinanceEntryResponse): string {
  const lines = row.expenseLines ?? [];
  if (lines.length === 0) return "—";
  return lines.map((l) => `${l.detail}: ${csvAmount(l.amount)} €`).join(" | ");
}

export function buildDailyFinanceCsv(rows: DailyFinanceEntryResponse[]): string {
  const headers = [
    "Fecha",
    "Efectivo apertura (€)",
    "Ingresos por canal",
    "Total ingresos canales (€)",
    "Gastos detalle",
    "Total gastos (€)",
    "Efectivo cierre (€)",
    "Saldo del día (€)",
    "Notas",
    "Registrado por",
    "Última edición por",
  ];

  const sorted = [...rows].sort((a, b) => a.entryDate.localeCompare(b.entryDate));

  const dataLines = sorted.map((row) =>
    [
      csvCell(formatDisplayDate(row.entryDate)),
      csvAmount(row.cashOpening),
      csvCell(formatIncomeChannels(row)),
      csvAmount(row.revenue),
      csvCell(formatExpenseLines(row)),
      csvAmount(row.expenses),
      csvAmount(row.cashClosing),
      csvAmount(row.finalBalance),
      csvCell((row.notes ?? "").trim() || "—"),
      csvCell(row.createdBy?.trim() || "—"),
      csvCell(row.updatedBy?.trim() || "—"),
    ].join(CSV_SEP),
  );

  return UTF8_BOM + [headers.join(CSV_SEP), ...dataLines].join("\r\n");
}

export function downloadDailyFinanceCsv(rows: DailyFinanceEntryResponse[]): void {
  const content = buildDailyFinanceCsv(rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `finanzas-cierres-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
