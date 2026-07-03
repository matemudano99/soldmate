"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import type { TpvTable, TpvTableInput } from "app/lib/api";
import { money } from "./shared";

type DragState = {
  id: number;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
};

export function FloorPlan({
  tables,
  editMode,
  activeZone,
  setActiveZone,
  selectedId,
  onSelect,
  onOpenTable,
  onPersist,
}: {
  tables: TpvTable[];
  editMode: boolean;
  activeZone: string;
  setActiveZone: (z: string) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onOpenTable: (t: TpvTable) => void;
  onPersist: (id: number, body: TpvTableInput) => void;
}) {
  const [local, setLocal] = useState<TpvTable[]>(tables);
  const draggingRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const localRef = useRef<TpvTable[]>(tables);

  useEffect(() => {
    localRef.current = local;
  }, [local]);

  // Sincroniza desde el servidor salvo mientras se arrastra (para no pisar el movimiento en curso).
  useEffect(() => {
    if (!draggingRef.current) setLocal(tables);
  }, [tables]);

  const zones = useMemo(() => {
    const set: string[] = [];
    for (const t of local) if (!set.includes(t.zone)) set.push(t.zone);
    return set.length ? set : ["Salón"];
  }, [local]);

  const zone = zones.includes(activeZone) ? activeZone : zones[0];
  const zoneTables = local.filter((t) => t.zone === zone);
  const canvasHeight = Math.max(
    380,
    ...zoneTables.map((t) => t.posY + t.height + 40),
  );
  const canvasWidth = Math.max(
    320,
    ...zoneTables.map((t) => t.posX + t.width + 40),
  );

  function onPointerDown(e: React.PointerEvent, t: TpvTable, mode: "move" | "resize") {
    if (!editMode) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    onSelect(t.id);
    dragRef.current = {
      id: t.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      baseX: mode === "move" ? t.posX : t.width,
      baseY: mode === "move" ? t.posY : t.height,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setLocal((prev) =>
      prev.map((t) => {
        if (t.id !== d.id) return t;
        if (d.mode === "move") {
          return { ...t, posX: Math.max(0, Math.round(d.baseX + dx)), posY: Math.max(0, Math.round(d.baseY + dy)) };
        }
        return { ...t, width: Math.max(50, Math.round(d.baseX + dx)), height: Math.max(50, Math.round(d.baseY + dy)) };
      }),
    );
  }

  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    draggingRef.current = false;
    if (!d) return;
    const t = localRef.current.find((x) => x.id === d.id);
    if (t) onPersist(t.id, { posX: t.posX, posY: t.posY, width: t.width, height: t.height });
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        {zones.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setActiveZone(z)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border ${
              z === zone
                ? "bg-[#1e2040] text-white border-[#1e2040]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#1e2040]"
            }`}
          >
            {z}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 overflow-auto" style={{ maxHeight: "calc(100vh - 230px)", touchAction: "pan-x pan-y" }}>
      <div
        className="relative bg-[#f6f7fb]"
        style={{
          height: canvasHeight,
          width: canvasWidth,
          minWidth: "100%",
          backgroundImage:
            "linear-gradient(#e7eaf3 1px, transparent 1px), linear-gradient(90deg, #e7eaf3 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => editMode && onSelect(null)}
      >
        {zoneTables.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            No hay mesas en esta zona.
          </div>
        ) : null}

        {zoneTables.map((t) => {
          const occupied = t.openOrderId != null;
          const selected = selectedId === t.id;
          return (
            <div
              key={t.id}
              onPointerDown={(e) => onPointerDown(e, t, "move")}
              onClick={(e) => {
                e.stopPropagation();
                if (editMode) onSelect(t.id);
                else onOpenTable(t);
              }}
              className={`absolute flex flex-col items-center justify-center text-center select-none shadow-sm ${
                t.shape === "ROUND" ? "rounded-full" : "rounded-2xl"
              } ${editMode ? "cursor-move" : "cursor-pointer"} ${
                occupied
                  ? "bg-amber-50 border-2 border-amber-400 text-amber-900"
                  : "bg-white border-2 border-emerald-300 text-[#1e2040] hover:border-emerald-500"
              } ${selected ? "ring-2 ring-[#4f6ef7] ring-offset-2" : ""}`}
              style={{ left: t.posX, top: t.posY, width: t.width, height: t.height }}
            >
              <span className="font-bold text-sm leading-tight px-1">{t.label}</span>
              <span className="flex items-center gap-0.5 text-[10px] opacity-70">
                <Users size={10} /> {t.seats}
              </span>
              {occupied ? (
                <span className="text-[11px] font-semibold mt-0.5">{money(t.openTotal)}</span>
              ) : (
                <span className="text-[10px] text-emerald-600 font-semibold mt-0.5">Libre</span>
              )}

              {editMode ? (
                <span
                  onPointerDown={(e) => onPointerDown(e, t, "resize")}
                  className="absolute -right-1 -bottom-1 w-3.5 h-3.5 bg-[#4f6ef7] rounded-sm cursor-se-resize border-2 border-white"
                />
              ) : null}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
