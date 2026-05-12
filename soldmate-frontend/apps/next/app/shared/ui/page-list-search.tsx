"use client";

import { Search } from "lucide-react";

/**
 * Búsqueda local de listas (mismo aspecto que el campo del header, sin ⌘K).
 * El header (`AppTopHeader`) solo abre la búsqueda global; el filtrado en página va aquí.
 */
export function PageListSearchField({
  value,
  onChange,
  placeholder = "Buscar…",
  className = "",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className={`relative flex w-full max-w-md items-center ${className}`.trim()}>
      <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="w-full rounded-xl border border-gray-100 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-[#4f6ef7]"
        placeholder={placeholder}
      />
    </div>
  );
}
