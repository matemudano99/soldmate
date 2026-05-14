"use client";

import React, { useState, useEffect } from "react";
import {
  FileText, FileSpreadsheet, Image as ImageIcon, File, Upload,
  Search, Download, Eye, MoreVertical, ChevronRight, Trash2, Edit3, X
} from "lucide-react";
import { AppTopHeader, UploadDocumentModal, ErpPageShell, notify, useConfirm, PageListSearchField } from "../shared/ui";
import {
  documentsApi,
  usersApi,
  type DocumentResponse,
  type DocumentCategoryResponse,
  type DocumentStatsResponse,
  type UserListResponse,
} from "../shared/api";
import { useAuthStore } from "app/lib/store";
import { canDeleteDocuments, canManageDocumentCategories, canUploadDocuments } from "app/lib/rbac";

// Configuración visual por tipo de documento
const TYPE_META: Record<string, { Icon: React.ElementType; bg: string; text: string; ext: string }> = {
  PDF:   { Icon: FileText,        bg: "bg-red-50",    text: "text-red-500",   ext: "PDF"  },
  XLSX:  { Icon: FileSpreadsheet, bg: "bg-green-50",  text: "text-green-600", ext: "XLSX" },
  IMG:   { Icon: ImageIcon,       bg: "bg-blue-50",   text: "text-blue-500",  ext: "IMG"  },
  DOCX:  { Icon: FileText,        bg: "bg-blue-50",   text: "text-blue-600",  ext: "DOCX" },
  PPTX:  { Icon: File,            bg: "bg-orange-50", text: "text-orange-500",ext: "PPTX" },
  ZIP:   { Icon: File,            bg: "bg-yellow-50", text: "text-yellow-600",ext: "ZIP"  },
  VIDEO: { Icon: File,            bg: "bg-purple-50", text: "text-purple-500",ext: "VIDEO"},
  AUDIO: { Icon: File,            bg: "bg-pink-50",   text: "text-pink-500",  ext: "AUDIO"},
  TXT:   { Icon: FileText,        bg: "bg-gray-100",  text: "text-gray-600",  ext: "TXT"  },
  OTHER: { Icon: File,            bg: "bg-gray-100",  text: "text-gray-500",  ext: "DOC"  },
};

