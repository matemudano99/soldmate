// packages/app/lib/api.ts
//
// Esta librería centraliza TODAS las llamadas al backend.
// Así, si la URL cambia, solo lo cambias en un lugar.
//
// Usamos fetch nativo (funciona tanto en React Native como en Next.js)
// y guardamos el JWT en un store de Zustand.

// ─── URL del backend ────────────────────────────────────────────────────────
// En desarrollo apunta a tu máquina local.
// En producción cambia esto por tu URL de Render / Railway / etc.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:28080";
const BASE_URL = API_BASE_URL;

/** Mensaje legible cuando fetch falla (backend parado, puerto mal, CORS raro en dev). */
export function describeNetworkError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const looksNetwork =
    /failed to fetch|networkerror|load failed|fetch/i.test(raw) ||
    /network request failed/i.test(raw);
  if (looksNetwork) {
    return `No hay conexión con el API (${API_BASE_URL}). Arranca el backend (en la raíz del repo: docker compose up -d, puerto 28080). Con «npm run web»: apps/next/.env.local → NEXT_PUBLIC_API_URL.`;
  }
  return raw || "Error de red.";
}

// ─── Tipos que coinciden con los DTOs del backend ───────────────────────────

export interface AuthResponse {
  token: string;
  email: string;
  role: "OWNER" | "STAFF";
  tier: "FREE" | "PREMIUM";
  companyId: number;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
}

export interface ProductResponse {
  id: number;
  name: string;
  currentStock: number;
  minStock: number;
  unit: "KG" | "L" | "UNIT" | "BOX";
  category: string | null;
  vatRate: number;
  lowStock: boolean; // el backend nos dice si está por debajo del mínimo
}

export interface ProductInput {
  name: string;
  currentStock: number;
  minStock: number;
  unit: "KG" | "L" | "UNIT" | "BOX";
  category?: string | null;
  vatRate?: number | null;
}

export interface IncidentResponse {
  id: number;
  title: string;
  description: string | null;
  photoUrl: string | null;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string; // ISO 8601
  reportedBy?: string | null;
}

export type IncidentStatus = IncidentResponse["status"];

export interface SupplierResponse {
  id: number;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactPerson: string | null;
  category: string | null;
  notes: string | null;
}

export interface SupplierInput {
  name: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactPerson?: string | null;
  category?: string | null;
  notes?: string | null;
}

