"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  ChefHat,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
  Truck,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { AppTopHeader, ErpPageShell, notify } from "../shared/ui";
import {
  tpvApi,
  tpvTablesApi,
  tpvCustomersApi,
  tpvCashApi,
  type TpvCashState,
  type TpvChannel,
  type TpvCustomer,
  type TpvOrder,
  type TpvTable,
  type TpvTableInput,
} from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { CHANNEL_LABEL, Modal, money, todayIso } from "./shared";
import { FloorPlan } from "./floor-plan";
import { OrderView } from "./order-view";
import { CatalogManagerModal } from "./catalog-manager";
import { HistoryView } from "./history";
import { CustomersView } from "./customers";
import { DashboardView } from "./dashboard";
import { KitchenView } from "./kds";

type CustomerDraft = { channel: TpvChannel; name: string; phone: string; address: string; customerId: number | null };

export default function TpvPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const companyId = useAuthStore((s) => s.companyId);
  const queryClient = useQueryClient();
  const canManage = ["OWNER", "MANAGER", "SUPERVISOR", "DEV"].includes(role ?? "");
  const canOperate = canManage || role === "EMPLOYEE";
  const canCloseZ = ["OWNER", "MANAGER", "DEV"].includes(role ?? "");

  // El token/rol vienen de un store persistido en localStorage: en SSR no existen y en cliente sí,
  // lo que provoca discrepancias de hidratación. Renderizamos un cargando hasta montar en cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [view, setView] = useState<"sala" | "order" | "history" | "customers" | "dashboard" | "kitchen">("sala");
  const [showCash, setShowCash] = useState(false);
  const [order, setOrder] = useState<TpvOrder | null>(null);
  const [headerLabel, setHeaderLabel] = useState("Comanda");

  // Sala / plano
  const [editMode, setEditMode] = useState(false);
  const [activeZone, setActiveZone] = useState("Salón");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  // Modales
  const [showCatalog, setShowCatalog] = useState(false);
  const [customer, setCustomer] = useState<CustomerDraft | null>(null);

  const catsQ = useQuery({ queryKey: ["tpv-cats", companyId], queryFn: () => tpvApi.listCategories(token!), enabled: !!token, staleTime: 5 * 60 * 1000 });
  const itemsQ = useQuery({ queryKey: ["tpv-items", companyId], queryFn: () => tpvApi.listItems(token!), enabled: !!token, staleTime: 5 * 60 * 1000 });
  const tablesQ = useQuery({ queryKey: ["tpv-tables", companyId], queryFn: () => tpvTablesApi.list(token!), enabled: !!token, staleTime: 30 * 1000 });
  const xQ = useQuery({ queryKey: ["tpv-x", companyId], queryFn: () => tpvApi.xReport(token!, todayIso()), enabled: !!token && canManage });
  const openQ = useQuery({ queryKey: ["tpv-open", companyId], queryFn: () => tpvApi.listOpen(token!), enabled: !!token });

  const cats = catsQ.data ?? [];
  const items = itemsQ.data ?? [];
  const tables = tablesQ.data ?? [];
  const deliveryOrders = useMemo(
    () => (openQ.data ?? []).filter((o) => o.channel !== "DINE_IN"),
    [openQ.data],
  );

  const refreshSala = () => {
    queryClient.invalidateQueries({ queryKey: ["tpv-tables"] });
    queryClient.invalidateQueries({ queryKey: ["tpv-open"] });
  };

  function goToOrder(o: TpvOrder, label: string) {
    setOrder(o);
    setHeaderLabel(label);
    setView("order");
  }

  const openTableMut = useMutation({
    mutationFn: async (t: TpvTable) => {
      if (t.openOrderId != null) return { o: await tpvApi.getOrder(token!, t.openOrderId), label: t.label };
      const o = await tpvApi.createOrder(token!, { channel: "DINE_IN", tableId: t.id });
      return { o, label: t.label };
    },
    onSuccess: ({ o, label }) => goToOrder(o, label),
    onError: (e: Error) => notify.error(e.message ?? "No se pudo abrir la mesa"),
  });

  const openCustomerMut = useMutation({
    mutationFn: (d: CustomerDraft) =>
      tpvApi.createOrder(token!, {
        channel: d.channel,
        customerId: d.customerId ?? null,
        customerName: d.name || null,
        customerPhone: d.phone || null,
        customerAddress: d.channel === "DELIVERY" ? d.address || null : null,
      }),
    onSuccess: (o, d) => {
      setCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["tpv-customers"] });
      goToOrder(o, d.name ? `${CHANNEL_LABEL[d.channel]} · ${d.name}` : CHANNEL_LABEL[d.channel]);
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo crear el pedido"),
  });

  const recallMut = useMutation({
    mutationFn: (o: TpvOrder) => tpvApi.getOrder(token!, o.id),
    onSuccess: (o) =>
      goToOrder(o, o.customerName ? `${CHANNEL_LABEL[o.channel]} · ${o.customerName}` : CHANNEL_LABEL[o.channel]),
    onError: (e: Error) => notify.error(e.message ?? "No se pudo abrir el pedido"),
  });

  // Mesas
  const updateTableMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: TpvTableInput }) => tpvTablesApi.update(token!, id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tpv-tables"] }),
    onError: (e: Error) => notify.error(e.message ?? "No se pudo guardar la mesa"),
  });
  const createTableMut = useMutation({
    mutationFn: (body: TpvTableInput) => tpvTablesApi.create(token!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tpv-tables"] });
      notify.success("Mesa creada");
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo crear la mesa"),
  });
  const deleteTableMut = useMutation({
    mutationFn: (id: number) => tpvTablesApi.remove(token!, id),
    onSuccess: () => {
      setSelectedTableId(null);
      queryClient.invalidateQueries({ queryKey: ["tpv-tables"] });
      notify.success("Mesa eliminada");
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo eliminar"),
  });

  const seedSalaMut = useMutation({
    mutationFn: () => tpvTablesApi.seedDefault(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tpv-tables"] });
      notify.success("Sala de ejemplo generada");
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo generar la sala"),
  });

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  if (!mounted) {
    return (
      <ErpPageShell>
        <AppTopHeader />
        <main className="flex-1 min-h-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </main>
      </ErpPageShell>
    );
  }

  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 sm:px-7">
        {/* Cabecera */}
        <div className="mb-4 pt-1 flex items-start justify-between gap-3 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setView("sala")}
            title="Ir a la sala"
            className="flex items-center gap-3 text-left rounded-2xl hover:opacity-90 transition-opacity"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#f0f3ff] flex items-center justify-center text-[#4f6ef7] shrink-0">
              <Monitor size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e2040]">TPV</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Sala, pedidos y cobro · el ticket fiscal lo emite tu sistema certificado
              </p>
            </div>
          </button>
          {canOperate ? (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <button
                type="button"
                onClick={() => setView("kitchen")}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 font-semibold ${
                  view === "kitchen" ? "bg-[#f0f3ff] text-[#4f6ef7] border-[#4f6ef7]" : "bg-white text-gray-600 border-gray-200 hover:border-[#4f6ef7]"
                }`}
              >
                <ChefHat size={16} /> Cocina
              </button>
              {canManage ? (
              <>
              <button
                type="button"
                onClick={() => setView("history")}
                title="Ver historial de ventas"
                className={`rounded-xl border px-4 py-2 shadow-sm text-left hover:border-[#4f6ef7] ${
                  view === "history" ? "bg-[#f0f3ff] border-[#4f6ef7]" : "bg-white border-gray-100"
                }`}
              >
                <span className="text-gray-400 text-xs block">Ventas hoy</span>
                <span className="font-bold text-[#1e2040]">{money(xQ.data?.totalSales ?? 0)}</span>
                <span className="text-gray-400 text-xs"> · {xQ.data?.paymentCount ?? 0} cobros</span>
              </button>
              <button
                type="button"
                onClick={() => setView("dashboard")}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 font-semibold ${
                  view === "dashboard" ? "bg-[#f0f3ff] text-[#4f6ef7] border-[#4f6ef7]" : "bg-white text-gray-600 border-gray-200 hover:border-[#4f6ef7]"
                }`}
              >
                <BarChart3 size={16} /> Informes
              </button>
              <button
                type="button"
                onClick={() => setView("customers")}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 font-semibold ${
                  view === "customers" ? "bg-[#f0f3ff] text-[#4f6ef7] border-[#4f6ef7]" : "bg-white text-gray-600 border-gray-200 hover:border-[#4f6ef7]"
                }`}
              >
                <Users size={16} /> Clientes
              </button>
              <button
                type="button"
                onClick={() => setShowCatalog(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-3 py-2.5 font-semibold text-gray-600 hover:border-[#4f6ef7]"
              >
                <UtensilsCrossed size={16} /> Carta
              </button>
              <button
                type="button"
                onClick={() => setShowCash(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1e2040] text-white px-4 py-2.5 font-semibold hover:bg-[#2b2e57]"
              >
                <Receipt size={16} /> Caja
              </button>
              </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-6">
        {view === "order" && order ? (
          <OrderView
            token={token!}
            order={order}
            setOrder={setOrder}
            cats={cats}
            items={items}
            itemsLoading={itemsQ.isLoading}
            canOperate={canOperate}
            canManage={canManage}
            headerLabel={headerLabel}
            onBack={() => {
              setView("sala");
              setOrder(null);
              refreshSala();
            }}
            onPaid={() => {
              notify.success("Cobro registrado");
              queryClient.invalidateQueries({ queryKey: ["tpv-x"] });
              queryClient.invalidateQueries({ queryKey: ["tpv-sales"] });
              setView("sala");
              setOrder(null);
              refreshSala();
            }}
          />
        ) : view === "history" ? (
          <HistoryView token={token!} onBack={() => setView("sala")} />
        ) : view === "customers" ? (
          <CustomersView token={token!} onBack={() => setView("sala")} />
        ) : view === "dashboard" ? (
          <DashboardView token={token!} onBack={() => setView("sala")} />
        ) : view === "kitchen" ? (
          <KitchenView token={token!} onBack={() => setView("sala")} />
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-5">
            {/* Plano de sala */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-[#1e2040]">Sala</h2>
                  <p className="text-xs text-gray-500">
                    {editMode ? "Arrastra para colocar · esquina para redimensionar" : "Toca una mesa para abrir su comanda"}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-2">
                    {tables.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => seedSalaMut.mutate()}
                        disabled={seedSalaMut.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f6ef7] text-white px-3 py-2 text-sm font-semibold hover:bg-[#3d5ae0] disabled:opacity-60"
                      >
                        {seedSalaMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Generar sala de ejemplo
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode((v) => !v);
                        setSelectedTableId(null);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold border ${
                        editMode ? "bg-[#1e2040] text-white border-[#1e2040]" : "bg-white text-gray-600 border-gray-200 hover:border-[#1e2040]"
                      }`}
                    >
                      {editMode ? <Check size={15} /> : <Pencil size={15} />} {editMode ? "Listo" : "Editar plano"}
                    </button>
                  </div>
                ) : null}
              </div>

              {tablesQ.isLoading ? (
                <div className="flex items-center gap-2 text-gray-500 py-16 justify-center">
                  <Loader2 className="animate-spin" size={20} /> Cargando sala…
                </div>
              ) : tables.length === 0 ? (
                <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-2xl">
                  No hay mesas todavía. {canManage ? "Genera la sala de ejemplo y reorganízala." : ""}
                </p>
              ) : (
                <FloorPlan
                  tables={tables}
                  editMode={editMode}
                  activeZone={activeZone}
                  setActiveZone={setActiveZone}
                  selectedId={selectedTableId}
                  onSelect={setSelectedTableId}
                  onOpenTable={(t) => openTableMut.mutate(t)}
                  onPersist={(id, body) => updateTableMut.mutate({ id, body })}
                />
              )}

              {editMode && canManage ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      createTableMut.mutate({ label: `Mesa ${tables.length + 1}`, zone: activeZone, seats: 4 })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#4f6ef7]"
                  >
                    <Plus size={15} /> Añadir mesa a {activeZone}
                  </button>
                  {selectedTable ? (
                    <TableEditor
                      key={selectedTable.id}
                      table={selectedTable}
                      onSave={(body) => updateTableMut.mutate({ id: selectedTable.id, body })}
                      onDelete={() => deleteTableMut.mutate(selectedTable.id)}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Pedidos para llevar / domicilio */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4">
                <h2 className="text-lg font-bold text-[#1e2040] mb-3">Nuevo pedido</h2>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canOperate}
                    onClick={() => setCustomer({ channel: "TAKEAWAY", name: "", phone: "", address: "", customerId: null })}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-200 py-4 text-sm font-semibold text-[#1e2040] hover:border-[#4f6ef7] hover:bg-[#f8f9ff] disabled:opacity-50"
                  >
                    <ShoppingBag size={22} className="text-[#4f6ef7]" /> Para llevar
                  </button>
                  <button
                    type="button"
                    disabled={!canOperate}
                    onClick={() => setCustomer({ channel: "DELIVERY", name: "", phone: "", address: "", customerId: null })}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-200 py-4 text-sm font-semibold text-[#1e2040] hover:border-[#4f6ef7] hover:bg-[#f8f9ff] disabled:opacity-50"
                  >
                    <Truck size={22} className="text-[#4f6ef7]" /> A domicilio
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4">
                <h2 className="text-lg font-bold text-[#1e2040] mb-3">
                  Pedidos activos {deliveryOrders.length > 0 ? `(${deliveryOrders.length})` : ""}
                </h2>
                {deliveryOrders.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Sin pedidos para llevar o a domicilio.</p>
                ) : (
                  <ul className="space-y-2">
                    {deliveryOrders.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => recallMut.mutate(o)}
                          className="w-full text-left rounded-xl border border-gray-200 px-3 py-2.5 hover:border-[#4f6ef7]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#1e2040]">
                              {o.channel === "DELIVERY" ? "🛵" : "🛍️"} {o.customerName || CHANNEL_LABEL[o.channel]}
                            </span>
                            <span className="text-sm font-bold text-[#4f6ef7]">{money(o.total)}</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            #{o.id} · {CHANNEL_LABEL[o.channel]}
                            {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canManage ? (
                <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4">
                  <h2 className="text-sm font-bold text-[#1e2040] mb-2">Resumen</h2>
                  <p className="text-[11px] text-gray-400">
                    {items.length} artículos en carta · {tables.length} mesas.{" "}
                    <Link href="/finances" className="text-[#4f6ef7] hover:underline">
                      Ver Finanzas
                    </Link>
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
        </div>
      </main>

      {showCatalog && token ? (
        <CatalogManagerModal token={token} cats={cats} onClose={() => setShowCatalog(false)} />
      ) : null}

      {customer ? (
        <CustomerModal
          token={token!}
          draft={customer}
          pending={openCustomerMut.isPending}
          onChange={setCustomer}
          onClose={() => setCustomer(null)}
          onConfirm={() => openCustomerMut.mutate(customer)}
        />
      ) : null}

      {showCash && token ? (
        <CashModal
          token={token}
          date={todayIso()}
          canCloseZ={canCloseZ}
          xSummary={xQ.data}
          onClose={() => setShowCash(false)}
          onZClosed={() => {
            queryClient.invalidateQueries({ queryKey: ["tpv-x"] });
            queryClient.invalidateQueries({ queryKey: ["tpv-sales"] });
          }}
        />
      ) : null}
    </ErpPageShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-sm font-bold text-[#1e2040]" : "text-sm text-gray-500"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CashModal({
  token,
  date,
  canCloseZ,
  xSummary,
  onClose,
  onZClosed,
}: {
  token: string;
  date: string;
  canCloseZ: boolean;
  xSummary: { totalSales: number; paymentCount: number; byFinanceChannel: { name: string; amount: number }[] } | undefined;
  onClose: () => void;
  onZClosed: () => void;
}) {
  const companyId = useAuthStore((s) => s.companyId);
  const queryClient = useQueryClient();
  const cashQ = useQuery<TpvCashState>({ queryKey: ["tpv-cash", companyId], queryFn: () => tpvCashApi.current(token), enabled: !!token });
  const cash = cashQ.data;

  const [floatStr, setFloatStr] = useState("");
  const [movType, setMovType] = useState<"IN" | "OUT">("OUT");
  const [movAmount, setMovAmount] = useState("");
  const [movReason, setMovReason] = useState("");
  const [countedStr, setCountedStr] = useState("");
  const [result, setResult] = useState<{ expectedCash: number; countedCash: number; difference: number } | null>(null);

  const num = (s: string) => Number(s.replace(",", ".")) || 0;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tpv-cash"] });

  const openMut = useMutation({
    mutationFn: () => tpvCashApi.open(token, num(floatStr)),
    onSuccess: () => { refresh(); notify.success("Caja abierta"); },
    onError: (e: Error) => notify.error(e.message),
  });
  const movMut = useMutation({
    mutationFn: () => tpvCashApi.movement(token, { type: movType, amount: num(movAmount), reason: movReason }),
    onSuccess: () => { refresh(); setMovAmount(""); setMovReason(""); notify.success("Movimiento registrado"); },
    onError: (e: Error) => notify.error(e.message),
  });
  const closeMut = useMutation({
    mutationFn: async () => {
      const res = await tpvCashApi.close(token, { countedCash: num(countedStr) });
      const z = await tpvApi.zClose(token, date);
      return { res, z };
    },
    onSuccess: ({ res, z }) => {
      setResult(res);
      refresh();
      onZClosed();
      notify.success(`Caja cerrada · Z ${money(z.totalSales)} a Finanzas`);
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo cerrar"),
  });

  const counted = num(countedStr);
  const diff = cash?.open ? counted - cash.expectedCash : 0;

  // Resultado del arqueo tras cerrar.
  if (result) {
    const ok = Math.abs(result.difference) < 0.005;
    return (
      <Modal title="Caja cerrada" subtitle={`Fecha: ${date}`} onClose={onClose} maxWidth="max-w-sm">
        <div className="space-y-1.5">
          <Row label="Efectivo esperado" value={money(result.expectedCash)} />
          <Row label="Efectivo contado" value={money(result.countedCash)} />
          <div className={`flex justify-between text-base font-bold mt-1 ${ok ? "text-emerald-600" : "text-red-600"}`}>
            <span>Descuadre</span>
            <span>{result.difference >= 0 ? "+" : ""}{money(result.difference)}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-[#1e2040] text-white py-2.5 font-bold hover:bg-[#2b2e57]">
          Hecho
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Caja" subtitle={`Fecha: ${date}`} onClose={onClose} maxWidth="max-w-md">
      {cashQ.isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
          <Loader2 className="animate-spin" size={18} /> Cargando caja…
        </div>
      ) : !cash?.open ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">No hay caja abierta. Indica el fondo inicial para abrirla.</p>
          <div className="flex items-center gap-2">
            <input
              value={floatStr}
              onChange={(e) => setFloatStr(e.target.value)}
              inputMode="decimal"
              placeholder="Fondo inicial €"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
            />
            <button
              type="button"
              disabled={openMut.isPending}
              onClick={() => openMut.mutate()}
              className="rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 font-semibold hover:bg-[#3d5ae0] disabled:opacity-60"
            >
              Abrir caja
            </button>
          </div>
          {canCloseZ ? (
            <button
              type="button"
              disabled={closeMut.isPending}
              onClick={() => closeMut.mutate()}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-[#1e2040]"
              title="Volcar ventas a Finanzas sin arqueo de efectivo"
            >
              {closeMut.isPending ? "Cerrando…" : "Cerrar caja (Z) sin arqueo"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-[#f0f3ff] border border-[#4f6ef7]/20 px-4 py-3 space-y-1">
            <Row label="Fondo inicial" value={money(cash.openingFloat)} />
            <Row label="Ventas en efectivo" value={money(cash.cashSales)} />
            {cash.movementsIn > 0 ? <Row label="Entradas" value={money(cash.movementsIn)} /> : null}
            {cash.movementsOut > 0 ? <Row label="Salidas" value={`−${money(cash.movementsOut)}`} /> : null}
            <Row label="Efectivo esperado" value={money(cash.expectedCash)} strong />
            <div className="text-[11px] text-gray-400">
              Ventas hoy: {money(xSummary?.totalSales ?? 0)} · {xSummary?.paymentCount ?? 0} cobros
            </div>
          </div>

          {/* Movimientos */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Movimientos de caja</p>
            {cash.movements.length > 0 ? (
              <ul className="mb-2 space-y-0.5">
                {cash.movements.map((m) => (
                  <li key={m.id} className="flex justify-between text-xs">
                    <span className={m.type === "IN" ? "text-emerald-600" : "text-red-500"}>
                      {m.type === "IN" ? "+" : "−"}{money(m.amount)} {m.reason ? `· ${m.reason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex items-center gap-1.5">
              <select value={movType} onChange={(e) => setMovType(e.target.value as "IN" | "OUT")} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white outline-none focus:border-[#4f6ef7]">
                <option value="OUT">Salida</option>
                <option value="IN">Entrada</option>
              </select>
              <input value={movAmount} onChange={(e) => setMovAmount(e.target.value)} inputMode="decimal" placeholder="€" className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#4f6ef7]" />
              <input value={movReason} onChange={(e) => setMovReason(e.target.value)} placeholder="Motivo" className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#4f6ef7]" />
              <button type="button" disabled={movMut.isPending || num(movAmount) <= 0} onClick={() => movMut.mutate()} className="rounded-lg bg-white border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-[#4f6ef7] disabled:opacity-50">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Arqueo */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-sm font-semibold text-[#1e2040]">Efectivo contado</label>
              <input value={countedStr} onChange={(e) => setCountedStr(e.target.value)} inputMode="decimal" placeholder="0,00 €" className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-right outline-none focus:border-[#4f6ef7]" />
            </div>
            {countedStr ? (
              <div className={`flex justify-between text-sm font-bold mb-2 ${Math.abs(diff) < 0.005 ? "text-emerald-600" : "text-red-600"}`}>
                <span>Descuadre</span>
                <span>{diff >= 0 ? "+" : ""}{money(diff)}</span>
              </div>
            ) : null}
            {canCloseZ ? (
              <button
                type="button"
                disabled={closeMut.isPending || !countedStr}
                onClick={() => closeMut.mutate()}
                className="w-full rounded-xl bg-[#1e2040] text-white py-2.5 font-bold hover:bg-[#2b2e57] disabled:opacity-50"
              >
                {closeMut.isPending ? "Cerrando…" : "Cerrar caja y hacer Z"}
              </button>
            ) : (
              <p className="text-[11px] text-gray-400">Solo OWNER/MANAGER puede cerrar la caja.</p>
            )}
            <p className="mt-2 text-[11px] text-gray-400">
              Al cerrar, las ventas se vuelcan a Finanzas como canales de ingreso del día.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TableEditor({
  table,
  onSave,
  onDelete,
}: {
  table: TpvTable;
  onSave: (body: TpvTableInput) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(table.label);
  const [zone, setZone] = useState(table.zone);
  const [seats, setSeats] = useState(String(table.seats));
  const [shape, setShape] = useState(table.shape);

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Editar {table.label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nombre"
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          placeholder="Zona"
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          inputMode="numeric"
          placeholder="Plazas"
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <select
          value={shape}
          onChange={(e) => setShape(e.target.value as TpvTable["shape"])}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7] bg-white"
        >
          <option value="RECT">Cuadrada</option>
          <option value="ROUND">Redonda</option>
        </select>
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <button
          type="button"
          onClick={() => onSave({ label, zone, seats: Number(seats) || 0, shape })}
          className="flex-1 rounded-lg bg-[#1e2040] text-white py-1.5 text-sm font-semibold hover:bg-[#2b2e57]"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 text-red-500 px-3 py-1.5 text-sm font-semibold hover:bg-red-50"
        >
          <Trash2 size={14} /> Eliminar
        </button>
      </div>
    </div>
  );
}

function CustomerModal({
  token,
  draft,
  pending,
  onChange,
  onClose,
  onConfirm,
}: {
  token: string;
  draft: CustomerDraft;
  pending: boolean;
  onChange: (d: CustomerDraft) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [term, setTerm] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);

  const searchQ = useQuery<TpvCustomer[]>({
    queryKey: ["tpv-customers-search", term],
    queryFn: () => tpvCustomersApi.search(token, term),
    enabled: !!token && term.trim().length >= 2,
  });
  const suggestions = searchQ.data ?? [];

  // Al teclear nombre/teléfono buscamos coincidencias; editar manualmente desvincula el cliente elegido.
  const onName = (v: string) => {
    onChange({ ...draft, name: v, customerId: null });
    setTerm(v);
    setShowSuggest(true);
  };
  const onPhone = (v: string) => {
    onChange({ ...draft, phone: v, customerId: null });
    setTerm(v);
    setShowSuggest(true);
  };
  const pick = (c: TpvCustomer) => {
    onChange({
      ...draft,
      customerId: c.id,
      name: c.name,
      phone: c.phone ?? "",
      address: c.address ?? draft.address,
    });
    setShowSuggest(false);
    setTerm("");
  };

  return (
    <Modal title={CHANNEL_LABEL[draft.channel]} subtitle="Busca un cliente o escribe los datos (nombre y teléfono)" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-2.5">
        <div className="relative">
          <input
            value={draft.name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Nombre del cliente"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
          />
          {draft.customerId ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-emerald-600">
              ✓ guardado
            </span>
          ) : null}
          {showSuggest && term.trim().length >= 2 && suggestions.length > 0 ? (
            <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto">
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="w-full text-left px-3 py-2 hover:bg-[#f8f9ff] border-b border-gray-50 last:border-0"
                >
                  <span className="block text-sm font-semibold text-[#1e2040]">{c.name}</span>
                  <span className="block text-xs text-gray-500">
                    {c.phone ?? "—"}
                    {c.address ? ` · ${c.address}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <input
          value={draft.phone}
          onChange={(e) => onPhone(e.target.value)}
          inputMode="tel"
          placeholder="Teléfono"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        {draft.channel === "DELIVERY" ? (
          <input
            value={draft.address}
            onChange={(e) => onChange({ ...draft, address: e.target.value })}
            placeholder="Dirección de entrega"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
          />
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        El cliente se guarda automáticamente en tu fichero al empezar la comanda.
      </p>
      <button
        type="button"
        disabled={pending || !draft.name.trim() || !draft.phone.trim()}
        onClick={onConfirm}
        className="mt-3 w-full rounded-xl bg-[#1e2040] text-white py-2.5 font-bold hover:bg-[#2b2e57] disabled:opacity-60"
      >
        {pending
          ? "Creando…"
          : !draft.name.trim() || !draft.phone.trim()
            ? "Nombre y teléfono obligatorios"
            : "Empezar comanda"}
      </button>
    </Modal>
  );
}