export default function DocumentsPage() {
  const { token, role } = useAuthStore();
  const canManageCats = canManageDocumentCategories(role);
  const canDeleteDocs = canDeleteDocuments(role);
  const canUpload = canUploadDocuments(role);

  const [docs, setDocs] = useState<DocumentResponse[]>([]);
  const [categories, setCategories] = useState<DocumentCategoryResponse[]>([]);
  const [stats, setStats] = useState<DocumentStatsResponse | null>(null);
  const [companyUsers, setCompanyUsers] = useState<UserListResponse[]>([]);

  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Modal de Categoría
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DocumentCategoryResponse | null>(null);
  const [catForm, setCatForm] = useState({ name: "", color: "#4f6ef7" });
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, activeCategory]);

  const loadData = async () => {
    if (!token) return;
    try {
      const [d, c, s, u] = await Promise.all([
        documentsApi.getAll(token, activeCategory === "Todos" ? undefined : activeCategory),
        documentsApi.getCategories(token),
        documentsApi.getStats(token),
        usersApi.getAll(token),
      ]);
      setDocs(d);
      setCategories(c);
      setStats(s);
      setCompanyUsers(u);
    } catch (err) {
      notify.error((err as Error)?.message ?? "Error al cargar documentos");
    }
  };

  const handleUpload = async (
    payload: {
      name: string;
      category: string;
      type: string;
      size: string;
      linkedUserId?: number | null;
    },
    file?: File
  ) => {
    if (!token || !file) return;
    const id = notify.loading("Subiendo documento...");
    try {
      await documentsApi.upload(
        token,
        file,
        payload.name,
        payload.category,
        payload.linkedUserId ?? undefined
      );
      notify.dismiss(id);
      notify.success("Documento subido correctamente");
      await loadData();
    } catch (err) {
      notify.dismiss(id);
      notify.error((err as Error)?.message ?? "Error al subir el documento");
    }
  };

  const handleDelete = async (docId: number) => {
    if (!token) return;
    const ok = await confirm("¿Eliminar documento?", "Esta acción no se puede deshacer.", "danger");
    if (!ok) return;
    try {
      await documentsApi.remove(token, docId);
      notify.success("Documento eliminado");
      await loadData();
    } catch (err) {
      notify.error((err as Error)?.message ?? "Error al eliminar documento");
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !catForm.name.trim()) return;
    try {
      if (editingCategory) {
        await documentsApi.updateCategory(token, editingCategory.id, catForm);
        notify.success("Categoría actualizada");
      } else {
        await documentsApi.createCategory(token, catForm.name, catForm.color);
        notify.success("Categoría creada");
      }
      setShowCategoryModal(false);
      await loadData();
    } catch (err) {
      notify.error((err as Error)?.message ?? "Error al guardar categoría");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!token) return;
    const ok = await confirm("¿Eliminar categoría?", "Los documentos de esta categoría quedarán sin categoría.", "warning");
    if (!ok) return;
    try {
      await documentsApi.removeCategory(token, id);
      notify.success("Categoría eliminada");
      if (categories.find(c => c.id === id)?.name === activeCategory) {
        setActiveCategory("Todos");
      } else {
        await loadData();
      }
    } catch (err) {
      notify.error((err as Error)?.message ?? "Error al eliminar categoría");
    }
  };

  const filtered = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  const formatSize = (bytes: number | null) => {
    if (bytes == null) return "-";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const parseDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <ErpPageShell>
        <AppTopHeader />
        <main className="flex-1 min-h-0 overflow-y-auto pb-6">
        <div className="px-4 sm:px-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1e2040]">Documentos</h1>
              <p className="text-sm text-gray-400 mt-0.5">Repositorio centralizado del negocio</p>
            </div>
            <button 
              onClick={() => setShowUpload(true)} 
              disabled={!canUpload}
              className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#4f6ef7] text-white rounded-xl px-4 py-3 sm:py-2.5 text-sm font-semibold shadow-[0_4px_15px_rgba(79,110,247,0.30)] hover:bg-[#3d5ae0] transition-all w-full sm:w-auto min-h-[44px] disabled:opacity-50 disabled:pointer-events-none"
            >
              <Upload size={15} />
              Subir documento
            </button>
          </div>

          <div className="mb-5">
            <PageListSearchField value={search} onChange={setSearch} placeholder="Buscar documentos por nombre…" />
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl p-3.5 shadow-[0_2px_10px_rgba(149,157,165,0.08)] border border-gray-50 flex items-center gap-3 min-w-0">
              <div className="w-2 h-8 rounded-full flex-shrink-0 bg-[#4f6ef7]" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider truncate">Documentos</p>
                <p className="text-base font-bold text-[#1e2040] mt-0.5">{stats?.totalDocuments ?? 0}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-3.5 shadow-[0_2px_10px_rgba(149,157,165,0.08)] border border-gray-50 flex items-center gap-3 min-w-0">
              <div className="w-2 h-8 rounded-full flex-shrink-0 bg-emerald-400" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Almacenamiento</p>
                <p className="text-base font-bold text-[#1e2040] mt-0.5 truncate">{stats?.totalSizeHuman ?? "0 B"}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-3.5 shadow-[0_2px_10px_rgba(149,157,165,0.08)] border border-gray-50 flex items-center gap-3 min-w-0">
              <div className="w-2 h-8 rounded-full flex-shrink-0 bg-amber-400" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Esta semana</p>
                <p className="text-base font-bold text-[#1e2040] mt-0.5">{stats?.newThisWeek ?? 0} nuevos</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Left: filters & categories */}
            <div className="w-full lg:w-44 lg:flex-shrink-0 space-y-1">
              <div className="flex items-center justify-between px-1 sm:px-3 mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Categorías</p>
                {canManageCats && (
                  <button 
                    onClick={() => { setEditingCategory(null); setCatForm({ name: "", color: "#4f6ef7" }); setShowCategoryModal(true); }}
                    className="text-xs text-[#4f6ef7] font-semibold hover:underline"
                  >
                    + Nueva
                  </button>
                )}
              </div>
              
              <div className="flex flex-row flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-0 lg:space-y-1">
              <button
                onClick={() => setActiveCategory("Todos")}
                className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 lg:w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === "Todos"
                    ? "bg-[#4f6ef7] text-white shadow-sm"
                    : "text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm bg-white/80 border border-gray-100 lg:border-0 lg:bg-transparent"
                }`}
              >
                <span>Todos</span>
                {activeCategory === "Todos" && <ChevronRight size={13} className="opacity-70 flex-shrink-0" />}
              </button>

              {categories.map((cat) => (
                <div key={cat.id} className="group relative flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-[140px] lg:min-w-0 lg:w-full">
                  <button
                    onClick={() => setActiveCategory(cat.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activeCategory === cat.name
                        ? "bg-[#4f6ef7] text-white shadow-sm"
                        : "text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm bg-white/80 border border-gray-100 lg:border-0 lg:bg-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || "#ccc" }} />
                      <span className="truncate lg:max-w-[90px]">{cat.name}</span>
                    </div>
                    {activeCategory === cat.name && <ChevronRight size={13} className="opacity-70 flex-shrink-0" />}
                  </button>
                  {canManageCats && activeCategory !== cat.name && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white rounded-md shadow-sm border border-gray-100 p-0.5">
                      <button onClick={() => { setEditingCategory(cat); setCatForm({ name: cat.name, color: cat.color || "#4f6ef7" }); setShowCategoryModal(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-500"><Edit3 size={12} /></button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>

            {/* Right: document list */}
            <div className="flex-1 min-w-0 lg:min-w-0">
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

              {/* Lista móvil (tarjetas) */}
              <div className="lg:hidden space-y-3">
                {filtered.length === 0 ? (
                  <div className="bg-white rounded-2xl py-14 flex flex-col items-center justify-center text-gray-400 border border-gray-50 shadow-sm">
                    <FileText size={32} className="mb-3 opacity-40" />
                    <p className="text-sm font-medium">No se encontraron documentos</p>
                  </div>
                ) : (
                  filtered.map((doc) => {
                    const meta = TYPE_META[doc.docType] || TYPE_META.OTHER;
                    return (
                      <div
                        key={doc.id}
                        className="bg-white rounded-2xl border border-gray-50 shadow-[0_2px_12px_rgba(149,157,165,0.08)] p-4 flex gap-3"
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.bg} flex-shrink-0`}>
                          <meta.Icon size={18} className={meta.text} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1e2040] break-words" title={doc.name}>{doc.name}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-gray-500">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>{meta.ext}</span>
                            <span>{parseDate(doc.createdAt)}</span>
                            <span className="text-gray-300">·</span>
                            <span>{formatSize(doc.fileSize)}</span>
                          </div>
                          {doc.category ? (
                            <p className="text-[10px] text-gray-400 mt-1">{doc.category}</p>
                          ) : null}
                          {doc.linkedUserName ? (
                            <p className="text-[10px] text-[#4f6ef7] mt-0.5 font-medium">
                              Vinculado: {doc.linkedUserName}
                            </p>
                          ) : null}
                          <div className="flex items-center justify-between gap-2 mt-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {doc.uploaderAvatarUrl ? (
                                <img src={doc.uploaderAvatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                                  {doc.uploaderName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="text-xs text-gray-500 truncate">{doc.uploaderName}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-xl bg-[#f0f3ff] text-[#4f6ef7]"
                                title="Ver / Descargar"
                              >
                                <Eye size={16} />
                              </a>
                              {canDeleteDocs ? (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(doc.id)}
                                  className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-xl bg-red-50 text-red-500"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Tabla escritorio */}
                <div className="hidden lg:block bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  <span className="w-9" />
                  <span>Nombre</span>
                  <span>Vinculado</span>
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
                      const meta = TYPE_META[doc.docType] || TYPE_META.OTHER;
                      return (
                        <div
                          key={doc.id}
                          onMouseEnter={() => setHoveredId(doc.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-[#fafbff] transition-colors"
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg} flex-shrink-0`}>
                            <meta.Icon size={16} className={meta.text} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1e2040] truncate" title={doc.name}>{doc.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>
                                {meta.ext}
                              </span>
                              {doc.category && <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{doc.category}</span>}
                              <span className="text-[10px] text-gray-300">·</span>
                              <div className="flex items-center gap-1">
                                {doc.uploaderAvatarUrl ? (
                                  <img src={doc.uploaderAvatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500">
                                    {doc.uploaderName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{doc.uploaderName}</span>
                              </div>
                            </div>
                          </div>

                          <span className="text-xs text-gray-500 truncate max-w-[120px]" title={doc.linkedUserName ?? ""}>
                            {doc.linkedUserName ?? "—"}
                          </span>

                          <span className="text-xs text-gray-400 whitespace-nowrap">{parseDate(doc.createdAt)}</span>

                          <span className="text-xs text-gray-400 whitespace-nowrap">{formatSize(doc.fileSize)}</span>

                          <div className={`flex items-center gap-1.5 transition-opacity w-16 justify-center ${
                            hoveredId === doc.id ? "opacity-100" : "opacity-0"
                          }`}>
                            <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#4f6ef7] transition-colors" title="Ver / Descargar">
                              <Eye size={13} />
                            </a>
                            {canDeleteDocs && (
                              <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Subida de Documentos (ahora adaptado para recibir File) */}
      {showUpload && (
        <UploadDocumentModalReal 
          onClose={() => setShowUpload(false)}
          onUpload={handleUpload}
          categories={categories}
          users={companyUsers}
        />
      )}

      {/* Modal de Categoría */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-[#1e2040]">{editingCategory ? "Editar categoría" : "Nueva categoría"}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Nombre</label>
                <input autoFocus value={catForm.name} onChange={e => setCatForm(s => ({ ...s, name: e.target.value }))} required className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]" placeholder="Ej: Facturas" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Color</label>
                <div className="flex gap-2">
                  <input type="color" value={catForm.color} onChange={e => setCatForm(s => ({ ...s, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                  <input type="text" value={catForm.color} onChange={e => setCatForm(s => ({ ...s, color: e.target.value }))} className="flex-1 border rounded-xl px-3 py-2 text-sm outline-none focus:border-[#4f6ef7]" />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#4f6ef7] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#3d5ae0]">
                Guardar
              </button>
            </form>
          </div>
        </div>
      )}
      {confirmDialog}
    </ErpPageShell>
  );
}

// Componente helper para el modal real de subida (con soporte de archivo)
function UploadDocumentModalReal({
  onClose,
  onUpload,
  categories,
  users,
}: {
  onClose: () => void;
  onUpload: (payload: any, file?: File) => void;
  categories: DocumentCategoryResponse[];
  users: UserListResponse[];
}) {
  const [form, setForm] = useState({ name: "", category: "", linkedUserId: "" });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userLabel = (u: UserListResponse) => {
    const n = (u.fullName && u.fullName.trim()) || [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    return n || u.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { notify.error("Selecciona un archivo"); return; }
    setSubmitting(true);
    const linked =
      form.linkedUserId && form.linkedUserId !== ""
        ? Number(form.linkedUserId)
        : null;
    await onUpload(
      { name: form.name, category: form.category, type: "other", size: "0", linkedUserId: linked },
      file
    );
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div>
            <h2 className="text-base font-bold text-[#1e2040]">Subir documento</h2>
            <p className="text-xs text-gray-400 mt-0.5">Selecciona un archivo de tu equipo</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Archivo *</label>
            <input type="file" required onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#4f6ef7]/10 file:text-[#4f6ef7] hover:file:bg-[#4f6ef7]/20" />
            <p className="text-[10px] text-gray-400 mt-1.5">Máximo 50 MB</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Nombre (opcional)</label>
            <input value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]" placeholder="Ej: Contrato de alquiler" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Categoría</label>
            <select value={form.category} onChange={e => setForm(s => ({ ...s, category: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]">
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Usuario vinculado (opcional)</label>
            <select
              value={form.linkedUserId}
              onChange={(e) => setForm((s) => ({ ...s, linkedUserId: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#4f6ef7]"
            >
              <option value="">Ninguno</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {userLabel(u)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-500 border rounded-xl hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={submitting || !file} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#4f6ef7] rounded-xl hover:bg-[#3d5ae0] disabled:opacity-50">
              {submitting ? "Subiendo..." : "Subir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
