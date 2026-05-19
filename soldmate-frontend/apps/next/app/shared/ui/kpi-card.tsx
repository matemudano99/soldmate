import React from "react";
import { LucideIcon } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string | number;
  Icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  compact?: boolean;
}

export function KpiCard({ label, value, Icon, colorClass, bgClass, compact = false }: KpiCardProps) {
  return (
    <div
      className={`bg-white shadow-[0_2px_16px_rgba(149,157,165,0.10)] border ${bgClass} ${
        compact ? "rounded-xl p-3" : "rounded-2xl p-4 sm:p-5"
      }`}
    >
      <div className={`flex items-start justify-between gap-2 ${compact ? "mb-1.5" : "mb-2 sm:mb-3"}`}>
        <p
          className={`font-semibold text-gray-500 uppercase tracking-wider leading-snug flex-1 min-w-0 ${
            compact ? "text-[10px]" : "text-[11px] sm:text-xs"
          }`}
        >
          {label}
        </p>
        <Icon size={compact ? 14 : 16} className={`${colorClass} flex-shrink-0`} />
      </div>
      <p
        className={`font-bold text-[#1e2040] leading-tight ${
          compact ? "text-lg sm:text-xl line-clamp-2" : "text-2xl sm:text-3xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
