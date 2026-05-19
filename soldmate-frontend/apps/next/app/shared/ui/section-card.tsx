import React from "react";

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  compact?: boolean;
}

export function SectionCard({
  title,
  subtitle,
  children,
  className = "",
  noPadding = false,
  compact = false,
}: SectionCardProps) {
  return (
    <div
      className={`bg-white shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden ${
        compact ? "rounded-xl" : "rounded-2xl"
      } ${className}`}
    >
      {(title || subtitle) && (
        <div
          className={`border-b border-gray-50 ${compact ? "px-4 pt-3.5 pb-3" : "px-5 pt-5 pb-4"}`}
        >
          {title && (
            <h2 className={`font-semibold text-[#1e2040] ${compact ? "text-sm" : "text-base"}`}>{title}</h2>
          )}
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className={noPadding ? "" : compact ? "p-4" : "p-5"}>{children}</div>
    </div>
  );
}
