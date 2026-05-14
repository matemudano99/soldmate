// packages/app/lib/api.ts
//
// Esta librería centraliza TODAS las llamadas al backend.
// Así, si la URL cambia, solo lo cambias en un lugar.
//
// Usamos fetch nativo (funciona tanto en React Native como en Next.js)
// y guardamos el JWT en un store de Zustand.

// ─── URL del backend ────────────────────────────────────────────────────────
// Web (Next): NEXT_PUBLIC_API_URL
// Fallback local para dev: http://localhost:28080
function resolveApiBaseUrl(): string {
  const webUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (webUrl) return webUrl;

  return "http://localhost:28080";
}

export const API_BASE_URL = resolveApiBaseUrl();
const BASE_URL = API_BASE_URL;

/** Mensaje legible cuando fetch falla (backend parado, puerto mal, CORS raro en dev). */
export function describeNetworkError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const looksNetwork =
    /failed to fetch|networkerror|load failed|fetch/i.test(raw) ||
    /network request failed/i.test(raw);
  if (looksNetwork) {
    return `No hay conexión con el API (${API_BASE_URL}). Arranca el backend (docker compose up -d, puerto 28080). Configura NEXT_PUBLIC_API_URL en apps/next/.env.local.`;
  }
  return raw || "Error de red.";
}

// ─── Tipos que coinciden con los DTOs del backend ───────────────────────────

export type UserRole = "OWNER" | "MANAGER" | "SUPERVISOR" | "EMPLOYEE" | "VIEWER";

export function normalizeUserRole(role: string | null | undefined): UserRole | null {
  if (role == null || role === "") return null;
  const u = role.trim().toUpperCase();
  if (u === "STAFF") return "EMPLOYEE";
  if (u === "OWNER" || u === "MANAGER" || u === "SUPERVISOR" || u === "EMPLOYEE" || u === "VIEWER") {
    return u;
  }
  return "EMPLOYEE";
}

export interface LinkedCompany {
  companyId: number;
  companyName: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  email: string;
  role: UserRole;
  tier: "FREE" | "PREMIUM";
  companyId: number;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
  /** Negocios vinculados al mismo usuario (cada uno aislado por tenant). */
  linkedCompanies: LinkedCompany[];
}

export interface ProductResponse {
  id: number;
  name: string;
  currentStock: number;
  minStock: number;
  unit: "KG" | "L" | "UNIT" | "BOX";
  category: string | null;
  supplierId: number | null;
  supplierName: string | null;
  vatRate: number;
  lowStock: boolean; // true si currentStock < minStock (igual al mínimo no cuenta como bajo)
}

export interface ProductInput {
  name: string;
  currentStock: number;
  minStock: number;
  unit: "KG" | "L" | "UNIT" | "BOX";
  category?: string | null;
  supplierId?: number | null;
  vatRate?: number | null;
}

export interface InventoryCategoryResponse {
  id: number;
  name: string;
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
  type?: "SUPPLIER" | "CONTACT";
}

export interface SupplierInput {
  name: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactPerson?: string | null;
  category?: string | null;
  notes?: string | null;
  type?: "SUPPLIER" | "CONTACT";
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

export interface UserListResponse {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  nationalId: string | null;
  jobTitle: string | null;
  workScheduleNote: string | null;
  active: boolean;
}

export interface UserUpsertInput {
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  password?: string;
  nationalId?: string | null;
  jobTitle?: string | null;
  workScheduleNote?: string | null;
  active?: boolean;
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
  /** NIF/CIF del negocio (solo lectura en UI salvo flujos futuros). */
  taxId?: string | null;
  /** ISO 4217 (EUR, USD, …). */
  currency?: string;
  subscriptionTier?: "FREE" | "PREMIUM";
}

export interface BusinessProfileInput extends BusinessProfileResponse {}

export interface ActivityItemResponse {
  id: number;
  type: string;
  title: string;
  /** Acción del log (p. ej. CREADO, MODIFICADO, ELIMINADO). */
  status: string;
  priority: string;
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

function normalizeAuthResponse(data: AuthResponse): AuthResponse {
  const nr = normalizeUserRole(data.role);
  return {
    ...data,
    role: nr ?? "EMPLOYEE",
    linkedCompanies: Array.isArray(data.linkedCompanies) ? data.linkedCompanies : [],
  };
}

export const authApi = {
  /** Registra empresa + usuario dueño. Devuelve JWT. */
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return normalizeAuthResponse(await handleResponse<AuthResponse>(res));
  },

