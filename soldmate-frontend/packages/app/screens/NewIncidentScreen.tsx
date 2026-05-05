// packages/app/screens/NewIncidentScreen.tsx
//
// Pantalla para reportar una avería desde el móvil.
// Diseñada para que un camarero o cocinero pueda reportar rápidamente
// desde el suelo del restaurante.
//
// Funcionalidades:
//   - Formulario rápido: título, descripción, prioridad
//   - Captura de foto con la cámara del dispositivo
//   - Envío al backend con subida a Supabase Storage
//   - Feedback visual claro (estados de carga y éxito)

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "../lib/router";
import { Camera, X, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react-native";
import { useAuthStore } from "../lib/store";
import { incidentsApi } from "../lib/api";
import { Input, Button } from "../components/ui";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface PriorityOption {
  value: Priority;
  label: string;
  emoji: string;
  activeClass: string;
  textClass: string;
}

// Opciones de prioridad con su estilo visual
const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: "LOW",
    label: "Baja",
    emoji: "🟢",
    activeClass: "bg-emerald-900/50 border-emerald-600",
    textClass: "text-emerald-400",
  },
  {
    value: "MEDIUM",
    label: "Media",
    emoji: "🟡",
    activeClass: "bg-amber-900/50 border-amber-600",
    textClass: "text-amber-400",
  },
  {
    value: "HIGH",
    label: "Alta",
    emoji: "🟠",
    activeClass: "bg-orange-900/50 border-orange-600",
    textClass: "text-orange-400",
  },
  {
    value: "CRITICAL",
    label: "Crítica",
    emoji: "🔴",
    activeClass: "bg-red-900/50 border-red-600",
    textClass: "text-red-400",
  },
];

// ─── NewIncidentScreen ────────────────────────────────────────────────────────

export function NewIncidentScreen() {
  const router = useRouter();
  const token  = useAuthStore((state) => state.token);

  // Estado del formulario
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [priority,    setPriority]    = useState<Priority>("MEDIUM");
  const [photoUri,    setPhotoUri]    = useState<string | null>(null);

  // Estado de la petición
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── Validación ──
  const validate = (): boolean => {
    if (title.trim().length < 3) {
      setError("El título debe tener al menos 3 caracteres");
      return false;
    }
    return true;
  };

  // ── Selección de foto ──
  // Nota: en producción usarías expo-image-picker para acceder a la cámara.
  // Aquí simulamos la selección para que el código funcione sin instalar
  // el paquete nativo durante el desarrollo.
  const handlePickPhoto = async () => {
    try {
      // En producción, descomenta este bloque e instala expo-image-picker:
      //
      // import * as ImagePicker from 'expo-image-picker';
      // const result = await ImagePicker.launchCameraAsync({
      //   mediaTypes: ImagePicker.MediaTypeOptions.Images,
      //   allowsEditing: true,
      //   quality: 0.8,
      // });
      // if (!result.canceled) {
      //   setPhotoUri(result.assets[0].uri);
      // }

      // Simulación para desarrollo:
      Alert.alert(
        "Cámara",
        "En producción aquí se abriría la cámara del dispositivo.\n\nInstala expo-image-picker y descomenta el bloque en handlePickPhoto."
      );
    } catch (err) {
      setError("No se pudo acceder a la cámara");
    }
  };

  // ── Envío ──
  const handleSubmit = async () => {
    setError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      if (photoUri) {
        // Con foto: multipart/form-data
        await incidentsApi.createWithPhoto(
          token!,
          { title: title.trim(), description: description.trim(), priority },
          { uri: photoUri, name: "incident.jpg", type: "image/jpeg" }
        );
      } else {
        // Sin foto: JSON normal
        await incidentsApi.create(token!, {
          title: title.trim(),
          description: description.trim(),
          priority,
        });
      }

      setSuccess(true);

      // Volvemos al dashboard después de 1.5 segundos
      setTimeout(() => router.back(), 1500);

    } catch (err: any) {
      setError(err.message ?? "Error al enviar la incidencia");
    } finally {
      setLoading(false);
    }
  };

  // ── Pantalla de éxito ──
  if (success) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center gap-4 p-8">
        <View className="bg-emerald-500/20 rounded-full p-6">
          <CheckCircle size={48} color="#4ade80" />
        </View>
        <Text className="text-white font-bold text-2xl text-center">
          ¡Incidencia reportada!
        </Text>
        <Text className="text-slate-400 text-center">
          El equipo ha sido notificado.
        </Text>
        <Text className="text-slate-500 text-sm">Volviendo al dashboard…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-950"
    >

      {/* ── Header ── */}
      <View className="flex-row items-center gap-3 px-4 pt-14 pb-4 border-b border-slate-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-slate-800 rounded-xl p-2.5"
        >
          <ArrowLeft size={20} color="#94a3b8" />
        </TouchableOpacity>
        <View>
          <Text className="text-white font-bold text-xl">Reportar avería</Text>
          <Text className="text-slate-400 text-xs">
            Describe el problema para que se gestione rápido
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Título ── */}
        <Input
          label="¿Qué ha fallado?"
          value={title}
          onChangeText={(t) => { setTitle(t); setError(null); }}
          placeholder='Ej: "Frigorífico 2 no enfría"'
          error={error && title.trim().length < 3 ? error : null}
        />

        {/* ── Descripción ── */}
        <Input
          label="Descripción (opcional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Más detalles: cuándo empezó, temperatura actual, última vez que funcionó…"
          multiline
          numberOfLines={4}
        />

        {/* ── Selector de prioridad ── */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-slate-300">Prioridad</Text>
          <View className="flex-row gap-2">
            {PRIORITY_OPTIONS.map((opt) => {
              const isActive = priority === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setPriority(opt.value)}
                  className={`
                    flex-1 items-center py-3 rounded-xl border
                    ${isActive ? opt.activeClass : "bg-slate-800 border-slate-700"}
                  `}
                >
                  <Text className="text-lg mb-0.5">{opt.emoji}</Text>
                  <Text
                    className={`text-xs font-medium ${isActive ? opt.textClass : "text-slate-400"}`}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Foto ── */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-slate-300">Foto (opcional)</Text>

          {photoUri ? (
            // Vista previa de la foto seleccionada
            <View className="relative">
              <Image
                source={{ uri: photoUri }}
                className="w-full h-48 rounded-xl"
                resizeMode="cover"
              />
              {/* Botón para eliminar la foto */}
              <TouchableOpacity
                onPress={() => setPhotoUri(null)}
                className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5"
              >
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            // Botón para abrir la cámara
            <TouchableOpacity
              onPress={handlePickPhoto}
              className="border-2 border-dashed border-slate-600 rounded-xl py-8 items-center gap-2"
            >
              <View className="bg-slate-800 rounded-xl p-3">
                <Camera size={24} color="#64748b" />
              </View>
              <Text className="text-slate-400 text-sm">Añadir foto</Text>
              <Text className="text-slate-600 text-xs">Toca para abrir la cámara</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Error global ── */}
        {error && (
          <View className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 flex-row items-center gap-2">
            <AlertTriangle size={16} color="#f87171" />
            <Text className="text-red-400 text-sm flex-1">{error}</Text>
          </View>
        )}

        {/* ── Botón de envío ── */}
        <View className="pb-4">
          <Button
            onPress={handleSubmit}
            loading={loading}
            disabled={title.trim().length < 3}
          >
            Enviar incidencia
          </Button>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
