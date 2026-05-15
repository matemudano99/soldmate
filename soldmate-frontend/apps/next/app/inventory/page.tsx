"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, ChevronLeft, AlertTriangle, Minus, Plus, Trash2, Save, X, Tag } from "lucide-react";
import {
  AppTopHeader,
  CreateProductModal,
  InventoryCategoriesModal,
  ErpPageShell,
  notify,
  useConfirm,
  EmptyState,
  PageListSearchField,
} from "../shared/ui";
import { inventoryApi, suppliersApi, type ProductResponse, type SupplierResponse } from "app/lib/api";
import { compareProductsByCategoryThenName } from "app/lib/inventorySort";
import { useAuthStore } from "app/lib/store";

const UNIT_LABEL: Record<ProductResponse["unit"], string> = {
  KG: "kg",
  L: "L",
  UNIT: "ud",
  BOX: "cajas",
};

function productCategoryLabel(p: ProductResponse): string {
  const c = p.category?.trim();
  return c && c.length > 0 ? c : "Ninguna";
}

export default function InventoryPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const isOwner = role === "OWNER" || role === "DEV";
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

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

  const categoriesQuery = useQuery({
    queryKey: ["inventory-categories", token],
    queryFn: () => inventoryApi.listCategories(token!),
    enabled: authReady && !!token,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", token, "SUPPLIER"],
    queryFn: () => suppliersApi.getAll(token!, undefined, "SUPPLIER"),
    enabled: authReady && !!token,
  });

  const categoryNames = useMemo(
    () => (categoriesQuery.data ?? []).map((c) => c.name).sort((a, b) => a.localeCompare(b, "es")),
    [categoriesQuery.data],
  );

  const categoriesErrorMessage = useMemo(() => {
    if (!categoriesQuery.isError) return null;
    return (categoriesQuery.error as Error)?.message ?? "No se pudieron cargar las categorías.";
  }, [categoriesQuery.isError, categoriesQuery.error]);

  const stockMut = useMutation({
    mutationFn: ({ id, delta }: { id: number; delta: number }) => inventoryApi.updateStock(token!, id, delta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      notify.success("Stock actualizado");
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al actualizar stock"),
  });
  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof inventoryApi.create>[1]) => inventoryApi.create(token!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      notify.success("Producto creado");
      setShowCreateProduct(false);
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al crear producto"),
  });
  const updateMut = useMutation({
    mutationFn: (payload: {
      id: number;
      minStock: number;
      currentStock: number;
      name: string;
      unit: "KG" | "L" | "UNIT" | "BOX";
      category?: string | null;
      supplierId?: number | null;
      vatRate?: number | null;
    }) =>
      inventoryApi.update(token!, payload.id, {
        name: payload.name,
        currentStock: payload.currentStock,
        minStock: payload.minStock,
        unit: payload.unit,
        category: payload.category ?? null,
        supplierId: payload.supplierId ?? null,
        vatRate: payload.vatRate ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      notify.success("Producto actualizado");
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al actualizar producto"),
  });
  const removeMut = useMutation({
    mutationFn: (id: number) => inventoryApi.remove(token!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      notify.success("Producto eliminado");
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al eliminar producto"),
  });

  const createCategoryMut = useMutation({
    mutationFn: (name: string) => inventoryApi.createCategory(token!, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-categories"] });
      notify.success("Categoría creada");
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al crear categoría"),
  });

  const deleteCategoryMut = useMutation({
    mutationFn: (id: number) => inventoryApi.deleteCategory(token!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-categories"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      notify.success("Categoría eliminada");
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al eliminar categoría"),
  });

  const products = useMemo(() => {
    let list = query.data ?? [];
    if (categoryFilter !== "ALL") {
      list = list.filter((p) => {
        const lab = productCategoryLabel(p);
        if (categoryFilter === "Ninguna") {
          return lab === "Ninguna";
        }
        return lab === categoryFilter;
      });
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((p) => {
        const name = (p.name ?? "").toLowerCase();
        const sup = (p.supplierName ?? "").toLowerCase();
        return (
          name.includes(s) ||
          productCategoryLabel(p).toLowerCase().includes(s) ||
          sup.includes(s)
        );
      });
    }
    return [...list].sort(compareProductsByCategoryThenName);
  }, [query.data, search, categoryFilter]);

  const lowStock = useMemo(() => products.filter((p) => p.lowStock), [products]);
  const okStock = useMemo(() => products.filter((p) => !p.lowStock), [products]);
  const totalProducts = query.data?.length ?? 0;
  const hasFilters = categoryFilter !== "ALL" || search.trim().length > 0;
  const filteredEmpty = totalProducts > 0 && products.length === 0;

  const supplierOptions = suppliersQuery.data ?? [];

  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="flex-1 min-h-0 overflow-y-auto pb-6">
        <div className="px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#4f6ef7] hover:underline"
            >
              <ChevronLeft size={14} />
              Dashboard
            </Link>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="text-[#4f6ef7]" size={26} />
                Inventario
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Categorías de referencia, proveedor por producto y control de stock.
              </p>
            </div>
            {isOwner && authReady && !query.isLoading && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setShowCreateCategory(true)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#1e2040] hover:bg-gray-50 sm:w-auto sm:py-2.5"
                >
                  <Tag size={16} className="text-[#4f6ef7]" />
                  Nueva categoría
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateProduct(true)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#4f6ef7] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3d5ae0] sm:w-auto sm:py-2.5"
                >
                  <Plus size={16} />
                  Nuevo producto
                </button>
              </div>
            )}
          </div>

          <div className="mb-5">
            <PageListSearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar producto, categoría o proveedor…"
            />
          </div>

          {isOwner && showCreateProduct && (
            <CreateProductModal
              onClose={() => setShowCreateProduct(false)}
              submitting={createMut.isPending}
              categories={categoryNames}
              suppliers={supplierOptions}
              onCreate={(payload) => createMut.mutate(payload)}
            />
          )}

          {isOwner && showCreateCategory && (
            <InventoryCategoriesModal
              onClose={() => setShowCreateCategory(false)}
              categories={categoriesQuery.data ?? []}
              categoriesLoading={categoriesQuery.isLoading}
              categoriesError={categoriesErrorMessage}
              onCreateCategory={(name) => createCategoryMut.mutate(name)}
              createSubmitting={createCategoryMut.isPending}
              deleteSubmitting={deleteCategoryMut.isPending}
              onRequestDeleteCategory={async (id, name) => {
                const ok = await confirm(
                  `¿Eliminar la categoría «${name}»?`,
                  "Los productos de esta categoría pasarán a «Ninguna».",
                  "danger",
                );
                if (ok) deleteCategoryMut.mutate(id);
              }}
            />
          )}

          {!authReady && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-12">
              <Loader2 className="animate-spin" size={18} />
              Restaurando sesión…
            </div>
          )}

          {authReady && (query.isLoading || categoriesQuery.isLoading) && (
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

          {authReady && categoriesQuery.isError && !showCreateCategory && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
              {(categoriesQuery.error as Error)?.message ?? "No se pudieron cargar las categorías."}
            </div>
          )}

          {authReady && !query.isLoading && !query.isError && (
            <div className="space-y-8">
              <section>
                <h2 className="mb-2 text-sm font-semibold text-[#1e2040]">Filtrar por categoría</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("ALL")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      categoryFilter === "ALL"
                        ? "bg-[#4f6ef7] text-white"
                        : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Todas
                  </button>
                  {categoryNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setCategoryFilter(name)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        categoryFilter === name
                          ? "bg-[#4f6ef7] text-white"
                          : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </section>

              {filteredEmpty && (
                <p className="rounded-xl border border-dashed border-gray-200 bg-white py-8 text-center text-sm text-gray-500">
                  Ningún producto coincide con la búsqueda o el filtro de categoría.
                </p>
              )}

              {lowStock.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <h2 className="text-base font-semibold">Stock bajo</h2>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      {lowStock.length}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_16px_rgba(149,157,165,0.10)]">
                    {lowStock.map((p) => (
                      <ProductRow
                        key={p.id}
                        product={p}
                        canManage={isOwner}
                        categoryNames={categoryNames}
                        supplierOptions={supplierOptions}
                        onDelta={(id, d) => stockMut.mutate({ id, delta: d })}
                        onUpdateMin={(id, minStock, currentStock, name, unit, category, vatRate, supplierId) =>
                          updateMut.mutate({
                            id,
                            minStock,
                            currentStock,
                            name,
                            unit,
                            category,
                            vatRate,
                            supplierId,
                          })
                        }
                        onCategoryChange={(id, category) => {
                          const pr = query.data?.find((x) => x.id === id);
                          if (!pr) return;
                          updateMut.mutate({
                            id,
                            minStock: pr.minStock,
                            currentStock: pr.currentStock,
                            name: pr.name,
                            unit: pr.unit,
                            category,
                            supplierId: pr.supplierId ?? null,
                            vatRate: pr.vatRate,
                          });
                        }}
                        onSupplierChange={(id, supplierId) => {
                          const pr = query.data?.find((x) => x.id === id);
                          if (!pr) return;
                          updateMut.mutate({
                            id,
                            minStock: pr.minStock,
                            currentStock: pr.currentStock,
                            name: pr.name,
                            unit: pr.unit,
                            category: pr.category,
                            supplierId,
                            vatRate: pr.vatRate,
                          });
                        }}
                        onRemove={async (id, name) => {
                          const ok = await confirm(
                            `¿Eliminar el producto «${name}»?`,
                            "Esta acción no se puede deshacer.",
                            "danger",
                          );
                          if (ok) removeMut.mutate(id);
                        }}
                        pending={stockMut.isPending}
                      />
                    ))}
                  </div>
                </section>
              )}

              {okStock.length > 0 && (
                <section>
                  <h2 className="mb-3 text-base font-semibold">Resto de productos</h2>
                  <div className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_16px_rgba(149,157,165,0.10)]">
                    {okStock.map((p) => (
                      <ProductRow
                        key={p.id}
                        product={p}
                        canManage={isOwner}
                        categoryNames={categoryNames}
                        supplierOptions={supplierOptions}
                        onDelta={(id, d) => stockMut.mutate({ id, delta: d })}
                        onUpdateMin={(id, minStock, currentStock, name, unit, category, vatRate, supplierId) =>
                          updateMut.mutate({
                            id,
                            minStock,
                            currentStock,
                            name,
                            unit,
                            category,
                            vatRate,
                            supplierId,
                          })
                        }
                        onCategoryChange={(id, category) => {
                          const pr = query.data?.find((x) => x.id === id);
                          if (!pr) return;
                          updateMut.mutate({
                            id,
                            minStock: pr.minStock,
                            currentStock: pr.currentStock,
                            name: pr.name,
                            unit: pr.unit,
                            category,
                            supplierId: pr.supplierId ?? null,
                            vatRate: pr.vatRate,
                          });
                        }}
                        onSupplierChange={(id, supplierId) => {
                          const pr = query.data?.find((x) => x.id === id);
                          if (!pr) return;
                          updateMut.mutate({
                            id,
                            minStock: pr.minStock,
                            currentStock: pr.currentStock,
                            name: pr.name,
                            unit: pr.unit,
                            category: pr.category,
                            supplierId,
                            vatRate: pr.vatRate,
                          });
                        }}
                        onRemove={async (id, name) => {
                          const ok = await confirm(
                            `¿Eliminar el producto «${name}»?`,
                            "Esta acción no se puede deshacer.",
                            "danger",
                          );
                          if (ok) removeMut.mutate(id);
                        }}
                        pending={stockMut.isPending}
                      />
                    ))}
                  </div>
                </section>
              )}

              {totalProducts === 0 && !hasFilters && (
                <EmptyState
                  icon={Package}
                  title="Sin productos"
                  description={
                    isOwner
                      ? "Añade tu primer producto con el botón «Nuevo producto»."
                      : "Aún no hay artículos en el inventario."
                  }
                />
              )}
            </div>
          )}
        </div>
      </main>
      {confirmDialog}
    </ErpPageShell>
  );
}

