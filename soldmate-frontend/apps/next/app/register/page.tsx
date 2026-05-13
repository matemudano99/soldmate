"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Sparkles, ArrowRight, Check, Building2, User, Mail, Lock } from "lucide-react";
import { authApi, describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

type Step = 1 | 2;

const STEP_LABELS: Record<Step, string> = {
  1: "Tu empresa",
  2: "Tu cuenta",
};

export default function RegisterPage() {
  const router     = useRouter();
  const storeLogin = useAuthStore((s) => s.login);

  const [step,    setStep]    = useState<Step>(1);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    taxId: "",
    country: "ES",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const set = (field: string, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authApi.register({
        companyName: form.companyName,
        taxId:       form.taxId,
        country:     form.country,
        email:       form.email,
        password:    form.password,
        firstName:   form.firstName,
        lastName:    form.lastName,
      });
      storeLogin(data);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(describeNetworkError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[40%] flex-col justify-between bg-gradient-to-br from-[#1e2040] via-[#252850] to-[#2d3370] p-12 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#4f6ef7]/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#4f6ef7]/15 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4f6ef7] rounded-xl flex items-center justify-center shadow-[0_4px_15px_rgba(79,110,247,0.4)]">
            <Sparkles size={18} color="white" />
          </div>
          <span className="text-white font-bold text-xl">Soldmate</span>
        </div>

        {/* Center */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#4f6ef7]/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-blue-200 text-xs font-medium">Registro gratuito · Sin tarjeta</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Empieza en<br />menos de 2 min
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed max-w-xs">
            Crea tu cuenta OWNER o, si ya tienes email en Soldmate, registra <strong>otro negocio</strong> con la misma contraseña (nombre y NIF nuevos, distintos de los ya dados de alta).
          </p>

          {/* Steps preview */}
          <div className="mt-10 space-y-3">
            {([1, 2] as Step[]).map((s) => (
              <div
                key={s}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  step === s ? "bg-white/10" : "opacity-50"
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  step > s
                    ? "bg-green-400 text-white"
                    : step === s
                    ? "bg-[#4f6ef7] text-white"
                    : "bg-white/10 text-slate-400"
                }`}>
                  {step > s ? <Check size={13} /> : s}
                </div>
                <span className={`text-sm font-medium ${step === s ? "text-white" : "text-slate-400"}`}>
                  {STEP_LABELS[s]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stat badges */}
        <div className="relative z-10 grid grid-cols-2 gap-3">
          {[
            { value: "+500", label: "negocios activos" },
            { value: "99.9%", label: "uptime garantizado" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/8 rounded-xl p-3 border border-white/10">
              <p className="text-[#4f6ef7] text-xl font-bold">{stat.value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#fafbff]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-[#4f6ef7] rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(79,110,247,0.35)]">
              <Sparkles size={17} color="white" />
            </div>
            <span className="font-bold text-[#1e2040] text-lg">Soldmate</span>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mb-6">
            {([1, 2] as Step[]).map((s) => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${
                s === step ? "w-8 bg-[#4f6ef7]" : s < step ? "w-5 bg-[#4f6ef7]/50" : "w-5 bg-gray-200"
              }`} />
            ))}
            <span className="ml-2 text-xs text-gray-400 font-medium">Paso {step} de 2</span>
          </div>

          <h2 className="text-2xl font-bold text-[#1e2040] mb-1">
            {step === 1 ? "Datos de la empresa" : "Crea tu cuenta"}
          </h2>
          <p className="text-gray-400 text-sm mb-7">
            {step === 1
              ? "Cuéntanos sobre tu negocio"
              : "Configura tus credenciales de acceso"}
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <Building2 size={12} /> Nombre del negocio
                  </label>
                  <input
                    required
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                    placeholder="Restaurante El Mar S.L."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 shadow-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">NIF / CIF</label>
                    <input
                      required
                      value={form.taxId}
                      onChange={(e) => set("taxId", e.target.value)}
                      placeholder="B12345678"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">País</label>
                    <select
                      value={form.country}
                      onChange={(e) => set("country", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] shadow-sm"
                    >
                      <option value="ES">🇪🇸 España</option>
                      <option value="MX">🇲🇽 México</option>
                      <option value="AR">🇦🇷 Argentina</option>
                      <option value="CO">🇨🇴 Colombia</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                      <User size={12} /> Nombre
                    </label>
                    <input
                      required
                      value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      placeholder="María"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Apellidos</label>
                    <input
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      placeholder="García López"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 shadow-sm"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <Mail size={12} /> Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="maria@mirestaurante.com"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 shadow-sm"
                  />
                  <p className="text-[11px] text-gray-500 leading-snug mt-1.5">
                    ¿Ya tienes cuenta? Mismo email y tu contraseña: se creará un <strong>nuevo negocio</strong> vinculado a ti. El nombre comercial no puede coincidir con otro de tus negocios; el NIF/CIF debe ser único en la plataforma.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <Lock size={12} /> Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-11 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Confirmar contraseña</label>
                  <input
                    type="password"
                    required
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 shadow-sm"
                  />
                </div>

                {/* Password strength */}
                {form.password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          form.password.length >= i * 3
                            ? form.password.length >= 10 ? "bg-green-400" : "bg-amber-400"
                            : "bg-gray-100"
                        }`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {form.password.length < 6 ? "Muy corta" :
                       form.password.length < 10 ? "Aceptable" : "Contraseña segura ✓"}
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <input
                    id="terms"
                    type="checkbox"
                    required
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-[#4f6ef7]"
                  />
                  <label htmlFor="terms" className="text-xs text-gray-500 leading-relaxed">
                    Acepto los{" "}
                    <span className="text-[#4f6ef7] font-medium cursor-pointer">Términos de servicio</span>{" "}
                    y la{" "}
                    <span className="text-[#4f6ef7] font-medium cursor-pointer">Política de privacidad</span>
                  </label>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border border-gray-200 text-gray-500 font-semibold py-3 text-sm hover:bg-gray-50 transition-all"
                >
                  Atrás
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#4f6ef7] text-white font-semibold py-3 text-sm shadow-[0_4px_15px_rgba(79,110,247,0.35)] hover:bg-[#3d5ae0] transition-all disabled:opacity-60"
              >
                {loading ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : step === 1 ? (
                  <><span>Siguiente</span><ArrowRight size={15} /></>
                ) : (
                  <><span>Crear cuenta</span><Check size={15} /></>
                )}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-semibold text-[#4f6ef7] hover:text-[#3d5ae0]">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
