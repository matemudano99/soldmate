"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#4f6ef7]/10 flex items-center justify-center mb-4">
        <Icon size={28} className="text-[#4f6ef7]" />
      </div>
      <h3 className="text-[#1e2040] font-semibold text-base mb-1">{title}</h3>
      {description && (
        <p className="text-gray-400 text-sm max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