function ProductRow({
  product: p,
  canManage,
  categoryNames,
  supplierOptions,
  onDelta,
  onUpdateMin,
  onCategoryChange,
  onSupplierChange,
  onRemove,
  pending,
}: {
  product: ProductResponse;
  canManage: boolean;
  categoryNames: string[];
  supplierOptions: SupplierResponse[];
  onDelta: (id: number, delta: number) => void;
  onUpdateMin: (
    id: number,
    minStock: number,
    currentStock: number,
    name: string,
    unit: "KG" | "L" | "UNIT" | "BOX",
    category?: string | null,
    vatRate?: number | null,
    supplierId?: number | null,
  ) => void;
  onCategoryChange: (id: number, category: string | null) => void;
  onSupplierChange: (id: number, supplierId: number | null) => void;
  onRemove: (id: number, name: string) => void;
  pending: boolean;
}) {
  const [editingMin, setEditingMin] = useState(false);
  const [minDraft, setMinDraft] = useState(String(p.minStock));

  useEffect(() => {
    setMinDraft(String(p.minStock));
    setEditingMin(false);
  }, [p.minStock, p.id]);

  const lab = productCategoryLabel(p);
  const selectOptions = useMemo(() => {
    const set = new Set(categoryNames);
    if (p.category?.trim() && !set.has(p.category.trim())) {
      return [...categoryNames, p.category.trim()].sort((a, b) => a.localeCompare(b, "es"));
    }
    return categoryNames;
  }, [categoryNames, p.category]);

  const pct = p.minStock > 0 ? Math.round((p.currentStock / p.minStock) * 100) : 100;
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 hover:bg-[#fafbff] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#1e2040]">{p.name}</span>
          {p.lowStock ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              Bajo mínimo
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          {canManage && selectOptions.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <select
                value={lab}
                disabled={pending}
                onChange={(e) => {
                  const v = e.target.value;
                  onCategoryChange(p.id, v === "Ninguna" ? "Ninguna" : v || "Ninguna");
                }}
                className="max-w-[200px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-[#1e2040]"
              >
                {selectOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={p.supplierId != null ? String(p.supplierId) : ""}
                disabled={pending}
                onChange={(e) => {
                  const v = e.target.value;
                  onSupplierChange(p.id, v === "" ? null : Number(v));
                }}
                className="max-w-[200px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-[#1e2040]"
              >
                <option value="">Proveedor…</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-gray-600">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{lab}</span>
              {p.supplierName ? (
                <span className="ml-2 text-[10px] text-gray-400">· {p.supplierName}</span>
              ) : null}
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${p.lowStock ? "bg-red-400" : "bg-emerald-400"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="-1"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onDelta(p.id, 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="+1"
          >
            <Plus size={14} />
          </button>
          {canManage && !editingMin && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditingMin(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
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
                    p.vatRate,
                    p.supplierId ?? null,
                  );
                  setEditingMin(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
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
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
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
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
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