export interface RegisterRequest {
  companyName: string;
  taxId: string;
  country: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// ─── Contactos CRM ──────────────────────────────────────────────────────────

export interface ContactResponse {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string | null;
  department: string | null;
  location: string | null;
  progress: number;
  active: boolean;
  notes: string | null;
  joinDate: string | null;
  rating: number;
  projects: string | null;
  createdAt: string | null;
}

export interface ContactInput {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  department?: string | null;
  location?: string | null;
  progress?: number;
  active?: boolean;
  notes?: string | null;
  joinDate?: string | null;
  rating?: number;
  projects?: string | null;
}

export interface ContactStats {
  total: number;
  active: number;
  inactive: number;
  avgProgress: number;
}

export interface DashboardWeeklyPoint {
  day: string;
  incidents: number;
}

export interface DashboardRecentIncident {
  id: number;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  createdAt: string;
  reportedBy: string | null;
}

export interface DashboardSummaryResponse {
  totalProducts: number;
  lowStockProducts: number;
  totalIncidents: number;
  openIncidents: number;
  inProgressIncidents: number;
  closedIncidents: number;
  activeContacts: number;
  totalContacts: number;
  weeklyIncidentsByDay: DashboardWeeklyPoint[];
  recentIncidents: DashboardRecentIncident[];
}

export interface CalendarEventResponse {
  id: number;
  title: string;
  notes: string | null;
  eventDate: string;
  eventTime: string | null;
  source: string;
}

export interface CalendarEventInput {
  title: string;
  notes?: string | null;
  eventDate: string;
  eventTime?: string | null;
}

export interface AlertResponse {
  text: string;
  type: "critical" | "warning" | "success";
  source: string;
}

export interface ForecastImpactDay {
  date: string;
  rain: number;
  wind: number;
  tempMax: number;
  impactScore: number;
  recommendation: string;
}

export interface PredictiveDay {
  date: string;
  weatherImpact: number;
  historicalBaseline: number;
  predictedDemand: number;
  suggestedStaff: number;
  inventoryHint: string;
}

export interface BusinessProfileResponse {
  businessName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
}

export interface BusinessProfileInput extends BusinessProfileResponse {}

export interface ActivityItemResponse {
  id: number;
  type: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string;
  actorName: string;
  actorAvatarUrl: string | null;
  actorEmail: string | null;
}

// ─── Helper: fetch autenticado ───────────────────────────────────────────────
//
// Esta función envuelve fetch y añade automáticamente el JWT al header.
// Así no tienes que repetir headers en cada llamada.

async function authFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

// ─── Manejo de errores ───────────────────────────────────────────────────────
//
// Si el servidor devuelve un error (4xx, 5xx), parseamos el mensaje
// y lanzamos una excepción con ese texto (lo mostraremos en la UI).

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  /** Registra empresa + usuario dueño. Devuelve JWT. */
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<AuthResponse>(res);
  },

  /** Login con email + contraseña. Devuelve JWT. */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<AuthResponse>(res);
  },

  me: async (token: string): Promise<AuthResponse> => {
    const res = await authFetch("/api/v1/auth/me", token);
    return handleResponse<AuthResponse>(res);
  },

  updateProfile: async (
    token: string,
    data: { firstName: string; lastName: string }
  ): Promise<AuthResponse> => {
    const res = await authFetch("/api/v1/auth/profile", token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleResponse<AuthResponse>(res);
  },
  uploadAvatar: async (token: string, photo: File): Promise<{ avatarUrl: string }> => {
    const formData = new FormData();
    formData.append("photo", photo);
    const res = await fetch(`${BASE_URL}/api/v1/auth/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return handleResponse<{ avatarUrl: string }>(res);
  },
};

// ─── Inventario ──────────────────────────────────────────────────────────────

export const inventoryApi = {
  /** Lista todos los productos de la empresa. */
  getAll: async (token: string): Promise<ProductResponse[]> => {
    const res = await authFetch("/api/v1/inventory", token);
    return handleResponse<ProductResponse[]>(res);
  },

  /** Actualiza el stock de un producto.
   *  quantity positivo = entrada de mercancía
   *  quantity negativo = consumo / merma
   */
  updateStock: async (
    token: string,
    productId: number,
    quantity: number
  ): Promise<ProductResponse> => {
    const res = await authFetch(
      `/api/v1/inventory/${productId}/stock?quantity=${quantity}`,
      token,
      { method: "PATCH" }
    );
    return handleResponse<ProductResponse>(res);
  },

  create: async (token: string, data: ProductInput): Promise<ProductResponse> => {
    const res = await authFetch("/api/v1/inventory", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleResponse<ProductResponse>(res);
  },

  update: async (token: string, productId: number, data: ProductInput): Promise<ProductResponse> => {
    const res = await authFetch(`/api/v1/inventory/${productId}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleResponse<ProductResponse>(res);
  },

  remove: async (token: string, productId: number): Promise<void> => {
    const res = await authFetch(`/api/v1/inventory/${productId}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
};

// ─── Proveedores ─────────────────────────────────────────────────────────────

export const suppliersApi = {
  getAll: async (token: string, category?: string): Promise<SupplierResponse[]> => {
    const q =
      category && category.trim() !== ""
        ? `?category=${encodeURIComponent(category.trim())}`
        : "";
    const res = await authFetch(`/api/v1/suppliers${q}`, token);
    return handleResponse<SupplierResponse[]>(res);
  },

  getById: async (token: string, id: number): Promise<SupplierResponse> => {
    const res = await authFetch(`/api/v1/suppliers/${id}`, token);
    return handleResponse<SupplierResponse>(res);
  },

  create: async (token: string, data: SupplierInput): Promise<SupplierResponse> => {
    const res = await authFetch("/api/v1/suppliers", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleResponse<SupplierResponse>(res);
  },

  update: async (token: string, id: number, data: SupplierInput): Promise<SupplierResponse> => {
    const res = await authFetch(`/api/v1/suppliers/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleResponse<SupplierResponse>(res);
  },

  remove: async (token: string, id: number): Promise<void> => {
    const res = await authFetch(`/api/v1/suppliers/${id}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
};

// ─── Contactos CRM ───────────────────────────────────────────────────────────

export const contactsApi = {
  getAll: async (token: string): Promise<ContactResponse[]> => {
    const res = await authFetch("/api/v1/contacts", token);
    return handleResponse<ContactResponse[]>(res);
  },

  getStats: async (token: string): Promise<ContactStats> => {
    const res = await authFetch("/api/v1/contacts/stats", token);
    return handleResponse<ContactStats>(res);
  },

  getOne: async (token: string, id: number): Promise<ContactResponse> => {
    const res = await authFetch(`/api/v1/contacts/${id}`, token);
    return handleResponse<ContactResponse>(res);
  },

  create: async (token: string, data: ContactInput): Promise<ContactResponse> => {
    const res = await authFetch("/api/v1/contacts", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleResponse<ContactResponse>(res);
  },

  update: async (token: string, id: number, data: ContactInput): Promise<ContactResponse> => {
    const res = await authFetch(`/api/v1/contacts/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleResponse<ContactResponse>(res);
  },

  toggleActive: async (token: string, id: number): Promise<ContactResponse> => {
    const res = await authFetch(`/api/v1/contacts/${id}/active`, token, { method: "PATCH" });
    return handleResponse<ContactResponse>(res);
  },

  remove: async (token: string, id: number): Promise<void> => {
    const res = await authFetch(`/api/v1/contacts/${id}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
};

// ─── Incidencias ─────────────────────────────────────────────────────────────

export const incidentsApi = {
  /** Lista las incidencias de la empresa (opcional: filtro por estado). */
  getAll: async (token: string, status?: IncidentStatus): Promise<IncidentResponse[]> => {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await authFetch(`/api/v1/incidents${q}`, token);
    return handleResponse<IncidentResponse[]>(res);
  },

  getById: async (token: string, id: number): Promise<IncidentResponse> => {
    const res = await authFetch(`/api/v1/incidents/${id}`, token);
    return handleResponse<IncidentResponse>(res);
  },

  /** Crea una nueva incidencia (sin foto). */
  create: async (
    token: string,
    data: { title: string; description: string; priority: string }
  ): Promise<IncidentResponse> => {
    const res = await authFetch("/api/v1/incidents", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return handleResponse<IncidentResponse>(res);
  },

  /** Crea una incidencia CON foto (POST /api/v1/incidents/with-photo).
   *  En navegador: pasa un `File`. En React Native: objeto `{ uri, name, type }`.
   */
  createWithPhoto: async (
    token: string,
    data: { title: string; description: string; priority: string },
    photo: File | { uri: string; name: string; type: string }
  ): Promise<IncidentResponse> => {
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("description", data.description ?? "");
    formData.append("priority", data.priority);

    if (typeof File !== "undefined" && photo instanceof File) {
      formData.append("photo", photo);
    } else {
      // React Native FormData
      // @ts-expect-error — RN acepta objeto con uri/name/type
      formData.append("photo", photo);
    }

    const res = await fetch(`${BASE_URL}/api/v1/incidents/with-photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return handleResponse<IncidentResponse>(res);
  },

  update: async (
    token: string,
    incidentId: number,
    data: { title: string; description: string; priority: string }
  ): Promise<IncidentResponse> => {
    const res = await authFetch(`/api/v1/incidents/${incidentId}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return handleResponse<IncidentResponse>(res);
  },

  updateStatus: async (
    token: string,
    incidentId: number,
    status: IncidentStatus
  ): Promise<IncidentResponse> => {
    const res = await authFetch(`/api/v1/incidents/${incidentId}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return handleResponse<IncidentResponse>(res);
  },

  remove: async (token: string, incidentId: number): Promise<void> => {
    const res = await authFetch(`/api/v1/incidents/${incidentId}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
};

export const dashboardApi = {
  getSummary: async (token: string): Promise<DashboardSummaryResponse> => {
    const res = await authFetch("/api/v1/dashboard/summary", token);
    return handleResponse<DashboardSummaryResponse>(res);
  },
};

export const calendarApi = {
  getAll: async (token: string, from?: string, to?: string): Promise<CalendarEventResponse[]> => {
    const q = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "";
    const res = await authFetch(`/api/v1/calendar/events${q}`, token);
    return handleResponse<CalendarEventResponse[]>(res);
  },
  create: async (token: string, payload: CalendarEventInput): Promise<CalendarEventResponse> => {
    const res = await authFetch("/api/v1/calendar/events", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return handleResponse<CalendarEventResponse>(res);
  },
  update: async (token: string, id: number, payload: CalendarEventInput): Promise<CalendarEventResponse> => {
    const res = await authFetch(`/api/v1/calendar/events/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return handleResponse<CalendarEventResponse>(res);
  },
  remove: async (token: string, id: number): Promise<void> => {
    const res = await authFetch(`/api/v1/calendar/events/${id}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
};

export const alertsApi = {
  getAll: async (token: string): Promise<AlertResponse[]> => {
    const res = await authFetch("/api/v1/alerts", token);
    return handleResponse<AlertResponse[]>(res);
  },
};

export const forecastApi = {
  getImpact: async (token: string): Promise<ForecastImpactDay[]> => {
    const res = await authFetch("/api/v1/forecast/impact", token);
    return handleResponse<ForecastImpactDay[]>(res);
  },
};

export const predictionsApi = {
  getOperations: async (token: string): Promise<PredictiveDay[]> => {
    const res = await authFetch("/api/v1/predictions/operations", token);
    return handleResponse<PredictiveDay[]>(res);
  },
};

export const businessProfileApi = {
  get: async (token: string): Promise<BusinessProfileResponse> => {
    const res = await authFetch("/api/v1/business-profile", token);
    return handleResponse<BusinessProfileResponse>(res);
  },
  update: async (token: string, payload: BusinessProfileInput): Promise<BusinessProfileResponse> => {
    const res = await authFetch("/api/v1/business-profile", token, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return handleResponse<BusinessProfileResponse>(res);
  },
};

export const activityApi = {
  getAll: async (token: string): Promise<ActivityItemResponse[]> => {
    const res = await authFetch("/api/v1/activity", token);
    return handleResponse<ActivityItemResponse[]>(res);
  },
};
