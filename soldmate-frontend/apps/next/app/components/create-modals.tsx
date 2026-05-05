"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import { incidentsApi, suppliersApi, type IncidentResponse, type SupplierResponse } from "app/lib/api";

type ModalShellProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitLabel: string;
  submitting?: boolean;
};

function ModalShell({
  title,
  subtitle,
  onClose,
  onSubmit,
  children,
  submitLabel,
  submitting = false,
}: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <div>
            <h2 className="text-base font-bold text-[#1e2040]">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          {children}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 text-gray-500 font-semibold py-2.5 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-[#4f6ef7] text-white font-semibold py-2.5 text-sm hover:bg-[#3d5ae0] disabled:opacity-60">
              {submitting ? "Guardando..." : submitLabel}
            </button>
          </div>
        </form>
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

export type CreatePersonPayload = { name: string; department: string; role: string; email: string; phone: string; location: string; online: boolean };
export function CreatePersonModal({
  onClose,
  onCreate,
  departments,
}: { onClose: () => void; onCreate: (payload: CreatePersonPayload) => void; departments: string[] }) {
  const [form, setForm] = useState<CreatePersonPayload>({ name: "", department: departments[0] ?? "Design", role: "", email: "", phone: "", location: "", online: true });
  const set = (k: keyof CreatePersonPayload, v: string | boolean) => setForm((s) => ({ ...s, [k]: v as never }));

  return (
    <ModalShell
      title="Añadir usuario"
      subtitle="Completa los datos de acceso del nuevo usuario"
      onClose={onClose}
      submitLabel="Crear usuario"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onCreate({ ...form, name: form.name.trim() });
        onClose();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} required /></div>
        <div>
          <Label>Departamento</Label>
          <select value={form.department} onChange={(e) => set("department", e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7]">
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div><Label>Cargo / Rol</Label><Input value={form.role} onChange={(e) => set("role", e.target.value)} /></div>
      <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><Label>Ubicación</Label><Input value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-sm font-medium text-gray-600">Estado inicial</span>
        <button type="button" onClick={() => set("online", !form.online)} className={`relative w-11 h-6 rounded-full transition-colors ${form.online ? "bg-green-400" : "bg-gray-200"}`}>
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.online ? "left-6" : "left-1"}`} />
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

export type CreateCalendarTaskPayload = { day: string; time: string; title: string };
export function CreateCalendarTaskModal({ onClose, onCreate, days }: { onClose: () => void; onCreate: (payload: CreateCalendarTaskPayload) => void; days: string[] }) {
  const [form, setForm] = useState<CreateCalendarTaskPayload>({ day: days[0] ?? "Mon", time: "09:00", title: "" });
  const set = (k: keyof CreateCalendarTaskPayload, v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <ModalShell
      title="Nueva tarea de calendario"
      subtitle="Programa una tarea o evento semanal"
      onClose={onClose}
      submitLabel="Crear tarea"
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
            {days.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div><Label>Hora</Label><Input value={form.time} onChange={(e) => set("time", e.target.value)} placeholder="09:00" /></div>
      </div>
    </ModalShell>
  );
}

