"use client";

import React from "react";
import { useAuthStore } from "app/lib/store";

function formatTodayEs(): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

export function AppTopHeader() {
  const firstName = useAuthStore((s) => s.firstName);
  const email = useAuthStore((s) => s.email);
  const displayName = firstName || email || "Usuario";

  return (
    <header className="flex-shrink-0 px-7 py-4 flex items-center justify-between gap-4">
      <p className="text-sm text-gray-500 capitalize">{formatTodayEs()}</p>
      <h1 className="text-xl font-bold text-[#1e2040]">Bienvenido, {displayName}</h1>
    </header>
  );
}
