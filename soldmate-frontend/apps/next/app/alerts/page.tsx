"use client";

import React from "react";
import { SectionCard } from "../components/web-ui";
import { AppTopHeader, WebErpNavbar } from "../shared/ui";
import { AlertTriangle, Clock, CheckCircle, LifeBuoy, Mail, Phone } from "lucide-react";
import { alertsApi, describeNetworkError, type AlertResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

export default function AlertsPage() {
  const token = useAuthStore((s) => s.token);
  const [alerts, setAlerts] = React.useState<AlertResponse[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    async function loadAlerts() {
      try {
        setError(null);
        const data = await alertsApi.getAll(token);
        setAlerts(data);
      } catch (err) {
        setError(describeNetworkError(err));
      }
    }
    loadAlerts();
  }, [token]);

  return (
    <div className="flex min-h-screen bg-[#eef1f8]">
      <WebErpNavbar />
      <main className="flex-1 pb-6 overflow-y-auto">
        <AppTopHeader />
        <div className="px-6">
        <h1 className="text-2xl font-bold text-[#1e2040] mb-5">Alertas y soporte</h1>
        <div className="max-w-4xl grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <SectionCard title="Alertas recientes" subtitle="Estado operativo">
            <div className="flex flex-col gap-2">
              {alerts.map((a) => {
                const Icon =
                  a.type === "critical" ? AlertTriangle : a.type === "warning" ? Clock : CheckCircle;
                const styles =
                  a.type === "critical" ? "bg-red-50 border-red-100 text-red-600" :
                  a.type === "warning"  ? "bg-amber-50 border-amber-100 text-amber-600" :
                                          "bg-green-50 border-green-100 text-green-600";
                return (
                  <div key={a.text} className={`flex items-center gap-3 rounded-xl border p-3.5 ${styles}`}>
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="text-sm font-medium">{a.text}</span>
                  </div>
                );
              })}
            </div>
            {error && <p className="text-xs text-amber-600 mt-2">{error}</p>}
          </SectionCard>

          <SectionCard title="Centro de ayuda" subtitle="Canales de soporte">
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-blue-700">
                <LifeBuoy size={15} className="flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Soporte operativo</p>
                  <p className="text-xs">Disponible de 08:00 a 20:00</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5">
                <Mail size={15} className="text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#1e2040]">support@soldmate.app</p>
                  <p className="text-xs text-gray-500">Respuesta media: 30 min</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5">
                <Phone size={15} className="text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#1e2040]">+34 900 123 456</p>
                  <p className="text-xs text-gray-500">Urgencias de infraestructura</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
        </div>
      </main>
    </div>
  );
}
