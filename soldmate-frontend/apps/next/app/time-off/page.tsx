"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Palmtree, Plus } from "lucide-react";
import { AppTopHeader, ErpPageShell, notify } from "../shared/ui";
import { vacationsApi, type VacationCreateInput, type VacationResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { canPostVacationRequest, roleDisplayLabel } from "app/lib/rbac";

function formatRange(v: VacationResponse): string {
  const a = new Date(v.startDate + "T12:00:00");
  const b = new Date(v.endDate + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
  return `${a.toLocaleDateString("es-ES", opts)} → ${b.toLocaleDateString("es-ES", opts)}`;
}

export default function TimeOffPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();
  const canCreate = canPostVacationRequest(role);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["vacations"],
    queryFn: () => vacationsApi.list(token!),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (body: VacationCreateInput) => vacationsApi.create(token!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
      notify.success("Solicitud registrada");
      setNotes("");
    },
    onError: (e: Error) => notify.error(e.message ?? "No se pudo registrar"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      notify.error("Indica fecha de inicio y fin");
      return;
    }
    createMut.mutate({
      startDate,
      endDate,
      notes: notes.trim() || null,
    });
  };

  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-[#f0f3ff] flex items-center justify-center text-[#4f6ef7] shrink-0">
              <Palmtree size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e2040]">Vacaciones</h1>
              <p className="text-sm text-gray-500 mt-1">
                Registro interno (MVP). {role === "OWNER" || role === "MANAGER" || role === "DEV"
                  ? "Ves todas las solicitudes de la empresa."
                  : "Ves tus propias solicitudes."}{" "}
                Tu rol: {roleDisplayLabel(role)}.
              </p>
            </div>
          </div>

          {canCreate ? (
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8 space-y-4"
            >
              <h2 className="text-sm font-semibold text-[#1e2040]">Nueva solicitud</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Desde</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Hasta</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#4f6ef7] resize-none"
                  placeholder="Comentarios para RR.HH. o el equipo"
                />
              </div>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#3d5ae0] disabled:opacity-60"
              >
                <Plus size={16} />
                {createMut.isPending ? "Enviando…" : "Registrar"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-500 mb-6 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
              Tu rol no puede crear solicitudes de vacaciones desde la aplicación.
            </p>
          )}

          <h2 className="text-sm font-semibold text-[#1e2040] mb-3">Listado</h2>

          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
              <Loader2 className="animate-spin" size={22} />
              Cargando…
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-600">No se pudo cargar el listado.</p>
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
              Aún no hay solicitudes registradas.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((v) => (
                <li
                  key={v.id}
                  className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1e2040]">{formatRange(v)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {v.userFullName}{" "}
                      <span className="text-gray-400">({v.userEmail})</span>
                    </p>
                    {v.notes ? <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{v.notes}</p> : null}
                  </div>
                  <p className="text-[10px] text-gray-400 sm:text-right shrink-0">
                    Alta: {new Date(v.createdAt).toLocaleString("es-ES")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </ErpPageShell>
  );
}
