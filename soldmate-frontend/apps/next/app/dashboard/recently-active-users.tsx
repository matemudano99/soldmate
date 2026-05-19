"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { usersApi, type UserListResponse } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import {
  formatLastSeenRelative,
  isRecentlyActive,
  isSameUserId,
  parseLastSeenAt,
} from "app/lib/presence";
import { usePresenceStore } from "app/lib/presence-store";
import { userDisplayName } from "app/lib/user-display";
import { UserAvatarPresence } from "../shared/ui/user-avatar-presence";
import { SectionCard } from "../shared/ui";

function sortByRecentActivity(a: UserListResponse, b: UserListResponse): number {
  const ta = a.lastSeenAt ? parseLastSeenAt(a.lastSeenAt) : 0;
  const tb = b.lastSeenAt ? parseLastSeenAt(b.lastSeenAt) : 0;
  return tb - ta;
}

export function RecentlyActiveUsers() {
  const token = useAuthStore((s) => s.token);
  const currentUserId = useAuthStore((s) => s.userId);
  const isLocallyOnline = usePresenceStore((s) => s.isLocallyOnline);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", token],
    queryFn: () => usersApi.getAll(token!),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const activeUsers = useMemo(() => {
    return users
      .filter((u) => {
        if (!u.active) return false;
        const self = isSameUserId(u.id, currentUserId);
        const local = isLocallyOnline(u.id);
        return isRecentlyActive(u.lastSeenAt, { locallyOnline: local || self });
      })
      .sort(sortByRecentActivity)
      .slice(0, 8);
  }, [users, currentUserId, isLocallyOnline]);

  return (
    <SectionCard
      title="Usuarios recientemente activos"
      subtitle="Conectados en los últimos 5 minutos"
      compact
      className="min-h-0 flex flex-col"
    >
      {isLoading ? (
        <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p>
      ) : activeUsers.length > 0 ? (
        <ul className="space-y-2 flex-1">
          {activeUsers.map((u) => {
            const name = userDisplayName(u);
            const self = isSameUserId(u.id, currentUserId);
            return (
              <li key={u.id}>
                <Link
                  href="/people"
                  className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2 transition-colors hover:bg-indigo-50/50 hover:border-indigo-100"
                >
                  <UserAvatarPresence
                    name={name}
                    avatarUrl={u.avatarUrl}
                    lastSeenAt={u.lastSeenAt ?? null}
                    active={u.active}
                    presenceOptions={{
                      isSelf: self,
                      locallyOnline: isLocallyOnline(u.id),
                    }}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1e2040] truncate">{name}</p>
                    <p className="text-[11px] text-gray-500">
                      {self ? "Tú · en línea" : formatLastSeenRelative(u.lastSeenAt) || "En línea"}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500 flex-1 flex items-center justify-center">
          Nadie activo ahora. Los usuarios aparecerán al usar la app.
        </p>
      )}
      <div className="mt-4 border-t border-gray-100 pt-3 text-center">
        <Link
          href="/people"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4f6ef7] hover:underline"
        >
          <Users size={14} />
          Ver todos los usuarios
        </Link>
      </div>
    </SectionCard>
  );
}
