"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SectionCard } from "../components/web-ui";
import { ErpPageShell, AppTopHeader, notify } from "../shared/ui";
import { businessProfileApi, type BusinessProfileResponse, describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { Building2, MapPin } from "lucide-react";

const COUNTRY_OPTIONS = [
  { code: "ES", name: "España" },
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "US", name: "Estados Unidos" },
  { code: "GB", name: "Reino Unido" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "PT", name: "Portugal" },
];

const TIMEZONE_OPTIONS = [
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "MXN", "COP", "ARS", "CLP", "PEN"] as const;

const DEFAULT_OPENING_HOURS = JSON.stringify(
  {
    mon: "08:00-18:00",
    tue: "08:00-18:00",
    wed: "08:00-18:00",
    thu: "08:00-18:00",
    fri: "08:00-18:00",
    sat: "09:00-16:00",
    sun: "CLOSED",
  },
  null,
  2,
);

export default function BusinessSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [savedBusiness, setSavedBusiness] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    timezone: "Europe/Madrid",
  });
  const [business, setBusiness] = useState<BusinessProfileResponse>({
    businessName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    postalCode: "",
    country: "ES",
    timezone: "Europe/Madrid",
    latitude: 40.4168,
    longitude: -3.7038,
    openingHours: DEFAULT_OPENING_HOURS,
    taxId: "",
    currency: "EUR",
    subscriptionTier: "FREE",
  });

  useEffect(() => {
    if (!token) return;
    async function loadBusiness() {
      try {
        const data = await businessProfileApi.get(token);
        setBusiness({
          businessName: data.businessName ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          postalCode: data.postalCode ?? "",
          country: data.country ?? "ES",
          timezone: data.timezone ?? "Europe/Madrid",
          latitude: data.latitude ?? 40.4168,
          longitude: data.longitude ?? -3.7038,
          openingHours: data.openingHours ?? DEFAULT_OPENING_HOURS,
          taxId: data.taxId ?? "",
          currency: data.currency ?? "EUR",
          subscriptionTier: data.subscriptionTier ?? "FREE",
        });
        setPreferences((prev) => ({
          ...prev,
          timezone: data.timezone ?? prev.timezone,
        }));
      } catch (err) {
        setBusinessError(describeNetworkError(err));
      }
    }
    void loadBusiness();
  }, [token]);

  const onSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoadingBusiness(true);
    setSavedBusiness(false);
    setBusinessError(null);
    try {
      await businessProfileApi.update(token, {
        ...business,
        timezone: preferences.timezone || business.timezone,
      });
      setSavedBusiness(true);
      notify.success("Perfil de empresa guardado");
    } catch (err) {
      const msg = describeNetworkError(err);
      setBusinessError(msg);
      notify.error(msg);
    } finally {
      setLoadingBusiness(false);
    }
  };

  if (role !== "OWNER") {
    return (
      <ErpPageShell>
        <AppTopHeader />
        <main className="flex-1 min-h-0 overflow-y-auto pb-6">
          <div className="px-4 sm:px-6 max-w-xl">
            <h1 className="text-2xl font-bold text-[#1e2040] mb-3">Configuración del negocio</h1>
            <p className="text-sm text-gray-600 mb-4">
              Solo el propietario (OWNER) puede editar los datos fiscales y operativos del negocio activo.
            </p>
            <Link href="/company-settings" className="text-sm font-semibold text-[#4f6ef7] hover:underline">
              Volver a Ajustes de cuenta
            </Link>
          </div>
        </main>
      </ErpPageShell>
    );
  }

  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="flex-1 min-h-0 overflow-y-auto pb-6">
        <div className="px-4 sm:px-6">
          <h1 className="text-2xl font-bold text-[#1e2040] mb-1 flex items-center gap-2">
            <Building2 className="text-[#4f6ef7]" size={26} />
            Configuración del negocio
          </h1>
          <p className="text-sm text-gray-500 mb-5">
            Datos generales del negocio actual (nombre, contacto, coordenadas, horario). Si tu usuario opera en varios negocios distintos, elige el activo en la cabecera con el desplegable «Negocio activo».
          </p>
          <div className="max-w-4xl grid gap-4">
            <SectionCard title="Identificación y plan" subtitle="Datos fiscales del negocio activo (solo lectura)">
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">NIF / CIF</p>
                  <p className="font-mono font-semibold text-[#1e2040]">{business.taxId?.trim() || "—"}</p>
                  <p className="text-[10px] text-gray-400 mt-2">Se asigna en el alta del negocio. Para corregirlo contacta con soporte.</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Plan</p>
                  <p className="font-semibold text-[#1e2040]">
                    {business.subscriptionTier === "PREMIUM" ? "Premium" : "Gratuito"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Moneda contable</p>
                  <p className="font-semibold text-[#1e2040]">{business.currency ?? "EUR"}</p>
                  <p className="text-[10px] text-gray-400 mt-2">Editable abajo con el resto de datos generales.</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Datos generales"
              subtitle="Se usan en cabecera, clima y operación"
              right={
                <Link href="/company-settings" className="text-xs font-semibold text-[#4f6ef7] hover:underline whitespace-nowrap">
                  Mi perfil →
                </Link>
              }
            >
              <form onSubmit={onSaveBusiness} className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    value={business.businessName}
                    onChange={(e) => setBusiness((b) => ({ ...b, businessName: e.target.value }))}
                    placeholder="Nombre del negocio"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                  <input
                    value={business.phone ?? ""}
                    onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))}
                    placeholder="Teléfono"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                  <input
                    value={business.email ?? ""}
                    onChange={(e) => setBusiness((b) => ({ ...b, email: e.target.value }))}
                    placeholder="Email de negocio"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                  <input
                    value={business.address ?? ""}
                    onChange={(e) => setBusiness((b) => ({ ...b, address: e.target.value }))}
                    placeholder="Dirección (sede fiscal o principal)"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                  <input
                    value={business.city ?? ""}
                    onChange={(e) => setBusiness((b) => ({ ...b, city: e.target.value }))}
                    placeholder="Ciudad"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                  <input
                    value={business.postalCode ?? ""}
                    onChange={(e) => setBusiness((b) => ({ ...b, postalCode: e.target.value }))}
                    placeholder="Código postal"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                  <select
                    value={business.country ?? "ES"}
                    onChange={(e) => setBusiness((b) => ({ ...b, country: e.target.value }))}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={business.currency ?? "EUR"}
                    onChange={(e) => setBusiness((b) => ({ ...b, currency: e.target.value }))}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    title="Moneda ISO para importes y cierres"
                  >
                    {CURRENCY_OPTIONS.map((cur) => (
                      <option key={cur} value={cur}>
                        {cur}
                      </option>
                    ))}
                  </select>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => setPreferences((p) => ({ ...p, timezone: e.target.value }))}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <label className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm flex items-center gap-2">
                    <MapPin size={14} className="text-gray-400" />
                    <input
                      type="number"
                      step="0.0001"
                      value={business.latitude ?? 0}
                      onChange={(e) => setBusiness((b) => ({ ...b, latitude: Number(e.target.value) }))}
                      placeholder="Latitud"
                      className="w-full outline-none"
                    />
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={business.longitude ?? 0}
                    onChange={(e) => setBusiness((b) => ({ ...b, longitude: Number(e.target.value) }))}
                    placeholder="Longitud"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-2">Horario por día</label>
                  <div className="space-y-2">
                    {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => {
                      const label = { mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom" }[day];
                      let parsed: Record<string, string> = {};
                      try {
                        parsed = JSON.parse(business.openingHours ?? "{}");
                      } catch {
                        /* ignore */
                      }
                      const val = parsed[day] ?? "CLOSED";
                      const isClosed = val === "CLOSED";
                      return (
                        <div key={day} className="flex items-center gap-3">
                          <span className="w-8 text-xs font-semibold text-gray-500">{label}</span>
                          <input
                            type="checkbox"
                            checked={!isClosed}
                            onChange={(e) => {
                              let p: Record<string, string> = {};
                              try {
                                p = JSON.parse(business.openingHours ?? "{}");
                              } catch {
                                /* ignore */
                              }
                              p[day] = e.target.checked ? "08:00-18:00" : "CLOSED";
                              setBusiness((b) => ({ ...b, openingHours: JSON.stringify(p, null, 2) }));
                            }}
                            className="accent-[#4f6ef7]"
                          />
                          {!isClosed ? (
                            <input
                              value={val}
                              onChange={(e) => {
                                let p: Record<string, string> = {};
                                try {
                                  p = JSON.parse(business.openingHours ?? "{}");
                                } catch {
                                  /* ignore */
                                }
                                p[day] = e.target.value;
                                setBusiness((b) => ({ ...b, openingHours: JSON.stringify(p, null, 2) }));
                              }}
                              placeholder="08:00-18:00"
                              className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">Cerrado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {businessError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{businessError}</div>
                )}
                {savedBusiness && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    Configuración del negocio guardada.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loadingBusiness}
                  className="rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#3d5ae0] disabled:opacity-60"
                >
                  {loadingBusiness ? "Guardando..." : "Guardar datos generales"}
                </button>
              </form>
            </SectionCard>
          </div>
        </div>
      </main>
    </ErpPageShell>
  );
}
