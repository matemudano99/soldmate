"use client";

import React from "react";
import { User } from "lucide-react";
import { getPresenceStatus } from "app/lib/presence";

export type UserAvatarPresenceProps = {
  name: string;
  avatarUrl?: string | null;
  lastSeenAt?: string | null;
  active?: boolean;
  presenceOptions?: { isSelf?: boolean; locallyOnline?: boolean };
  size?: number;
  className?: string;
};

export function UserAvatarPresence({
  name,
  avatarUrl,
  lastSeenAt = null,
  active = true,
  presenceOptions,
  size = 40,
  className = "",
}: UserAvatarPresenceProps) {
  const presence = getPresenceStatus(lastSeenAt, active, presenceOptions);
  const dotSize = size <= 36 ? "w-2 h-2" : "w-2.5 h-2.5";

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="rounded-full object-cover ring-2 ring-white shadow-sm w-full h-full"
        />
      ) : (
        <div className="rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center shadow-sm w-full h-full">
          <User className="text-blue-300" size={Math.round(size * 0.45)} />
        </div>
      )}
      <span
        className={`absolute -bottom-0.5 -right-0.5 ${dotSize} rounded-full border-2 border-white ${presence.color}`}
        title={presence.label}
      />
    </div>
  );
}
