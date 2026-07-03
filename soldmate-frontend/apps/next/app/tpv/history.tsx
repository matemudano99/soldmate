"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { tpvSalesApi, type TpvReceipt, type TpvSaleSummary } from "app/lib/api";
import { CHANNEL_LABEL, Modal, money, fmtDateTime, fmtTime, paymentLabel, todayIso } from "./shared";

export function HistoryView({ token, onBack }: { token: string; onBack: () => void }) {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [openId, setOpenId] = useState<number | null>(null);

  const salesQ = useQuery({
    queryKey: ["tpv-sales", from, to],
    queryFn: () => tpvSalesApi.list(token, from, to),
    enabled: !!token,
  });

  const sales = salesQ.data ?? [];
  const totalRange = sales.reduce((a, s) => a + s.total, 0);

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#4f6ef7]"
          >
            <ArrowLeft size={16} /> Sala
          </button>
          <h2 className="text-lg font-bold text-[#1e2040]">Historial de ventas</h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 outline-none focus:border-[#4f6ef7]"
          />
          <label className="text-gray-500">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 outline-none focus:border-[#4f6ef7]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="text-gray-500">
          {sales.length} ventas · <span className="font-bold text-[#1e2040]">{money(totalRange)}</span>
        </span>
      </div>

      {salesQ.isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 className="animate-spin" size={20} /> Cargando ventas…
        </div>
      ) : sales.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-2xl">
          No hay ventas en ese rango de fechas.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-2 font-semibold">Ticket</th>
                <th className="py-2 font-semibold">Fecha</th>
                <th className="py-2 font-semibold">Canal</th>
                <th className="py-2 font-semibold">Mesa / Cliente</th>
                <th className="py-2 font-semibold">Pago</th>
                <th className="py-2 font-semibold text-right">Total</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <SaleRow key={s.id} sale={s} onOpen={() => setOpenId(s.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId != null ? (
        <ReceiptModal token={token} orderId={openId} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}

function SaleRow({ sale, onOpen }: { sale: TpvSaleSummary; onOpen: () => void }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60">
      <td className="py-2.5 font-semibold text-[#1e2040]">#{sale.id}</td>
      <td className="py-2.5 text-gray-600">
        {sale.businessDay} {fmtTime(sale.closedAt) ? `· ${fmtTime(sale.closedAt)}` : ""}
      </td>
      <td className="py-2.5 text-gray-600">{CHANNEL_LABEL[sale.channel]}</td>
      <td className="py-2.5 text-gray-600">{sale.tableLabel || sale.customerName || "—"}</td>
      <td className="py-2.5 text-gray-600">{sale.paymentMethods.map(paymentLabel).join(", ")}</td>
      <td className="py-2.5 text-right font-bold text-[#1e2040]">{money(sale.total)}</td>
      <td className="py-2.5 text-right">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-[#4f6ef7] hover:border-[#4f6ef7]"
        >
          <ReceiptIcon size={13} /> Ver
        </button>
      </td>
    </tr>
  );
}

type ReceiptMode = "ticket" | "preticket" | "kitchen";

export function ReceiptModal({
  token,
  orderId,
  onClose,
  mode = "ticket",
}: {
  token: string;
  orderId: number;
  onClose: () => void;
  mode?: ReceiptMode;
}) {
  const q = useQuery({
    queryKey: ["tpv-receipt", orderId],
    queryFn: () => tpvSalesApi.receipt(token, orderId),
    enabled: !!token,
  });
  const r = q.data;

  const title = mode === "kitchen" ? "Ticket de cocina" : mode === "preticket" ? "Preticket (proforma)" : `Ticket ${r?.number ?? `#${orderId}`}`;
  const subtitle = mode === "kitchen"
    ? "Comanda para cocina · sin precios"
    : mode === "preticket"
      ? "Documento provisional · no es factura"
      : "Justificante interno · no es factura fiscal";

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} maxWidth="max-w-sm">
      {q.isLoading || !r ? (
        <div className="flex items-center gap-2 text-gray-500 py-10 justify-center">
          <Loader2 className="animate-spin" size={20} /> Cargando…
        </div>
      ) : (
        <>
          {mode === "kitchen" ? <KitchenBody r={r} /> : <ReceiptBody r={r} preticket={mode === "preticket"} />}
          <button
            type="button"
            onClick={() => printReceipt(r, mode)}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e2040] text-white py-2.5 font-bold hover:bg-[#2b2e57]"
          >
            <Printer size={16} /> Imprimir
          </button>
        </>
      )}
    </Modal>
  );
}

function ReceiptBody({ r, preticket = false }: { r: TpvReceipt; preticket?: boolean }) {
  return (
    <div className="font-mono text-[12px] text-[#1e2040] leading-relaxed">
      {preticket ? (
        <div className="text-center text-[11px] font-bold uppercase tracking-wide bg-amber-50 border border-amber-200 text-amber-700 rounded py-1 mb-2">
          Preticket · documento provisional
        </div>
      ) : null}
      <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
        <div className="text-sm font-bold">{r.company.name}</div>
        {r.company.taxId ? <div>NIF/CIF: {r.company.taxId}</div> : null}
        {r.company.addressLine ? <div>{r.company.addressLine}</div> : null}
        {(r.company.postalCode || r.company.city) ? (
          <div>
            {r.company.postalCode ?? ""} {r.company.city ?? ""}
          </div>
        ) : null}
        {r.company.phone ? <div>Tel: {r.company.phone}</div> : null}
      </div>

      <div className="mb-2">
        <div className="flex justify-between">
          <span>Ticket</span>
          <span className="font-bold">{r.number}</span>
        </div>
        <div className="flex justify-between">
          <span>Fecha</span>
          <span>{fmtDateTime(r.closedAt) || r.businessDay}</span>
        </div>
        <div className="flex justify-between">
          <span>Canal</span>
          <span>{CHANNEL_LABEL[r.channel]}</span>
        </div>
        {r.tableLabel ? (
          <div className="flex justify-between">
            <span>Mesa</span>
            <span>{r.tableLabel}</span>
          </div>
        ) : null}
        {r.customerName ? (
          <div className="flex justify-between">
            <span>Cliente</span>
            <span>{r.customerName}</span>
          </div>
        ) : null}
        {r.customerTaxId ? (
          <div className="flex justify-between">
            <span>NIF/CIF</span>
            <span>{r.customerTaxId}</span>
          </div>
        ) : null}
        {r.customerAddress ? <div className="text-[11px] text-gray-500">{r.customerAddress}</div> : null}
        {r.openedBy ? (
          <div className="flex justify-between text-[11px] text-gray-500">
            <span>Atendido por</span>
            <span>{r.openedBy}</span>
          </div>
        ) : null}
      </div>

      <div className="border-t border-dashed border-gray-300 pt-2 mb-2">
        {r.lines.map((l, i) => (
          <React.Fragment key={i}>
            <div className={`flex justify-between gap-2 ${l.modifier ? "text-gray-500 text-[11px] pl-3" : ""}`}>
              <span className="flex-1">
                {l.removal ? l.name : `${l.modifier ? "+ " : `${Number(l.qty)}× `}${l.name}`}
                {l.discountPct && l.discountPct > 0 ? (
                  <span className="text-emerald-600"> ({l.discountPct >= 100 ? "invitado" : `−${Number(l.discountPct)}%`})</span>
                ) : null}
              </span>
              {l.removal ? null : <span>{money(l.lineTotal)}</span>}
            </div>
            {l.note ? <div className="text-[11px] text-gray-500 pl-3 italic">→ {l.note}</div> : null}
          </React.Fragment>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-300 pt-2 mb-2">
        {r.discountTotal > 0 ? (
          <>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(r.total + r.discountTotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>Descuento{r.discountReason ? ` · ${r.discountReason}` : ""}</span>
              <span>−{money(r.discountTotal)}</span>
            </div>
          </>
        ) : null}
        <div className="flex justify-between">
          <span>Base imponible</span>
          <span>{money(r.subtotal)}</span>
        </div>
        {r.taxBreakdown.map((t, i) => (
          <div key={i} className="flex justify-between text-[11px] text-gray-500">
            <span>IVA {Number(t.vatRate)}% (base {money(t.base)})</span>
            <span>{money(t.tax)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold mt-1">
          <span>TOTAL</span>
          <span>{money(r.total)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-300 pt-2">
        {r.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>
              {paymentLabel(p.method)}
              {p.platform ? ` (${p.platform})` : ""}
            </span>
            <span>{money(p.amount)}</span>
          </div>
        ))}
        {r.totalTips > 0 ? (
          <div className="flex justify-between text-[11px] text-gray-500">
            <span>Propina</span>
            <span>{money(r.totalTips)}</span>
          </div>
        ) : null}
      </div>

      <div className="text-center text-[11px] text-gray-400 mt-3">¡Gracias por su visita!</div>
    </div>
  );
}

function KitchenBody({ r }: { r: TpvReceipt }) {
  const lines = r.lines.filter((l) => l.kitchen);
  return (
    <div className="font-mono text-[13px] text-[#1e2040] leading-relaxed">
      <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
        <div className="text-base font-bold">COCINA</div>
        <div className="text-xs">{r.tableLabel ? `Mesa ${r.tableLabel}` : CHANNEL_LABEL[r.channel]}</div>
      </div>
      <div className="flex justify-between text-[11px] text-gray-500 mb-2">
        <span>Comanda {r.number}</span>
        <span>{fmtDateTime(r.closedAt) || fmtTime(r.openedAt)}</span>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-gray-400 py-3 text-center">No hay platos de cocina en este pedido.</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((l, i) => (
            <React.Fragment key={i}>
              <li className={l.removal ? "text-red-600 text-[12px] pl-4 font-semibold" : l.modifier ? "text-gray-600 text-[12px] pl-4" : "font-bold"}>
                {l.removal ? `✕ ${l.name}` : l.modifier ? `+ ${Number(l.qty) > 1 ? `${Number(l.qty)}× ` : ""}${l.name}` : `${Number(l.qty)}× ${l.name}`}
              </li>
              {l.note ? <li className="pl-4 text-[11px] text-amber-700 italic">→ {l.note}</li> : null}
            </React.Fragment>
          ))}
        </ul>
      )}
      {r.note ? <div className="mt-2 text-[11px] text-gray-500">Nota: {r.note}</div> : null}
    </div>
  );
}

/** Abre una ventana con el documento formateado (ticket/preticket/cocina) y lanza la impresión. */
function printReceipt(r: TpvReceipt, mode: ReceiptMode = "ticket") {
  const m = (n: number) => `${(n ?? 0).toFixed(2)} €`;
  const esc = (s: string | null | undefined) =>
    (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  const css = `
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; width: 72mm; margin: 0 auto; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .lg { font-size: 14px; }
    .xl { font-size: 16px; }
    .sep { border-top: 1px dashed #999; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .row.small, .small { font-size: 11px; color: #555; }
    .row.mod, .mod { color: #333; font-size: 12px; padding-left: 12px; }
    .sin { color: #b00; font-weight: bold; font-size: 12px; padding-left: 12px; }
    .note { color: #555; font-size: 11px; font-style: italic; padding-left: 12px; }
    .item { font-weight: bold; font-size: 14px; margin-top: 4px; }`;
  const onload = `window.print(); setTimeout(function(){window.close();}, 300);`;

  let html: string;

  if (mode === "kitchen") {
    const kl = r.lines.filter((l) => l.kitchen);
    const body = kl.length === 0
      ? `<div class="center">Sin platos de cocina</div>`
      : kl.map((l) => {
          const main = l.removal
            ? `<div class="sin">✕ ${esc(l.name)}</div>`
            : l.modifier
              ? `<div class="mod">+ ${Number(l.qty) > 1 ? `${Number(l.qty)}× ` : ""}${esc(l.name)}</div>`
              : `<div class="item">${Number(l.qty)}× ${esc(l.name)}</div>`;
          return main + (l.note ? `<div class="note">→ ${esc(l.note)}</div>` : "");
        }).join("");
    html = `<!doctype html><html><head><meta charset="utf-8"><title>Cocina ${esc(r.number)}</title>
      <style>${css}</style></head><body onload="${onload}">
      <div class="center bold xl">COCINA</div>
      <div class="center">${r.tableLabel ? `Mesa ${esc(r.tableLabel)}` : esc(r.channel)}</div>
      <div class="sep"></div>
      <div class="row small"><span>Comanda ${esc(r.number)}</span><span>${esc(r.closedAt ? new Date(r.closedAt).toLocaleString("es-ES") : r.businessDay)}</span></div>
      ${r.customerName ? `<div class="small">Cliente: ${esc(r.customerName)}</div>` : ""}
      <div class="sep"></div>
      ${body}
      ${r.note ? `<div class="sep"></div><div class="small">Nota: ${esc(r.note)}</div>` : ""}
      </body></html>`;
  } else {
    const lines = r.lines
      .map((l) => {
        const disc = l.discountPct && l.discountPct > 0 ? ` (${l.discountPct >= 100 ? "invitado" : `-${Number(l.discountPct)}%`})` : "";
        const row = l.removal
          ? `<div class="sin">${esc(l.name)}</div>`
          : `<div class="row ${l.modifier ? "mod" : ""}"><span>${l.modifier ? "+ " : `${Number(l.qty)}× `}${esc(l.name)}${disc}</span><span>${m(l.lineTotal)}</span></div>`;
        return row + (l.note ? `<div class="note">→ ${esc(l.note)}</div>` : "");
      })
      .join("");
    const taxes = r.taxBreakdown
      .map((t) => `<div class="row small"><span>IVA ${Number(t.vatRate)}% (base ${m(t.base)})</span><span>${m(t.tax)}</span></div>`)
      .join("");
    const pays = mode === "preticket"
      ? ""
      : `<div class="sep"></div>${r.payments.map((p) => `<div class="row"><span>${esc(p.method)}${p.platform ? ` (${esc(p.platform)})` : ""}</span><span>${m(p.amount)}</span></div>`).join("")}${r.totalTips > 0 ? `<div class="row small"><span>Propina</span><span>${m(r.totalTips)}</span></div>` : ""}`;
    const banner = mode === "preticket" ? `<div class="center bold">*** PRETICKET / PROFORMA ***</div><div class="sep"></div>` : "";
    const footer = mode === "preticket" ? "Documento provisional · no es factura" : "Justificante interno · no es factura fiscal";

    html = `<!doctype html><html><head><meta charset="utf-8"><title>${mode === "preticket" ? "Preticket" : "Ticket"} ${esc(r.number)}</title>
      <style>${css}</style></head><body onload="${onload}">
      ${banner}
      <div class="center">
        <div class="bold lg">${esc(r.company.name)}</div>
        ${r.company.taxId ? `<div>NIF/CIF: ${esc(r.company.taxId)}</div>` : ""}
        ${r.company.addressLine ? `<div>${esc(r.company.addressLine)}</div>` : ""}
        ${r.company.postalCode || r.company.city ? `<div>${esc(r.company.postalCode)} ${esc(r.company.city)}</div>` : ""}
        ${r.company.phone ? `<div>Tel: ${esc(r.company.phone)}</div>` : ""}
      </div>
      <div class="sep"></div>
      <div class="row"><span>${mode === "preticket" ? "Comanda" : "Ticket"}</span><span class="bold">${esc(r.number)}</span></div>
      <div class="row"><span>Fecha</span><span>${esc(r.closedAt ? new Date(r.closedAt).toLocaleString("es-ES") : r.businessDay)}</span></div>
      <div class="row"><span>Canal</span><span>${esc(r.channel)}</span></div>
      ${r.tableLabel ? `<div class="row"><span>Mesa</span><span>${esc(r.tableLabel)}</span></div>` : ""}
      ${r.customerName ? `<div class="row"><span>Cliente</span><span>${esc(r.customerName)}</span></div>` : ""}
      ${r.customerTaxId ? `<div class="row"><span>NIF/CIF</span><span>${esc(r.customerTaxId)}</span></div>` : ""}
      ${r.customerAddress ? `<div class="small">${esc(r.customerAddress)}</div>` : ""}
      <div class="sep"></div>
      ${lines}
      <div class="sep"></div>
      ${r.discountTotal > 0 ? `<div class="row"><span>Subtotal</span><span>${m(r.total + r.discountTotal)}</span></div><div class="row"><span>Descuento${r.discountReason ? ` · ${esc(r.discountReason)}` : ""}</span><span>-${m(r.discountTotal)}</span></div>` : ""}
      <div class="row"><span>Base imponible</span><span>${m(r.subtotal)}</span></div>
      ${taxes}
      <div class="row bold lg"><span>TOTAL</span><span>${m(r.total)}</span></div>
      ${pays}
      <div class="sep"></div>
      <div class="center small">${footer}</div>
      <div class="center small">¡Gracias por su visita!</div>
      </body></html>`;
  }

  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
