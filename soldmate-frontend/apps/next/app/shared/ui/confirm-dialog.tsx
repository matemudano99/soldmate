"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const btnClass =
    variant === "danger"
      ? "bg-red-500 hover:bg-red-600 text-white"
      : variant === "warning"
        ? "bg-amber-500 hover:bg-amber-600 text-white"
        : "bg-[#4f6ef7] hover:bg-[#3d5ae0] text-white";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-6">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              variant === "danger"
                ? "bg-red-50"
                : variant === "warning"
                  ? "bg-amber-50"
                  : "bg-blue-50"
            }`}
          >
            <AlertTriangle
              size={18}
              className={
                variant === "danger"
                  ? "text-red-500"
                  : variant === "warning"
                    ? "text-amber-500"
                    : "text-[#4f6ef7]"
              }
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#1e2040] text-sm">{title}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description?: string;
    variant?: "danger" | "warning" | "info";
    resolve?: (ok: boolean) => void;
  }>({ open: false, title: "" });

  const confirm = React.useCallback(
    (title: string, description?: string, variant?: "danger" | "warning" | "info") =>
      new Promise<boolean>((resolve) => {
        setState({ open: true, title, description, variant, resolve });
      }),
    [],
  );

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      variant={state.variant}
      onConfirm={() => { setState((s) => ({ ...s, open: false })); state.resolve?.(true); }}
      onCancel={() => { setState((s) => ({ ...s, open: false })); state.resolve?.(false); }}
    />
  );

  return { confirm, dialog };
}
