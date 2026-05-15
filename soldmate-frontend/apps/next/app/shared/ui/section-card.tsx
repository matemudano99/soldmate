import React from "react";

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({ title, subtitle, children, className = "", noPadding = false }: SectionCardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-[0_2px_16px_rgba(149,157,165,0.10)] border border-gray-50 overflow-hidden ${className}`}>
      {(title || subtitle) && (
        <div className="px-5 pt-5 pb-4 border-b border-gray-50">
          {title && <h2 className="text-base font-semibold text-[#1e2040]">{title}</h2>}
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className={noPadding ? "" : "p-5"}>
        {children}
      </div>
    </div>
  );
}
