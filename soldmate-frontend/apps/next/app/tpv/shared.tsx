"use client";

import React from "react";
import type { TpvChannel } from "app/lib/api";

export const money = (n: number | null | undefined) => `${(n ?? 0).toFixed(2)} €`;
export const todayIso = () => new Date().toLocaleDateString("en-CA");

export const CHANNEL_LABEL: Record<TpvChannel, string> = {
  DINE_IN: "En mesa",
  TAKEAWAY: "Para llevar",
  DELIVERY: "A domicilio",
};

export const DELIVERY_PLATFORMS = ["Glovo", "Just Eat", "Uber Eats", "Otra"];

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
  DELIVERY_PLATFORM: "Plataforma",
};

export const paymentLabel = (m: string) => PAYMENT_LABEL[m] ?? m;

/** Color pastel claro determinista por id de categoría (para teñir sus artículos). */
export function pastelFor(id: number): { bg: string; border: string } {
  const hue = ((id * 47) % 360 + 360) % 360;
  return { bg: `hsl(${hue} 70% 96%)`, border: `hsl(${hue} 55% 85%)` };
}

/** Fecha/hora legible a partir de un ISO; vacío si no hay valor. */
export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
};

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
        active
          ? "bg-[#4f6ef7] text-white border-[#4f6ef7]"
          : "bg-white text-gray-600 border-gray-200 hover:border-[#4f6ef7]"
      }`}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3 rounded-t-3xl">
          <div>
            <h3 className="text-lg font-bold text-[#1e2040]">{title}</h3>
            {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-1"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
