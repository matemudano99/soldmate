"use client";

import React, { useState } from "react";
import {
  FileText, FileSpreadsheet, Image, File, Upload,
  Search, Download, Eye, MoreVertical, ChevronRight,
} from "lucide-react";
import { UploadDocumentModal, WebErpNavbar } from "../shared/ui";

// ─── Mock Data ────────────────────────────────────────────────────────────────

type DocType = "pdf" | "xlsx" | "img" | "other";

interface Doc {
  id: string;
  name: string;
  category: string;
  type: DocType;
  size: string;
  date: string;
  author: string;
  avatar: string;
}

const DOCS: Doc[] = [
  { id: "D-001", name: "Contrato proveedor Frutas Martínez",  category: "Contratos",  type: "pdf",   size: "248 KB", date: "28 Abr 2026", author: "María G.",  avatar: "https://i.pravatar.cc/24?img=5"  },
  { id: "D-002", name: "Inventario cierre Abril 2026",        category: "Inventario", type: "xlsx",  size: "92 KB",  date: "30 Abr 2026", author: "Carlos R.", avatar: "https://i.pravatar.cc/24?img=3"  },
  { id: "D-003", name: "Factura Bebidas Ibérica #44",         category: "Facturas",   type: "pdf",   size: "128 KB", date: "27 Abr 2026", author: "María G.",  avatar: "https://i.pravatar.cc/24?img=5"  },
  { id: "D-004", name: "Foto avería frigorífico",             category: "Incidencias",type: "img",   size: "1.4 MB", date: "25 Abr 2026", author: "Luis P.",   avatar: "https://i.pravatar.cc/24?img=8"  },
  { id: "D-005", name: "Informe semanal KPIs",                category: "Informes",   type: "pdf",   size: "380 KB", date: "22 Abr 2026", author: "Carlos R.", avatar: "https://i.pravatar.cc/24?img=3"  },
  { id: "D-006", name: "Presupuesto reforma cocina",          category: "Contratos",  type: "pdf",   size: "215 KB", date: "20 Abr 2026", author: "María G.",  avatar: "https://i.pravatar.cc/24?img=5"  },
  { id: "D-007", name: "Hoja de salarios Abril",              category: "RRHH",       type: "xlsx",  size: "64 KB",  date: "18 Abr 2026", author: "Carlos R.", avatar: "https://i.pravatar.cc/24?img=3"  },
  { id: "D-008", name: "Menú temporada primavera",            category: "Informes",   type: "img",   size: "2.1 MB", date: "15 Abr 2026", author: "Luis P.",   avatar: "https://i.pravatar.cc/24?img=8"  },
  { id: "D-009", name: "Póliza seguro local 2026",            category: "Contratos",  type: "pdf",   size: "502 KB", date: "10 Abr 2026", author: "María G.",  avatar: "https://i.pravatar.cc/24?img=5"  },
  { id: "D-010", name: "Acta reunión equipo Marzo",           category: "RRHH",       type: "other", size: "38 KB",  date: "05 Abr 2026", author: "Carlos R.", avatar: "https://i.pravatar.cc/24?img=3"  },
];

const TYPE_META: Record<DocType, { Icon: React.ElementType; bg: string; text: string; ext: string }> = {
  pdf:   { Icon: FileText,        bg: "bg-red-50",    text: "text-red-500",   ext: "PDF"  },
  xlsx:  { Icon: FileSpreadsheet, bg: "bg-green-50",  text: "text-green-600", ext: "XLSX" },
  img:   { Icon: Image,           bg: "bg-blue-50",   text: "text-blue-500",  ext: "IMG"  },
  other: { Icon: File,            bg: "bg-gray-100",  text: "text-gray-500",  ext: "DOC"  },
};