  /** Login con email + contraseña. Devuelve JWT. */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return normalizeAuthResponse(await handleResponse<AuthResponse>(res));
  },

  me: async (token: string): Promise<AuthResponse> => {
    const res = await authFetch("/api/v1/auth/me", token);
    return normalizeAuthResponse(await handleResponse<AuthResponse>(res));
  },

  switchCompany: async (token: string, companyId: number): Promise<AuthResponse> => {
    const res = await authFetch("/api/v1/auth/switch-company", token, {
      method: "POST",
      body: JSON.stringify({ companyId }),
    });
    return normalizeAuthResponse(await handleResponse<AuthResponse>(res));
  },

  updateProfile: async (
    token: string,
    data: { firstName: string; lastName: string }
  ): Promise<AuthResponse> => {
    const res = await authFetch("/api/v1/auth/profile", token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return normalizeAuthResponse(await handleResponse<AuthResponse>(res));
  },
  changePassword: async (
    token: string,
    body: { currentPassword: string; newPassword: string }
  ): Promise<void> => {
    const res = await authFetch("/api/v1/auth/password", token, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
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

  listCategories: async (token: string): Promise<InventoryCategoryResponse[]> => {
    const res = await authFetch("/api/v1/inventory/categories", token);
    return handleResponse<InventoryCategoryResponse[]>(res);
  },

  createCategory: async (token: string, body: { name: string }): Promise<InventoryCategoryResponse> => {
    const res = await authFetch("/api/v1/inventory/categories", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return handleResponse<InventoryCategoryResponse>(res);
  },

  updateCategory: async (
    token: string,
    id: number,
    body: { name?: string | null }
  ): Promise<InventoryCategoryResponse> => {
    const res = await authFetch(`/api/v1/inventory/categories/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return handleResponse<InventoryCategoryResponse>(res);
  },

  deleteCategory: async (token: string, id: number): Promise<void> => {
    const res = await authFetch(`/api/v1/inventory/categories/${id}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
};

// ─── Proveedores ─────────────────────────────────────────────────────────────

export const suppliersApi = {
  getAll: async (token: string, category?: string, type?: "SUPPLIER" | "CONTACT"): Promise<SupplierResponse[]> => {
    const params = new URLSearchParams();
    if (category && category.trim() !== "") params.set("category", category.trim());
    if (type) params.set("type", type);
    const q = params.size > 0 ? `?${params.toString()}` : "";
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

export const usersApi = {
  getAll: async (token: string): Promise<UserListResponse[]> => {
    const res = await authFetch("/api/v1/users", token);
    return handleResponse<UserListResponse[]>(res);
  },
  create: async (token: string, payload: UserUpsertInput): Promise<UserListResponse> => {
    const res = await authFetch("/api/v1/users", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return handleResponse<UserListResponse>(res);
  },
  update: async (token: string, id: number, payload: UserUpsertInput): Promise<UserListResponse> => {
    const res = await authFetch(`/api/v1/users/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return handleResponse<UserListResponse>(res);
  },
  remove: async (token: string, id: number): Promise<void> => {
    const res = await authFetch(`/api/v1/users/${id}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
};

export interface VacationResponse {
  id: number;
  userId: number;
  userEmail: string;
  userFullName: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdAt: string;
}

export interface VacationCreateInput {
  startDate: string;
  endDate: string;
  notes?: string | null;
}

export const vacationsApi = {
  list: async (token: string): Promise<VacationResponse[]> => {
    const res = await authFetch("/api/v1/vacations", token);
    return handleResponse<VacationResponse[]>(res);
  },
  create: async (token: string, body: VacationCreateInput): Promise<VacationResponse> => {
    const res = await authFetch("/api/v1/vacations", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return handleResponse<VacationResponse>(res);
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

/** Cierre de caja diario (efectivo apertura/cierre, canales, gastos con detalle). */
export const FINANCE_MAX_DAILY_AMOUNT = 99_999_999.99;

export interface DailyFinanceExpenseLineResponse {
  detail: string;
  amount: number;
}

export interface DailyFinanceIncomeChannelResponse {
  name: string;
  amount: number;
}

export interface DailyFinanceEntryResponse {
  id: number;
  entryDate: string;
  cashOpening: number;
  incomeChannels: DailyFinanceIncomeChannelResponse[];
  cashClosing: number;
  /** Suma de todos los canales de ingreso. */
  revenue: number;
  /** Suma líneas de gastos/sueldos. */
  expenses: number;
  /** -efectivo_apertura + ingresos_canales + gastos + efectivo_cierre */
  finalBalance: number;
  expenseLines: DailyFinanceExpenseLineResponse[];
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface DailyFinanceUpsertExpenseLineBody {
  detail: string;
  amount: number;
}

export interface DailyFinanceIncomeChannelBody {
  name: string;
  amount: number;
}

export interface DailyFinanceUpsertBody {
  cashOpening: number;
  incomeChannels: DailyFinanceIncomeChannelBody[];
  cashClosing: number;
  notes?: string | null;
  expenseLines?: DailyFinanceUpsertExpenseLineBody[] | null;
}

export interface DailyFinanceUpsertResponse {
  data: DailyFinanceEntryResponse;
  warnings: string[];
}

export const financeApi = {
  listDaily: async (token: string, from: string, to: string): Promise<DailyFinanceEntryResponse[]> => {
    const q = new URLSearchParams({ from, to });
    const res = await authFetch(`/api/v1/finance/daily?${q}`, token);
    return handleResponse<DailyFinanceEntryResponse[]>(res);
  },
  listLockedMonths: async (token: string): Promise<string[]> => {
    const res = await authFetch("/api/v1/finance/locked-months", token);
    return handleResponse<string[]>(res);
  },
  listIncomeChannelTemplates: async (token: string): Promise<string[]> => {
    const res = await authFetch("/api/v1/finance/income-channel-templates", token);
    return handleResponse<string[]>(res);
  },
  putIncomeChannelTemplates: async (token: string, names: string[]): Promise<string[]> => {
    const res = await authFetch("/api/v1/finance/income-channel-templates", token, {
      method: "PUT",
      body: JSON.stringify({ names }),
    });
    return handleResponse<string[]>(res);
  },
  lockMonth: async (token: string, yearMonth: string): Promise<void> => {
    const res = await authFetch(`/api/v1/finance/locked-months/${encodeURIComponent(yearMonth)}`, token, {
      method: "POST",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
  unlockMonth: async (token: string, yearMonth: string): Promise<void> => {
    const res = await authFetch(`/api/v1/finance/locked-months/${encodeURIComponent(yearMonth)}`, token, {
      method: "DELETE",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
  upsertDaily: async (token: string, date: string, body: DailyFinanceUpsertBody): Promise<DailyFinanceUpsertResponse> => {
    const res = await authFetch(`/api/v1/finance/daily/${date}`, token, {
      method: "PUT",
      body: JSON.stringify({
        cashOpening: body.cashOpening,
        incomeChannels: body.incomeChannels?.length ? body.incomeChannels : [{ name: "Datáfono (TPV)", amount: 0 }],
        cashClosing: body.cashClosing,
        notes: body.notes ?? null,
        expenseLines: body.expenseLines?.length ? body.expenseLines : [],
      }),
    });
    return handleResponse<DailyFinanceUpsertResponse>(res);
  },
  deleteDaily: async (token: string, date: string): Promise<void> => {
    const res = await authFetch(`/api/v1/finance/daily/${date}`, token, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
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

// ─── Documentos ──────────────────────────────────────────────────────────────

export interface DocumentResponse {
  id: number;
  name: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  /** Tipo normalizado: PDF | XLSX | IMG | DOCX | PPTX | ZIP | VIDEO | AUDIO | TXT | OTHER */
  docType: string;
  category: string | null;
  createdAt: string;
  uploaderName: string;
  uploaderEmail: string | null;
  uploaderAvatarUrl: string | null;
  linkedUserId: number | null;
  linkedUserName: string | null;
}

export interface DocumentStatsResponse {
  totalDocuments: number;
  totalSizeBytes: number;
  totalSizeHuman: string;
  newThisWeek: number;
}

export interface DocumentCategoryResponse {
  id: number;
  name: string;
  color: string | null;
}

export const documentsApi = {
  /** Lista documentos. Filtra por categoría si se proporciona. */
  getAll: async (token: string, category?: string): Promise<DocumentResponse[]> => {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    const res = await authFetch(`/api/v1/documents${q}`, token);
    return handleResponse<DocumentResponse[]>(res);
  },

  getStats: async (token: string): Promise<DocumentStatsResponse> => {
    const res = await authFetch("/api/v1/documents/stats", token);
    return handleResponse<DocumentStatsResponse>(res);
  },

  /**
   * Sube un fichero al backend (multipart/form-data).
   * @param file   File nativo del navegador
   * @param name   Nombre amigable (opcional; si no se da se usa el nombre del fichero)
   * @param category Categoría (opcional)
   */
  upload: async (
    token: string,
    file: File,
    name?: string,
    category?: string,
    linkedUserId?: number | null
  ): Promise<DocumentResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);
    if (category) formData.append("category", category);
    if (linkedUserId != null && linkedUserId > 0) {
      formData.append("linkedUserId", String(linkedUserId));
    }

    const res = await fetch(`${BASE_URL}/api/v1/documents/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return handleResponse<DocumentResponse>(res);
  },

  update: async (
    token: string,
    id: number,
    data: {
      name?: string;
      category?: string;
      linkedUserId?: number | null;
      setLinkedUser?: boolean;
    }
  ): Promise<DocumentResponse> => {
    const res = await authFetch(`/api/v1/documents/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return handleResponse<DocumentResponse>(res);
  },

  remove: async (token: string, id: number): Promise<void> => {
    const res = await authFetch(`/api/v1/documents/${id}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },

  // ── Categorías ────────────────────────────────────────────────────────────

  getCategories: async (token: string): Promise<DocumentCategoryResponse[]> => {
    const res = await authFetch("/api/v1/documents/categories", token);
    return handleResponse<DocumentCategoryResponse[]>(res);
  },

  createCategory: async (
    token: string,
    name: string,
    color?: string
  ): Promise<DocumentCategoryResponse> => {
    const res = await authFetch("/api/v1/documents/categories", token, {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });
    return handleResponse<DocumentCategoryResponse>(res);
  },

  updateCategory: async (
    token: string,
    id: number,
    data: { name?: string; color?: string }
  ): Promise<DocumentCategoryResponse> => {
    const res = await authFetch(`/api/v1/documents/categories/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return handleResponse<DocumentCategoryResponse>(res);
  },

  removeCategory: async (token: string, id: number): Promise<void> => {
    const res = await authFetch(`/api/v1/documents/categories/${id}`, token, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
  },
};

// ─── Búsqueda global ─────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  type: "PRODUCT" | "INCIDENT" | "SUPPLIER" | "DOCUMENT";
  title: string;
  subtitle: string;
  href: string;
}

export const searchApi = {
  search: async (token: string, query: string): Promise<SearchResult[]> => {
    if (!query || query.trim().length < 2) return [];
    const res = await authFetch(`/api/v1/search?q=${encodeURIComponent(query.trim())}`, token);
    return handleResponse<SearchResult[]>(res);
  },
};

// ─── Notificaciones persistidas ───────────────────────────────────────────────

export interface NotificationResponse {
  id: number;
  type: "INFO" | "WARNING" | "ALERT";
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  getAll: async (token: string): Promise<NotificationResponse[]> => {
    const res = await authFetch("/api/v1/notifications", token);
    return handleResponse<NotificationResponse[]>(res);
  },

  getUnreadCount: async (token: string): Promise<number> => {
    const res = await authFetch("/api/v1/notifications/unread-count", token);
    const data = await handleResponse<{ unread: number }>(res);
    return data.unread;
  },

  markRead: async (token: string, id: number): Promise<NotificationResponse> => {
    const res = await authFetch(`/api/v1/notifications/${id}/read`, token, { method: "PUT" });
    return handleResponse<NotificationResponse>(res);
  },

  markAllRead: async (token: string): Promise<void> => {
    const res = await authFetch("/api/v1/notifications/read-all", token, { method: "PUT" });
    if (!res.ok) throw new Error(`Error ${res.status}`);
  },

  create: async (token: string, type: string, title: string, body?: string): Promise<NotificationResponse> => {
    const res = await authFetch("/api/v1/notifications", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, body }),
    });
    return handleResponse<NotificationResponse>(res);
  },
};
