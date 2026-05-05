"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, ChevronLeft, AlertTriangle, Minus, Plus, Trash2, Save, X } from "lucide-react";
import { WebErpNavbar } from "../shared/ui";
import { inventoryApi, type ProductResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

const UNIT_LABEL: Record<ProductResponse["unit"], string> = {
  KG: "kg",
  L: "L",
  UNIT: "ud",
  BOX: "cajas",
};

export default function InventoryPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const isOwner = role === "OWNER";
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
  }, []);

  const query = useQuery({
    queryKey: ["inventory", token],
    queryFn: () => inventoryApi.getAll(token!),
    enabled: authReady && !!token,
  });

  const stockMut = useMutation({
    mutationFn: ({ id, delta }: { id: number; delta: number }) => inventoryApi.updateStock(token!, id, delta),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
  const createMut = useMutation({
    mutationFn: (payload: {
      name: string;
      currentStock: number;
      minStock: number;
      unit: "KG" | "L" | "UNIT" | "BOX";
      category?: string | null;
      vatRate?: number | null;
    }) => inventoryApi.create(token!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
  const updateMut = useMutation({
    mutationFn: (payload: {
      id: number;
      minStock: number;
      currentStock: number;
      name: string;
      unit: "KG" | "L" | "UNIT" | "BOX";
      category?: string | null;
      vatRate?: number | null;
    }) =>
      inventoryApi.update(token!, payload.id, {
        name: payload.name,
        currentStock: payload.currentStock,
        minStock: payload.minStock,
        unit: payload.unit,
        category: payload.category ?? null,
        vatRate: payload.vatRate ?? null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
  const removeMut = useMutation({
    mutationFn: (id: number) => inventoryApi.remove(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });

  const products = query.data ?? [];
  const lowStock = useMemo(() => products.filter((p) => p.lowStock), [products]);
  const okStock = useMemo(() => products.filter((p) => !p.lowStock), [products]);

  return (
    <div className="flex min-h-screen bg-[#eef1f8] text-[#1e2040]">
      <WebErpNavbar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#4f6ef7] hover:underline"
          >
            <ChevronLeft size={14} />
            Dashboard
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="text-[#4f6ef7]" size={26} />
              Inventario
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Productos de tu empresa · puedes agregar, eliminar y ajustar mínimos necesarios.
            </p>
          </div>
        </div>

        {isOwner && authReady && !query.isLoading && (
          <AddProductCard
            onCreate={(payload) => createMut.mutate(payload)}
            pending={createMut.isPending}
          />
        )}

        {!authReady && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-12">
            <Loader2 className="animate-spin" size={18} />
            Restaurando sesión…
          </div>
        )}

        {authReady && query.isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-12">
            <Loader2 className="animate-spin" size={18} />
            Cargando inventario…
          </div>
        )}

        {authReady && query.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {(query.error as Error)?.message ?? "No se pudo cargar el inventario."}
          </div>
        )}

        {authReady && !query.isLoading && !query.isError && (
          <div className="space-y-8">
            {lowStock.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} className="text-amber-500" />
                  <h2 className="text-base font-semibold">Stock bajo</h2>
                  <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    {lowStock.length}
                  </span>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] overflow-hidden divide-y divide-gray-50">
                  {lowStock.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      canManage={isOwner}
                      onDelta={(id, d) => stockMut.mutate({ id, delta: d })}
                      onUpdateMin={(id, minStock, currentStock, name, unit, category, vatRate) =>
                        updateMut.mutate({ id, minStock, currentStock, name, unit, category, vatRate })
                      }
                      onRemove={(id, name) => {
                        if (!confirm(`¿Eliminar el producto «${name}»?`)) return;
                        removeMut.mutate(id);
                      }}
                      pending={stockMut.isPending}
                    />
                  ))}
                </div>
              </section>
            )}

            {okStock.length > 0 && (
              <section>
                <h2 className="text-base font-semibold mb-3">Resto de productos</h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] overflow-hidden divide-y divide-gray-50">
                  {okStock.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      canManage={isOwner}
                      onDelta={(id, d) => stockMut.mutate({ id, delta: d })}
                      onUpdateMin={(id, minStock, currentStock, name, unit, category, vatRate) =>
                        updateMut.mutate({ id, minStock, currentStock, name, unit, category, vatRate })
                      }
                      onRemove={(id, name) => {
                        if (!confirm(`¿Eliminar el producto «${name}»?`)) return;
                        removeMut.mutate(id);
                      }}
                      pending={stockMut.isPending}
                    />
                  ))}
                </div>
              </section>
            )}

            {products.length === 0 && (
              <p className="text-sm text-gray-500 py-8 text-center bg-white rounded-2xl border border-gray-100">
                No hay productos en el catálogo.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function AddProductCard({
  onCreate,
  pending,
}: {
  onCreate: (payload: {
    name: string;
    currentStock: number;
    minStock: number;
    unit: "KG" | "L" | "UNIT" | "BOX";
    category?: string | null;
    vatRate?: number | null;
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [currentStock, setCurrentStock] = useState("0");
  const [minStock, setMinStock] = useState("10");
  const [unit, setUnit] = useState<"KG" | "L" | "UNIT" | "BOX">("UNIT");
  const [category, setCategory] = useState("");

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-4">
      <p className="text-sm font-semibold text-[#1e2040] mb-3">Agregar producto</p>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          value={currentStock}
          onChange={(e) => setCurrentStock(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Stock actual"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Mínimo necesario"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as "KG" | "L" | "UNIT" | "BOX")}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="UNIT">ud</option>
          <option value="KG">kg</option>
          <option value="L">L</option>
          <option value="BOX">cajas</option>
        </select>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Categoría"
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-3">
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() => {
            onCreate({
              name: name.trim(),
              currentStock: Number(currentStock || 0),
              minStock: Number(minStock || 0),
              unit,
              category: category.trim() || null,
              vatRate: 10,
            });
            setName("");
            setCurrentStock("0");
            setMinStock("10");
            setCategory("");
          }}
          className="rounded-xl bg-[#4f6ef7] text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Agregar"}
        </button>
      </div>
    </div>
  );
}

function ProductRow({
  product: p,
  canManage,
  onDelta,
  onUpdateMin,
  onRemove,
  pending,
}: {
  product: ProductResponse;
  canManage: boolean;
  onDelta: (id: number, delta: number) => void;
  onUpdateMin: (
    id: number,
    minStock: number,
    currentStock: number,
    name: string,
    unit: "KG" | "L" | "UNIT" | "BOX",
    category?: string | null,
    vatRate?: number | null
  ) => void;
  onRemove: (id: number, name: string) => void;
  pending: boolean;
}) {
  const [editingMin, setEditingMin] = useState(false);
  const [minDraft, setMinDraft] = useState(String(p.minStock));

  useEffect(() => {
    setMinDraft(String(p.minStock));
    setEditingMin(false);
  }, [p.minStock, p.id]);

  const pct = p.minStock > 0 ? Math.round((p.currentStock / p.minStock) * 100) : 100;
  return (
    <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-[#fafbff]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[#1e2040]">{p.name}</span>
          {p.category ? (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{p.category}</span>
          ) : null}
          {p.lowStock ? (
            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Bajo mínimo</span>
          ) : null}
        </div>
        <div className="mt-2 w-full max-w-xs h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${p.lowStock ? "bg-red-400" : "bg-emerald-400"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {!editingMin ? (
          <span className={`text-sm font-semibold tabular-nums ${p.lowStock ? "text-red-600" : "text-[#1e2040]"}`}>
            {p.currentStock} / {p.minStock} {UNIT_LABEL[p.unit]}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold tabular-nums text-[#1e2040]">{p.currentStock} /</span>
            <input
              value={minDraft}
              onChange={(e) => setMinDraft(e.target.value)}
              type="number"
              step="0.01"
              className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs"
            />
            <span className="text-xs text-gray-500">{UNIT_LABEL[p.unit]}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => onDelta(p.id, -1)}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="-1"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onDelta(p.id, 1)}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="+1"
          >
            <Plus size={14} />
          </button>
          {canManage && !editingMin && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditingMin(true)}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              title="Editar mínimo"
            >
              <Save size={12} />
            </button>
          )}
          {canManage && editingMin && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  onUpdateMin(
                    p.id,
                    Number(minDraft || p.minStock),
                    Number(p.currentStock),
                    p.name,
                    p.unit,
                    p.category,
                    p.vatRate
                  );
                  setEditingMin(false);
                }}
                className="w-8 h-8 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                title="Guardar mínimo"
              >
                <Save size={12} />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setMinDraft(String(p.minStock));
                  setEditingMin(false);
                }}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                title="Cancelar"
              >
                <X size={12} />
              </button>
            </>
          )}
          {canManage && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onRemove(p.id, p.name)}
              className="w-8 h-8 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center text-red-600 hover:bg-red-100 disabled:opacity-50"
              title="Eliminar producto"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
