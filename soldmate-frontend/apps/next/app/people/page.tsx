"use client";

import React, { useMemo, useState } from "react";
import {
  Search,
  Grid3X3,
  List,
  Plus,
  X,
  MoreVertical,
  User,
  Mail,
  Calendar,
  Pencil,
  Check,
  Trash2,
  Loader2,
  AlertCircle,
  FileText,
  Palmtree,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreatePersonModal,
  AppTopHeader,
  ErpPageShell,
  notify,
  useConfirm,
  PageListSearchField,
} from "../shared/ui";
import type { CreatePersonPayload } from "../components/create-modals";
import {
  activityApi,
  usersApi,
  vacationsApi,
  documentsApi,
  type ActivityItemResponse,
  type UserListResponse,
  type UserUpsertInput,
  type UserRole,
  type VacationResponse,
  type DocumentResponse,
} from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { canManageUsers, roleDisplayLabel } from "app/lib/rbac";

interface Person {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  jobTitle: string;
  nationalId: string;
  workScheduleNote: string;
  active: boolean;
  avatar: string | null;
  lastSeenAt: string | null;
}

export function getPresenceStatus(lastSeenAt: string | null, active: boolean) {
  if (!active) return { color: "bg-gray-300", label: "Cuenta desactivada" };
  if (!lastSeenAt) return { color: "bg-gray-300", label: "Offline" };
  
  const diffMinutes = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;
  if (diffMinutes < 2) return { color: "bg-emerald-400", label: "Online" };
  if (diffMinutes < 15) return { color: "bg-amber-400", label: "Ausente" };
  return { color: "bg-gray-300", label: "Offline" };
}

const ROLE_FILTERS: Array<"Todos" | UserRole> = [
  "Todos",
  "OWNER",
  "MANAGER",
  "SUPERVISOR",
  "EMPLOYEE",
  "VIEWER",
];

function mapUser(u: UserListResponse): Person {
  const name =
    (u.fullName && u.fullName.trim()) ||
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
    u.email;
  return {
    id: u.id,
    name,
    email: u.email ?? "",
    role: u.role,
    jobTitle: u.jobTitle ?? "",
    nationalId: u.nationalId ?? "",
    workScheduleNote: u.workScheduleNote ?? "",
    active: u.active,
    avatar: u.avatarUrl ?? null,
    lastSeenAt: u.lastSeenAt ?? null,
  };
}

function personToUpsert(p: Person, password?: string): UserUpsertInput {
  const base: UserUpsertInput = {
    fullName: p.name.trim(),
    email: p.email.trim(),
    role: p.role,
    avatarUrl: p.avatar,
    nationalId: p.nationalId.trim() || undefined,
    jobTitle: p.jobTitle.trim() || undefined,
    workScheduleNote: p.workScheduleNote.trim() || undefined,
    active: p.active,
  };
  if (password) return { ...base, password };
  return base;
}

type SortKey = "name" | "role";

