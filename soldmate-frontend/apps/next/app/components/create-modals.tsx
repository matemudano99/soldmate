"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Loader2, Tag } from "lucide-react";
import {
  incidentsApi,
  suppliersApi,
  type IncidentResponse,
  type InventoryCategoryResponse,
  type ProductInput,
  type SupplierResponse,
  type UserRole,
} from "app/lib/api";

type ModalShellProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Modo formulario: pie con Cancelar + acción principal. Modo panel: solo Cerrar (contenido sin envío global). */
  mode?: "form" | "panel";
  onSubmit?: (e: React.FormEvent) => void;
  submitLabel?: string;
  submitting?: boolean;
  panelCloseLabel?: string;
  /** Clases del contenedor blanco (ej. max-w-2xl para tablas). */
  boxClassName?: string;
};

function ModalShell({
  title,
  subtitle,
  onClose,
  onSubmit,
  children,
  submitLabel = "Guardar",
  submitting = false,
  mode = "form",
  panelCloseLabel = "Cerrar",
  boxClassName = "max-w-lg mx-4",
}: ModalShellProps) {
  if (mode === "form" && !onSubmit) {
    throw new Error("ModalShell: onSubmit es obligatorio en mode=form");
  }
  const inner = <>{children}</>;
  const footer =
    mode === "panel" ? (
      <div className="flex gap-3 border-t border-gray-50 px-4 sm:px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-[#4f6ef7] py-2.5 text-sm font-semibold text-white hover:bg-[#3d5ae0]"
        >
          {panelCloseLabel}
        </button>
      </div>
    ) : (
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl bg-[#4f6ef7] py-2.5 text-sm font-semibold text-white hover:bg-[#3d5ae0] disabled:opacity-60"
        >
          {submitting ? "Guardando..." : submitLabel}
        </button>
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${boxClassName} overflow-hidden max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-50">
          <div>
            <h2 className="text-base font-bold text-[#1e2040]">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        {mode === "panel" ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">{inner}</div>
            {footer}
          </>
        ) : (
          <form onSubmit={onSubmit!} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">{inner}</div>
            <div className="shrink-0 border-t border-gray-50 px-4 sm:px-6 py-4">{footer}</div>
          </form>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] ${props.className ?? ""}`} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] min-h-24 resize-none ${props.className ?? ""}`} />;
}

export type CreateIncidentPayload = { title: string; description: string; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" };

type CreateIncidentModalProps = {
  onClose: () => void;
  /** Si hay JWT, se guarda en el backend (Supabase Storage si adjuntas imagen). */
  authToken?: string | null;
  /** Tras crear correctamente en API (p. ej. invalidar lista o navegar). */
  onSuccess?: () => void | Promise<void>;
  /** Sin `authToken`: solo notifica al padre (modo mock / demos). */
  onCreate?: (payload: CreateIncidentPayload) => void;
  /** Edición: PUT sin cambiar foto desde este modal. */
  editIncidentId?: number | null;
  initialIncident?: IncidentResponse | null;
};

export function CreateIncidentModal({
  onClose,
  onCreate,
  onSuccess,
  authToken,
  editIncidentId,
  initialIncident,
}: CreateIncidentModalProps) {
  const isEdit = Boolean(editIncidentId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CreateIncidentPayload["priority"]>("MEDIUM");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (initialIncident) {
      setTitle(initialIncident.title);
      setDescription(initialIncident.description ?? "");
      setPriority(initialIncident.priority);
      setPhotoFile(null);
      setSubmitError(null);
    }
  }, [initialIncident]);

  const previewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload: CreateIncidentPayload = {
      title: title.trim(),
      description: description.trim(),
      priority,
    };

    if (authToken) {
      setSubmitError(null);
      setSubmitting(true);
      try {
        if (isEdit && editIncidentId) {
          await incidentsApi.update(authToken, editIncidentId, payload);
        } else if (photoFile) {
          await incidentsApi.createWithPhoto(authToken, payload, photoFile);
        } else {
          await incidentsApi.create(authToken, payload);
        }
        await onSuccess?.();
        if (!isEdit) {
          setTitle("");
          setDescription("");
          setPriority("MEDIUM");
          setPhotoFile(null);
        }
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al guardar la incidencia";
        setSubmitError(msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    onCreate?.(payload);
    onClose();
  };

  return (
    <ModalShell
      title={isEdit ? "Editar incidencia" : "Nueva incidencia"}
      subtitle={
        isEdit
          ? "Título, descripción y prioridad (la foto no se cambia aquí)"
          : authToken
            ? "Se sube a Supabase si adjuntas foto (máx. 5 MB, solo imágenes)"
            : "Registra una avería o problema operativo"
      }
      onClose={onClose}
      submitLabel={isEdit ? "Guardar cambios" : photoFile ? "Crear con foto" : "Crear incidencia"}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</div>
      )}
      <div>
        <Label>Título *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ej: Nevera no enfría" />
      </div>
      <div>
        <Label>Descripción</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe la incidencia..." />
      </div>
      <div>
        <Label>Prioridad</Label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as CreateIncidentPayload["priority"])} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]">
          {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
            <option key={p} value={p}>
              {p === "LOW" ? "Baja" : p === "MEDIUM" ? "Media" : p === "HIGH" ? "Alta" : "Crítica"}
            </option>
          ))}
        </select>
      </div>
      {authToken && !isEdit ? (
        <div>
          <Label>Foto (opcional)</Label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef1f8] file:px-3 file:py-2 file:font-semibold file:text-[#4f6ef7]"
            onChange={(ev) => {
              setPhotoFile(ev.target.files?.[0] ?? null);
              setSubmitError(null);
            }}
          />
          {previewUrl ? (
            <img src={previewUrl} alt="" className="mt-2 max-h-36 w-full rounded-xl border border-gray-100 object-contain bg-gray-50" />
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  );
}

export type CreateSupplierPayload = {
  name: string;
  category: string;
  phone: string;
  email: string;
  contactPerson: string;
  notes: string;
};

type CreateSupplierModalProps = {
  onClose: () => void;
  onCreate?: (payload: CreateSupplierPayload) => void;
  onSuccess?: () => void | Promise<void>;
  authToken?: string | null;
  /** Si viene con `id`, se hace PUT; si no, POST. */
  initial?: SupplierResponse | null;
  mode?: "SUPPLIER" | "CONTACT";
  contactOptions?: string[];
};

function emptySupplierForm(): CreateSupplierPayload {
  return { name: "", category: "", phone: "", email: "", contactPerson: "", notes: "" };
}

function supplierToForm(s: SupplierResponse): CreateSupplierPayload {
  return {
    name: s.name,
    category: s.category ?? "",
    phone: s.contactPhone ?? "",
    email: s.contactEmail ?? "",
    contactPerson: s.contactPerson ?? "",
    notes: s.notes ?? "",
  };
}

export function CreateSupplierModal({
  onClose, onCreate, onSuccess, authToken, initial, mode = "SUPPLIER", contactOptions = [],
}: CreateSupplierModalProps) {
  const [form, setForm] = useState<CreateSupplierPayload>(emptySupplierForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (initial) setForm(supplierToForm(initial));
    else setForm(emptySupplierForm());
    setSubmitError(null);
  }, [initial]);

  const set = (k: keyof CreateSupplierPayload, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = { ...form, name: form.name.trim() };

    if (authToken) {
      setSubmitError(null);
      setSubmitting(true);
      try {
        const body = {
          name: payload.name,
          contactEmail: payload.email.trim() || "",
          contactPhone: payload.phone.trim() || null,
          contactPerson: payload.contactPerson.trim() || null,
          category: payload.category.trim() || null,
          notes: payload.notes.trim() || null,
          type: mode,
        };
        if (isEdit && initial?.id) await suppliersApi.update(authToken, initial.id, body);
        else await suppliersApi.create(authToken, body);
        await onSuccess?.();
        onClose();
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : "Error al guardar");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    onCreate?.(payload);
    onClose();
  };

  return (
    <ModalShell
      title={isEdit ? (mode === "CONTACT" ? "Editar contacto" : "Editar proveedor") : (mode === "CONTACT" ? "Nuevo contacto" : "Nuevo proveedor")}
      subtitle={authToken ? "Se guarda en el API (solo OWNER puede crear/editar)" : "Añade un registro al sistema"}
      onClose={onClose}
      submitLabel={isEdit ? "Guardar" : (mode === "CONTACT" ? "Crear contacto" : "Crear proveedor")}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      {submitError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} required /></div>
        <div><Label>Categoría</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="opcional" /></div>
      </div>
      <div>
        <Label>Persona de contacto</Label>
        {contactOptions.length > 0 ? (
          <select
            value={form.contactPerson}
            onChange={(e) => set("contactPerson", e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
          >
            <option value="">Seleccionar contacto</option>
            {contactOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
        )}
      </div>
      <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observaciones internas…" /></div>
    </ModalShell>
  );
}

const RBAC_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "VIEWER", label: "Solo lectura" },
  { value: "EMPLOYEE", label: "Empleado" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "MANAGER", label: "Gerente" },
  { value: "OWNER", label: "Propietario" },
];

export type CreatePersonPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  nationalId: string;
  jobTitle: string;
  workScheduleNote: string;
  active: boolean;
};

export function CreatePersonModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (payload: CreatePersonPayload) => void;
}) {
  const [form, setForm] = useState<CreatePersonPayload>({
    name: "",
    email: "",
    password: "",
    role: "EMPLOYEE",
    nationalId: "",
    jobTitle: "",
    workScheduleNote: "",
    active: true,
  });
  const set = <K extends keyof CreatePersonPayload>(k: K, v: CreatePersonPayload[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  return (
    <ModalShell
      title="Añadir usuario"
      subtitle="Acceso con email y contraseña (solo el propietario puede crear usuarios)"
      onClose={onClose}
      submitLabel="Crear usuario"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onCreate({
          ...form,
          name: form.name.trim(),
          email: form.email.trim(),
          nationalId: form.nationalId.trim(),
          jobTitle: form.jobTitle.trim(),
          workScheduleNote: form.workScheduleNote.trim(),
        });
        onClose();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <Label>Nombre completo *</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label>Rol de seguridad *</Label>
          <select
            value={form.role}
            onChange={(e) => set("role", e.target.value as UserRole)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
          >
            {RBAC_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>Puesto / área</Label>
        <Input
          value={form.jobTitle}
          onChange={(e) => set("jobTitle", e.target.value)}
          placeholder="Ej: Sala · Camarero, Cocina · Jefe de partida"
        />
      </div>
      <div>
        <Label>DNI / NIE (opcional)</Label>
        <Input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} maxLength={32} />
      </div>
      <div>
        <Label>Email *</Label>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
      </div>
      <div>
        <Label>Contraseña *</Label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          minLength={8}
          required
          placeholder="Mínimo 8 caracteres"
        />
      </div>
      <div>
        <Label>Nota de horario (opcional)</Label>
        <Textarea
          value={form.workScheduleNote}
          onChange={(e) => set("workScheduleNote", e.target.value)}
          placeholder="Ej: L–V 10:00–18:00, sábados rotativos"
          className="min-h-[88px]"
        />
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-sm font-medium text-gray-600">Cuenta activa</span>
        <button
          type="button"
          onClick={() => set("active", !form.active)}
          className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? "bg-green-400" : "bg-gray-200"}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.active ? "left-6" : "left-1"}`}
          />
        </button>
      </div>
    </ModalShell>
  );
}

export type UploadDocumentPayload = { name: string; category: string; type: "pdf" | "xlsx" | "img" | "other"; size: string };
export function UploadDocumentModal({ onClose, onCreate }: { onClose: () => void; onCreate: (payload: UploadDocumentPayload) => void }) {
  const [form, setForm] = useState<UploadDocumentPayload>({ name: "", category: "Informes", type: "pdf", size: "120 KB" });
  const set = (k: keyof UploadDocumentPayload, v: string) => setForm((s) => ({ ...s, [k]: v as never }));

  return (
    <ModalShell
      title="Subir documento"
      subtitle="Registra un nuevo documento en el repositorio"
      onClose={onClose}
      submitLabel="Subir documento"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onCreate({ ...form, name: form.name.trim() });
        onClose();
      }}
    >
      <div><Label>Nombre del documento *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Categoría</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
        <div>
          <Label>Tipo</Label>
          <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]">
            {["pdf", "xlsx", "img", "other"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div><Label>Tamaño</Label><Input value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="Ej: 300 KB" /></div>
    </ModalShell>
  );
}

export function InventoryCategoriesModal({
  onClose,
  categories,
  categoriesLoading,
  categoriesError,
  onCreateCategory,
  createSubmitting,
  onRequestDeleteCategory,
  deleteSubmitting,
}: {
  onClose: () => void;
  categories: InventoryCategoryResponse[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  onCreateCategory: (name: string) => void;
  createSubmitting: boolean;
  onRequestDeleteCategory: (id: number, name: string) => void | Promise<void>;
  deleteSubmitting: boolean;
}) {
  const [categorySearch, setCategorySearch] = useState("");
  const [newName, setNewName] = useState("");

  const filtered = useMemo(() => {
    const s = categorySearch.trim().toLowerCase();
    let list = categories;
    if (s) list = list.filter((c) => c.name.toLowerCase().includes(s));
    return list;
  }, [categories, categorySearch]);

  return (
    <ModalShell
      mode="panel"
      boxClassName="max-w-2xl mx-4"
      title="Categorías de inventario"
      subtitle="Por defecto: Bebidas, Limpieza, Otro y Ninguna. El proveedor se asigna en cada producto. Puedes eliminar las que no uses; los productos pasan a «Ninguna»."
      onClose={onClose}
    >
      <div className="flex items-start gap-2 rounded-xl border border-gray-100 bg-[#fafbff] px-3 py-2">
        <Tag size={18} className="mt-0.5 shrink-0 text-[#4f6ef7]" />
        <p className="text-xs text-gray-600">Busca, añade o elimina categorías de tu empresa.</p>
      </div>

      {categoriesError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{categoriesError}</div>
      ) : null}

      <div>
        <Label>Buscar categoría</Label>
        <Input
          value={categorySearch}
          onChange={(e) => setCategorySearch(e.target.value)}
          placeholder="Buscar categoría…"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100">
        {categoriesLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={18} />
            Cargando categorías…
          </div>
        ) : (
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-[#fafbff] text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Categoría</th>
                <th className="w-28 px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/80">
                  <td className="px-3 py-2 font-medium text-[#1e2040]">{row.name}</td>
                  <td className="px-3 py-2 text-right">
                    {row.name !== "Ninguna" ? (
                      <button
                        type="button"
                        disabled={deleteSubmitting}
                        onClick={() => void onRequestDeleteCategory(row.id, row.name)}
                        className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!categoriesLoading && filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-400">Sin categorías que coincidan.</p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Label>Añadir categoría</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la nueva categoría"
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={createSubmitting || !newName.trim()}
            onClick={() => {
              const t = newName.trim();
              if (!t) return;
              onCreateCategory(t);
              setNewName("");
            }}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-[#4f6ef7] px-4 text-sm font-semibold text-white hover:bg-[#3d5ae0] disabled:opacity-50 sm:min-w-[120px]"
          >
            {createSubmitting ? "Añadiendo…" : "Añadir"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function CreateProductModal({
  onClose,
  onCreate,
  submitting = false,
  categories = [],
  suppliers = [],
}: {
  onClose: () => void;
  onCreate: (payload: ProductInput) => void;
  submitting?: boolean;
  /** Nombres de categoría de inventario (incluye «Ninguna»). */
  categories?: string[];
  suppliers?: SupplierResponse[];
}) {
  const [name, setName] = useState("");
  const [currentStock, setCurrentStock] = useState("0");
  const [minStock, setMinStock] = useState("10");
  const [unit, setUnit] = useState<ProductInput["unit"]>("UNIT");
  const [category, setCategory] = useState("Ninguna");
  const [supplierId, setSupplierId] = useState("");

  const categoryOptions = useMemo(
    () => (categories.length > 0 ? categories : (["Ninguna"] as string[])),
    [categories],
  );

  useEffect(() => {
    setCategory((prev) =>
      categoryOptions.includes(prev) ? prev : categoryOptions.includes("Ninguna") ? "Ninguna" : categoryOptions[0]!,
    );
  }, [categoryOptions]);

  return (
    <ModalShell
      title="Nuevo producto"
      subtitle="Nombre, stock, categoría, proveedor opcional y unidad de medida"
      onClose={onClose}
      submitLabel="Crear producto"
      submitting={submitting}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate({
          name: name.trim(),
          currentStock: Math.floor(Number(currentStock || 0)),
          minStock: Math.floor(Number(minStock || 0)),
          unit,
          category: category === "Ninguna" ? "Ninguna" : category || null,
          supplierId: supplierId === "" ? null : Number(supplierId),
          vatRate: 10,
        });
      }}
    >
      <div>
        <Label>Nombre *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Harina 00" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Stock actual</Label>
          <Input
            value={currentStock}
            onChange={(e) => setCurrentStock(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            min={0}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Mínimo necesario</Label>
          <Input
            value={minStock}
            onChange={(e) => setMinStock(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            min={0}
            placeholder="10"
          />
        </div>
      </div>
      <div>
        <Label>Unidad</Label>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as ProductInput["unit"])}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
        >
          <option value="UNIT">Unidades (ud)</option>
          <option value="KG">Kilogramos (kg)</option>
          <option value="L">Litros (L)</option>
          <option value="BOX">Cajas</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Categoría</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Proveedor (opcional)</Label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]"
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </ModalShell>
  );
}

export type CreateCalendarTaskPayload = { day: string; time: string; title: string };

/** Opciones de día con valor estable (p. ej. fecha ISO) y etiqueta legible. */
export type CalendarDayOption = { value: string; label: string };

export function CreateCalendarTaskModal({
  onClose,
  onCreate,
  days,
  dayOptions,
  initial,
  submitLabel = "Crear tarea",
}: {
  onClose: () => void;
  onCreate: (payload: CreateCalendarTaskPayload) => void;
  /** Modo clásico: solo etiquetas Lun…Dom (valor = etiqueta). */
  days?: string[];
  /** Modo extendido: `value` suele ser YYYY-MM-DD; prioridad sobre `days` si viene informado. */
  dayOptions?: CalendarDayOption[];
  initial?: Partial<CreateCalendarTaskPayload>;
  submitLabel?: string;
}) {
  const options = dayOptions?.length ? dayOptions : (days ?? []).map((d) => ({ value: d, label: d }));
  const defaultDay = initial?.day ?? options[0]?.value ?? "Mon";

  const [form, setForm] = useState<CreateCalendarTaskPayload>({
    day: defaultDay,
    time: initial?.time ?? "09:00",
    title: initial?.title ?? "",
  });

  useEffect(() => {
    if (!initial?.day) return;
    setForm((s) => ({
      ...s,
      day: initial.day!,
      time: initial.time ?? s.time,
      title: initial.title ?? s.title,
    }));
  }, [initial?.day, initial?.time, initial?.title]);

  const set = (k: keyof CreateCalendarTaskPayload, v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <ModalShell
      title="Nueva tarea de calendario"
      subtitle={dayOptions?.length ? "Elige la fecha en el rango visible del calendario." : "Programa una tarea o evento semanal"}
      onClose={onClose}
      submitLabel={submitLabel}
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        onCreate({ ...form, title: form.title.trim() });
        onClose();
      }}
    >
      <div><Label>Título *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Día</Label>
          <select value={form.day} onChange={(e) => set("day", e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]">
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div><Label>Hora</Label><Input value={form.time} onChange={(e) => set("time", e.target.value)} placeholder="09:00" /></div>
      </div>
    </ModalShell>
  );
}

