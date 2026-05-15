"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SectionCard } from "../components/web-ui";
import { ErpPageShell, AppTopHeader, notify } from "../shared/ui";
import { businessProfileApi, type BusinessProfileResponse, describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { Building2 } from "lucide-react";

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
    const authToken = token; // narrowed: string (not null)
    async function loadBusiness() {
      try {
        const data = await businessProfileApi.get(authToken);
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
            Datos generales del negocio actual (nombre, contacto, ubicación y horario). Si tu usuario opera en varios negocios distintos, elige el activo en la cabecera con el menú junto al nombre del negocio.
          </p>
          <div className="max-w-4xl grid gap-4">
            <SectionCard title="Identificación y plan" subtitle="Datos fiscales del negocio activo (solo lectura)">
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <span className="mb-1 block text-xs font-semibold text-gray-500">NIF / CIF</span>
                  <p className="font-mono font-semibold text-[#1e2040]">{business.taxId?.trim() || "—"}</p>
                  <p className="mt-2 text-[10px] text-gray-400">Se asigna en el alta del negocio. Para corregirlo contacta con soporte.</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <span className="mb-1 block text-xs font-semibold text-gray-500">Plan de suscripción</span>
                  <p className="font-semibold text-[#1e2040]">
                    {business.subscriptionTier === "PREMIUM" ? "Premium" : "Gratuito"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <span className="mb-1 block text-xs font-semibold text-gray-500">Moneda contable</span>
                  <p className="font-semibold text-[#1e2040]">{business.currency ?? "EUR"}</p>
                  <p className="mt-2 text-[10px] text-gray-400">Editable abajo con el resto de datos generales.</p>
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
                  <div>
                    <label htmlFor="business-name" className="mb-1 block text-xs font-semibold text-gray-500">
                      Nombre del negocio
                    </label>
                    <input
                      id="business-name"
                      value={business.businessName}
                      onChange={(e) => setBusiness((b) => ({ ...b, businessName: e.target.value }))}
                      placeholder="Ej. Soldmate Madrid"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="business-phone" className="mb-1 block text-xs font-semibold text-gray-500">
                      Teléfono
                    </label>
                    <input
                      id="business-phone"
                      value={business.phone ?? ""}
                      onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))}
                      placeholder="+34 …"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="business-email" className="mb-1 block text-xs font-semibold text-gray-500">
                      Email de negocio
                    </label>
                    <input
                      id="business-email"
                      type="email"
                      value={business.email ?? ""}
                      onChange={(e) => setBusiness((b) => ({ ...b, email: e.target.value }))}
                      placeholder="contacto@empresa.com"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="business-address" className="mb-1 block text-xs font-semibold text-gray-500">
                      Dirección
                    </label>
                    <input
                      id="business-address"
                      value={business.address ?? ""}
                      onChange={(e) => setBusiness((b) => ({ ...b, address: e.target.value }))}
                      placeholder="Calle, número, piso…"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="business-city" className="mb-1 block text-xs font-semibold text-gray-500">
                      Ciudad
                    </label>
                    <input
                      id="business-city"
                      value={business.city ?? ""}
                      onChange={(e) => setBusiness((b) => ({ ...b, city: e.target.value }))}
                      placeholder="Ciudad"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="business-postal" className="mb-1 block text-xs font-semibold text-gray-500">
                      Código postal
                    </label>
                    <input
                      id="business-postal"
                      value={business.postalCode ?? ""}
                      onChange={(e) => setBusiness((b) => ({ ...b, postalCode: e.target.value }))}
                      placeholder="28001"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="business-country" className="mb-1 block text-xs font-semibold text-gray-500">
                      País
                    </label>
                    <select
                      id="business-country"
                      value={business.country ?? "ES"}
                      onChange={(e) => setBusiness((b) => ({ ...b, country: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="business-currency" className="mb-1 block text-xs font-semibold text-gray-500">
                      Moneda contable (ISO)
                    </label>
                    <select
                      id="business-currency"
                      value={business.currency ?? "EUR"}
                      onChange={(e) => setBusiness((b) => ({ ...b, currency: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      title="Moneda para importes y cierres"
                    >
                      {CURRENCY_OPTIONS.map((cur) => (
                        <option key={cur} value={cur}>
                          {cur}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="business-timezone" className="mb-1 block text-xs font-semibold text-gray-500">
                      Zona horaria
                    </label>
                    <select
                      id="business-timezone"
                      value={preferences.timezone}
                      onChange={(e) => setPreferences((p) => ({ ...p, timezone: e.target.value }))}
                      className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    >
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-2">Horario por día</label>
                  <p className="text-[10px] text-gray-400 mb-3">Puedes configurar horario partido (p. ej. 08:00–14:00 y 17:00–22:00) usando el botón «+ Turno».</p>
                  <div className="space-y-3">
                    {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => {
                      const label = { mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom" }[day];
                      let parsed: Record<string, string> = {};
                      try { parsed = JSON.parse(business.openingHours ?? "{}"); } catch { /* ignore */ }
                      const val = parsed[day] ?? "CLOSED";
                      const isClosed = val === "CLOSED";

                      // Parse into slots: "08:00-14:00,17:00-22:00" → [["08:00","14:00"],["17:00","22:00"]]
                      const slots: [string, string][] = isClosed ? [] : val.split(",").map((s) => {
                        const [open, close] = s.trim().split("-");
                        return [open ?? "08:00", close ?? "18:00"];
                      });

                      const setSlots = (nextSlots: [string, string][]) => {
                        let p: Record<string, string> = {};
                        try { p = JSON.parse(business.openingHours ?? "{}"); } catch { /* ignore */ }
                        p[day] = nextSlots.length === 0 ? "CLOSED" : nextSlots.map(([o, c]) => `${o}-${c}`).join(",");
                        setBusiness((b) => ({ ...b, openingHours: JSON.stringify(p, null, 2) }));
                      };

                      return (
                        <div key={day} className="flex flex-col sm:flex-row sm:items-start gap-2">
                          <div className="flex items-center gap-2 min-w-[5rem]">
                            <input
                              type="checkbox"
                              checked={!isClosed}
                              aria-label={`Abierto el ${label}`}
                              onChange={(e) => setSlots(e.target.checked ? [["08:00", "18:00"]] : [])}
                              className="accent-[#4f6ef7]"
                            />
                            <span className="text-xs font-semibold text-gray-600 w-8">{label}</span>
                          </div>

                          {isClosed ? (
                            <span className="text-xs text-gray-400 italic py-1.5">Cerrado</span>
                          ) : (
                            <div className="flex flex-col gap-1.5 flex-1">
                              {slots.map(([open, close], idx) => (
                                <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                  <input
                                    type="time"
                                    value={open}
                                    onChange={(e) => {
                                      const next = [...slots] as [string, string][];
                                      next[idx] = [e.target.value, close];
                                      setSlots(next);
                                    }}
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs min-w-[90px]"
                                  />
                                  <span className="text-xs text-gray-400">–</span>
                                  <input
                                    type="time"
                                    value={close}
                                    onChange={(e) => {
                                      const next = [...slots] as [string, string][];
                                      next[idx] = [open, e.target.value];
                                      setSlots(next);
                                    }}
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs min-w-[90px]"
                                  />
                                  {slots.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setSlots(slots.filter((_, i) => i !== idx))}
                                      className="text-[10px] text-red-400 hover:text-red-600 px-1"
                                      title="Eliminar turno"
                                    >✕</button>
                                  )}
                                </div>
                              ))}
                              {slots.length < 2 && (
                                <button
                                  type="button"
                                  onClick={() => setSlots([...slots, ["17:00", "22:00"]])}
                                  className="text-[10px] font-semibold text-[#4f6ef7] hover:underline text-left"
                                >+ Turno (partido)</button>
                              )}
                            </div>
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
