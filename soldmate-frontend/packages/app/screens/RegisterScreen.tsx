// packages/app/screens/RegisterScreen.tsx
//
// Pantalla de registro de nueva empresa.
// Diseño multi-paso para no abrumar al usuario con todo el formulario a la vez.
//
// Paso 1: Datos de la empresa (nombre, NIF/CIF, país)
// Paso 2: Datos del dueño (nombre, email, contraseña)
// Paso 3: Confirmación y creación de cuenta

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "../lib/router";
import { ArrowLeft, ArrowRight, Check, Building2, User, ShieldCheck } from "lucide-react-native";
import { authApi } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { Input, Button } from "../components/ui";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FormData {
  // Paso 1 – empresa
  companyName: string;
  taxId: string;
  country: string;
  // Paso 2 – dueño
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type StepId = 1 | 2 | 3;

// ─── Indicador de pasos ───────────────────────────────────────────────────────

interface StepIndicatorProps {
  current: StepId;
  total: number;
}

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-4">
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as StepId;
        const done = step < current;
        const active = step === current;
        return (
          <React.Fragment key={step}>
            <View
              className={`
                w-8 h-8 rounded-full items-center justify-center
                ${active ? "bg-amber-500" : done ? "bg-emerald-600" : "bg-slate-700"}
              `}
            >
              {done ? (
                <Check size={14} color="white" />
              ) : (
                <Text className={`text-xs font-bold ${active ? "text-white" : "text-slate-400"}`}>
                  {step}
                </Text>
              )}
            </View>
            {i < total - 1 && (
              <View className={`h-0.5 w-10 ${done ? "bg-emerald-600" : "bg-slate-700"}`} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── RegisterScreen ───────────────────────────────────────────────────────────

export function RegisterScreen() {
  const router = useRouter();
  const login  = useAuthStore((state) => state.login);

  const [step, setStep] = useState<StepId>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    companyName: "",
    taxId: "",
    country: "ES",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Actualiza un campo del formulario manteniendo el resto intacto
  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  // ── Validaciones por paso ──

  const validateStep1 = (): boolean => {
    if (form.companyName.trim().length < 2) {
      setError("El nombre del negocio es obligatorio");
      return false;
    }
    if (form.taxId.trim().length < 9) {
      setError("Introduce un NIF o CIF válido (ej: B12345678 o 12345678Z)");
      return false;
    }
    if (form.country.length !== 2) {
      setError("Introduce el código de país de 2 letras (ej: ES, FR, MX)");
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (form.firstName.trim().length < 2) {
      setError("Introduce tu nombre");
      return false;
    }
    if (!form.email.includes("@")) {
      setError("Introduce un email válido");
      return false;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres");
      return false;
    }
    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep((s) => (s - 1) as StepId);
    else router.back();
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.register({
        companyName: form.companyName.trim(),
        taxId:       form.taxId.trim(),
        country:     form.country.toUpperCase().trim(),
        email:       form.email.trim().toLowerCase(),
        password:    form.password,
        firstName:   form.firstName.trim(),
        lastName:    form.lastName.trim(),
      });
      login(data);
      router.replace("/dashboard");
    } catch (err: any) {
      const msg = err.message ?? "Error al crear la cuenta";
      setError(msg);
      const lower = msg.toLowerCase();
      if (lower.includes("nif") || lower.includes("cif") || lower.includes("nombre comercial")) {
        setStep(1);
      } else if (lower.includes("contraseña no coincide")) {
        setStep(2);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Títulos y descripciones por paso ──
  const STEPS = [
    { icon: <Building2 size={22} color="#f59e0b" />, title: "Tu negocio",  sub: "Datos de la empresa o local" },
    { icon: <User       size={22} color="#f59e0b" />, title: "Tu cuenta",  sub: "Datos del administrador" },
    { icon: <ShieldCheck size={22} color="#f59e0b" />, title: "Confirmar", sub: "Revisa y crea la cuenta" },
  ];

  const current = STEPS[step - 1];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-950"
    >
      {/* ── Header ── */}
      <View className="flex-row items-center gap-3 px-4 pt-14 pb-2 border-b border-slate-800">
        <TouchableOpacity onPress={handleBack} className="bg-slate-800 rounded-xl p-2.5">
          <ArrowLeft size={20} color="#94a3b8" />
        </TouchableOpacity>
        <View>
          <Text className="text-white font-bold text-xl">Registrar negocio</Text>
          <Text className="text-slate-400 text-xs">Soldmate ERP · Plan gratuito</Text>
        </View>
      </View>

      {/* ── Indicador de pasos ── */}
      <StepIndicator current={step} total={3} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 gap-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabecera del paso ── */}
        <View className="flex-row items-center gap-3 bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <View className="bg-amber-500/20 rounded-xl p-3">{current.icon}</View>
          <View>
            <Text className="text-white font-bold text-lg">{current.title}</Text>
            <Text className="text-slate-400 text-sm">{current.sub}</Text>
          </View>
        </View>

        {/* ── Paso 1: Datos de la empresa ── */}
        {step === 1 && (
          <View className="gap-4">
            <Input
              label="Nombre del negocio"
              value={form.companyName}
              onChangeText={(t) => update("companyName", t)}
              placeholder="Bar El Patio, Restaurante Lucía…"
            />
            <Input
              label="NIF / CIF"
              value={form.taxId}
              onChangeText={(t) => update("taxId", t)}
              placeholder="B12345678 (empresa) o 12345678Z (autónomo)"
              autoCapitalize="characters"
            />
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-slate-300">País</Text>
              {/* Selector simple de país — en producción usarías un picker nativo */}
              <View className="flex-row gap-2">
                {["ES", "FR", "IT", "PT", "MX"].map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => update("country", c)}
                    className={`
                      flex-1 py-3 rounded-xl border items-center
                      ${form.country === c
                        ? "bg-amber-500/20 border-amber-500"
                        : "bg-slate-800 border-slate-700"}
                    `}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        form.country === c ? "text-amber-400" : "text-slate-400"
                      }`}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-slate-500 text-xs">
                Afecta a la validación del NIF/CIF y los tipos de IVA por defecto
              </Text>
            </View>
          </View>
        )}

        {/* ── Paso 2: Datos del dueño ── */}
        {step === 2 && (
          <View className="gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Nombre"
                  value={form.firstName}
                  onChangeText={(t) => update("firstName", t)}
                  placeholder="Carmen"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Apellidos"
                  value={form.lastName}
                  onChangeText={(t) => update("lastName", t)}
                  placeholder="García"
                />
              </View>
            </View>
            <Input
              label="Email"
              value={form.email}
              onChangeText={(t) => update("email", t)}
              placeholder="carmen@mirestaurante.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text className="text-slate-500 text-xs -mt-2">
              Si ya tienes cuenta, mismo email y contraseña: nuevo negocio (nombre distinto a tus otros negocios y NIF/CIF no usado antes).
            </Text>
            <Input
              label="Contraseña"
              value={form.password}
              onChangeText={(t) => update("password", t)}
              placeholder="Mínimo 8 caracteres"
              secureTextEntry
            />
            <Input
              label="Repetir contraseña"
              value={form.confirmPassword}
              onChangeText={(t) => update("confirmPassword", t)}
              placeholder="Repite la contraseña"
              secureTextEntry
              error={
                form.confirmPassword.length > 0 &&
                form.password !== form.confirmPassword
                  ? "Las contraseñas no coinciden"
                  : null
              }
            />
          </View>
        )}

        {/* ── Paso 3: Resumen y confirmación ── */}
        {step === 3 && (
          <View className="gap-4">
            {/* Tarjeta resumen */}
            <View className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
              <View className="px-4 py-3 border-b border-slate-700">
                <Text className="text-slate-400 text-xs uppercase tracking-widest">Empresa</Text>
              </View>
              <View className="px-4 py-3 gap-2">
                <SummaryRow label="Nombre"   value={form.companyName} />
                <SummaryRow label="NIF/CIF"  value={form.taxId.toUpperCase()} />
                <SummaryRow label="País"     value={form.country.toUpperCase()} />
              </View>

              <View className="px-4 py-3 border-t border-slate-700">
                <Text className="text-slate-400 text-xs uppercase tracking-widest">Administrador</Text>
              </View>
              <View className="px-4 py-3 gap-2">
                <SummaryRow label="Nombre" value={`${form.firstName} ${form.lastName}`} />
                <SummaryRow label="Email"  value={form.email} />
              </View>
            </View>

            {/* Lo que incluye el plan gratuito */}
            <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 gap-2">
              <Text className="text-amber-400 font-semibold text-sm">Plan gratuito incluye:</Text>
              {[
                "Gestión de inventario ilimitada",
                "Módulo de incidencias con fotos",
                "Configuración de IVA personalizada",
                "Acceso web y móvil",
              ].map((item) => (
                <View key={item} className="flex-row items-center gap-2">
                  <Check size={14} color="#4ade80" />
                  <Text className="text-slate-300 text-sm">{item}</Text>
                </View>
              ))}
            </View>

            <Text className="text-slate-500 text-xs text-center">
              Al crear la cuenta aceptas los términos de uso de Soldmate.
            </Text>
          </View>
        )}

        {/* ── Error global ── */}
        {error && (
          <View className="bg-red-950 border border-red-800 rounded-xl px-4 py-3">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}

        {/* ── Botones de navegación ── */}
        <View className="flex-row gap-3 pt-2">
          {step > 1 && (
            <TouchableOpacity
              onPress={handleBack}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-4 items-center"
            >
              <Text className="text-slate-300 font-semibold">Atrás</Text>
            </TouchableOpacity>
          )}

          {step < 3 ? (
            <View className={step > 1 ? "flex-1" : "flex-1"}>
              <TouchableOpacity
                onPress={handleNext}
                className="bg-amber-500 active:bg-amber-600 rounded-xl py-4 flex-row items-center justify-center gap-2"
              >
                <Text className="text-white font-semibold text-base">Siguiente</Text>
                <ArrowRight size={18} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-1">
              <Button onPress={handleSubmit} loading={loading}>
                Crear cuenta
              </Button>
            </View>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Fila de resumen ──────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-slate-400 text-sm">{label}</Text>
      <Text className="text-white text-sm font-medium">{value || "—"}</Text>
    </View>
  );
}
