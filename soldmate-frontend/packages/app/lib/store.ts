// packages/app/lib/store.ts
//
// Zustand es una librería de estado global muy sencilla.
// Piénsala como una "caja" donde guardas datos que necesitas
// en muchos componentes (el JWT, el rol del usuario, etc.)
//
// Ventaja sobre useState: no necesitas pasar props entre componentes.
// Cualquier componente puede leer y escribir en el store directamente.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse } from "./api";

// ─── Tipos del estado ────────────────────────────────────────────────────────

interface AuthState {
  // Datos del usuario autenticado (null si no ha iniciado sesión)
  token: string | null;
  email: string | null;
  role: "OWNER" | "MANAGER" | "EMPLOYEE" | "STAFF" | null;
  tier: "FREE" | "PREMIUM" | null;
  companyId: number | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;

  // ¿El usuario está autenticado?
  isAuthenticated: boolean;
  // Modo edición global para módulos ERP (toggle desde navbar)
  editMode: boolean;

  // Acciones (funciones que modifican el estado)
  login: (data: AuthResponse) => void;
  logout: () => void;
  setProfile: (data: Pick<AuthResponse, "firstName" | "lastName" | "avatarUrl">) => void;
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

// ─── Helpers para cookies (accesibles por el middleware de Next.js) ──────────

function setCookie(name: string, value: string, maxAgeSec = 86400) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSec}; SameSite=Strict`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
  // Estado inicial: no hay usuario autenticado
  token: null,
  email: null,
  role: null,
  tier: null,
  companyId: null,
  firstName: null,
  lastName: null,
  avatarUrl: null,
  isAuthenticated: false,
  editMode: false,

  // Acción login: guarda los datos del usuario tras el login/registro
  login: (data: AuthResponse) => {
    // Cookie para el middleware de Next.js (no accesible por JS después de login)
    setCookie("sm_token", data.token, 86400);
    set({
      token: data.token,
      email: data.email,
      role: data.role,
      tier: data.tier,
      companyId: data.companyId ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      avatarUrl: data.avatarUrl ?? null,
      isAuthenticated: true,
      editMode: false,
    });
  },

  // Acción logout: limpia todos los datos del usuario
  logout: () => {
    deleteCookie("sm_token");
    set({
      token: null,
      email: null,
      role: null,
      tier: null,
      companyId: null,
      firstName: null,
      lastName: null,
      avatarUrl: null,
      isAuthenticated: false,
      editMode: false,
    });
  },
  setProfile: (data) =>
    set({
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      avatarUrl: data.avatarUrl ?? null,
    }),
  toggleEditMode: () =>
    set((s) => ({
      editMode: !s.editMode,
    })),
  setEditMode: (value: boolean) =>
    set({
      editMode: value,
    }),
    }),
    {
      name: "soldmate-auth",
    }
  )
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Comprueba si el usuario tiene rol OWNER (dueño del negocio) */
export const isOwner = (role: string | null) => role === "OWNER";

/** Comprueba si el usuario tiene plan PREMIUM */
export const isPremium = (tier: string | null) => tier === "PREMIUM";
