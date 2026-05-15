"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Database,
  Loader2,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  Unlock,
  UserPlus,
  Users,
} from "lucide-react";
import { AppTopHeader, ErpPageShell, notify } from "../shared/ui";
import {
  devApi,
  type AppRole,
  type DevCompanySummary,
  type DevCompanyUpsertInput,
  type DevCreateUserInput,
  type DevUserAggregate,
  type DevUserUpdateInput,
  type UserRole,
} from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { canAccessDevConsole, roleDisplayLabel } from "app/lib/rbac";

const TENANT_ROLES: UserRole[] = ["OWNER", "MANAGER", "SUPERVISOR", "EMPLOYEE", "VIEWER"];
const GLOBAL_ROLES: AppRole[] = ["DEV", "OWNER", "MANAGER", "SUPERVISOR", "EMPLOYEE", "VIEWER"];

type Tab = "companies" | "users";

const field =
  "w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white";
const label = "block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1";

function invalidateConsole(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["dev-console"] });
}

// ─── Negocios ────────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  onSaved,
}: {
  company: DevCompanySummary;
  onSaved: () => void;
}) {
  const token = useAuthStore((s) => s.token);
  const [draft, setDraft] = useState<DevCompanyUpsertInput>(() => companyToDraft(company));
  const [confirmName, setConfirmName] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    setDraft(companyToDraft(company));
  }, [company]);

  const saveMut = useMutation({
    mutationFn: () => devApi.updateCompany(token!, company.companyId, draft),
    onSuccess: () => {
      notify.success("Negocio actualizado");
      onSaved();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => devApi.deleteCompany(token!, company.companyId, confirmName),
    onSuccess: () => {
      notify.success("Negocio eliminado");
      onSaved();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-slate-200 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
            company_id = {company.companyId}
          </p>
          <h3 className="text-base font-bold text-slate-900">{company.companyName}</h3>
          <p className="text-[11px] text-slate-500">
            {company.membershipCount} usuario{company.membershipCount !== 1 ? "s" : ""}{" "}
            vinculado{company.membershipCount !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
          {company.subscriptionTier ?? "FREE"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Nombre del negocio</label>
          <input className={field} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </div>
        <div>
          <label className={label}>NIF / CIF</label>
          <input className={field} value={draft.taxId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, taxId: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Ciudad</label>
          <input className={field} value={draft.city ?? ""} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
        </div>
        <div>
          <label className={label}>País (ISO)</label>
          <input className={field} value={draft.country ?? "ES"} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Email negocio</label>
          <input className={field} value={draft.businessEmail ?? ""} onChange={(e) => setDraft((d) => ({ ...d, businessEmail: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Teléfono</label>
          <input className={field} value={draft.businessPhone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, businessPhone: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Dirección</label>
          <input className={field} value={draft.addressLine ?? ""} onChange={(e) => setDraft((d) => ({ ...d, addressLine: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Plan</label>
          <select
            className={field}
            value={draft.subscriptionTier ?? "FREE"}
            onChange={(e) => setDraft((d) => ({ ...d, subscriptionTier: e.target.value }))}
          >
            <option value="FREE">FREE</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowDelete((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14} />
          Eliminar negocio
        </button>
        <button
          type="button"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </div>

      {showDelete ? (
        <div>
          <p className="mb-2 text-xs text-red-700">
            Se borrarán todos los datos del tenant (inventario, finanzas, usuarios sin otras membresías…). Escribe el
            nombre exacto del negocio para confirmar.
          </p>
          <input
            className={field}
            placeholder={company.companyName}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
          <button
            type="button"
            disabled={deleteMut.isPending || !confirmName.trim()}
            onClick={() => deleteMut.mutate()}
            className="mt-2 w-full rounded-lg bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteMut.isPending ? "Eliminando…" : "Confirmar eliminación"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function CreateCompanyForm({ onCreated }: { onCreated: () => void }) {
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DevCompanyUpsertInput>({ name: "", country: "ES", subscriptionTier: "FREE" });

  const mut = useMutation({
    mutationFn: () => devApi.createCompany(token!, draft),
    onSuccess: () => {
      notify.success("Negocio creado");
      setOpen(false);
      setDraft({ name: "", country: "ES", subscriptionTier: "FREE" });
      onCreated();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-white py-4 text-sm font-semibold text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50"
      >
        <Plus size={16} />
        Nuevo negocio
      </button>
    );
  }

  return (
    <article className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
      <h3 className="mb-3 text-sm font-bold text-indigo-900">Crear negocio</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Nombre *</label>
          <input className={field} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </div>
        <div>
          <label className={label}>NIF / CIF</label>
          <input className={field} value={draft.taxId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, taxId: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Plan</label>
          <select
            className={field}
            value={draft.subscriptionTier ?? "FREE"}
            onChange={(e) => setDraft((d) => ({ ...d, subscriptionTier: e.target.value }))}
          >
            <option value="FREE">FREE</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-white">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!draft.name.trim() || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Crear
        </button>
      </div>
    </article>
  );
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

type UserDraft = DevUserUpdateInput & {
  editingMembershipId: number;
  editingMembershipRole: UserRole;
  membershipCompanyId: number;
};

function userToDraft(user: DevUserAggregate, membershipId: number, companies: DevCompanySummary[]): UserDraft {
  const mem = user.memberships.find((m) => m.membershipId === membershipId) ?? user.memberships[0];
  return {
    editingMembershipId: mem?.membershipId ?? membershipId,
    editingMembershipRole: (mem?.membershipRole ?? "EMPLOYEE") as UserRole,
    membershipCompanyId: mem?.companyId ?? companies[0]?.companyId ?? 0,
    email: user.email,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    nationalId: user.nationalId ?? "",
    jobTitle: user.jobTitle ?? "",
    workScheduleNote: user.workScheduleNote ?? "",
    active: user.active,
    avatarUrl: user.avatarUrl ?? "",
    globalRole: user.globalRole,
    membershipRole: (mem?.membershipRole ?? "EMPLOYEE") as UserRole,
    primaryCompanyId: user.primaryCompanyId ?? mem?.companyId,
    newPassword: "",
  };
}

function UserCard({
  user,
  companies,
  onSaved,
}: {
  user: DevUserAggregate;
  companies: DevCompanySummary[];
  onSaved: () => void;
}) {
  const token = useAuthStore((s) => s.token);
  const defaultMem = user.memberships[0]?.membershipId ?? 0;
  const [draft, setDraft] = useState<UserDraft>(() => userToDraft(user, defaultMem, companies));
  const [addCompanyId, setAddCompanyId] = useState<number>(companies[0]?.companyId ?? 0);

  useEffect(() => {
    setDraft(userToDraft(user, draft.editingMembershipId || defaultMem, companies));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set = <K extends keyof UserDraft>(k: K, v: UserDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const selectMembership = (membershipId: number) => {
    const mem = user.memberships.find((m) => m.membershipId === membershipId);
    if (!mem) return;
    setDraft((d) => ({
      ...d,
      editingMembershipId: mem.membershipId,
      editingMembershipRole: mem.membershipRole,
      membershipCompanyId: mem.companyId,
      membershipRole: mem.membershipRole,
    }));
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const { editingMembershipId, editingMembershipRole, membershipCompanyId, newPassword, membershipRole, ...rest } =
        draft;
      const body: DevUserUpdateInput = {
        ...rest,
        membershipRole: draft.membershipRole ?? editingMembershipRole,
        membershipCompanyId,
      };
      if (newPassword?.trim() && newPassword.trim().length >= 8) {
        body.newPassword = newPassword.trim();
      }
      return devApi.updateUser(token!, user.userId, editingMembershipId, body);
    },
    onSuccess: () => {
      notify.success(`Usuario ${draft.email} guardado`);
      onSaved();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  const deleteUserMut = useMutation({
    mutationFn: () => devApi.deleteUser(token!, user.userId),
    onSuccess: () => {
      notify.success("Usuario eliminado");
      onSaved();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  const deleteMemMut = useMutation({
    mutationFn: () => devApi.deleteMembership(token!, draft.editingMembershipId),
    onSuccess: () => {
      notify.success("Membresía eliminada");
      onSaved();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  const addMemMut = useMutation({
    mutationFn: () => devApi.addMembership(token!, user.userId, addCompanyId, "EMPLOYEE"),
    onSuccess: () => {
      notify.success("Añadido al negocio");
      onSaved();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  const unlockMut = useMutation({
    mutationFn: () => devApi.unlockUser(token!, user.userId),
    onSuccess: () => {
      notify.success("Cuenta reactivada");
      onSaved();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  const editingMem = user.memberships.find((m) => m.membershipId === draft.editingMembershipId);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Usuario #{user.userId}</p>
        <p className="text-sm font-semibold text-slate-900">
          {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {user.memberships.map((m) => (
            <button
              key={m.membershipId}
              type="button"
              onClick={() => selectMembership(m.membershipId)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                draft.editingMembershipId === m.membershipId
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {m.companyName} · {roleDisplayLabel(m.membershipRole)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 mt-3 flex flex-wrap gap-1.5">
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
            user.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}
        >
          {user.active ? "Activo" : "Inactivo"}
        </span>
        {user.globalRole === "DEV" ? (
          <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">DEV</span>
        ) : null}
        {user.lastSeenAt ? (
          <span className="text-[10px] text-slate-400">Última actividad: {user.lastSeenAt}</span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Negocio (membresía en edición)</label>
          <select
            className={field}
            value={draft.membershipCompanyId}
            onChange={(e) => set("membershipCompanyId", Number(e.target.value))}
          >
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                #{c.companyId} — {c.companyName}
              </option>
            ))}
          </select>
          {editingMem && draft.membershipCompanyId !== editingMem.companyId ? (
            <p className="mt-1 text-[10px] text-amber-600">Se moverá desde «{editingMem.companyName}» al guardar.</p>
          ) : null}
        </div>
        <div>
          <label className={label}>Rol en ese negocio</label>
          <select
            className={field}
            value={draft.membershipRole ?? "EMPLOYEE"}
            onChange={(e) => set("membershipRole", e.target.value as UserRole)}
          >
            {TENANT_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleDisplayLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Empresa principal (login por defecto)</label>
          <select
            className={field}
            value={draft.primaryCompanyId ?? ""}
            onChange={(e) => set("primaryCompanyId", Number(e.target.value))}
          >
            {user.memberships.map((m) => (
              <option key={m.membershipId} value={m.companyId}>
                #{m.companyId} — {m.companyName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Email</label>
          <input className={field} value={draft.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className={label}>Contraseña nueva (opcional)</label>
          <input
            type="password"
            className={field}
            placeholder="Mín. 8 caracteres"
            value={draft.newPassword ?? ""}
            onChange={(e) => set("newPassword", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Nombre</label>
          <input className={field} value={draft.firstName ?? ""} onChange={(e) => set("firstName", e.target.value)} />
        </div>
        <div>
          <label className={label}>Apellidos</label>
          <input className={field} value={draft.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)} />
        </div>
        <div>
          <label className={label}>DNI / NIE</label>
          <input className={field} value={draft.nationalId ?? ""} onChange={(e) => set("nationalId", e.target.value)} />
        </div>
        <div>
          <label className={label}>Puesto</label>
          <input className={field} value={draft.jobTitle ?? ""} onChange={(e) => set("jobTitle", e.target.value)} />
        </div>
        <div>
          <label className={label}>Rol global</label>
          <select
            className={field}
            value={draft.globalRole ?? "EMPLOYEE"}
            onChange={(e) => set("globalRole", e.target.value as AppRole)}
          >
            {GLOBAL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r} — {roleDisplayLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Nota de horario</label>
          <textarea
            rows={2}
            className={`${field} resize-none`}
            value={draft.workScheduleNote ?? ""}
            onChange={(e) => set("workScheduleNote", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id={`active-${user.userId}`}
            type="checkbox"
            checked={draft.active ?? true}
            onChange={(e) => set("active", e.target.checked)}
            className="rounded border-slate-300"
          />
          <label htmlFor={`active-${user.userId}`} className="text-xs font-medium text-slate-700">
            Cuenta activa (puede iniciar sesión)
          </label>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Añadir a otro negocio</p>
        <div className="flex flex-wrap gap-2">
          <select className={`${field} flex-1 min-w-[140px]`} value={addCompanyId} onChange={(e) => setAddCompanyId(Number(e.target.value))}>
            {companies
              .filter((c) => !user.memberships.some((m) => m.companyId === c.companyId))
              .map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.companyName}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={addMemMut.isPending}
            onClick={() => addMemMut.mutate()}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-600 shadow-sm ring-1 ring-slate-200 hover:bg-indigo-50 disabled:opacity-50"
          >
            <UserPlus size={14} className="inline mr-1" />
            Añadir
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap gap-2">
          {!user.active ? (
            <button
              type="button"
              onClick={() => unlockMut.mutate()}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <Unlock size={14} />
              Reactivar
            </button>
          ) : null}
          {user.memberships.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`¿Quitar a este usuario del negocio «${editingMem?.companyName}»?`)) {
                  deleteMemMut.mutate();
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              Quitar de este negocio
            </button>
          ) : null}
          {user.globalRole !== "DEV" ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Eliminar usuario y todas sus membresías? Esta acción no se puede deshacer.")) {
                  deleteUserMut.mutate();
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
              Eliminar usuario
            </button>
          ) : null}
        </div>
        <button
          type="button"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </div>
    </article>
  );
}

function CreateUserForm({
  companies,
  onCreated,
}: {
  companies: DevCompanySummary[];
  onCreated: () => void;
}) {
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DevCreateUserInput>({
    email: "",
    password: "",
    companyId: companies[0]?.companyId ?? 0,
    membershipRole: "EMPLOYEE",
  });

  const mut = useMutation({
    mutationFn: () => devApi.createUser(token!, draft),
    onSuccess: () => {
      notify.success("Usuario creado");
      setOpen(false);
      setDraft({ email: "", password: "", companyId: companies[0]?.companyId ?? 0, membershipRole: "EMPLOYEE" });
      onCreated();
    },
    onError: (e: Error) => notify.error(e.message),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-200 bg-white py-4 text-sm font-semibold text-violet-600 hover:border-violet-400 hover:bg-violet-50/50"
      >
        <UserPlus size={16} />
        Nuevo usuario
      </button>
    );
  }

  return (
    <article className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
      <h3 className="mb-3 text-sm font-bold text-violet-900">Crear usuario</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Email *</label>
          <input className={field} value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Contraseña *</label>
          <input
            type="password"
            className={field}
            value={draft.password}
            onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
          />
        </div>
        <div>
          <label className={label}>Negocio inicial *</label>
          <select
            className={field}
            value={draft.companyId}
            onChange={(e) => setDraft((d) => ({ ...d, companyId: Number(e.target.value) }))}
          >
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Rol en negocio</label>
          <select
            className={field}
            value={draft.membershipRole ?? "EMPLOYEE"}
            onChange={(e) => setDraft((d) => ({ ...d, membershipRole: e.target.value as UserRole }))}
          >
            {TENANT_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleDisplayLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Nombre</label>
          <input className={field} value={draft.firstName ?? ""} onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Apellidos</label>
          <input className={field} value={draft.lastName ?? ""} onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))} />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-white">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!draft.email.trim() || draft.password.length < 8 || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Crear
        </button>
      </div>
    </article>
  );
}

function companyToDraft(c: DevCompanySummary): DevCompanyUpsertInput {
  return {
    name: c.companyName,
    taxId: c.taxId,
    city: c.city,
    country: c.country,
    businessEmail: c.businessEmail,
    businessPhone: c.businessPhone,
    addressLine: c.addressLine,
    subscriptionTier: c.subscriptionTier,
  };
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function DevConsolePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    if (role && !canAccessDevConsole(role)) {
      router.replace("/dashboard");
    }
  }, [role, router]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dev-console"],
    queryFn: () => devApi.getConsole(token!),
    enabled: !!token && canAccessDevConsole(role),
  });

  const onSaved = () => invalidateConsole(queryClient);

  const filteredCompanies = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.companies;
    return data.companies.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        (c.taxId ?? "").toLowerCase().includes(q) ||
        String(c.companyId).includes(q)
    );
  }, [data, search]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.firstName ?? "").toLowerCase().includes(q) ||
        (u.lastName ?? "").toLowerCase().includes(q) ||
        u.memberships.some(
          (m) => m.companyName.toLowerCase().includes(q) || String(m.companyId).includes(q)
        )
    );
  }, [data, search]);

  if (!canAccessDevConsole(role)) {
    return null;
  }

  return (
    <ErpPageShell>
      <AppTopHeader />
      <main className="flex-1 min-h-0 overflow-y-auto bg-slate-100/80 pb-10">
        <div className="border-b border-slate-800 bg-slate-900 px-4 py-6 text-white sm:px-7">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
              <Database size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-violet-300" />
                <h1 className="text-xl font-bold tracking-tight">Consola DEV</h1>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Gestión de plataforma: negocios (tenants) y usuarios por separado. Mueve usuarios entre empresas,
                reactiva cuentas, resetea contraseñas o elimina datos con confirmación.
              </p>
            </div>
          </div>
          {data ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <StatPill label="Negocios" value={data.companyCount} />
              <StatPill label="Membresías" value={data.membershipCount} />
              <StatPill label="Usuarios" value={data.distinctUserCount} />
            </div>
          ) : null}
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-7">
          <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users} label="Usuarios" />
            <TabButton active={tab === "companies"} onClick={() => setTab("companies")} icon={Building2} label="Negocios" />
          </div>

          <div className="relative mb-6">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "users"
                  ? "Buscar por email, nombre o negocio…"
                  : "Buscar negocio por nombre, NIF o ID…"
              }
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm outline-none focus:border-indigo-500"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20 text-slate-500">
              <Loader2 className="animate-spin" size={28} />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
              No se pudo cargar la consola.{" "}
              <button type="button" className="font-semibold underline" onClick={() => refetch()}>
                Reintentar
              </button>
            </div>
          ) : tab === "companies" ? (
            <div className="space-y-4">
              <CreateCompanyForm onCreated={onSaved} />
              {filteredCompanies.map((c) => (
                <CompanyCard key={c.companyId} company={c} onSaved={onSaved} />
              ))}
              {filteredCompanies.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">Sin negocios</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <CreateUserForm companies={data?.companies ?? []} onCreated={onSaved} />
              {filteredUsers.map((u) => (
                <UserCard key={u.userId} user={u} companies={data?.companies ?? []} onSaved={onSaved} />
              ))}
              {filteredUsers.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">Sin usuarios</p>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </ErpPageShell>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
        active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/10 px-4 py-2 backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
