// packages/app/lib/apiSettings.ts
//
// Extensión de api.ts para el módulo de configuración.
// Separamos en un archivo propio para no crecer api.ts indefinidamente.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:28080";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SettingResponse {
  id: number;
  key: string;
  value: string;
  label: string;
  group: string;
  displayOrder: number;
}

export interface GroupedSettingsResponse {
  groups: Record<string, SettingResponse[]>;
}

export type SettingGroup = "VAT" | "CATEGORY" | "ORDER_STATUS" | "FINANCE";

// ─── Helper ──────────────────────────────────────────────────────────────────

async function authFetch(path: string, token: string, options: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── API de configuración ────────────────────────────────────────────────────

export const settingsApi = {
  /** Obtiene todos los ajustes agrupados. Opcional: filtrar por grupo. */
  getAll: async (token: string, group?: SettingGroup): Promise<GroupedSettingsResponse> => {
    const query = group ? `?group=${group}` : "";
    const res = await authFetch(`/api/v1/settings${query}`, token);
    return handleResponse<GroupedSettingsResponse>(res);
  },

  /** Crea un nuevo ajuste personalizado. */
  create: async (
    token: string,
    data: { key: string; value: string; label: string; group: string }
  ): Promise<SettingResponse> => {
    const res = await authFetch("/api/v1/settings", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleResponse<SettingResponse>(res);
  },

  /** Actualiza el valor o la etiqueta de un ajuste. */
  update: async (
    token: string,
    id: number,
    data: { value: string; label?: string }
  ): Promise<SettingResponse> => {
    const res = await authFetch(`/api/v1/settings/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleResponse<SettingResponse>(res);
  },

  /** Desactiva (elimina suavemente) un ajuste. */
  delete: async (token: string, id: number): Promise<void> => {
    await authFetch(`/api/v1/settings/${id}`, token, { method: "DELETE" });
  },
};
