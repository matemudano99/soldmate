"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { AppTopHeader, ErpPageShell, notify } from "../shared/ui";
import { shiftsApi, type ShiftInput, type ShiftResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { roleDisplayLabel } from "app/lib/rbac";

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const EMPTY: ShiftInput = { shiftDate: "", shiftName: "", staffRequired: 2, notes: "" };

export default function ShiftsPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();
  const canManage = ["OWNER", "MANAGER", "SUPERVISOR", "DEV"].includes(role ?? "");

  const [form, setForm] = useState<ShiftInput>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["shifts"],
    queryFn: () => shiftsApi.list(token!),
    enabled: !!token,
  });

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const saveMut = useMutation({
    mutationFn: (body: ShiftInput) =>
      editingId ? shiftsApi.update(token!, editingId, body) : shiftsApi.create(token!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      notify.success(editingId ? "Turno actualizado" : "Turno creado");
      resetForm();
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo guardar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => shiftsApi.remove(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      notify.success("Turno eliminado");
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo eliminar"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shiftDate || !form.shiftName.trim()) {
      notify.error("Indica fecha y nombre del turno");
      return;
    }
    saveMut.mutate({
      shiftDate: form.shiftDate,
      shiftName: form.shiftName.trim(),
      staffRequired: form.staffRequired && form.staffRequired > 0 ? form.staffRequired : 1,
      notes: form.notes?.trim() || null,
    });
  };

  const startEdit = (s: ShiftResponse) => {
    setEditingId(s.id);
    setForm({
      shiftDate: s.shiftDate,
      shiftName: s.shiftName,
      staffRequired: s.staffRequired,
      notes: s.notes ?? "",
    });
  };

  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-[#f0f3ff] flex items-center justify-center text-[#4f6ef7] shrink-0">
              <CalendarClock size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e2040]">Turnos</h1>
              <p className="text-sm text-gray-500 mt-1">
                Planificación de cobertura por día (turno y personal requerido).{" "}
                {canManage ? "Puedes crear y editar turnos." : "Solo lectura para tu rol."}{" "}
                Tu rol: {roleDisplayLabel(role)}.
              </p>
            </div>
          </div>

          {canManage ? (
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1e2040]">
                  {editingId ? "Editar turno" : "Nuevo turno"}
                </h2>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    <X size={14} /> Cancelar
                  </button>
                ) : null}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={form.shiftDate}
                    onChange={(e) => setForm((f) => ({ ...f, shiftDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Turno</label>
                  <input
                    type="text"
                    required
                    placeholder="Mañana, Tarde, Noche…"
                    value={form.shiftName}
                    onChange={(e) => setForm((f) => ({ ...f, shiftName: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Personal</label>
                  <input
                    type="number"
                    min={1}
                    value={form.staffRequired ?? 1}
                    onChange={(e) => setForm((f) => ({ ...f, staffRequired: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Notas (opcional)</label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7] resize-none"
                  placeholder="Eventos, refuerzos, observaciones…"
                />
              </div>
              <button
                type="submit"
                disabled={saveMut.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#3d5ae0] disabled:opacity-60"
              >
                <Plus size={16} />
                {saveMut.isPending ? "Guardando…" : editingId ? "Guardar cambios" : "Crear turno"}
              </button>
            </form>
          ) : null}

          <h2 className="text-sm font-semibold text-[#1e2040] mb-3">Planificación</h2>

          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
              <Loader2 className="animate-spin" size={22} />
              Cargando…
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-600">No se pudo cargar la planificación.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 text-sm font-semibold text-[#4f6ef7] hover:underline"
              >
                Reintentar
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-2xl">
              Aún no hay turnos planificados.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((s) => (
                <li
                  key={s.id}
                  className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#1e2040]">{s.shiftName}</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#f0f3ff] text-[#4f6ef7] border border-[#dbe3ff] px-2 py-0.5 text-[11px] font-semibold">
                        <Users size={12} /> {s.staffRequired}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{formatDate(s.shiftDate)}</p>
                    {s.notes ? <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{s.notes}</p> : null}
                  </div>
                  {canManage ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 text-gray-600 px-2.5 py-1.5 text-xs font-semibold hover:bg-gray-50"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate(s.id)}
                        disabled={deleteMut.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 text-red-600 px-2.5 py-1.5 text-xs font-semibold hover:bg-red-50 disabled:opacity-60"
                      >
                        <Trash2 size={14} /> Borrar
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </ErpPageShell>
  );
}