function Avatar({ person, size = 56 }: { person: Person; size?: number }) {
  if (person.avatar) {
    return (
      <img
        src={person.avatar}
        alt={person.name}
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

function PersonCard({
  person: emp,
  selected,
  onSelect,
  onDelete,
  canWrite,
}: {
  person: Person;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  canWrite: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      onClick={() => {
        onSelect();
        setMenuOpen(false);
      }}
      className={`relative bg-white rounded-2xl p-5 cursor-pointer transition-all border ${
        selected
          ? "border-[#4f6ef7] shadow-[0_4px_24px_rgba(79,110,247,0.18)] ring-1 ring-[#4f6ef7]/20"
          : "border-gray-50 shadow-[0_2px_16px_rgba(149,157,165,0.10)] hover:shadow-[0_4px_24px_rgba(149,157,165,0.18)] hover:border-gray-200"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="relative">
          <Avatar person={emp} size={52} />
          <span
            className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border border-white ${getPresenceStatus(emp.lastSeenAt, emp.active).color}`}
            title={getPresenceStatus(emp.lastSeenAt, emp.active).label}
          />
        </div>

        {canWrite ? (
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
                  onClick={() => {
                    onSelect();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Pencil size={12} /> Editar
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <h3 className="font-semibold text-[#1e2040] text-sm leading-tight mb-0.5">{emp.name}</h3>
      {emp.email ? (
        <p className="text-gray-400 text-xs mb-3 truncate">{emp.email}</p>
      ) : (
        <p className="text-gray-300 text-xs mb-3 italic">Sin email</p>
      )}

      <p className="text-[11px] text-gray-500 line-clamp-2 min-h-[2.5rem]">
        {emp.jobTitle ? (
          emp.jobTitle
        ) : (
          <span className="text-gray-300 italic">Sin puesto indicado</span>
        )}
      </p>

      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-gray-50">
        <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-widest truncate">
          {roleDisplayLabel(emp.role)}
        </p>
      </div>
    </div>
  );
}

function PersonRow({
  person: emp,
  selected,
  onSelect,
  onDelete,
  canWrite,
}: {
  person: Person;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  canWrite: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 cursor-pointer transition-colors ${
        selected ? "bg-blue-50/70" : "hover:bg-[#fafbff]"
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar person={emp} size={38} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${getPresenceStatus(emp.lastSeenAt, emp.active).color}`}
          title={getPresenceStatus(emp.lastSeenAt, emp.active).label}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1e2040] truncate">{emp.name}</p>
        <p className="text-xs text-gray-400 truncate">{emp.email || "—"}</p>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap hidden md:block">
        {roleDisplayLabel(emp.role)}
      </span>
      <span className="text-xs text-gray-600 truncate hidden lg:block max-w-[140px]" title={emp.jobTitle}>
        {emp.jobTitle || "—"}
      </span>
      {canWrite ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors justify-self-end"
        >
          <Trash2 size={13} />
        </button>
      ) : (
        <span className="w-8" />
      )}
    </div>
  );
}

function DetailPanel({
  person: emp,
  recentActivity,
  onUpdate,
  onClose,
  canWrite,
}: {
  person: Person;
  recentActivity: ActivityItemResponse[];
  onUpdate: (updated: Person) => void;
  onClose: () => void;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Person>(emp);
  const token = useAuthStore((s) => s.token);

  const { data: vacations = [] } = useQuery({
    queryKey: ["vacations", emp.id],
    queryFn: async () => {
      const all = await vacationsApi.list(token!);
      return all.filter((v) => v.userId === emp.id);
    },
    enabled: !!token && !!emp.id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", "linked", emp.id],
    queryFn: async () => {
      const all = await documentsApi.getAll(token!);
      return all.filter((d) => d.linkedUserId === emp.id);
    },
    enabled: !!token && !!emp.id,
  });

  React.useEffect(() => {
    setDraft(emp);
    setEditing(false);
  }, [emp.id]);

  const set = (field: keyof Person, value: string | boolean | UserRole) =>
    setDraft((d) => ({ ...d, [field]: value } as Person));

  const save = () => {
    onUpdate(draft);
    setEditing(false);
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl border-l border-gray-100 lg:static lg:inset-auto lg:z-auto lg:h-full lg:min-h-0 lg:max-h-full lg:w-80 lg:max-w-none lg:shrink-0 lg:rounded-none lg:shadow-none">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-gray-50">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Perfil</p>
        <div className="flex items-center gap-1.5">
          {canWrite && editing ? (
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
                onClick={() => {
                  setDraft(emp);
                  setEditing(false);
                }}
                className="p-2.5 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors min-w-[40px] min-h-[40px] inline-flex items-center justify-center"
                aria-label="Cancelar edición"
              >
                <X size={16} />
              </button>
            </>
          ) : canWrite ? (
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
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors min-w-[40px] min-h-[40px] inline-flex items-center justify-center"
              aria-label="Cerrar perfil"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col items-center text-center border-b border-gray-50">
        <div className="relative mb-3">
          <Avatar person={editing ? draft : emp} size={72} />
          <span
            className={`absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-white ${getPresenceStatus(emp.lastSeenAt, editing ? draft.active : emp.active).color}`}
            title={getPresenceStatus(emp.lastSeenAt, editing ? draft.active : emp.active).label}
          />
        </div>

        {editing && canWrite ? (
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className="text-center w-full font-bold text-[#1e2040] text-base border-b border-[#4f6ef7]/40 outline-none bg-transparent mb-1 pb-0.5"
          />
        ) : (
          <h2 className="font-bold text-[#1e2040] text-base mb-0.5">{emp.name}</h2>
        )}

        {editing && canWrite ? (
          <select
            value={draft.role}
            onChange={(e) => set("role", e.target.value as UserRole)}
            className="mt-1 text-center text-xs rounded-lg border border-gray-200 px-2 py-1 outline-none bg-white text-gray-700 max-w-full"
          >
            {ROLE_FILTERS.filter((r): r is UserRole => r !== "Todos").map((r) => (
              <option key={r} value={r}>
                {roleDisplayLabel(r)}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-400 mb-2">{roleDisplayLabel(emp.role)}</p>
        )}

        {editing && canWrite ? (
          <label className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => set("active", e.target.checked)}
              className="rounded border-gray-300"
            />
            Cuenta activa
          </label>
        ) : (
          <p className="text-[10px] text-gray-400">{emp.active ? "Cuenta activa" : "Cuenta desactivada"}</p>
        )}
      </div>

      <div className="px-5 py-4 border-b border-gray-50 space-y-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Datos</p>

        <div className="flex items-start gap-2.5">
          <Mail size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
          {editing && canWrite ? (
            <input
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              className="flex-1 text-xs text-[#1e2040] border-b border-gray-200 outline-none bg-transparent pb-0.5"
            />
          ) : (
            <span className="text-xs text-gray-600 truncate">{emp.email || "Sin email"}</span>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-1">Puesto / área</p>
          {editing && canWrite ? (
            <input
              value={draft.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
              className="w-full text-xs text-[#1e2040] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#4f6ef7]"
            />
          ) : (
            <p className="text-xs text-gray-600">{emp.jobTitle || "—"}</p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-1">DNI / NIE</p>
          {editing && canWrite ? (
            <input
              value={draft.nationalId}
              onChange={(e) => set("nationalId", e.target.value)}
              maxLength={32}
              className="w-full text-xs text-[#1e2040] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#4f6ef7]"
            />
          ) : (
            <p className="text-xs text-gray-600">{emp.nationalId || "—"}</p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-1">Horario (nota)</p>
          {editing && canWrite ? (
            <textarea
              value={draft.workScheduleNote}
              onChange={(e) => set("workScheduleNote", e.target.value)}
              rows={3}
              className="w-full text-xs text-[#1e2040] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#4f6ef7] resize-none"
            />
          ) : (
            <p className="text-xs text-gray-600 whitespace-pre-wrap">{emp.workScheduleNote || "—"}</p>
          )}
        </div>
      </div>

      <div className="px-5 py-4 border-b border-gray-50 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Vacaciones</p>
        </div>
        <div className="space-y-2">
          {vacations.length ? (
            vacations.map((v) => (
              <div key={v.id} className="flex items-start gap-2.5">
                <Palmtree size={13} className="text-[#4f6ef7] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#1e2040]">
                    {new Date(v.startDate).toLocaleDateString("es-ES")} - {new Date(v.endDate).toLocaleDateString("es-ES")}
                  </p>
                  {v.notes && <p className="text-[10px] text-gray-500 mt-0.5">{v.notes}</p>}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400">No hay vacaciones registradas.</p>
          )}
        </div>
      </div>

      <div className="px-5 py-4 border-b border-gray-50 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Documentos vinculados</p>
        </div>
        <div className="space-y-2">
          {documents.length ? (
            documents.map((d) => (
              <a
                key={d.id}
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2.5 group"
              >
                <FileText size={13} className="text-emerald-500 flex-shrink-0 mt-0.5 group-hover:text-emerald-600" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#1e2040] truncate group-hover:underline">{d.name}</p>
                  <p className="text-[10px] text-gray-400">{new Date(d.createdAt).toLocaleDateString("es-ES")}</p>
                </div>
              </a>
            ))
          ) : (
            <p className="text-xs text-gray-400">No hay documentos.</p>
          )}
        </div>
      </div>

      <div className="px-5 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Actividad reciente</p>
        </div>
        <div className="space-y-2">
          {recentActivity.length ? (
            recentActivity.map((a, idx) => {
              const color =
                a.status === "ELIMINADO" ? "bg-red-400" : a.status === "MODIFICADO" ? "bg-amber-400" : "bg-green-400";
              return (
                <div key={`${a.id}-${idx}`} className="flex items-start gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${color} mt-1.5 flex-shrink-0`} />
                  <div>
                    <p className="text-xs text-gray-600 leading-tight line-clamp-2">{a.title}</p>
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
    </aside>
  );
}

export default function PeoplePage() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const ownerCanWrite = canManageUsers(role);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<typeof ROLE_FILTERS[number]>("Todos");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showModal, setShowModal] = useState(false);

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

  const people = useMemo(() => users.map(mapUser), [users]);

  const createMutation = useMutation({
    mutationFn: (data: UserUpsertInput) => usersApi.create(token!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      notify.success("Usuario creado");
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al crear usuario"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpsertInput }) => usersApi.update(token!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      notify.success("Usuario actualizado");
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al actualizar usuario"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.remove(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      notify.success("Usuario eliminado");
    },
    onError: (e: Error) => notify.error(e.message ?? "Error al eliminar usuario"),
  });

  const selected = people.find((p) => p.id === selectedId) ?? null;
  const selectedActivity = useMemo(() => {
    if (!selected) return [];
    const nameLc = selected.name.toLowerCase();
    const emailLc = selected.email.toLowerCase();
    return allActivity
      .filter((a) => {
        const actorEmail = (a.actorEmail ?? "").toLowerCase();
        const actorName = (a.actorName ?? "").toLowerCase();
        return (emailLc && actorEmail === emailLc) || (!!nameLc && actorName.includes(nameLc));
      })
      .slice(0, 8);
  }, [allActivity, selected]);

  const filtered = useMemo(() => {
    let list = people.filter((p) => {
      const matchRole = roleFilter === "Todos" || p.role === roleFilter;
      const q = search.toLowerCase();
      const matchSearch =
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.jobTitle.toLowerCase().includes(q) ||
        p.nationalId.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return a.role.localeCompare(b.role);
    });
    return list;
  }, [people, search, roleFilter, sortBy]);

  const addPerson = (payload: CreatePersonPayload) => {
    createMutation.mutate(
      personToUpsert(
        {
          id: 0,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          jobTitle: payload.jobTitle,
          nationalId: payload.nationalId,
          workScheduleNote: payload.workScheduleNote,
          active: payload.active,
          avatar: null,
          lastSeenAt: null,
        },
        payload.password
      )
    );
  };

  const updatePerson = (updated: Person) => {
    updateMutation.mutate({ id: updated.id, data: personToUpsert(updated) });
  };

  const deletePerson = async (id: number) => {
    const ok = await confirm("¿Eliminar usuario?", "Se quitará de la empresa (y del sistema si no tiene más negocios).", "danger");
    if (!ok) return;
    deleteMutation.mutate(id);
    if (selectedId === id) setSelectedId(null);
  };

  const statsLine = `${people.length} usuarios · ${people.filter((p) => p.active).length} cuentas activas`;

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
      <AppTopHeader />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-7 pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1e2040]">Usuarios</h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">{statsLine}</p>
            </div>
            {ownerCanWrite ? (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-[#4f6ef7] text-white rounded-xl px-4 py-3 sm:py-2.5 text-sm font-semibold shadow-[0_4px_12px_rgba(79,110,247,0.30)] hover:bg-[#3d5ae0] transition-all shrink-0 min-h-[44px]"
              >
                <Plus size={15} /> Añadir usuario
              </button>
            ) : null}
          </div>

          <div className="mb-4">
            <PageListSearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, email, rol o puesto…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <div className="flex flex-wrap gap-1.5">
              {ROLE_FILTERS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    roleFilter === r
                      ? "bg-[#4f6ef7] text-white shadow-sm"
                      : "bg-white text-gray-500 border border-gray-100 hover:border-gray-200 shadow-sm"
                  }`}
                >
                  {r === "Todos" ? "Todos" : roleDisplayLabel(r)}
                  <span
                    className={`ml-1.5 text-[10px] ${roleFilter === r ? "opacity-70" : "text-gray-400"}`}
                  >
                    {r === "Todos" ? people.length : people.filter((p) => p.role === r).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Ordenar:</span>
              <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
                {(["name", "role"] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSortBy(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      sortBy === k ? "bg-[#4f6ef7] text-white" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {k === "name" ? "Nombre" : "Rol"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "grid" ? "bg-[#4f6ef7] text-white" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Grid3X3 size={13} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "list" ? "bg-[#4f6ef7] text-white" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <List size={13} />
              </button>
            </div>
          </div>

          {search ? (
            <p className="text-xs text-gray-400 mb-3">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para &quot;
              <span className="text-[#4f6ef7]">{search}</span>&quot;
            </p>
          ) : null}

          {viewMode === "grid" && (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  selected={selectedId === p.id}
                  onSelect={() => setSelectedId(p.id === selectedId ? null : p.id)}
                  onDelete={() => void deletePerson(p.id)}
                  canWrite={ownerCanWrite}
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

          {viewMode === "list" && (
            <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-2.5 border-b border-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                <span className="w-10" />
                <span>Nombre</span>
                <span className="hidden md:block">Rol</span>
                <span className="hidden lg:block">Puesto</span>
                <span className="w-8" />
              </div>
              <div className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    selected={selectedId === p.id}
                    onSelect={() => setSelectedId(p.id === selectedId ? null : p.id)}
                    onDelete={() => void deletePerson(p.id)}
                    canWrite={ownerCanWrite}
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

        {selected ? (
          <>
            <button
              type="button"
              aria-label="Cerrar panel"
              className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px] lg:hidden"
              onClick={() => setSelectedId(null)}
            />
            <DetailPanel
              person={selected}
              recentActivity={selectedActivity}
              onUpdate={updatePerson}
              onClose={() => setSelectedId(null)}
              canWrite={ownerCanWrite}
            />
          </>
        ) : null}
      </div>

      {showModal && ownerCanWrite ? (
        <CreatePersonModal
          onClose={() => setShowModal(false)}
          onCreate={(payload) => addPerson(payload)}
        />
      ) : null}
      {confirmDialog}
    </ErpPageShell>
  );
}
