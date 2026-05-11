"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { WebErpNavbar } from "../../components/web-erp-navbar";
import { CreateIncidentModal } from "../../components/create-modals";
import { AppTopHeader } from "../../shared/ui";
import { useAuthStore } from "app/lib/store";

export default function NewIncidentPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!token) router.replace("/login");
  }, [authReady, token, router]);

  return (
    <div className="flex min-h-screen bg-[#eef1f8]">
      <WebErpNavbar />
      <main className="flex-1 pb-6 overflow-y-auto">
        <AppTopHeader />
        <div className="px-4 sm:px-6">
        <h1 className="text-2xl font-bold text-[#1e2040] mb-2">Nueva incidencia</h1>
        <p className="text-sm text-gray-500 mb-5 max-w-lg">
          Completa el formulario. Si eliges una imagen, el backend la sube al bucket <code className="text-xs bg-gray-100 px-1 rounded">incidents</code> en
          Supabase y guarda la URL pública en la incidencia.
        </p>
        </div>
      </main>
      {authReady && token ? (
        <CreateIncidentModal
          onClose={() => router.push("/incidents")}
          authToken={token}
          onSuccess={() => router.push("/incidents")}
        />
      ) : null}
      {!authReady && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#eef1f8]/80">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={18} />
            Restaurando sesión…
          </div>
        </div>
      )}
    </div>
  );
}
