"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, ChevronLeft, AlertTriangle, Minus, Plus } from "lucide-react";
import { WebErpNavbar } from "../components/web-erp-navbar";
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
              Productos de tu empresa · ajuste rápido de stock (±1). Desde el dashboard: bloque «Stock bajo» o KPI.
            </p>
          </div>
        </div>

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
                      onDelta={(id, d) => stockMut.mutate({ id, delta: d })}
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
                      onDelta={(id, d) => stockMut.mutate({ id, delta: d })}
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

function ProductRow({
  product: p,
  onDelta,
  pending,
}: {
  product: ProductResponse;
  onDelta: (id: number, delta: number) => void;
  pending: boolean;
}) {
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
        <span className={`text-sm font-semibold tabular-nums ${p.lowStock ? "text-red-600" : "text-[#1e2040]"}`}>
          {p.currentStock} / {p.minStock} {UNIT_LABEL[p.unit]}
        </span>
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
        </div>
      </div>
    </div>
  );
}
