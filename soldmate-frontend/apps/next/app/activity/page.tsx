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
  if (action === "CREADO") return <PlusCircle size={12} className="text-emerald-500 shrink-0" />;
  if (action === "ELIMINADO") return <Trash2 size={12} className="text-red-500 shrink-0" />;
  return <Edit3 size={12} className="text-amber-500 shrink-0" />;
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

export default function ActivityPage() {
  const token = useAuthStore((s) => s.token);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
  }, []);

  const [filterType, setFilterType] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["activity-feed", token],
    queryFn: () => activityApi.getAll(token!),
    enabled: authReady && !!token,
  });

  const items = useMemo(() => {
    let list = query.data ?? [];
    if (filterType) {
      list = list.filter((item) => item.type === filterType || (filterType === "DOCUMENT" && item.type === "DOCUMENT_CATEGORY"));
    }
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 60);
  }, [query.data, filterType]);

  return (
    <div className="flex min-h-screen bg-[#eef1f8] text-[#1e2040]">
      <WebErpNavbar />
      <main className="flex-1 pb-6 overflow-y-auto max-w-3xl">
        <AppTopHeader />
        <div className="px-6">
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
          <>
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setFilterType(null)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${!filterType ? 'bg-[#1e2040] text-white border-[#1e2040]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              >
                Todos
              </button>
              {[
                { type: "INCIDENT", label: "Incidencias" },
                { type: "DOCUMENT", label: "Documentos" },
                { type: "SUPPLIER", label: "Proveedores" },
                { type: "USER", label: "Usuarios" },
                { type: "TASK", label: "Agenda" }
              ].map((f) => (
                <button
                  key={f.type}
                  onClick={() => setFilterType(f.type)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${filterType === f.type ? 'bg-[#1e2040] text-white border-[#1e2040]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] p-5 md:p-6 overflow-hidden">
              {items.length === 0 ? (
                <p className="text-sm text-gray-500 py-10 text-center px-4">
                  {filterType ? "No hay actividad para este filtro." : "Aún no hay actividad registrada en la empresa."}
                </p>
              ) : (
                <ul className="relative space-y-5">
                  {/* Línea conectora */}
                  <div className="absolute left-[22px] top-6 bottom-4 w-px bg-gray-100 z-0"></div>

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
                      <li key={inc.id} className="relative z-10 flex gap-4">
                        <div className="relative shrink-0">
                          {inc.actorAvatarUrl ? (
                            <img src={inc.actorAvatarUrl} alt={who} className="w-11 h-11 rounded-full object-cover border-4 border-white shadow-sm bg-white" />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-[#f0f3ff] border-4 border-white shadow-sm flex items-center justify-center">
                              <TypeIcon type={inc.type} />
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                            <ActionIcon action={inc.status} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 bg-gray-50/50 rounded-xl p-3.5 border border-gray-100 hover:border-[#4f6ef7]/30 transition-colors">
                          <p className="text-[13px] leading-snug">
                            <span className="font-bold text-[#1e2040]">{who}</span>{" "}
                            <span className="text-gray-500">{actionVerb(inc.status)}</span>{" "}
                            <span className="text-[#1e2040] font-semibold">«{inc.title}»</span>
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-[11px] text-gray-400 font-medium">{timeStr}</span>
                            <span className="text-[10px] text-gray-300">·</span>
                            <span className="text-[10px] font-bold text-[#4f6ef7] bg-[#f0f3ff] px-2 py-0.5 rounded-md uppercase tracking-wider">
                              {typeName(inc.type)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
}
