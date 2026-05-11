"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Activity, ChevronLeft, Wrench, Circle, Clock, CheckCircle2, Package, Users, FileText, Calendar, PlusCircle, Edit3, Trash2, ShieldAlert, Truck } from "lucide-react";
import { AppTopHeader, WebErpNavbar } from "../shared/ui";
import { activityApi, type ActivityItemResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

function actionVerb(action: string): string {
  if (action === "CREADO") return "creó";
  if (action === "MODIFICADO") return "modificó";
  if (action === "ELIMINADO") return "eliminó";
  return action.toLowerCase();
}

function ActionIcon({ action }: { action: string }) {
  if (action === "CREADO") return <PlusCircle size={14} className="text-emerald-500 shrink-0" />;
  if (action === "ELIMINADO") return <Trash2 size={14} className="text-red-500 shrink-0" />;
  return <Edit3 size={14} className="text-amber-500 shrink-0" />;
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "INCIDENT": return <Wrench size={16} className="text-orange-500" />;
    case "DOCUMENT": return <FileText size={16} className="text-blue-500" />;
    case "DOCUMENT_CATEGORY": return <FileText size={16} className="text-indigo-500" />;
    case "SUPPLIER": return <Truck size={16} className="text-purple-500" />;
    case "USER": return <Users size={16} className="text-teal-500" />;
    case "TASK": return <Calendar size={16} className="text-rose-500" />;
    default: return <Activity size={16} className="text-[#4f6ef7]" />;
  }
}

function typeName(type: string): string {
  switch (type) {
    case "INCIDENT": return "Incidencia";
    case "DOCUMENT": return "Documento";
    case "DOCUMENT_CATEGORY": return "Categoría Doc.";
    case "SUPPLIER": return "Proveedor";
    case "USER": return "Usuario";
    case "TASK": return "Tarea/Evento";
    default: return "Registro";
  }
}

const FILTERS = [
  { id: "ALL", label: "Todos" },
  { id: "INCIDENT", label: "Incidencias" },
  { id: "DOCUMENT", label: "Documentos" },
  { id: "SUPPLIER", label: "Proveedores" },
  { id: "USER", label: "Usuarios" },
  { id: "TASK", label: "Agenda" },
];

export default function ActivityPage() {
  const token = useAuthStore((s) => s.token);
  const [authReady, setAuthReady] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
  }, []);

  const query = useQuery({
    queryKey: ["activity-feed", token],
    queryFn: () => activityApi.getAll(token!),
    enabled: authReady && !!token,
  });

  const items = useMemo(() => {
    let list = query.data ?? [];
    if (filterType !== "ALL") {
      list = list.filter((i) => i.type === filterType);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((i) => 
        i.details?.toLowerCase().includes(s) || 
        i.userEmail?.toLowerCase().includes(s) ||
        typeName(i.type).toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 60);
  }, [query.data, filterType, search]);

  return (
    <div className="flex min-h-screen bg-[#eef1f8] text-[#1e2040]">
      <WebErpNavbar />
      <main className="flex-1 pb-6 overflow-y-auto">
        <AppTopHeader 
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filtrar registros..."
        />
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
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="text-[#4f6ef7]" size={26} />
              Actividad
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Línea de tiempo con toda la actividad de la empresa: proveedores, usuarios, documentos, incidencias y más.
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterType === f.id
                    ? "bg-[#4f6ef7] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
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
              Cargando actividad…
            </div>
          )}

          {authReady && query.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {(query.error as Error)?.message ?? "No se pudo cargar la actividad."}
            </div>
          )}

          {authReady && !query.isLoading && !query.isError && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-6">
              {items.length === 0 ? (
                <p className="text-sm text-gray-500 py-10 text-center">
                  Aún no hay actividad registrada para este filtro.
                </p>
              ) : (
                <div className="relative">
                  {/* Timeline connector */}
                  <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200 z-0"></div>
                  <ul className="space-y-3 relative z-10">
                    {items.map((inc) => {
                      const when = new Date(inc.createdAt);
                      const timeStr = when.toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const who = inc.actorName ?? "Usuario";
                      return (
                        <li key={inc.id} className="flex gap-3 group items-start">
                          <div className="relative shrink-0 mt-0.5">
                            {inc.actorAvatarUrl ? (
                              <img src={inc.actorAvatarUrl} alt={who} className="w-8 h-8 rounded-full object-cover border-[3px] border-white shadow-sm" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#f0f3ff] border-[3px] border-white shadow-sm flex items-center justify-center text-[#4f6ef7] font-bold text-xs">
                                {who.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                              <ActionIcon action={inc.status} />
                            </div>
                          </div>

                          <div className="flex-1 bg-gray-50/50 group-hover:bg-gray-50 transition-colors border border-transparent group-hover:border-gray-100 rounded-lg px-3 py-2">
                            <p className="text-[13px] text-gray-800 leading-snug">
                              <span className="font-semibold text-[#1e2040]">{who}</span>{" "}
                              <span className="text-gray-500">{actionVerb(inc.status)}</span>{" "}
                              <span className="text-[#1e2040] font-medium">{inc.title}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[11px] text-gray-400">{timeStr}</span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-gray-100 text-[10px] font-medium text-gray-600 shadow-sm">
                                <TypeIcon type={inc.type} />
                                {typeName(inc.type)}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
