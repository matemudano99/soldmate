"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { notify } from "../shared/ui";
import { inventoryApi, tpvApi, type ProductResponse, type TpvCategory, type TpvItem } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { Modal, money } from "./shared";

type VariantRow = { label: string; price: string };
type ItemFormValue = {
  categoryId: number;
  name: string;
  price: string;
  vatRate: string;
  sellsAsProductId: number | "";
  allowsModifiers: boolean;
  kitchen: boolean;
  autoSoldOut: boolean;
  modifierGroupIds: number[];
  variants: VariantRow[];
};

export function CatalogManagerModal({
  token,
  cats,
  onClose,
}: {
  token: string;
  cats: TpvCategory[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = useAuthStore((s) => s.companyId);
  const itemsQ = useQuery({ queryKey: ["tpv-items", companyId], queryFn: () => tpvApi.listItems(token) });
  const productsQ = useQuery<ProductResponse[]>({ queryKey: ["inv-products", companyId], queryFn: () => inventoryApi.getAll(token) });
  const items = itemsQ.data ?? [];
  const products = productsQ.data ?? [];

  const [newCatName, setNewCatName] = useState("");
  const [newCatMod, setNewCatMod] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [creatingInCat, setCreatingInCat] = useState<number | null>(null);
  const [editingCat, setEditingCat] = useState<number | null>(null);

  const itemsByCat = useMemo(() => {
    const map = new Map<number, TpvItem[]>();
    for (const it of items) {
      const arr = map.get(it.categoryId) ?? [];
      arr.push(it);
      map.set(it.categoryId, arr);
    }
    return map;
  }, [items]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tpv-items"] });
    queryClient.invalidateQueries({ queryKey: ["tpv-cats"] });
  };

  const createCatMut = useMutation({
    mutationFn: () => tpvApi.createCategory(token, { name: newCatName.trim(), isModifierGroup: newCatMod }),
    onSuccess: () => { invalidate(); setNewCatName(""); setNewCatMod(false); notify.success("Categoría creada"); },
    onError: (e: Error) => notify.error(e.message),
  });
  const deleteCatMut = useMutation({
    mutationFn: (id: number) => tpvApi.deleteCategory(token, id),
    onSuccess: () => { invalidate(); notify.success("Categoría eliminada"); },
    onError: (e: Error) => notify.error(e.message),
  });
  const updateCatMut = useMutation({
    mutationFn: ({ id, name, isModifierGroup }: { id: number; name: string; isModifierGroup: boolean }) =>
      tpvApi.updateCategory(token, id, { name, isModifierGroup }),
    onSuccess: () => { invalidate(); setEditingCat(null); notify.success("Categoría actualizada"); },
    onError: (e: Error) => notify.error(e.message),
  });
  const createItemMut = useMutation({
    mutationFn: (body: any) => tpvApi.createItem(token, body),
    onSuccess: () => { invalidate(); setCreatingInCat(null); notify.success("Artículo creado"); },
    onError: (e: Error) => notify.error(e.message),
  });
  const updateItemMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => tpvApi.updateItem(token, id, body),
    onSuccess: () => { invalidate(); setEditingItem(null); notify.success("Artículo actualizado"); },
    onError: (e: Error) => notify.error(e.message),
  });
  const deleteItemMut = useMutation({
    mutationFn: (id: number) => tpvApi.deleteItem(token, id),
    onSuccess: () => { invalidate(); notify.success("Artículo eliminado"); },
    onError: (e: Error) => notify.error(e.message),
  });
  const availabilityMut = useMutation({
    mutationFn: ({ id, available }: { id: number; available: boolean }) => tpvApi.setItemAvailability(token, id, available),
    onSuccess: (it) => { invalidate(); notify.success(it.available ? "Disponible" : "Agotado"); },
    onError: (e: Error) => { invalidate(); notify.error(e.message); },
  });

  function toBody(v: ItemFormValue) {
    return {
      categoryId: v.categoryId,
      name: v.name.trim(),
      price: Number(v.price.replace(",", ".")) || 0,
      vatRate: Number(v.vatRate.replace(",", ".")) || 10,
      sellsAsProductId: v.sellsAsProductId === "" ? null : Number(v.sellsAsProductId),
      allowsModifiers: v.allowsModifiers,
      kitchen: v.kitchen,
      autoSoldOut: v.autoSoldOut,
      modifierGroupIds: v.allowsModifiers ? v.modifierGroupIds : [],
      variants: v.variants
        .filter((r) => r.label.trim() && r.price.trim())
        .map((r) => ({ label: r.label.trim(), price: Number(r.price.replace(",", ".")) || 0 })),
    };
  }

  return (
    <Modal title="Gestión de carta" subtitle="Categorías, artículos y variantes" onClose={onClose} maxWidth="max-w-2xl">
      {/* Crear categoría */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-gray-100">
        <input
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="Nueva categoría"
          className="flex-1 min-w-[160px] rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={newCatMod} onChange={(e) => setNewCatMod(e.target.checked)} /> Modificadores
        </label>
        <button
          type="button"
          disabled={!newCatName.trim() || createCatMut.isPending}
          onClick={() => createCatMut.mutate()}
          className="inline-flex items-center gap-1 rounded-lg bg-[#4f6ef7] text-white px-3 py-2 text-xs font-semibold hover:bg-[#3d5ae0] disabled:opacity-50"
        >
          <Plus size={14} /> Categoría
        </button>
      </div>

      {cats.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No hay categorías. Crea una arriba o carga la carta.</p>
      ) : null}

      <div className="space-y-3">
        {cats.map((c) => {
          const catItems = itemsByCat.get(c.id) ?? [];
          const isCollapsed = collapsed[c.id];
          return (
            <div key={c.id} className="rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/70 rounded-t-xl">
                <button type="button" onClick={() => setCollapsed((p) => ({ ...p, [c.id]: !p[c.id] }))} className="text-gray-400">
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                {editingCat === c.id ? (
                  <CategoryEditor
                    cat={c}
                    pending={updateCatMut.isPending}
                    onCancel={() => setEditingCat(null)}
                    onSave={(name, isModifierGroup) => updateCatMut.mutate({ id: c.id, name, isModifierGroup })}
                  />
                ) : (
                  <>
                    <span className="font-bold text-sm text-[#1e2040] flex-1">
                      {c.name}{" "}
                      {c.isModifierGroup ? (
                        <span className="text-[10px] font-bold uppercase text-amber-500">· modificadores</span>
                      ) : null}
                      <span className="text-xs text-gray-400 font-normal"> ({catItems.length})</span>
                    </span>
                    <button type="button" onClick={() => setEditingCat(c.id)} className="text-gray-400 hover:text-[#4f6ef7]" aria-label="Editar categoría">
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar "${c.name}" y sus ${catItems.length} artículos?`)) deleteCatMut.mutate(c.id);
                      }}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Eliminar categoría"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>

              {!isCollapsed ? (
                <div className="p-2 space-y-1">
                  {catItems.map((it) =>
                    editingItem === it.id ? (
                      <ItemForm
                        key={it.id}
                        cats={cats}
                        products={products}
                        pending={updateItemMut.isPending}
                        initial={{
                          categoryId: it.categoryId,
                          name: it.name,
                          price: String(it.price),
                          vatRate: String(it.vatRate),
                          sellsAsProductId: it.sellsAsProductId ?? "",
                          allowsModifiers: it.allowsModifiers,
                          kitchen: it.kitchen,
                          autoSoldOut: it.autoSoldOut,
                          modifierGroupIds: it.modifierGroupIds ?? [],
                          variants: it.variants.map((v) => ({ label: v.label, price: String(v.price) })),
                        }}
                        onCancel={() => setEditingItem(null)}
                        onSubmit={(v) => updateItemMut.mutate({ id: it.id, body: toBody(v) })}
                      />
                    ) : (
                      <div key={it.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                        <span className={`flex-1 text-sm ${it.soldOut ? "text-gray-400 line-through" : "text-[#1e2040]"}`}>
                          {it.name}
                          {it.variants.length > 0 ? (
                            <span className="text-xs text-gray-400"> · {it.variants.map((v) => v.label).join("/")}</span>
                          ) : null}
                          {it.allowsModifiers ? <span className="text-[10px] text-amber-500 font-bold"> +extras</span> : null}
                        </span>
                        <span className="text-sm font-semibold text-gray-600 w-14 text-right">{money(it.price)}</span>
                        <button
                          type="button"
                          onClick={() => availabilityMut.mutate({ id: it.id, available: !it.available })}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${
                            it.available
                              ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              : "border-red-200 text-red-600 bg-red-50"
                          }`}
                          title={it.available ? "Marcar agotado" : "Marcar disponible"}
                        >
                          {it.available ? "Disp." : "Agotado"}
                        </button>
                        <button type="button" onClick={() => setEditingItem(it.id)} className="text-gray-400 hover:text-[#4f6ef7]" aria-label="Editar">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm(`¿Eliminar "${it.name}"?`)) deleteItemMut.mutate(it.id); }}
                          className="text-gray-400 hover:text-red-500"
                          aria-label="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ),
                  )}

                  {creatingInCat === c.id ? (
                    <ItemForm
                      cats={cats}
                      products={products}
                      pending={createItemMut.isPending}
                      initial={{
                        categoryId: c.id,
                        name: "",
                        price: "",
                        vatRate: "10",
                        sellsAsProductId: "",
                        allowsModifiers: false,
                        kitchen: !c.isModifierGroup && !/^bebida/i.test(c.name),
                        autoSoldOut: false,
                        modifierGroupIds: [],
                        variants: [],
                      }}
                      onCancel={() => setCreatingInCat(null)}
                      onSubmit={(v) => createItemMut.mutate(toBody(v))}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreatingInCat(c.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#4f6ef7] hover:underline px-2 py-1"
                    >
                      <Plus size={13} /> Añadir artículo
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function CategoryEditor({
  cat,
  pending,
  onCancel,
  onSave,
}: {
  cat: TpvCategory;
  pending: boolean;
  onCancel: () => void;
  onSave: (name: string, isModifierGroup: boolean) => void;
}) {
  const [name, setName] = useState(cat.name);
  const [mod, setMod] = useState(cat.isModifierGroup);
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-[#4f6ef7]"
      />
      <label className="flex items-center gap-1 text-xs text-gray-600">
        <input type="checkbox" checked={mod} onChange={(e) => setMod(e.target.checked)} /> Mod.
      </label>
      <button type="button" disabled={pending} onClick={() => onSave(name.trim(), mod)} className="rounded-lg bg-[#1e2040] text-white px-2.5 py-1 text-xs font-semibold">
        Guardar
      </button>
      <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={15} /></button>
    </div>
  );
}

function ItemForm({
  cats,
  products,
  pending,
  initial,
  onCancel,
  onSubmit,
}: {
  cats: TpvCategory[];
  products: ProductResponse[];
  pending: boolean;
  initial: ItemFormValue;
  onCancel: () => void;
  onSubmit: (v: ItemFormValue) => void;
}) {
  const [v, setV] = useState<ItemFormValue>(initial);
  const set = (patch: Partial<ItemFormValue>) => setV((prev) => ({ ...prev, ...patch }));

  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    set({ variants: v.variants.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });

  return (
    <div className="rounded-xl border border-[#4f6ef7]/40 bg-[#f8f9ff] p-3 space-y-2 my-1">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={v.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Nombre"
          className="col-span-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={v.price}
          onChange={(e) => set({ price: e.target.value })}
          placeholder="Precio €"
          inputMode="decimal"
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <input
          value={v.vatRate}
          onChange={(e) => set({ vatRate: e.target.value })}
          placeholder="IVA %"
          inputMode="decimal"
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7]"
        />
        <select
          value={v.categoryId}
          onChange={(e) => set({ categoryId: Number(e.target.value) })}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7] bg-white"
        >
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={v.sellsAsProductId}
          onChange={(e) => set({ sellsAsProductId: e.target.value ? Number(e.target.value) : "" })}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#4f6ef7] bg-white"
        >
          <option value="">Sin descuento de stock</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>Descuenta: {p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={v.allowsModifiers} onChange={(e) => set({ allowsModifiers: e.target.checked })} />
          Admite combinados (salsas/extras)
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={v.kitchen} onChange={(e) => set({ kitchen: e.target.checked })} />
          Imprime en cocina
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={v.autoSoldOut} onChange={(e) => set({ autoSoldOut: e.target.checked })} />
          Auto-agotar al quedar sin stock
        </label>
      </div>

      {v.allowsModifiers ? (
        <div className="rounded-lg border border-gray-100 bg-white/60 p-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
            Grupos de combinados (vacío = todos)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cats.filter((c) => c.isModifierGroup).map((g) => {
              const on = v.modifierGroupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    set({
                      modifierGroupIds: on
                        ? v.modifierGroupIds.filter((x) => x !== g.id)
                        : [...v.modifierGroupIds, g.id],
                    })
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${
                    on ? "bg-[#4f6ef7] text-white border-[#4f6ef7]" : "bg-white text-gray-600 border-gray-200 hover:border-[#4f6ef7]"
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Variantes de tamaño */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">Tamaños (opcional, p. ej. Simple/Doble)</p>
        {v.variants.map((r, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input
              value={r.label}
              onChange={(e) => setVariant(i, { label: e.target.value })}
              placeholder="Tamaño"
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-[#4f6ef7]"
            />
            <input
              value={r.price}
              onChange={(e) => setVariant(i, { price: e.target.value })}
              placeholder="Precio €"
              inputMode="decimal"
              className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-[#4f6ef7]"
            />
            <button type="button" onClick={() => set({ variants: v.variants.filter((_, idx) => idx !== i) })} className="text-gray-400 hover:text-red-500">
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set({ variants: [...v.variants, { label: "", price: "" }] })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#4f6ef7] hover:underline"
        >
          <Plus size={12} /> Añadir tamaño
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={!v.name.trim() || pending}
          onClick={() => onSubmit(v)}
          className="rounded-lg bg-[#1e2040] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#2b2e57] disabled:opacity-50"
        >
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600">
          Cancelar
        </button>
      </div>
    </div>
  );
}
