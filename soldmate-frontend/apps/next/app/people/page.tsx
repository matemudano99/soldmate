"use client";

import React, { useState, useMemo } from "react";
import {
  Search, Grid3X3, List, Plus, X, MoreVertical, User,
  Mail, Phone, MapPin, Calendar, Pencil, Check, Trash2,
  ChevronDown, MessageSquare, Settings, ChevronLeft, ChevronRight,
  Star, TrendingUp, Loader2, AlertCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreatePersonModal, AppTopHeader, ErpPageShell, notify, useConfirm, EmptyState } from "../shared/ui";
import {
  activityApi,
  usersApi,
  type ActivityItemResponse,
  type UserListResponse,
  type UserUpsertInput,
} from "app/lib/api";
import { useAuthStore } from "app/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  progress: number;
  online: boolean;
  avatar: string | null;
  phone: string;
  location: string;
  projects: string[];
  joinDate: string;
  rating: number;
}

type NewEmployeeInput = Omit<Employee, "id" | "rating"> & { password?: string };

// ─── API ↔ UI mappers ─────────────────────────────────────────────────────────

function mapUser(u: UserListResponse): Employee {
  const name = (u.fullName && u.fullName.trim()) || [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email;
  return {
    id: u.id,
    name,
    email: u.email ?? "",
    role: u.role ?? "EMPLOYEE",
    department: "Operations",
    progress: 0,
    online: true,
    avatar: u.avatarUrl ?? null,
    phone: "",
    location: "",
    projects: [],
    joinDate: "",
    rating: 4.0,
  };
}

function employeeToUserInput(e: Omit<Employee, "id"> | NewEmployeeInput): UserUpsertInput {
  const role = (e.role || "EMPLOYEE").toUpperCase();
  const mappedRole: UserUpsertInput["role"] =
    role === "OWNER" ? "OWNER" :
    role === "MANAGER" ? "MANAGER" :
    role === "STAFF" || role === "EMPLOYEE" ? "EMPLOYEE" :
    "EMPLOYEE";
  return {
    fullName: e.name.trim(),
    email: e.email.trim(),
    role: mappedRole,
    avatarUrl: e.avatar ?? null,
    ...("password" in e && e.password ? { password: e.password } : {}),
  };
}

const STATIC_DEPARTMENTS = ["Design", "Marketing", "Engineering", "Product", "Operations"];
type SortKey = "name" | "progress" | "rating";

const EMPTY_FORM: Omit<Employee, "id" | "rating"> = {
  name: "", email: "", role: "", department: "Design",
  progress: 0, online: true, avatar: null,
  phone: "", location: "", projects: [], joinDate: "",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressDots({ percent, size = "sm" }: { percent: number; size?: "sm" | "xs" }) {
  const filled = Math.round((percent / 100) * 5);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`rounded-full ${size === "sm" ? "h-1.5 w-5" : "h-1 w-3.5"} ${i < filled ? "bg-[#4f6ef7]" : "bg-gray-100"}`} />
      ))}
    </div>
  );
}