const STORAGE_STATS = [
  { label: "Documentos",     value: "10",    color: "bg-[#4f6ef7]" },
  { label: "Almacenamiento", value: "5.2 MB",color: "bg-emerald-400" },
  { label: "Esta semana",    value: "3 nuevos", color: "bg-amber-400" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [docs, setDocs] = useState(DOCS);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const categories = ["Todos", ...Array.from(new Set(docs.map((d) => d.category)))];

  const filtered = docs.filter((d) => {
    const matchCat = activeCategory === "Todos" || d.category === activeCategory;
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex min-h-screen bg-[#eef1f8] text-[#1e2040]">
      <WebErpNavbar />

      <main className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e2040]">Documentos</h1>
            <p className="text-sm text-gray-400 mt-0.5">Repositorio centralizado del negocio</p>
          </div>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-[#4f6ef7] text-white rounded-xl px-4 py-2.5 text-sm font-semibold shadow-[0_4px_15px_rgba(79,110,247,0.30)] hover:bg-[#3d5ae0] transition-all">
            <Upload size={15} />
            Subir documento
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {STORAGE_STATS.map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-3.5 shadow-[0_2px_10px_rgba(149,157,165,0.08)] border border-gray-50 flex items-center gap-3">
              <div className={`w-2 h-8 rounded-full flex-shrink-0 ${s.color}`} />
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{s.label}</p>
                <p className="text-base font-bold text-[#1e2040] mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          {/* Left: filters */}
          <div className="w-44 flex-shrink-0 space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Categorías</p>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-[#4f6ef7] text-white shadow-sm"
                    : "text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm"
                }`}
              >
                <span>{cat}</span>
                {activeCategory === cat
                  ? <ChevronRight size={13} className="opacity-70" />
                  : <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeCategory === cat ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"
                    }`}>
                      {cat === "Todos" ? docs.length : docs.filter((d) => d.category === cat).length}
                    </span>
                }
              </button>
            ))}
          </div>

          {/* Right: document list */}
          <div className="flex-1 min-w-0">
            {/* Search */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar documento..."
                className="w-full bg-white border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1e2040] placeholder:text-gray-400 outline-none focus:border-[#4f6ef7] shadow-sm transition-colors"
              />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                <span className="w-9" />
                <span>Nombre</span>
                <span>Fecha</span>
                <span>Tamaño</span>
                <span className="w-16 text-center">Acciones</span>
              </div>

              {filtered.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-gray-400">
                  <FileText size={32} className="mb-3 opacity-40" />
                  <p className="text-sm font-medium">No se encontraron documentos</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map((doc) => {
                    const meta = TYPE_META[doc.type];
                    return (
                      <div
                        key={doc.id}
                        onMouseEnter={() => setHoveredId(doc.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-[#fafbff] transition-colors"
                      >
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg} flex-shrink-0`}>
                          <meta.Icon size={16} className={meta.text} />
                        </div>

                        {/* Name + meta */}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1e2040] truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>
                              {meta.ext}
                            </span>
                            <span className="text-[10px] text-gray-400">{doc.category}</span>
                            <span className="text-[10px] text-gray-300">·</span>
                            <div className="flex items-center gap-1">
                              <img src={doc.avatar} alt={doc.author} className="w-3.5 h-3.5 rounded-full" />
                              <span className="text-[10px] text-gray-400">{doc.author}</span>
                            </div>
                          </div>
                        </div>

                        {/* Date */}
                        <span className="text-xs text-gray-400 whitespace-nowrap">{doc.date}</span>

                        {/* Size */}
                        <span className="text-xs text-gray-400 whitespace-nowrap">{doc.size}</span>

                        {/* Actions */}
                        <div className={`flex items-center gap-1.5 transition-opacity w-16 justify-center ${
                          hoveredId === doc.id ? "opacity-100" : "opacity-0"
                        }`}>
                          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <Eye size={13} />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <Download size={13} />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreVertical size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      {showUpload && (
        <UploadDocumentModal
          onClose={() => setShowUpload(false)}
          onCreate={(payload) => {
            const now = new Date();
            const date = now.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
            setDocs((prev) => [
              {
                id: `D-${String(prev.length + 1).padStart(3, "0")}`,
                name: payload.name,
                category: payload.category,
                type: payload.type,
                size: payload.size,
                date,
                author: "Tú",
                avatar: "https://i.pravatar.cc/24?img=1",
              },
              ...prev,
            ]);
          }}
        />
      )}
    </div>
  );
}
