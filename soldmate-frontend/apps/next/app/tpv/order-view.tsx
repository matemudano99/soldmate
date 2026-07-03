"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, ChefHat, CreditCard, Loader2, Minus, Pencil, Percent, Plus, Printer, Search, Wallet, X } from "lucide-react";
import { notify } from "../shared/ui";
import { tpvApi, type TpvCategory, type TpvItem, type TpvModifierLine, type TpvOrder, type TpvOrderLine, type TpvPaymentMethod } from "app/lib/api";
import { CHANNEL_LABEL, Chip, DELIVERY_PLATFORMS, Modal, money, pastelFor, paymentLabel } from "./shared";
import { ReceiptModal } from "./history";

export function OrderView({
  token,
  order,
  setOrder,
  cats,
  items,
  itemsLoading,
  canOperate,
  canManage,
  headerLabel,
  onBack,
  onPaid,
}: {
  token: string;
  order: TpvOrder;
  setOrder: (o: TpvOrder) => void;
  cats: TpvCategory[];
  items: TpvItem[];
  itemsLoading?: boolean;
  canOperate: boolean;
  canManage: boolean;
  headerLabel: string;
  onBack: () => void;
  onPaid: (o: TpvOrder) => void;
}) {
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [modItem, setModItem] = useState<TpvItem | null>(null);
  const [editLine, setEditLine] = useState<{ lineId: number; item: TpvItem; selected: TpvModifierLine[]; note: string } | null>(null);
  const [printMode, setPrintMode] = useState<"preticket" | "kitchen" | null>(null);
  const [payMethod, setPayMethod] = useState<TpvPaymentMethod>("CARD");
  const [cashGiven, setCashGiven] = useState("");
  const [platform, setPlatform] = useState(DELIVERY_PLATFORMS[0]);
  const [amountStr, setAmountStr] = useState("");
  const [tipStr, setTipStr] = useState("");
  const [discountLineId, setDiscountLineId] = useState<number | null>(null);
  const [showOrderDiscount, setShowOrderDiscount] = useState(false);
  const [splitN, setSplitN] = useState(1); // dividir la cuenta entre N personas (1 = no dividir)

  // Pagos parciales: lo ya cobrado y lo pendiente.
  const paidSoFar = (order.payments ?? []).reduce((a, p) => a + (p.amount ?? 0), 0);
  const remaining = Math.max(0, Number((order.total - paidSoFar).toFixed(2)));

  // Parte por persona al dividir: techo a céntimos para que la última parte cubra el resto exacto.
  const perShare = splitN >= 2 ? Math.ceil((order.total / splitN) * 100) / 100 : 0;

  // El importe a cobrar arranca en el pendiente (o en la parte por persona al dividir); se reinicia
  // tras cada pago (cambia `remaining`), de modo que cada parte se cobra de una en una.
  useEffect(() => {
    const suggested = splitN >= 2 ? Math.min(remaining, perShare) : remaining;
    setAmountStr(suggested > 0 ? suggested.toFixed(2) : "");
  }, [order.id, remaining, splitN, perShare]);

  const amountNum = Number((amountStr || "0").replace(",", ".")) || 0;

  const paid = order.status === "PAID";

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const mainCats = useMemo(() => cats.filter((c) => !c.isModifierGroup), [cats]);
  const modifierCatIds = useMemo(() => new Set(cats.filter((c) => c.isModifierGroup).map((c) => c.id)), [cats]);
  const modifierItems = useMemo(() => items.filter((i) => modifierCatIds.has(i.categoryId)), [items, modifierCatIds]);

  const shownItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (modifierCatIds.has(i.categoryId)) return false; // los modificadores no van en la rejilla principal
      if (activeCat && i.categoryId !== activeCat) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, activeCat, search, modifierCatIds]);

  // Cola serializada de cambios en la comanda con alta optimista: el producto aparece al instante y
  // las peticiones se envían de una en una (evita la espera y los conflictos de versión del backend).
  const [pendingLines, setPendingLines] = useState<TpvOrderLine[]>([]);
  const queueRef = useRef<{ run: () => Promise<TpvOrder>; optimistic: boolean }[]>([]);
  const busyRef = useRef(false);

  const pump = () => {
    if (busyRef.current) return;
    const job = queueRef.current.shift();
    if (!job) return;
    busyRef.current = true;
    job
      .run()
      .then((o) => {
        setOrder(o);
        if (job.optimistic) setPendingLines((p) => p.slice(1));
      })
      .catch((e: Error) => {
        notify.error(e.message ?? "No se pudo actualizar la comanda");
        if (job.optimistic) setPendingLines((p) => p.slice(1));
      })
      .finally(() => {
        busyRef.current = false;
        pump();
      });
  };
  const enqueue = (run: () => Promise<TpvOrder>, optimistic?: TpvOrderLine) => {
    if (optimistic) setPendingLines((p) => [...p, optimistic]);
    queueRef.current.push({ run, optimistic: !!optimistic });
    pump();
  };

  const tipNum = Number((tipStr || "0").replace(",", ".")) || 0;
  const payMut = useMutation({
    mutationFn: () =>
      tpvApi.pay(token, order.id, {
        method: payMethod,
        amount: amountNum,
        tip: tipNum > 0 ? tipNum : undefined,
        platform: payMethod === "DELIVERY_PLATFORM" ? platform : undefined,
      }),
    onSuccess: (o) => {
      setOrder(o);
      setCashGiven("");
      setTipStr("");
      if (o.status === "PAID") onPaid(o);
      else notify.success("Pago parcial registrado");
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo cobrar"),
  });

  function handleTapItem(it: TpvItem) {
    if (!canOperate || paid || it.soldOut) return;
    const hasSizes = it.variants.length > 0;
    const hasMods = it.allowsModifiers && modifierItems.length > 0;
    if (hasSizes || hasMods) {
      setModItem(it);
    } else {
      const opt: TpvOrderLine = {
        id: -(Date.now() + Math.floor(Math.random() * 1000)),
        menuItemId: it.id, parentLineId: null, removal: false, name: it.name, qty: 1,
        unitPrice: it.price, vatRate: it.vatRate, lineTotal: it.price, note: null, voided: false,
      };
      enqueue(() => tpvApi.addLine(token, order.id, { menuItemId: it.id }), opt);
    }
  }

  // Agrupa líneas (autoritativas + optimistas pendientes): padres con sus hijos (combinados).
  const activeLines = [...order.lines, ...pendingLines].filter((l) => !l.voided);
  const parents = activeLines.filter((l) => l.parentLineId == null);
  const childrenByParent = (parentId: number) => activeLines.filter((l) => l.parentLineId === parentId);

  // Totales mostrados incluyendo las líneas optimistas pendientes.
  const pendTotal = pendingLines.reduce((s, l) => s + l.lineTotal, 0);
  const pendBase = pendingLines.reduce((s, l) => s + l.lineTotal / (1 + (l.vatRate || 0) / 100), 0);
  const dispSubtotal = order.subtotal + pendBase;
  const dispTaxTotal = order.taxTotal + (pendTotal - pendBase);
  const dispTotal = order.total + pendTotal;

  const cashGivenNum = parseFloat(cashGiven.replace(",", ".")) || 0;
  const change = cashGivenNum > 0 ? Math.max(0, cashGivenNum - amountNum) : 0;

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:h-full">
      {/* Catálogo */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4 flex flex-col lg:flex-1 lg:min-w-0 lg:min-h-0">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#4f6ef7]"
          >
            <ArrowLeft size={16} /> Sala
          </button>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en la carta…"
              className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-3 shrink-0">
          {mainCats.map((c) => (
            <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </Chip>
          ))}
          <Chip active={activeCat === null} onClick={() => setActiveCat(null)}>
            Todo
          </Chip>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mr-1 pr-1">
        {shownItems.length === 0 ? (
          itemsLoading ? (
            <div className="flex items-center gap-2 text-gray-500 py-10 justify-center">
              <Loader2 className="animate-spin" size={20} /> Cargando carta…
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-10 text-center border border-dashed border-gray-200 rounded-2xl">
              No hay artículos. Carga la carta o crea artículos en la gestión de carta.
            </p>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {shownItems.map((it) => {
              const pastel = pastelFor(it.categoryId);
              return (
                <button
                  key={it.id}
                  type="button"
                  disabled={!canOperate || paid || it.soldOut}
                  onClick={() => handleTapItem(it)}
                  style={{ backgroundColor: pastel.bg, borderColor: pastel.border, filter: it.soldOut ? "grayscale(1)" : undefined }}
                  className="relative text-left rounded-2xl border-2 p-3 min-h-[78px] flex flex-col justify-between hover:brightness-95 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  <span className="block text-sm font-semibold text-[#1e2040] leading-tight">{it.name}</span>
                  <span className="block text-sm text-[#1e2040] font-bold mt-1">
                    {it.variants.length > 0 ? `${money(it.variants[0].price)}+` : money(it.price)}
                  </span>
                  {it.soldOut ? (
                    <span className="absolute top-1.5 right-2 text-[9px] font-bold uppercase tracking-wide text-red-600 bg-white/80 rounded px-1">
                      Agotado
                    </span>
                  ) : it.allowsModifiers ? (
                    <span className="absolute top-1.5 right-2 text-[9px] font-bold uppercase tracking-wide text-amber-600/70">
                      + extras
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Comanda */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4 flex flex-col lg:w-[380px] lg:shrink-0 lg:min-h-0">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-lg font-bold text-[#1e2040]">{headerLabel}</h3>
            <p className="text-xs text-gray-500">
              Comanda #{order.id} · {CHANNEL_LABEL[order.channel]}
              {order.customerName ? ` · ${order.customerName}` : ""}
            </p>
          </div>
          {parents.length > 0 ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setPrintMode("preticket")}
                title="Imprimir preticket"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:border-[#4f6ef7]"
              >
                <Printer size={14} /> Preticket
              </button>
              <button
                type="button"
                onClick={() => setPrintMode("kitchen")}
                title="Imprimir ticket de cocina"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:border-[#4f6ef7]"
              >
                <ChefHat size={14} /> Cocina
              </button>
            </div>
          ) : null}
        </div>

        {parents.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center flex-1">Toca artículos para empezar la comanda.</p>
        ) : (
          <ul className="space-y-2 mb-3 flex-1 min-h-0 overflow-y-auto">
            {parents.map((l) => {
              const kids = childrenByParent(l.id);
              const lineItem = l.menuItemId != null ? itemById.get(l.menuItemId) : undefined;
              const optimistic = l.id < 0; // línea recién añadida, aún confirmándose en el servidor
              const canEditMods = !!lineItem && lineItem.allowsModifiers && modifierItems.length > 0;
              return (
                <li key={l.id} className={`rounded-xl border border-gray-100 px-2.5 py-2 ${optimistic ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#1e2040] flex-1">
                      {l.name}
                      {l.discountPct && l.discountPct >= 100 ? (
                        <span className="ml-1 text-[10px] font-bold uppercase text-emerald-600">Invitado</span>
                      ) : l.discountPct && l.discountPct > 0 ? (
                        <span className="ml-1 text-[10px] font-bold text-emerald-600">−{Number(l.discountPct)}%</span>
                      ) : null}
                    </span>
                    <span className="text-sm text-gray-700 w-16 text-right">{money(l.lineTotal)}</span>
                    {!paid && !optimistic && canManage ? (
                      <button
                        type="button"
                        onClick={() => setDiscountLineId(l.id)}
                        className="text-gray-300 hover:text-emerald-600"
                        aria-label="Descuento / invitar"
                      >
                        <Percent size={14} />
                      </button>
                    ) : null}
                    {!paid && !optimistic && canEditMods ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEditLine({
                            lineId: l.id,
                            item: lineItem!,
                            note: l.note ?? "",
                            selected: kids
                              .filter((k) => k.menuItemId != null)
                              .map((k) => ({
                                menuItemId: k.menuItemId as number,
                                qty: k.removal ? 1 : Number(k.qty),
                                removed: k.removal,
                              })),
                          })
                        }
                        className="text-gray-300 hover:text-[#4f6ef7]"
                        aria-label="Editar combinados"
                      >
                        <Pencil size={14} />
                      </button>
                    ) : null}
                    {!paid && !optimistic ? (
                      <button
                        type="button"
                        onClick={() => enqueue(() => tpvApi.voidLine(token, order.id, l.id))}
                        className="text-gray-300 hover:text-red-500"
                        aria-label="Quitar"
                      >
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>
                  {!paid && !optimistic ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => enqueue(() => tpvApi.setLineQty(token, order.id, l.id, Number(l.qty) - 1))}
                        className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[#4f6ef7]"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-semibold w-7 text-center">{Number(l.qty)}</span>
                      <button
                        type="button"
                        onClick={() => enqueue(() => tpvApi.setLineQty(token, order.id, l.id, Number(l.qty) + 1))}
                        className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[#4f6ef7]"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">{Number(l.qty)} ud</span>
                  )}
                  {kids.length > 0 ? (
                    <ul className="mt-1.5 pl-2 border-l-2 border-gray-100 space-y-0.5">
                      {kids.map((k) => (
                        <li key={k.id} className={`flex items-center justify-between gap-2 text-xs ${k.removal ? "text-red-500" : "text-gray-500"}`}>
                          <span>
                            {k.removal ? k.name : `+ ${Number(k.qty) > 1 ? `${Number(k.qty)}× ` : ""}${k.name}`}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {!k.removal ? <span>{money(k.lineTotal)}</span> : null}
                            {!paid ? (
                              <button
                                type="button"
                                onClick={() => enqueue(() => tpvApi.voidLine(token, order.id, k.id))}
                                className="text-gray-300 hover:text-red-500"
                                aria-label="Quitar combinado"
                              >
                                <X size={12} />
                              </button>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {l.note ? (
                    <p className="mt-1 text-[11px] text-amber-600 italic">📝 {l.note}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {parents.length > 0 ? (
          <div className="border-t border-gray-100 pt-3 shrink-0">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Base</span>
              <span>{money(dispSubtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>IVA</span>
              <span>{money(dispTaxTotal)}</span>
            </div>
            {order.discountTotal > 0 ? (
              <div className="flex justify-between text-sm font-semibold text-emerald-600">
                <span>
                  Descuento
                  {order.discountReason ? (
                    <span className="font-normal text-emerald-500"> · {order.discountReason}</span>
                  ) : null}
                </span>
                <span>−{money(order.discountTotal)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-xl font-bold text-[#1e2040] mt-1">
              <span>Total</span>
              <span>{money(dispTotal)}</span>
            </div>
            {!paid && canManage ? (
              <button
                type="button"
                onClick={() => setShowOrderDiscount(true)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4f6ef7] hover:underline"
              >
                <Percent size={12} />
                {order.discountType !== "NONE" ? "Editar descuento del ticket" : "Aplicar descuento al ticket"}
              </button>
            ) : null}

            {paidSoFar > 0 && !paid ? (
              <div className="mt-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                {(order.payments ?? []).map((p) => (
                  <div key={p.id} className="flex justify-between text-[11px] text-amber-700/80">
                    <span>{paymentLabel(p.method)}{p.platform ? ` · ${p.platform}` : ""}</span>
                    <span>{money(p.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-amber-800 mt-0.5">
                  <span>Pagado</span>
                  <span className="font-semibold">{money(paidSoFar)}</span>
                </div>
                <div className="flex justify-between text-amber-900 font-bold">
                  <span>Pendiente</span>
                  <span>{money(remaining)}</span>
                </div>
              </div>
            ) : null}

            {paid ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 text-green-700 px-3 py-2.5 text-sm font-semibold">
                  <Check size={16} /> Cobrada · stock descontado
                </div>
                <button
                  type="button"
                  onClick={onBack}
                  className="mt-3 w-full rounded-xl bg-[#4f6ef7] text-white py-2.5 font-semibold hover:bg-[#3d5ae0]"
                >
                  Volver a la sala
                </button>
              </div>
            ) : canOperate ? (
              <div className="mt-3 space-y-2">
                {/* Tipo de cobro */}
                <div className={`grid ${order.channel === "DELIVERY" ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                  <MethodButton active={payMethod === "CARD"} onClick={() => setPayMethod("CARD")} icon={<CreditCard size={16} />} label="Tarjeta" />
                  <MethodButton active={payMethod === "CASH"} onClick={() => setPayMethod("CASH")} icon={<Wallet size={16} />} label="Efectivo" />
                  {order.channel === "DELIVERY" ? (
                    <MethodButton active={payMethod === "DELIVERY_PLATFORM"} onClick={() => setPayMethod("DELIVERY_PLATFORM")} icon={<span className="text-base">🛵</span>} label="Plataforma" />
                  ) : null}
                </div>

                {payMethod === "DELIVERY_PLATFORM" ? (
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white outline-none focus:border-[#4f6ef7]"
                  >
                    {DELIVERY_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : null}

                {/* Botón de cobro — justo debajo del tipo de cobro */}
                <button
                  type="button"
                  onClick={() => payMut.mutate()}
                  disabled={payMut.isPending || amountNum <= 0 || pendingLines.length > 0}
                  className="w-full rounded-xl bg-[#1e2040] text-white py-3 font-bold hover:bg-[#2b2e57] disabled:opacity-60"
                >
                  {payMut.isPending
                    ? "Cobrando…"
                    : splitN >= 2 && amountNum < remaining
                      ? `Cobrar parte ${money(amountNum)}`
                      : amountNum < remaining
                        ? `Cobro parcial ${money(amountNum)}`
                        : `Cobrar ${money(amountNum)}`}
                </button>

                {/* Ajustes: importe + propina */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5">
                    <label className="block text-[11px] text-gray-500 mb-0.5">Importe €</label>
                    <input
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      inputMode="decimal"
                      placeholder={remaining.toFixed(2)}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm text-right outline-none focus:border-[#4f6ef7]"
                    />
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5">
                    <label className="block text-[11px] text-gray-500 mb-0.5">Propina €</label>
                    <input
                      value={tipStr}
                      onChange={(e) => setTipStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="0,00"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm text-right outline-none focus:border-[#4f6ef7]"
                    />
                  </div>
                </div>

                {/* Efectivo: entregado / cambio en una fila */}
                {payMethod === "CASH" ? (
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5">
                    <label className="text-[11px] text-gray-500 shrink-0">Entregado</label>
                    <input
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      inputMode="decimal"
                      placeholder="0,00"
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm text-right outline-none focus:border-[#4f6ef7]"
                    />
                    <span className="ml-auto text-sm font-semibold text-[#1e2040]">Cambio {money(change)}</span>
                  </div>
                ) : null}

                {/* Dividir cuenta — compacto, una fila */}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Dividir
                    {splitN >= 2 ? <span className="text-[#4f6ef7] font-semibold"> · {money(perShare)}/pers.</span> : null}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSplitN((n) => Math.max(1, n - 1))}
                      className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[#4f6ef7] disabled:opacity-40"
                      disabled={splitN <= 1}
                      aria-label="Menos personas"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="text-sm font-semibold w-12 text-center">{splitN <= 1 ? "No" : `${splitN} p.`}</span>
                    <button
                      type="button"
                      onClick={() => setSplitN((n) => Math.min(20, n + 1))}
                      className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[#4f6ef7]"
                      aria-label="Más personas"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {modItem ? (
        <ProductSheet
          item={modItem}
          cats={cats}
          modifierItems={modifierItems}
          pending={false}
          onClose={() => setModItem(null)}
          onConfirm={(variantIndex, modifiers, note) => {
            const id = modItem.id;
            enqueue(() => tpvApi.addLine(token, order.id, { menuItemId: id, variantIndex, modifiers, note }));
            setModItem(null);
          }}
        />
      ) : null}

      {editLine ? (
        <ProductSheet
          item={editLine.item}
          cats={cats}
          modifierItems={modifierItems}
          pending={false}
          editMode
          initialSelected={editLine.selected}
          initialNote={editLine.note}
          onClose={() => setEditLine(null)}
          onConfirm={(_variantIndex, modifiers, note) => {
            const lineId = editLine.lineId;
            enqueue(() => tpvApi.setLineModifiers(token, order.id, lineId, modifiers, note));
            setEditLine(null);
          }}
        />
      ) : null}

      {discountLineId != null ? (
        <LineDiscountModal
          line={activeLines.find((l) => l.id === discountLineId)}
          onClose={() => setDiscountLineId(null)}
          onApply={(pct) => {
            const lineId = discountLineId;
            enqueue(() => tpvApi.setLineDiscount(token, order.id, lineId, pct));
            setDiscountLineId(null);
          }}
        />
      ) : null}

      {showOrderDiscount ? (
        <OrderDiscountModal
          order={order}
          onClose={() => setShowOrderDiscount(false)}
          onApply={(type, value, reason) => {
            enqueue(() => tpvApi.setOrderDiscount(token, order.id, { type, value, reason }));
            setShowOrderDiscount(false);
          }}
        />
      ) : null}

      {printMode ? (
        <ReceiptModal token={token} orderId={order.id} mode={printMode} onClose={() => setPrintMode(null)} />
      ) : null}
    </div>
  );
}

function LineDiscountModal({
  line,
  onClose,
  onApply,
}: {
  line: TpvOrderLine | undefined;
  onClose: () => void;
  onApply: (pct: number) => void;
}) {
  const [custom, setCustom] = useState("");
  const current = Number(line?.discountPct ?? 0);
  const quick = [
    { pct: 100, label: "Invitar (gratis)", tone: "bg-emerald-600 text-white border-emerald-600" },
    { pct: 50, label: "−50 %", tone: "" },
    { pct: 25, label: "−25 %", tone: "" },
    { pct: 10, label: "−10 %", tone: "" },
  ];
  const customNum = Math.min(100, Math.max(0, Number(custom.replace(",", ".")) || 0));
  return (
    <Modal title={`Descuento · ${line?.name ?? "línea"}`} subtitle="Invita o rebaja esta línea" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-3">
        {current > 0 ? (
          <p className="text-xs text-emerald-600 font-semibold">
            Descuento actual: {current >= 100 ? "invitado" : `−${current}%`}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {quick.map((q) => (
            <button
              key={q.pct}
              type="button"
              onClick={() => onApply(q.pct)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${q.tone || "bg-white text-gray-700 border-gray-200 hover:border-[#4f6ef7]"}`}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            inputMode="decimal"
            placeholder="% personalizado"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
          />
          <button
            type="button"
            disabled={customNum <= 0}
            onClick={() => onApply(customNum)}
            className="rounded-xl bg-[#1e2040] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
        {current > 0 ? (
          <button
            type="button"
            onClick={() => onApply(0)}
            className="w-full rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:border-red-300 hover:text-red-500"
          >
            Quitar descuento
          </button>
        ) : null}
      </div>
    </Modal>
  );
}

function OrderDiscountModal({
  order,
  onClose,
  onApply,
}: {
  order: TpvOrder;
  onClose: () => void;
  onApply: (type: "PERCENT" | "AMOUNT", value: number, reason: string) => void;
}) {
  const [type, setType] = useState<"PERCENT" | "AMOUNT">(order.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT");
  const [value, setValue] = useState(order.discountType !== "NONE" ? String(order.discountValue ?? "") : "");
  const [reason, setReason] = useState(order.discountReason ?? "");
  const valueNum = Math.max(0, Number(value.replace(",", ".")) || 0);
  const apply = () => onApply(type, type === "PERCENT" ? Math.min(100, valueNum) : valueNum, reason.trim());
  return (
    <Modal title="Descuento del ticket" subtitle="Se reparte de forma proporcional sobre el total" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType("PERCENT")}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${type === "PERCENT" ? "bg-[#f0f3ff] text-[#4f6ef7] border-[#4f6ef7]" : "bg-white text-gray-600 border-gray-200"}`}
          >
            Porcentaje %
          </button>
          <button
            type="button"
            onClick={() => setType("AMOUNT")}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${type === "AMOUNT" ? "bg-[#f0f3ff] text-[#4f6ef7] border-[#4f6ef7]" : "bg-white text-gray-600 border-gray-200"}`}
          >
            Importe €
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder={type === "PERCENT" ? "0 %" : "0,00 €"}
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
          />
          <span className="text-sm text-gray-400 w-4">{type === "PERCENT" ? "%" : "€"}</span>
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional): incidencia, fidelidad…"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <button
          type="button"
          disabled={valueNum <= 0}
          onClick={apply}
          className="w-full rounded-xl bg-[#1e2040] text-white py-2.5 font-bold hover:bg-[#2b2e57] disabled:opacity-50"
        >
          Aplicar descuento
        </button>
        {order.discountType !== "NONE" ? (
          <button
            type="button"
            onClick={() => onApply("PERCENT", 0, "")}
            className="w-full rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:border-red-300 hover:text-red-500"
          >
            Quitar descuento
          </button>
        ) : null}
      </div>
    </Modal>
  );
}

function MethodButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold border ${
        active ? "bg-[#f0f3ff] text-[#4f6ef7] border-[#4f6ef7]" : "bg-white text-gray-600 border-gray-200"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function ProductSheet({
  item,
  cats,
  modifierItems,
  pending,
  editMode = false,
  initialSelected,
  initialNote,
  onClose,
  onConfirm,
}: {
  item: TpvItem;
  cats: TpvCategory[];
  modifierItems: TpvItem[];
  pending: boolean;
  editMode?: boolean;
  initialSelected?: TpvModifierLine[];
  initialNote?: string;
  onClose: () => void;
  onConfirm: (variantIndex: number | undefined, modifiers: TpvModifierLine[], note: string) => void;
}) {
  const hasSizes = item.variants.length > 0;
  const showSizes = hasSizes && !editMode; // al editar combinados no se cambia el tamaño
  const [variant, setVariant] = useState<number>(hasSizes ? item.variants[0].index : 0);
  const [note, setNote] = useState<string>(initialNote ?? "");
  // cantidades por modificador (añadir): menuItemId → qty (0 = no elegido)
  const [qtys, setQtys] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    for (const m of initialSelected ?? []) if (!m.removed) init[m.menuItemId] = m.qty;
    return init;
  });
  // modificadores "de quita" (sin X): conjunto de menuItemIds marcados como SIN
  const [sin, setSin] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const m of initialSelected ?? []) if (m.removed) s.add(m.menuItemId);
    return s;
  });

  // Grupos de combinados aplicables a este plato (si el plato fija grupos, se filtran).
  const allowedGroups = new Set(item.modifierGroupIds ?? []);
  const groups = cats.filter((c) => c.isModifierGroup && (allowedGroups.size === 0 || allowedGroups.has(c.id)));

  const basePrice = showSizes
    ? item.variants.find((v) => v.index === variant)?.price ?? item.price
    : item.price;
  const extra = Object.entries(qtys).reduce((sum, [id, q]) => {
    const price = modifierItems.find((m) => m.id === Number(id))?.price ?? 0;
    return sum + price * q;
  }, 0);

  // Añadir y "sin" son excluyentes para el mismo artículo.
  const setQty = (id: number, q: number) => {
    setQtys((prev) => ({ ...prev, [id]: Math.max(0, q) }));
    if (q > 0) setSin((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };
  const toggle = (id: number) => setQty(id, (qtys[id] ?? 0) > 0 ? 0 : 1);
  const toggleSin = (id: number) => {
    const willSin = !sin.has(id);
    setSin((prev) => {
      const n = new Set(prev);
      if (willSin) n.add(id);
      else n.delete(id);
      return n;
    });
    if (willSin) setQtys((q) => ({ ...q, [id]: 0 }));
  };

  const confirm = () => {
    const added: TpvModifierLine[] = Object.entries(qtys)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ menuItemId: Number(id), qty: q, removed: false }));
    const removed: TpvModifierLine[] = [...sin].map((id) => ({ menuItemId: id, qty: 1, removed: true }));
    onConfirm(showSizes ? variant : undefined, [...added, ...removed], note.trim());
  };

  return (
    <Modal
      title={editMode ? `Editar · ${item.name}` : item.name}
      subtitle={editMode ? "Modifica las salsas y extras" : showSizes ? "Elige el tamaño y añade combinados" : "Añade salsas y extras (combinados)"}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {showSizes ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Tamaño</p>
            <div className="grid grid-cols-2 gap-2">
              {item.variants.map((v) => {
                const on = v.index === variant;
                return (
                  <button
                    key={v.index}
                    type="button"
                    onClick={() => setVariant(v.index)}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold flex items-center justify-between ${
                      on ? "bg-[#4f6ef7] text-white border-[#4f6ef7]" : "bg-white text-gray-700 border-gray-200 hover:border-[#4f6ef7]"
                    }`}
                  >
                    <span>{v.label}</span>
                    <span className={on ? "opacity-90" : "text-gray-400"}>{money(v.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {groups.map((g) => {
          const gItems = modifierItems.filter((m) => m.categoryId === g.id);
          if (gItems.length === 0) return null;
          return (
            <div key={g.id}>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{g.name}</p>
              <div className="flex flex-wrap gap-2">
                {gItems.map((m) => {
                  const q = qtys[m.id] ?? 0;
                  const on = q > 0;
                  const isSin = sin.has(m.id);
                  const free = m.price <= 0; // artículo de quita ya creado a 0€
                  if (free) {
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggle(m.id)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                          on ? "bg-[#1e2040] text-white border-[#1e2040]" : "bg-white text-gray-700 border-gray-200 hover:border-[#4f6ef7]"
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  }
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border px-2.5 py-1.5 text-sm font-semibold flex items-center gap-2 ${
                        isSin ? "border-red-300 bg-red-50" : on ? "border-[#4f6ef7] bg-[#f0f3ff]" : "border-gray-200 bg-white"
                      }`}
                    >
                      <span className={isSin ? "text-red-600" : "text-gray-700"}>
                        {isSin ? (
                          `Sin ${m.name}`
                        ) : (
                          <>
                            {m.name} <span className="text-gray-400">· {money(m.price)}</span>
                          </>
                        )}
                      </span>
                      {!isSin && on ? (
                        <span className="flex items-center gap-1">
                          <button type="button" onClick={() => setQty(m.id, q - 1)} className="w-5 h-5 rounded-md border border-gray-200 flex items-center justify-center text-gray-600">
                            <Minus size={12} />
                          </button>
                          <span className="w-4 text-center text-[#4f6ef7] font-bold">{q}</span>
                          <button type="button" onClick={() => setQty(m.id, q + 1)} className="w-5 h-5 rounded-md border border-gray-200 flex items-center justify-center text-gray-600">
                            <Plus size={12} />
                          </button>
                        </span>
                      ) : !isSin ? (
                        <button type="button" onClick={() => setQty(m.id, 1)} className="text-[#4f6ef7]" title="Añadir">
                          <Plus size={15} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleSin(m.id)}
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border ${
                          isSin ? "bg-red-500 text-white border-red-500" : "border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500"
                        }`}
                        title="Marcar SIN este ingrediente"
                      >
                        Sin
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Descripción / excepciones</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Notas para cocina: alergias, punto de la carne, casos raros…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7] resize-none"
          />
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          disabled={pending}
          onClick={confirm}
          className="w-full rounded-xl bg-[#1e2040] text-white py-2.5 font-bold hover:bg-[#2b2e57] disabled:opacity-60"
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin inline" />
          ) : editMode ? (
            "Guardar combinados"
          ) : (
            `Añadir ${money(basePrice + extra)}`
          )}
        </button>
      </div>
    </Modal>
  );
}
