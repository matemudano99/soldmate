"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Phone, Tag, Plus, Pencil, Trash2 } from "lucide-react";
import { WebErpNavbar } from "../components/web-erp-navbar";
import { CreateSupplierModal } from "../components/create-modals";
import { suppliersApi, type SupplierResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

export default function SuppliersPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const isOwner = role === "OWNER";
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierResponse | null>(null);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
  }, []);

  const query = useQuery({
    queryKey: ["suppliers", token],
    queryFn: () => suppliersApi.getAll(token!),
    enabled: authReady && !!token,
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => suppliersApi.remove(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (s: SupplierResponse) => {
    setEditing(s);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const suppliers = query.data ?? [];

  return (
    <div className="flex min-h-screen bg-[#eef1f8]">
      <WebErpNavbar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-[#1e2040]">Proveedores</h1>
          {isOwner ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#3d5ae0]"
            >
              <Plus size={14} />
              Nuevo proveedor
            </button>
          ) : null}
        </div>

        {!authReady && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
            <Loader2 className="animate-spin" size={18} />
            Restaurando sesión…
          </div>
        )}

        {authReady && query.isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
            <Loader2 className="animate-spin" size={18} />
            Cargando proveedores…
          </div>
        )}

        {authReady && query.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
            {(query.error as Error)?.message ?? "No se pudo cargar la lista."}
          </div>
        )}

        {!isOwner && authReady && !query.isLoading && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-4">
            Solo el rol <strong>OWNER</strong> puede crear, editar o desactivar proveedores. Puedes ver el listado.
          </p>
        )}

        {authReady && !query.isLoading && !query.isError && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {suppliers.length === 0 ? (
              <p className="text-sm text-gray-500 col-span-full py-8 text-center">
                No hay proveedores activos. {isOwner ? "Crea el primero con el botón superior." : ""}
              </p>
            ) : (
              suppliers.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-[#1e2040] leading-snug">{s.name}</h3>
                    {isOwner ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-[#f0f3ff] hover:text-[#4f6ef7]"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`¿Desactivar el proveedor «${s.name}»?`)) return;
                            removeMut.mutate(s.id);
                          }}
                          disabled={removeMut.isPending}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                          title="Desactivar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Tag size={11} className="text-gray-400" />
                    <span className="text-xs text-gray-400">{s.category || "Sin categoría"}</span>
                  </div>
                  {s.contactPerson ? (
                    <p className="text-xs text-gray-500 mb-2">{s.contactPerson}</p>
                  ) : null}
                  <div className="space-y-1.5 mt-auto">
                    {s.contactPhone ? (
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-600">{s.contactPhone}</span>
                      </div>
                    ) : null}
                    {s.contactEmail ? (
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-600 truncate">{s.contactEmail}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {modalOpen && token ? (
          <CreateSupplierModal
            onClose={closeModal}
            authToken={token}
            initial={editing}
            onSuccess={() => qc.invalidateQueries({ queryKey: ["suppliers"] })}
          />
        ) : null}
      </main>
    </div>
  );
}