function StatusDot({ online, size = "md" }: { online: boolean; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-2.5 h-2.5 border" : "w-3.5 h-3.5 border-2";
  return <span className={`${s} rounded-full border-white ${online ? "bg-green-400" : "bg-gray-300"}`} />;
}

function Avatar({ emp, size = 56 }: { emp: Employee; size?: number }) {
  if (emp.avatar) {
    return (
      <img
        src={emp.avatar} alt={emp.name}
        className="rounded-full object-cover ring-2 ring-white shadow-sm"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center shadow-sm"
      style={{ width: size, height: size }}
    >
      <User className="text-blue-200" size={size * 0.5} />
    </div>
  );
}

function formatRelativeTime(isoDate: string): string {
  const d = new Date(isoDate);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Ayer";
  return `Hace ${days}d`;
}

// ─── Employee Card (grid view) ────────────────────────────────────────────────

function EmployeeCard({
  emp, selected, onSelect, onDelete,
}: {
  emp: Employee;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      onClick={() => { onSelect(); setMenuOpen(false); }}
      className={`relative bg-white rounded-2xl p-5 cursor-pointer transition-all border ${
        selected
          ? "border-[#4f6ef7] shadow-[0_4px_24px_rgba(79,110,247,0.18)] ring-1 ring-[#4f6ef7]/20"
          : "border-gray-50 shadow-[0_2px_16px_rgba(149,157,165,0.10)] hover:shadow-[0_4px_24px_rgba(149,157,165,0.18)] hover:border-gray-200"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="relative">
          <Avatar emp={emp} size={52} />
          <span className="absolute bottom-0.5 right-0.5">
            <StatusDot online={emp.online} />
          </span>
        </div>

        {/* Kebab menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-36 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
              <button
                onClick={() => { onSelect(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <Pencil size={12} /> Editar
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                <MessageSquare size={12} /> Mensaje
              </button>
              <div className="h-px bg-gray-100 my-1" />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={12} /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-[#1e2040] text-sm leading-tight mb-0.5">{emp.name}</h3>
      {emp.email
        ? <p className="text-gray-400 text-xs mb-3 truncate">{emp.email}</p>
        : <p className="text-gray-300 text-xs mb-3 italic">Sin email</p>}



      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-gray-50">
        <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-widest truncate">{emp.role}</p>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
          emp.department === "Design"      ? "bg-violet-50 text-violet-500" :
          emp.department === "Marketing"   ? "bg-pink-50 text-pink-500" :
                                             "bg-blue-50 text-blue-500"
        }`}>{emp.department}</span>
      </div>
    </div>
  );
}

// ─── Employee Row (list view) ─────────────────────────────────────────────────

function EmployeeRow({
  emp, selected, onSelect, onDelete,
}: {
  emp: Employee;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3.5 cursor-pointer transition-colors ${
        selected ? "bg-blue-50/70" : "hover:bg-[#fafbff]"
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar emp={emp} size={38} />
        <span className="absolute -bottom-0.5 -right-0.5">
          <StatusDot online={emp.online} size="sm" />
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1e2040] truncate">{emp.name}</p>
        <p className="text-xs text-gray-400 truncate">{emp.email || "—"}</p>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap hidden md:block">{emp.role}</span>
      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap hidden lg:block ${
        emp.department === "Design"    ? "bg-violet-50 text-violet-500" :
        emp.department === "Marketing" ? "bg-pink-50 text-pink-500" :
                                         "bg-blue-50 text-blue-500"
      }`}>{emp.department}</span>
      <div className="flex items-center gap-2 hidden xl:flex">
        <ProgressDots percent={emp.progress} size="xs" />
        <span className="text-xs text-gray-500 font-semibold">{emp.progress}%</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  emp,
  recentActivity,
  onUpdate,
  onClose,
}: {
  emp: Employee;
  recentActivity: ActivityItemResponse[];
  onUpdate: (updated: Employee) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Employee>(emp);

  // sync when selection changes
  React.useEffect(() => { setDraft(emp); setEditing(false); }, [emp.id]);

  const set = (field: keyof Employee, value: any) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const save = () => { onUpdate(draft); setEditing(false); };

  const DEPT_COLORS: Record<string, string> = {
    Design: "bg-violet-100 text-violet-600",
    Marketing: "bg-pink-100 text-pink-600",
    Engineering: "bg-blue-100 text-blue-600",
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl border-l border-gray-100 lg:relative lg:inset-auto lg:z-auto lg:max-w-none lg:w-72 lg:flex-shrink-0 lg:shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-gray-50">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Perfil</p>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={save}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4f6ef7] text-white text-xs font-semibold hover:bg-[#3d5ae0] transition-colors min-h-[40px]"
              >
                <Check size={12} /> Guardar
              </button>
              <button
                type="button"
                onClick={() => { setDraft(emp); setEditing(false); }}
                className="p-2.5 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors min-w-[40px] min-h-[40px] inline-flex items-center justify-center"
                aria-label="Cancelar edición"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors min-h-[40px]"
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors min-w-[40px] min-h-[40px] inline-flex items-center justify-center"
                aria-label="Cerrar perfil"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile top */}
      <div className="px-5 py-5 flex flex-col items-center text-center border-b border-gray-50">
        <div className="relative mb-3">
          <Avatar emp={editing ? draft : emp} size={72} />
          <span className="absolute bottom-1 right-1">
            <StatusDot online={editing ? draft.online : emp.online} />
          </span>
          {editing && (
            <button
              onClick={() => set("online", !draft.online)}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full border border-gray-200 shadow-sm flex items-center justify-center"
              title="Toggle online"
            >
              <span className={`w-3 h-3 rounded-full ${draft.online ? "bg-green-400" : "bg-gray-300"}`} />
            </button>
          )}
        </div>

        {editing ? (
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className="text-center w-full font-bold text-[#1e2040] text-base border-b border-[#4f6ef7]/40 outline-none bg-transparent mb-1 pb-0.5"
          />
        ) : (
          <h2 className="font-bold text-[#1e2040] text-base mb-0.5">{emp.name}</h2>
        )}

        {editing ? (
          <input
            value={draft.role}
            onChange={(e) => set("role", e.target.value)}
            className="text-center w-full text-xs text-gray-400 border-b border-gray-200 outline-none bg-transparent mb-2 pb-0.5"
          />
        ) : (
          <p className="text-xs text-gray-400 mb-2">{emp.role}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap justify-center">
          {editing ? (
            <select
              value={draft.department}
              onChange={(e) => set("department", e.target.value)}
              className="text-xs rounded-lg border border-gray-200 px-2 py-1 outline-none bg-white text-gray-600"
            >
              {["Design", "Marketing", "Engineering"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          ) : (
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${DEPT_COLORS[emp.department] ?? "bg-gray-100 text-gray-500"}`}>
              {emp.department}
            </span>
          )}

          <div className="flex items-center gap-0.5">
            <Star size={11} className="text-amber-400 fill-amber-400" />
            <span className="text-xs font-semibold text-gray-600">{emp.rating}</span>
          </div>
        </div>
      </div>


      {/* Contact info */}
      <div className="px-5 py-4 border-b border-gray-50 space-y-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Contacto</p>

        {(["email", "phone", "location"] as const).map((field) => {
          const icons = { email: Mail, phone: Phone, location: MapPin };
          const labels = { email: "Email", phone: "Teléfono", location: "Ubicación" };
          const Icon = icons[field];
          return (
            <div key={field} className="flex items-center gap-2.5">
              <Icon size={13} className="text-gray-400 flex-shrink-0" />
              {editing ? (
                <input
                  value={(draft as any)[field]}
                  onChange={(e) => set(field, e.target.value)}
                  placeholder={labels[field]}
                  className="flex-1 text-xs text-[#1e2040] border-b border-gray-200 outline-none bg-transparent pb-0.5"
                />
              ) : (
                <span className="text-xs text-gray-600 truncate">
                  {(emp as any)[field] || <span className="text-gray-300 italic">Sin datos</span>}
                </span>
              )}
            </div>
          );
        })}

        <div className="flex items-center gap-2.5">
          <Calendar size={13} className="text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-600">Desde {emp.joinDate}</span>
        </div>
      </div>

      {/* Projects */}
      <div className="px-5 py-4 border-b border-gray-50">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Proyectos</p>
        {emp.projects.length === 0 ? (
          <p className="text-xs text-gray-300 italic">Sin proyectos asignados</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {emp.projects.map((p) => (
              <span key={p} className="text-[10px] font-medium bg-[#f0f3ff] text-[#4f6ef7] px-2.5 py-1 rounded-full">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Performance mini-chart */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Actividad reciente</p>
        </div>
        <div className="space-y-2">
          {recentActivity.length ? (
            recentActivity.map((a, idx) => {
              const color =
                a.status === "ELIMINADO" ? "bg-red-400"
                : a.status === "MODIFICADO" ? "bg-amber-400"
                : "bg-green-400";
              return (
                <div key={`${a.id}-${idx}`} className="flex items-start gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${color} mt-1.5 flex-shrink-0`} />
                  <div>
                    <p className="text-xs text-gray-600 leading-tight line-clamp-2">
                      {a.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(a.createdAt)}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-gray-400">Sin actividad reciente para este usuario.</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 mt-auto pt-3 space-y-2">
        <button className="w-full flex items-center justify-center gap-2 bg-[#4f6ef7] text-white rounded-xl py-2.5 text-sm font-semibold shadow-[0_4px_12px_rgba(79,110,247,0.25)] hover:bg-[#3d5ae0] transition-colors">
          <MessageSquare size={14} /> Enviar mensaje
        </button>
        <button className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
          <TrendingUp size={14} /> Ver rendimiento
        </button>
      </div>
    </aside>
  );
}

// ─── Add Employee Modal ───────────────────────────────────────────────────────

function AddModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (emp: Omit<Employee, "id" | "rating">) => void;
}) {
  const [form, setForm] = useState<Omit<Employee, "id" | "rating">>(EMPTY_FORM);
  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd({ ...form, joinDate: new Date().toLocaleDateString("es-ES", { month: "short", year: "numeric" }) });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-50">
          <div>
            <h2 className="text-base font-bold text-[#1e2040]">Añadir persona</h2>
            <p className="text-xs text-gray-400 mt-0.5">Completa los datos del nuevo miembro</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Nombre *</label>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Henry Paulista"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Departamento</label>
              <select
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] transition-colors"
              >
                {STATIC_DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Cargo / Rol</label>
            <input
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              placeholder="Senior UI Designer"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="nombre@empresa.com"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Ubicación</label>
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Madrid"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1e2040] outline-none focus:border-[#4f6ef7] transition-colors"
              />
            </div>
          </div>

          {/* Status toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-gray-600">Estado inicial</span>
            <button
              type="button"
              onClick={() => set("online", !form.online)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.online ? "bg-green-400" : "bg-gray-200"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.online ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 text-gray-500 font-semibold py-2.5 text-sm hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-[#4f6ef7] text-white font-semibold py-2.5 text-sm shadow-[0_4px_12px_rgba(79,110,247,0.30)] hover:bg-[#3d5ae0] transition-all"
            >
              Añadir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PeoplePage() {
  const token       = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search,     setSearch]     = useState("");
  const [activeDept, setActiveDept] = useState("Todos");
  const [sortBy,     setSortBy]     = useState<SortKey>("name");
  const [viewMode,   setViewMode]   = useState<"grid" | "list">("grid");
  const [showModal,  setShowModal]  = useState(false);

  // ─── React Query: fetch users ───────────────────────────────────────────────
  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll(token!),
    enabled: !!token,
  });

  const { data: allActivity = [] } = useQuery({
    queryKey: ["activity-feed", token],
    queryFn: () => activityApi.getAll(token!),
    enabled: !!token,
  });

  const employees = useMemo(() => users.map(mapUser), [users]);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: UserUpsertInput) => usersApi.create(token!, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); notify.success("Usuario creado"); },
    onError: (e: Error) => notify.error(e.message ?? "Error al crear usuario"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpsertInput }) =>
      usersApi.update(token!, id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); notify.success("Usuario actualizado"); },
    onError: (e: Error) => notify.error(e.message ?? "Error al actualizar usuario"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.remove(token!, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); notify.success("Usuario eliminado"); },
    onError: (e: Error) => notify.error(e.message ?? "Error al eliminar usuario"),
  });

  // ─── Derived state ─────────────────────────────────────────────────────────
  const selectedEmp = employees.find((e) => e.id === selectedId) ?? null;
  const selectedEmpActivity = useMemo(() => {
    if (!selectedEmp) return [];
    const nameLc = selectedEmp.name.toLowerCase();
    const emailLc = selectedEmp.email.toLowerCase();
    return allActivity
      .filter((a) => {
        const actorEmail = (a.actorEmail ?? "").toLowerCase();
        const actorName = (a.actorName ?? "").toLowerCase();
        return (emailLc && actorEmail === emailLc) || (!!nameLc && actorName.includes(nameLc));
      })
      .slice(0, 3);
  }, [allActivity, selectedEmp]);

  const filtered = useMemo(() => {
    let list = employees.filter((e) => {
      const matchDept   = activeDept === "Todos" || e.department === activeDept;
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
                          e.email.toLowerCase().includes(search.toLowerCase()) ||
                          e.role.toLowerCase().includes(search.toLowerCase());
      return matchDept && matchSearch;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "name")     return a.name.localeCompare(b.name);
      if (sortBy === "progress") return b.progress - a.progress;
      if (sortBy === "rating")   return b.rating - a.rating;
      return 0;
    });
    return list;
  }, [employees, search, activeDept, sortBy]);

  const addEmployee = (data: NewEmployeeInput) => {
    createMutation.mutate(employeeToUserInput(data));
  };

  const updateEmployee = (updated: Employee) => {
    updateMutation.mutate({ id: updated.id, data: employeeToUserInput(updated) });
  };

  const deleteEmployee = (id: number) => {
    deleteMutation.mutate(id);
    if (selectedId === id) setSelectedId(null);
  };

  const teamStats = {
    total:       employees.length,
    online:      employees.filter((e) => e.online).length,
    avgProgress: employees.length
      ? Math.round(employees.reduce((s, e) => s + e.progress, 0) / employees.length)
      : 0,
  };

  const departments = useMemo(() => {
    const depts = [...new Set(employees.map((e) => e.department).filter(Boolean))];
    return ["Todos", ...depts];
  }, [employees]);

  // ─── Loading / Error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ErpPageShell>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 size={32} className="animate-spin text-[#4f6ef7]" />
            <p className="text-sm">Cargando usuarios...</p>
          </div>
        </div>
      </ErpPageShell>
    );
  }

  if (isError) {
    return (
      <ErpPageShell>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-[#1e2040]">No se pudo conectar al servidor</p>
              <p className="text-sm text-gray-400 mt-1">
                Asegúrate de que el backend está corriendo en el puerto 28080.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-xl bg-[#4f6ef7] text-white px-5 py-2.5 text-sm font-semibold shadow-[0_4px_12px_rgba(79,110,247,0.30)] hover:bg-[#3d5ae0] transition-all"
            >
              Reintentar
            </button>
          </div>
        </div>
      </ErpPageShell>
    );
  }

  return (
    <ErpPageShell>
        <AppTopHeader
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar usuarios..."
        />

        <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 pb-6">
          {/* Title + actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1e2040]">Usuarios</h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                <span className="block sm:inline">{teamStats.total} usuarios · {teamStats.online} activos ahora</span>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">{teamStats.avgProgress}% progreso medio</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-[#4f6ef7] text-white rounded-xl px-4 py-3 sm:py-2.5 text-sm font-semibold shadow-[0_4px_12px_rgba(79,110,247,0.30)] hover:bg-[#3d5ae0] transition-all shrink-0 min-h-[44px]"
            >
              <Plus size={15} /> Añadir usuario
            </button>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            {/* Department pills */}
            <div className="flex flex-wrap gap-1.5">
              {departments.map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDept(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeDept === d
                      ? "bg-[#4f6ef7] text-white shadow-sm"
                      : "bg-white text-gray-500 border border-gray-100 hover:border-gray-200 shadow-sm"
                  }`}
                >
                  {d}
                  <span className={`ml-1.5 text-[10px] ${activeDept === d ? "opacity-70" : "text-gray-400"}`}>
                    {d === "Todos" ? employees.length : employees.filter((e) => e.department === d).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Ordenar:</span>
              <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
                {(["name", "progress", "rating"] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSortBy(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      sortBy === k ? "bg-[#4f6ef7] text-white" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {k === "name" ? "Nombre" : k === "progress" ? "Progreso" : "Rating"}
                  </button>
                ))}
              </div>
            </div>

            {/* View toggle */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-[#4f6ef7] text-white" : "text-gray-400 hover:text-gray-600"}`}
              >
                <Grid3X3 size={13} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-[#4f6ef7] text-white" : "text-gray-400 hover:text-gray-600"}`}
              >
                <List size={13} />
              </button>
            </div>
          </div>

          {/* Results count */}
          {search && (
            <p className="text-xs text-gray-400 mb-3">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para "<span className="text-[#4f6ef7]">{search}</span>"
            </p>
          )}

          {/* Grid view */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  selected={selectedId === emp.id}
                  onSelect={() => setSelectedId(emp.id === selectedId ? null : emp.id)}
                  onDelete={() => deleteEmployee(emp.id)}
                />
              ))}
              {filtered.length === 0 && (
                <div className="col-span-3 py-20 flex flex-col items-center text-gray-400">
                  <User size={40} className="mb-3 opacity-30" />
                  <p className="font-medium">Sin resultados</p>
                  <p className="text-sm mt-1">Prueba con otro nombre o filtro</p>
                </div>
              )}
            </div>
          )}

          {/* List view */}
          {viewMode === "list" && (
            <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 border-b border-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                <span className="w-10" />
                <span>Nombre</span>
                <span className="hidden md:block">Cargo</span>
                <span className="hidden lg:block">Equipo</span>
                <span className="hidden xl:block">Progreso</span>
                <span className="w-8" />
              </div>
              <div className="divide-y divide-gray-50">
                {filtered.map((emp) => (
                  <EmployeeRow
                    key={emp.id}
                    emp={emp}
                    selected={selectedId === emp.id}
                    onSelect={() => setSelectedId(emp.id === selectedId ? null : emp.id)}
                    onDelete={() => deleteEmployee(emp.id)}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="py-12 flex flex-col items-center text-gray-400">
                    <User size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">Sin resultados</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

      {/* Detail Panel (overlay en móvil, columna en lg+) */}
      {selectedEmp && (
        <>
          <button
            type="button"
            aria-label="Cerrar panel"
            className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px] lg:hidden"
            onClick={() => setSelectedId(null)}
          />
          <DetailPanel
            emp={selectedEmp}
            recentActivity={selectedEmpActivity}
            onUpdate={updateEmployee}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}

      {/* Add Modal */}
      {showModal && (
        <CreatePersonModal
          onClose={() => setShowModal(false)}
          departments={STATIC_DEPARTMENTS}
          onCreate={(payload) =>
            addEmployee({
              name: payload.name,
              email: payload.email,
              password: payload.password,
              role: payload.role,
              department: payload.department,
              progress: 0,
              online: payload.online,
              avatar: null,
              phone: payload.phone,
              location: payload.location,
              projects: [],
              joinDate: new Date().toLocaleDateString("es-ES", { month: "short", year: "numeric" }),
            })
          }
        />
      )}
    </ErpPageShell>
  );
}
