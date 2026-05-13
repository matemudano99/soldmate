// packages/app/lib/store.ts
//
// Zustand es una librería de estado global muy sencilla.
// Piénsala como una "caja" donde guardas datos que necesitas
// en muchos componentes (el JWT, el rol del usuario, etc.)
//
// Ventaja sobre useState: no necesitas pasar props entre componentes.
// Cualquier componente puede leer y escribir en el store directamente.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthResponse, LinkedCompany } from "./api";
import type { StateStorage } from "zustand/middleware";

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
  /** Negocios (tenants) vinculados al mismo usuario. */
  linkedCompanies: LinkedCompany[];

  // ¿El usuario está autenticado?
  isAuthenticated: boolean;
  // Modo edición global para módulos ERP (toggle desde navbar)
  editMode: boolean;

  // Acciones (funciones que modifican el estado)
  login: (data: AuthResponse, remember?: boolean) => void;
  logout: () => void;
  setProfile: (data: Pick<AuthResponse, "firstName" | "lastName" | "avatarUrl">) => void;
  /** Actualiza token/rol/empresa/lista desde login, switch o /me. */
  syncSession: (data: AuthResponse) => void;
  /** Tras cambiar de negocio: nuevo JWT y contexto (misma cookie de sesión). */
  switchCompany: (data: AuthResponse) => void;
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

// ─── Helpers para cookies (accesibles por el middleware de Next.js) ──────────

function setCookie(name: string, value: string, maxAgeSec?: number) {
  if (typeof document === "undefined") return;
  const maxAgePart = typeof maxAgeSec === "number" ? `; max-age=${maxAgeSec}` : "";
  document.cookie = `${name}=${value}; path=/${maxAgePart}; SameSite=Strict`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function resolvePersistStorage(): StateStorage {
  if (typeof window === "undefined") {
    return noopStorage;
  }

  const hasLocal = typeof window.localStorage !== "undefined";
  const hasSession = typeof window.sessionStorage !== "undefined";

  if (!hasLocal && !hasSession) {
    return noopStorage;
  }

  const mode = hasLocal ? window.localStorage.getItem("soldmate-auth-storage") : "local";
  if (mode === "session" && hasSession) {
    return window.sessionStorage;
  }

  if (hasLocal) {
    return window.localStorage;
  }

  return window.sessionStorage;
}

function getWebStorages() {
  if (typeof window === "undefined") {
    return { local: null as Storage | null, session: null as Storage | null };
  }

  const local = typeof window.localStorage !== "undefined" ? window.localStorage : null;
  const session = typeof window.sessionStorage !== "undefined" ? window.sessionStorage : null;
  return { local, session };
}

function isRememberLocalStorage(): boolean {
  const { local } = getWebStorages();
  return local?.getItem("soldmate-auth-storage") === "local";
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
  linkedCompanies: [],
  isAuthenticated: false,
  editMode: false,

  // Acción login: guarda los datos del usuario tras el login/registro
  login: (data: AuthResponse, remember = true) => {
    // Define el almacenamiento persistente para esta sesión:
    // - localStorage: "recordarme" activo
    // - sessionStorage: solo durante esta sesión del navegador
    const { local, session } = getWebStorages();
    if (remember) {
      local?.setItem("soldmate-auth-storage", "local");
    } else if (session) {
      session.setItem("soldmate-auth-storage", "session");
    } else {
      local?.setItem("soldmate-auth-storage", "session");
    }

    // Cookie para el middleware de Next.js (no accesible por JS después de login)
    // Si no marca "recordarme", dejamos cookie de sesión (sin max-age).
    setCookie("sm_token", data.token, remember ? 86400 : undefined);
    set({
      token: data.token,
      email: data.email,
      role: data.role,
      tier: data.tier,
      companyId: data.companyId ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      avatarUrl: data.avatarUrl ?? null,
      linkedCompanies: data.linkedCompanies ?? [],
      isAuthenticated: true,
      editMode: false,
    });
  },

  syncSession: (data: AuthResponse) => {
    setCookie("sm_token", data.token, isRememberLocalStorage() ? 86400 : undefined);
    set({
      token: data.token,
      email: data.email,
      role: data.role,
      tier: data.tier,
      companyId: data.companyId ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      avatarUrl: data.avatarUrl ?? null,
      linkedCompanies: data.linkedCompanies ?? [],
      isAuthenticated: true,
    });
  },

  switchCompany: (data: AuthResponse) => {
    setCookie("sm_token", data.token, isRememberLocalStorage() ? 86400 : undefined);
    set({
      token: data.token,
      role: data.role,
      tier: data.tier,
      companyId: data.companyId ?? null,
      linkedCompanies: data.linkedCompanies ?? [],
      editMode: false,
    });
  },

  // Acción logout: limpia todos los datos del usuario
  logout: () => {
    deleteCookie("sm_token");
    const { local, session } = getWebStorages();
    local?.removeItem("soldmate-auth-storage");
    local?.removeItem("soldmate-auth");
    session?.removeItem("soldmate-auth");
    set({
      token: null,
      email: null,
      role: null,
      tier: null,
      companyId: null,
      firstName: null,
      lastName: null,
      avatarUrl: null,
      linkedCompanies: [],
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
      storage: createJSONStorage(resolvePersistStorage),
      onRehydrateStorage: () => (state) => {
        if (state && !Array.isArray(state.linkedCompanies)) {
          state.linkedCompanies = [];
        }
      },
    }
  )
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Comprueba si el usuario tiene rol OWNER (dueño del negocio) */
export const isOwner = (role: string | null) => role === "OWNER";

/** Comprueba si el usuario tiene plan PREMIUM */
export const isPremium = (tier: string | null) => tier === "PREMIUM";
