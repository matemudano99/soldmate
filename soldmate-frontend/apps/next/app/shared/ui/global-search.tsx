"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, Wrench, Truck, FileText, X, Loader2 } from "lucide-react";
import { searchApi, type SearchResult } from "app/lib/api";
import { useAuthStore } from "app/lib/store";

const TYPE_ICON: Record<SearchResult["type"], React.ReactNode> = {
  PRODUCT: <Package size={14} className="text-blue-500" />,
  INCIDENT: <Wrench size={14} className="text-orange-500" />,
  SUPPLIER: <Truck size={14} className="text-purple-500" />,
  DOCUMENT: <FileText size={14} className="text-red-500" />,
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  PRODUCT: "Producto",
  INCIDENT: "Incidencia",
  SUPPLIER: "Proveedor",
  DOCUMENT: "Documento",
};

export function GlobalSearchModal({ onClose }: { onClose: () => void }) {
  const token = useAuthStore((s) => s.token);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      if (!token) return;
      setLoading(true);
      try {
        const r = await searchApi.search(token, query);
        setResults(r);
        setSelected(0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, token]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && results[selected]) { navigate(results[selected].href); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [results, selected, navigate, onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-[10vh] bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.18)] w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar productos, incidencias, proveedores..."
            className="flex-1 text-sm outline-none placeholder:text-gray-400 text-[#1e2040]"
          />
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>

        {query.length >= 2 && (
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {results.length === 0 && !loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin resultados para «{query}»</p>
            ) : (
              results.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(r.href)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    i === selected ? "bg-[#f0f3ff]" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {TYPE_ICON[r.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1e2040] truncate">{r.title}</p>
                    <p className="text-xs text-gray-400 truncate">{r.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {TYPE_LABEL[r.type]}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {!query && (
          <div className="px-4 py-4">
            <p className="text-xs text-gray-400 text-center">Escribe al menos 2 caracteres para buscar</p>
            <p className="text-xs text-gray-300 text-center mt-1">↑↓ navegar · Enter seleccionar · Esc cerrar</p>
          </div>
        )}
      </div>
    </div>
  );
}
