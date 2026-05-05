"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ImageIcon, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { SectionCard } from "../components/web-ui";
import { WebErpNavbar } from "../components/web-erp-navbar";
import { CreateIncidentModal } from "../components/create-modals";
import { incidentsApi, type IncidentResponse, type IncidentStatus } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

function statusLabel(s: IncidentResponse["status"]) {
  if (s === "OPEN") return "Abierta";
  if (s === "IN_PROGRESS") return "En curso";
  return "Cerrada";
}

function priorityClass(p: IncidentResponse["priority"]) {
  if (p === "CRITICAL") return "bg-red-50 text-red-500";
  if (p === "HIGH") return "bg-orange-50 text-orange-500";
  if (p === "MEDIUM") return "bg-amber-50 text-amber-600";
  return "bg-blue-50 text-blue-500";
}

function priorityLabel(p: IncidentResponse["priority"]) {
  const map: Record<IncidentResponse["priority"], string> = {
    LOW: "Baja",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Crítica",
  };
  return map[p];
}

const STATUS_FILTERS: { value: "ALL" | IncidentStatus; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "OPEN", label: "Abiertas" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "CLOSED", label: "Cerradas" },
];

export default function IncidentsPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const isOwner = role === "OWNER";
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | IncidentStatus>("ALL");
  const [editing, setEditing] = useState<IncidentResponse | null>(null);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
  }, []);

  const query = useQuery({
    queryKey: ["incidents", token, statusFilter],
    queryFn: () =>
      statusFilter === "ALL" ? incidentsApi.getAll(token!) : incidentsApi.getAll(token!, statusFilter),
    enabled: authReady && !!token,
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: IncidentStatus }) =>
      incidentsApi.updateStatus(token!, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => incidentsApi.remove(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });

  const incidents = query.data ?? [];

  return (
    <div className="flex min-h-screen bg-[#eef1f8]">
      <WebErpNavbar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h1 className="text-2xl font-bold text-[#1e2040]">Incidencias</h1>
          <Link
            href="/incidents/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold shadow-[0_4px_12px_rgba(79,110,247,0.30)] hover:bg-[#3d5ae0] transition-colors"
          >
            + Nueva incidencia
          </Link>
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
            Cargando incidencias…
          </div>
        )}

        {authReady && query.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
            {(query.error as Error)?.message ?? "No se pudo cargar la lista. ¿Está el backend en marcha?"}
          </div>
        )}

        {authReady && !query.isLoading && !query.isError && (
          <SectionCard title="Incidencias" subtitle="CRUD vía API · cambiar estado con el desplegable">
            <div className="flex flex-wrap gap-2 mb-4">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                    statusFilter === f.value
                      ? "bg-[#4f6ef7] text-white border-[#4f6ef7]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#4f6ef7]/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {incidents.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No hay incidencias en este filtro. Crea una desde «Nueva incidencia».
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {incidents.map((r) => (
                  <div key={r.id} className="py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-[#1e2040] block">{r.title}</span>
                      {r.description ? (
                        <span className="text-xs text-gray-400 line-clamp-2 mt-0.5">{r.description}</span>
                      ) : null}
                      {r.reportedBy ? (
                        <span className="text-[10px] text-gray-400 mt-1 block">Reportado por {r.reportedBy}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityClass(r.priority)}`}>
                        {priorityLabel(r.priority)}
                      </span>
                      <select
                        value={r.status}
                        onChange={(e) =>
                          statusMut.mutate({ id: r.id, status: e.target.value as IncidentStatus })
                        }
                        disabled={statusMut.isPending}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-[#1e2040] outline-none focus:border-[#4f6ef7] disabled:opacity-50"
                      >
                        <option value="OPEN">Abierta</option>
                        <option value="IN_PROGRESS">En curso</option>
                        <option value="CLOSED">Cerrada</option>
                      </select>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.status === "CLOSED"
                            ? "bg-green-50 text-green-600"
                            : r.status === "IN_PROGRESS"
                              ? "bg-violet-50 text-violet-500"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {statusLabel(r.status)}
                      </span>
                      {r.photoUrl ? (
                        <a
                          href={r.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#4f6ef7] hover:bg-[#f0f3ff]"
                        >
                          <ImageIcon size={12} />
                          Foto
                          <ExternalLink size={10} className="opacity-60" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        <Pencil size={12} />
                        Editar
                      </button>
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`¿Eliminar la incidencia «${r.title}»?`)) return;
                            removeMut.mutate(r.id);
                          }}
                          disabled={removeMut.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50/80 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {editing && token ? (
          <CreateIncidentModal
            onClose={() => setEditing(null)}
            authToken={token}
            editIncidentId={editing.id}
            initialIncident={editing}
            onSuccess={() => qc.invalidateQueries({ queryKey: ["incidents"] })}
          />
        ) : null}
      </main>
    </div>
  );
}
