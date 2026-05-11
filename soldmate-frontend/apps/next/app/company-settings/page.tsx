"use client";

import React, { useEffect, useState } from "react";
import { SectionCard } from "../components/web-ui";
import { WebErpNavbar } from "../components/web-erp-navbar";
import { AppTopHeader } from "../shared/ui";
import { authApi, businessProfileApi, type BusinessProfileResponse, describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { Building2, Camera, MapPin, Settings2, UserRound } from "lucide-react";
import { notify } from "../shared/ui";

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

export default function CompanySettingsPage() {
  const token = useAuthStore((s) => s.token);
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const firstNameFromStore = useAuthStore((s) => s.firstName);
  const lastNameFromStore = useAuthStore((s) => s.lastName);
  const avatarFromStore = useAuthStore((s) => s.avatarUrl);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [firstName, setFirstName] = useState(firstNameFromStore ?? "");
  const [lastName, setLastName] = useState(lastNameFromStore ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(avatarFromStore ?? null);
  const [loading, setLoading] = useState(false);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBusiness, setSavedBusiness] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [showBusinessPanel, setShowBusinessPanel] = useState(false);
  const [preferences, setPreferences] = useState({
    language: "Español",
    currency: "EUR",
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
  });
  const roleLabel =
    role === "OWNER" ? "Owner" :
    role === "MANAGER" ? "Manager" :
    role === "EMPLOYEE" || role === "STAFF" ? "Employee" :
    "Usuario";

  useEffect(() => {
    setFirstName(firstNameFromStore ?? "");
    setLastName(lastNameFromStore ?? "");
    setAvatarUrl(avatarFromStore ?? null);
  }, [firstNameFromStore, lastNameFromStore, avatarFromStore]);

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
        });
        setPreferences((prev) => ({
          ...prev,
          timezone: data.timezone ?? prev.timezone,
          currency: "EUR",
        }));
      } catch (err) {
        setBusinessError(describeNetworkError(err));
      }
    }
    loadBusiness();
  }, [token]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await authApi.updateProfile(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setProfile({ firstName: updated.firstName, lastName: updated.lastName, avatarUrl: updated.avatarUrl });
      setSaved(true);
      notify.success("Perfil guardado correctamente");
    } catch (err: any) {
      const msg = err.message ?? "No se pudo guardar el perfil";
      setError(msg);
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onUploadAvatar = async (file: File) => {
    if (!token) return;
    setLoadingAvatar(true);
    setError(null);
    try {
      const res = await authApi.uploadAvatar(token, file);
      setAvatarUrl(res.avatarUrl);
      setProfile({ firstName, lastName, avatarUrl: res.avatarUrl });
    } catch (err) {
      setError(describeNetworkError(err));
    } finally {
      setLoadingAvatar(false);
    }
  };

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

  return (
    <div className="flex min-h-screen bg-[#eef1f8]">
      <WebErpNavbar />
      <main className="flex-1 pb-6 overflow-y-auto">
        <AppTopHeader />
        <div className="px-4 sm:px-6">
        <h1 className="text-2xl font-bold text-[#1e2040] mb-5">Ajustes</h1>
        <div className="max-w-4xl grid gap-4">
          <SectionCard title="Mi perfil" subtitle="Datos del usuario autenticado">
            <form onSubmit={onSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#f0f3ff] border border-blue-100 overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserRound size={26} className="text-[#4f6ef7]" />
                  )}
                </div>
                <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#1e2040] cursor-pointer hover:bg-gray-50">
                  <Camera size={14} />
                  {loadingAvatar ? "Subiendo..." : "Cambiar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadAvatar(file);
                    }}
                  />
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nombre</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Apellido</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Email</p>
                  <p className="text-[#1e2040] font-semibold text-sm break-all">{email ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Rol</p>
                  <p className="text-[#1e2040] font-semibold text-sm">{roleLabel}</p>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}
              {saved && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Perfil actualizado correctamente
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold shadow-[0_4px_12px_rgba(79,110,247,0.30)] hover:bg-[#3d5ae0] disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Guardar perfil"}
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Preferencias" subtitle="Configuración personal y regional">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Idioma</p>
                <select
                  value={preferences.language}
                  onChange={(e) => setPreferences((p) => ({ ...p, language: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <option>Español</option>
                  <option>English</option>
                </select>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Moneda</p>
                <select
                  value={preferences.currency}
                  onChange={(e) => setPreferences((p) => ({ ...p, currency: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4 sm:col-span-2">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Zona horaria</p>
                <select
                  value={preferences.timezone}
                  onChange={(e) => setPreferences((p) => ({ ...p, timezone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>

          {role === "OWNER" && (
            <SectionCard title="Administración del negocio" subtitle="Visible solo para administradores OWNER">
              <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3">
                <div className="text-sm text-blue-800 flex items-center gap-2">
                  <Building2 size={16} />
                  Configura información clave que se reutiliza en clima, horario y operación.
                </div>
                <button
                  type="button"
                  onClick={() => setShowBusinessPanel((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4f6ef7] text-white px-3 py-2 text-xs font-semibold hover:bg-[#3d5ae0]"
                >
                  <Settings2 size={14} />
                  {showBusinessPanel ? "Ocultar" : "Configurar negocio"}
                </button>
              </div>

              {showBusinessPanel && (
                <form onSubmit={onSaveBusiness} className="mt-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input value={business.businessName} onChange={(e) => setBusiness((b) => ({ ...b, businessName: e.target.value }))} placeholder="Nombre del negocio" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                    <input value={business.phone ?? ""} onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))} placeholder="Teléfono" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                    <input value={business.email ?? ""} onChange={(e) => setBusiness((b) => ({ ...b, email: e.target.value }))} placeholder="Email de negocio" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                    <input value={business.address ?? ""} onChange={(e) => setBusiness((b) => ({ ...b, address: e.target.value }))} placeholder="Dirección" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                    <input value={business.city ?? ""} onChange={(e) => setBusiness((b) => ({ ...b, city: e.target.value }))} placeholder="Ciudad" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                    <input value={business.postalCode ?? ""} onChange={(e) => setBusiness((b) => ({ ...b, postalCode: e.target.value }))} placeholder="Código postal" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                    <select value={business.country ?? "ES"} onChange={(e) => setBusiness((b) => ({ ...b, country: e.target.value }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
                      {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    <select value={preferences.timezone} onChange={(e) => setPreferences((p) => ({ ...p, timezone: e.target.value }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
                      {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                    <label className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400" />
                      <input type="number" step="0.0001" value={business.latitude ?? 0} onChange={(e) => setBusiness((b) => ({ ...b, latitude: Number(e.target.value) }))} placeholder="Latitud" className="w-full outline-none" />
                    </label>
                    <input type="number" step="0.0001" value={business.longitude ?? 0} onChange={(e) => setBusiness((b) => ({ ...b, longitude: Number(e.target.value) }))} placeholder="Longitud" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 font-semibold mb-2">Horario por día</label>
                    <div className="space-y-2">
                      {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => {
                        const label = { mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom" }[day];
                        let parsed: Record<string, string> = {};
                        try { parsed = JSON.parse(business.openingHours ?? "{}"); } catch {}
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
                                try { p = JSON.parse(business.openingHours ?? "{}"); } catch {}
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
                                  try { p = JSON.parse(business.openingHours ?? "{}"); } catch {}
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
                  {businessError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{businessError}</div>}
                  {savedBusiness && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Configuración del negocio guardada.</div>}
                  <button type="submit" disabled={loadingBusiness} className="rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#3d5ae0] disabled:opacity-60">
                    {loadingBusiness ? "Guardando..." : "Guardar negocio"}
                  </button>
                </form>
              )}
            </SectionCard>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
