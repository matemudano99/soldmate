import React from "react";

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterPillBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterPillBar({ options, value, onChange }: FilterPillBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.id
              ? "bg-[#4f6ef7] text-white"
              : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
