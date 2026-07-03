"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Receipt as ReceiptIcon, Search, Trash2, User } from "lucide-react";
import { notify } from "../shared/ui";
import { tpvCustomersApi, type TpvCustomer, type TpvCustomerInput } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { CHANNEL_LABEL, Modal, money } from "./shared";
import { ReceiptModal } from "./history";

export function CustomersView({ token, onBack }: { token: string; onBack: () => void }) {
  const companyId = useAuthStore((s) => s.companyId);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TpvCustomer | "new" | null>(null);

  const listQ = useQuery({ queryKey: ["tpv-customers", companyId], queryFn: () => tpvCustomersApi.list(token), enabled: !!token });
  const customers = listQ.data ?? [];

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

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
          <h2 className="text-lg font-bold text-[#1e2040]">Clientes</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              className="rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-[#4f6ef7] w-64"
            />
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f6ef7] text-white px-3 py-2 text-sm font-semibold hover:bg-[#3d5ae0]"
          >
            <Plus size={15} /> Nuevo cliente
          </button>
        </div>
      </div>

      {listQ.isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 className="animate-spin" size={20} /> Cargando clientes…
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center border border-dashed border-gray-200 rounded-2xl">
          {customers.length === 0 ? "Aún no hay clientes. Crea uno o se guardarán solos al tomar pedidos." : "Sin resultados."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {shown.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setEditing(c)}
                className="w-full text-left flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50"
              >
                <span className="w-9 h-9 rounded-full bg-[#f0f3ff] flex items-center justify-center text-[#4f6ef7] shrink-0">
                  <User size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[#1e2040] truncate">{c.name}</span>
                  <span className="block text-xs text-gray-500 truncate">
                    {c.phone ?? "—"}
                    {c.address ? ` · ${c.address}` : ""}
                    {c.taxId ? ` · NIF ${c.taxId}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <CustomerEditor
          token={token}
          customer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function emptyForm(): TpvCustomerInput {
  return { name: "", phone: "", email: "", address: "", city: "", postalCode: "", taxId: "", notes: "" };
}

function CustomerEditor({
  token,
  customer,
  onClose,
}: {
  token: string;
  customer: TpvCustomer | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TpvCustomerInput>(
    customer
      ? {
          name: customer.name,
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          address: customer.address ?? "",
          city: customer.city ?? "",
          postalCode: customer.postalCode ?? "",
          taxId: customer.taxId ?? "",
          notes: customer.notes ?? "",
        }
      : emptyForm(),
  );
  const [receiptOrderId, setReceiptOrderId] = useState<number | null>(null);
  const set = (patch: Partial<TpvCustomerInput>) => setForm((p) => ({ ...p, ...patch }));

  const ordersQ = useQuery({
    queryKey: ["tpv-customer-orders", customer?.id],
    queryFn: () => tpvCustomersApi.orders(token, customer!.id),
    enabled: !!customer,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tpv-customers"] });

  const saveMut = useMutation({
    mutationFn: () =>
      customer ? tpvCustomersApi.update(token, customer.id, form) : tpvCustomersApi.create(token, form),
    onSuccess: () => { invalidate(); notify.success(customer ? "Cliente actualizado" : "Cliente creado"); onClose(); },
    onError: (e: Error) => notify.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: () => tpvCustomersApi.remove(token, customer!.id),
    onSuccess: () => { invalidate(); notify.success("Cliente eliminado"); onClose(); },
    onError: (e: Error) => notify.error(e.message),
  });

  const canSave = form.name.trim() && form.phone.trim();

  return (
    <Modal
      title={customer ? customer.name : "Nuevo cliente"}
      subtitle="Nombre y teléfono obligatorios · el resto opcional (facturación)"
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <div className="grid grid-cols-2 gap-2.5">
        <input
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Nombre *"
          className="col-span-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={form.phone}
          onChange={(e) => set({ phone: e.target.value })}
          inputMode="tel"
          placeholder="Teléfono *"
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={form.email ?? ""}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="Email"
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={form.address ?? ""}
          onChange={(e) => set({ address: e.target.value })}
          placeholder="Dirección"
          className="col-span-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={form.city ?? ""}
          onChange={(e) => set({ city: e.target.value })}
          placeholder="Ciudad"
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={form.postalCode ?? ""}
          onChange={(e) => set({ postalCode: e.target.value })}
          placeholder="Código postal"
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={form.taxId ?? ""}
          onChange={(e) => set({ taxId: e.target.value })}
          placeholder="NIF / CIF (facturas)"
          className="col-span-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Notas"
          rows={2}
          className="col-span-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7] resize-none"
        />
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          disabled={!canSave || saveMut.isPending}
          onClick={() => saveMut.mutate()}
          className="flex-1 rounded-xl bg-[#1e2040] text-white py-2.5 font-bold hover:bg-[#2b2e57] disabled:opacity-50"
        >
          {saveMut.isPending ? "Guardando…" : "Guardar"}
        </button>
        {customer ? (
          <button
            type="button"
            onClick={() => { if (window.confirm(`¿Eliminar a "${customer.name}"?`)) deleteMut.mutate(); }}
            className="inline-flex items-center gap-1 rounded-xl border border-red-200 text-red-500 px-3 py-2.5 text-sm font-semibold hover:bg-red-50"
          >
            <Trash2 size={15} /> Eliminar
          </button>
        ) : null}
      </div>

      {customer ? (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Historial de pedidos</p>
          {ordersQ.isLoading ? (
            <div className="flex items-center gap-2 text-gray-500 py-3 text-sm">
              <Loader2 className="animate-spin" size={16} /> Cargando…
            </div>
          ) : (ordersQ.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Sin pedidos registrados todavía.</p>
          ) : (
            <ul className="space-y-1.5">
              {(ordersQ.data ?? []).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setReceiptOrderId(s.id)}
                    className="w-full text-left flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:border-[#4f6ef7]"
                  >
                    <span className="text-sm text-[#1e2040]">
                      #{s.id} · {s.businessDay} · {CHANNEL_LABEL[s.channel]}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {money(s.total)} <ReceiptIcon size={14} className="text-[#4f6ef7]" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {receiptOrderId != null ? (
        <ReceiptModal token={token} orderId={receiptOrderId} onClose={() => setReceiptOrderId(null)} />
      ) : null}
    </Modal>
  );
}
