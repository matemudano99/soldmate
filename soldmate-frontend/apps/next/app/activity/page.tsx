"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Activity, ChevronLeft, Wrench, Circle, Clock, CheckCircle2 } from "lucide-react";
import { WebErpNavbar } from "../components/web-erp-navbar";
import { activityApi, type ActivityItemResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

function statusVerb(s: ActivityItemResponse["status"]): string {
  if (s === "OPEN") return "registró la incidencia";
  if (s === "IN_PROGRESS") return "pasó a en curso";
  return "cerró";
}

function StatusIcon({ status }: { status: ActivityItemResponse["status"] }) {
  if (status === "CLOSED") return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
  if (status === "IN_PROGRESS") return <Clock size={14} className="text-amber-500 shrink-0" />;
  return <Circle size={14} className="text-red-400 shrink-0" />;
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

  const query = useQuery({
    queryKey: ["activity-feed", token],
    queryFn: () => activityApi.getAll(token!),
    enabled: authReady && !!token,
  });

  const items = useMemo(() => {
    const list = query.data ?? [];
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 40);
  }, [query.data]);

  return (
    <div className="flex min-h-screen bg-[#eef1f8] text-[#1e2040]">
      <WebErpNavbar />
      <main className="flex-1 p-6 overflow-y-auto max-w-3xl">
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
            Línea de tiempo a partir de las incidencias reales de tu empresa. En el dashboard: tarjeta «Actividad reciente».
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(149,157,165,0.10)] overflow-hidden">
            {items.length === 0 ? (
              <p className="text-sm text-gray-500 py-10 text-center px-4">
                Aún no hay incidencias que mostrar como actividad.
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
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
                    <li key={inc.id} className="px-5 py-3.5 flex gap-3 hover:bg-[#fafbff]">
                      {inc.actorAvatarUrl ? (
                        <img src={inc.actorAvatarUrl} alt={who} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#f0f3ff] flex items-center justify-center shrink-0">
                          <Wrench size={16} className="text-[#4f6ef7]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">
                          <span className="font-semibold text-[#1e2040]">{who}</span>{" "}
                          <span className="text-gray-600">{statusVerb(inc.status)}</span>{" "}
                          <span className="text-[#1e2040]">«{inc.title}»</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-gray-400">{timeStr}</span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] font-medium text-gray-500 uppercase">{inc.priority}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                            <StatusIcon status={inc.status} />
                            {inc.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                      <Link
                        href="/incidents"
                        className="text-[10px] font-semibold text-[#4f6ef7] self-center shrink-0 hover:underline"
                      >
                        Ver
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
