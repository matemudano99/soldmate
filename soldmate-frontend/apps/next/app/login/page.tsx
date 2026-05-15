"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Sparkles, ArrowRight, Shield, Zap, BarChart2 } from "lucide-react";
import { authApi, describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

const FEATURES = [
  { Icon: Shield,    text: "Gestión segura de inventario" },
  { Icon: Zap,       text: "Incidencias en tiempo real" },
  { Icon: BarChart2, text: "Analítica operativa avanzada" },
];

export default function LoginPage() {
  const router  = useRouter();
  const storeLogin = useAuthStore((s) => s.login);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const doLogin = async (e: string, p: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login(e, p);
      storeLogin(data, remember);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(describeNetworkError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    doLogin(email, password);
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-gradient-to-br from-[#4f6ef7] via-[#5b76f8] to-[#7c94fa] p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-12 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 right-8 w-48 h-48 rounded-full bg-white/5 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Sparkles size={20} color="white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Soldmate</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestiona tu negocio<br />sin fricciones
          </h1>
          <p className="text-blue-100 text-base mb-10 leading-relaxed max-w-xs">
            ERP moderno para hostelería y restauración. Inventario, incidencias y proveedores en un solo lugar.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon size={15} color="white" />
                </div>
                <span className="text-blue-50 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 bg-white/10 rounded-2xl p-5 backdrop-blur-sm">
          <p className="text-white text-sm italic leading-relaxed">
            "Soldmate redujo nuestro tiempo en gestión de inventario un 60%. Imprescindible."
          </p>
          <div className="flex items-center gap-2.5 mt-3">
            <img src="https://i.pravatar.cc/32?img=5" alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-white/30" />
            <div>
              <p className="text-white text-xs font-semibold">María Gómez</p>
              <p className="text-blue-200 text-[10px]">Jefa de cocina · Restaurante El Mar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#fafbff]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-[#4f6ef7] rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(79,110,247,0.35)]">
              <Sparkles size={17} color="white" />
            </div>
            <span className="font-bold text-[#1e2040] text-lg">Soldmate</span>
          </div>

          <h2 className="text-2xl font-bold text-[#1e2040] mb-1">Bienvenido de nuevo</h2>
          <p className="text-gray-400 text-sm mb-4">Accede a tu panel operativo</p>

          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { role: "DEV", email: "dev@soldmate.local" },
              { role: "Owner", email: "owner@test.com" },
              { role: "Manager", email: "manager@test.com" },
              { role: "Supervisor", email: "supervisor@test.com" },
              { role: "Employee", email: "employee@test.com" },
              { role: "Viewer", email: "viewer@test.com" },
            ].map(t => (
              <button
                key={t.role}
                type="button"
                onClick={() => { setEmail(t.email); setPassword("Password123!"); }}
                className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title={`Usar credenciales de ${t.role}`}
              >
                {t.role}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="tu@empresa.com"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 transition-all shadow-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-500">Contraseña</label>
                <button type="button" className="text-xs text-[#4f6ef7] hover:text-[#3d5ae0] font-medium">
                  ¿Olvidaste la contraseña?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-11 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] focus:ring-2 focus:ring-[#4f6ef7]/10 transition-all shadow-sm"
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

            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#4f6ef7] accent-[#4f6ef7]"
              />
              <label htmlFor="remember" className="text-xs text-gray-500">Recordarme en este dispositivo</label>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#4f6ef7] text-white font-semibold py-3 text-sm shadow-[0_4px_15px_rgba(79,110,247,0.35)] hover:bg-[#3d5ae0] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                <>Iniciar sesión <ArrowRight size={15} /></>
              )}
            </button>
          </div>

          <p className="mt-6 rounded-xl border border-gray-100 bg-white px-3 py-2 text-center text-[11px] text-gray-500">
            Acceso con email y contraseña de tu organización.
          </p>

          <p className="mt-5 text-center text-xs text-gray-400">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="font-semibold text-[#4f6ef7] hover:text-[#3d5ae0]">
              Crea tu negocio gratis
            </Link>
          </p>
          <div className="mt-3 text-center text-[11px] text-gray-400 flex items-center justify-center gap-3">
            <Link href="/legal/terms" className="hover:text-[#4f6ef7]">Términos</Link>
            <span>·</span>
            <Link href="/legal/privacy" className="hover:text-[#4f6ef7]">Privacidad</Link>
            <span>·</span>
            <Link href="/legal/cookies" className="hover:text-[#4f6ef7]">Cookies</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
