"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { SectionCard } from "../components/web-ui";
import { ErpPageShell, AppTopHeader, notify } from "../shared/ui";
import { authApi, describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { Building2, Camera, Eye, EyeOff, KeyRound, Lock, Shield, UserRound } from "lucide-react";

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

function prefsStorageKey(accountEmail: string) {
  return `soldmate-user-prefs-v1:${accountEmail.toLowerCase()}`;
}

export default function CompanySettingsPage() {
  const token = useAuthStore((s) => s.token);
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const tier = useAuthStore((s) => s.tier);
  const companyId = useAuthStore((s) => s.companyId);
  const linkedCompanies = useAuthStore((s) => s.linkedCompanies);
  const firstNameFromStore = useAuthStore((s) => s.firstName);
  const lastNameFromStore = useAuthStore((s) => s.lastName);
  const avatarFromStore = useAuthStore((s) => s.avatarUrl);
  const setProfile = useAuthStore((s) => s.setProfile);
  const syncSession = useAuthStore((s) => s.syncSession);

  const [firstName, setFirstName] = useState(firstNameFromStore ?? "");
  const [lastName, setLastName] = useState(lastNameFromStore ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(avatarFromStore ?? null);
  const [loading, setLoading] = useState(false);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState(false);

  const [preferences, setPreferences] = useState({
    language: "Español",
    currency: "EUR",
    timezone: "Europe/Madrid",
  });
  const [prefsSaved, setPrefsSaved] = useState(false);

  const roleLabel =
    role === "OWNER"
      ? "Owner"
      : role === "MANAGER"
        ? "Manager"
        : role === "EMPLOYEE" || role === "STAFF"
          ? "Employee"
          : "Usuario";

  const tierLabel = tier === "PREMIUM" ? "Premium" : tier === "FREE" ? "Gratuito" : "—";

  useEffect(() => {
    setFirstName(firstNameFromStore ?? "");
    setLastName(lastNameFromStore ?? "");
    setAvatarUrl(avatarFromStore ?? null);
  }, [firstNameFromStore, lastNameFromStore, avatarFromStore]);

  useEffect(() => {
    if (!email || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(prefsStorageKey(email));
      if (!raw) return;
      const j = JSON.parse(raw) as Partial<typeof preferences>;
      setPreferences((p) => ({
        language: typeof j.language === "string" ? j.language : p.language,
        currency: typeof j.currency === "string" ? j.currency : p.currency,
        timezone: typeof j.timezone === "string" ? j.timezone : p.timezone,
      }));
    } catch {
      /* ignore */
    }
  }, [email]);

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
      syncSession(updated);
      setSaved(true);
      notify.success("Perfil guardado correctamente");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar el perfil";
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
      notify.success("Foto actualizada");
    } catch (err) {
      setError(describeNetworkError(err));
      notify.error(describeNetworkError(err));
    } finally {
      setLoadingAvatar(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setPwdError(null);
    setPwdOk(false);
    if (newPassword !== confirmPassword) {
      setPwdError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    if (newPassword.length < 8) {
      setPwdError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setPwdLoading(true);
    try {
      await authApi.changePassword(token, { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwdOk(true);
      notify.success("Contraseña actualizada");
    } catch (err) {
      setPwdError(describeNetworkError(err));
      notify.error(describeNetworkError(err));
    } finally {
      setPwdLoading(false);
    }
  };

  const onSavePreferencesLocal = () => {
    if (!email || typeof window === "undefined") return;
    try {
      localStorage.setItem(prefsStorageKey(email), JSON.stringify(preferences));
      setPrefsSaved(true);
      notify.success("Preferencias guardadas en este navegador");
      window.setTimeout(() => setPrefsSaved(false), 4000);
    } catch {
      notify.error("No se pudieron guardar las preferencias");
    }
  };

  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="flex-1 min-h-0 overflow-y-auto pb-6">
        <div className="px-4 sm:px-6">
          <h1 className="text-2xl font-bold text-[#1e2040] mb-5">Ajustes</h1>
          <div className="max-w-4xl grid gap-4">
            <SectionCard title="Mi perfil" subtitle="Nombre visible y foto en el equipo">
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
                        if (file) void onUploadAvatar(file);
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
                    <p className="text-[10px] text-gray-400 mt-2">El email de acceso no se puede cambiar desde aquí.</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Rol en este negocio</p>
                    <p className="text-[#1e2040] font-semibold text-sm">{roleLabel}</p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
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

            <SectionCard
              title="Seguridad"
              subtitle="Contraseña de acceso a Soldmate (todas tus empresas vinculadas)"
              right={<Lock size={16} className="text-gray-400" />}
            >
              <form onSubmit={onChangePassword} className="space-y-3 max-w-md">
                <p className="text-xs text-gray-500">
                  Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número (misma regla que en el registro).
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contraseña actual</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#4f6ef7]"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-1"
                      onClick={() => setShowPwd((s) => !s)}
                      aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nueva contraseña</label>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Confirmar nueva contraseña</label>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
                  />
                </div>
                {pwdError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{pwdError}</div>
                )}
                {pwdOk && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    Contraseña cambiada. Usa la nueva en el próximo inicio de sesión en otros dispositivos.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={pwdLoading || !currentPassword || !newPassword}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1e2040] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#2a3158] disabled:opacity-50"
                >
                  <KeyRound size={16} />
                  {pwdLoading ? "Actualizando…" : "Actualizar contraseña"}
                </button>
              </form>
            </SectionCard>

            <SectionCard
              title="Cuenta y sesión"
              subtitle="Resumen del negocio activo y tu plan"
              right={<Shield size={16} className="text-gray-400" />}
            >
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Negocio activo (ID)</p>
                  <p className="font-semibold text-[#1e2040]">{companyId != null ? String(companyId) : "—"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Plan en este negocio</p>
                  <p className="font-semibold text-[#1e2040]">{tierLabel}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4 sm:col-span-2">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Negocios vinculados a tu usuario</p>
                  <p className="font-semibold text-[#1e2040]">{linkedCompanies.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Cambia de contexto con el selector «Negocio activo» en la cabecera cuando tengas más de uno.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Preferencias" subtitle="Idioma, moneda y zona horaria (solo este navegador)">
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                Estas opciones se guardan en tu dispositivo para recordar cómo prefieres ver importes y fechas. El calendario operativo del negocio sigue usando la zona horaria configurada en{" "}
                <Link href="/business-settings" className="font-semibold text-[#4f6ef7] underline">
                  Configuración del negocio
                </Link>{" "}
                (OWNER).
              </p>
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
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Moneda preferida (vista)</p>
                  <select
                    value={preferences.currency}
                    onChange={(e) => setPreferences((p) => ({ ...p, currency: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option>EUR</option>
                    <option>USD</option>
                    <option>GBP</option>
                    <option>MXN</option>
                  </select>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-4 sm:col-span-2">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Zona horaria (referencia personal)</p>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => setPreferences((p) => ({ ...p, timezone: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={onSavePreferencesLocal}
                className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#1e2040] hover:bg-gray-50"
              >
                Guardar preferencias en este navegador
              </button>
              {prefsSaved && <p className="text-xs text-emerald-600 mt-2">Guardado.</p>}
            </SectionCard>

            {role === "OWNER" && (
              <SectionCard
                title="Configuración del negocio"
                subtitle="Datos fiscales, horario y ubicación del tenant actual"
                right={
                  <Link href="/business-settings" className="text-xs font-semibold text-[#4f6ef7] hover:underline inline-flex items-center gap-1">
                    <Building2 size={14} />
                    Abrir configurador
                  </Link>
                }
              >
                <p className="text-sm text-gray-600">
                  Nombre fiscal, NIF/CIF, moneda del negocio, coordenadas y horarios. Si operas en varios negocios, elige el activo en la cabecera.
                </p>
              </SectionCard>
            )}
          </div>
        </div>
      </main>
    </ErpPageShell>
  );
}
