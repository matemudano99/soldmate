import React from "react";
import { LucideIcon } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string | number;
  Icon: LucideIcon;
  colorClass: string; // e.g., "text-emerald-600"
  bgClass: string; // e.g., "bg-emerald-50 border-emerald-100"
}

export function KpiCard({ label, value, Icon, colorClass, bgClass }: KpiCardProps) {
  return (
    <div className={`bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_16px_rgba(149,157,165,0.10)] border ${bgClass}`}>
      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
        <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider leading-snug flex-1 min-w-0">
          {label}
        </p>
        <Icon size={16} className={`${colorClass} flex-shrink-0`} />
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-[#1e2040]">{value}</p>
    </div>
  );
}
