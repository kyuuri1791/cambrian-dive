"use client";

import { useEffect } from "react";
import { MAX_DEPTH, diveStore, useDive } from "@/lib/diveStore";
import { ZONES, zoneAt } from "@/data/zones";
import { diveTo } from "@/lib/focus";

const STEP = 50;

export function DepthGauge() {
  const depth = useDive((s) => s.depth);
  const target = useDive((s) => s.targetDepth);
  const zone = zoneAt(depth);
  const moving = Math.abs(target - depth) > 0.5;

  // ↑↓キーでも潜れるようにする（レバーを倒すイメージ）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "s") {
        diveTo(diveStore.get().targetDepth + STEP);
      } else if (e.key === "ArrowUp" || e.key === "w") {
        diveTo(diveStore.get().targetDepth - STEP);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="hud-panel flex w-24 flex-col items-stretch gap-3 p-2 sm:w-44 sm:p-3">
      <div className="text-center">
        <div className="hud-label">水深</div>
        <div className="font-mono text-2xl leading-none sm:text-3xl text-amber-200 tabular-nums">
          {Math.round(depth)}
          <span className="ml-1 text-base text-amber-200/70">m</span>
        </div>
        <div className="mt-1 text-sm text-cyan-100">
          {zone.name}
          {moving && (
            <span className="ml-1 text-xs text-amber-300">
              {target > depth ? "▼潜行中" : "▲浮上中"}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {/* 深度のバー。クリックした深さへ移動する */}
        <div
          className="relative mx-auto h-40 w-8 cursor-pointer overflow-hidden rounded border border-amber-200/30 sm:h-72"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientY - rect.top) / rect.height;
            diveTo(ratio * MAX_DEPTH);
          }}
          role="slider"
          aria-label="水深"
          aria-valuemin={0}
          aria-valuemax={MAX_DEPTH}
          aria-valuenow={Math.round(depth)}
        >
          {ZONES.map((z) => (
            <div
              key={z.id}
              className="absolute inset-x-0"
              style={{
                top: `${(z.min / MAX_DEPTH) * 100}%`,
                height: `${((z.max - z.min) / MAX_DEPTH) * 100}%`,
                background: z.color,
              }}
            />
          ))}
          <div
            className="absolute inset-x-0 h-px bg-amber-300/60"
            style={{ top: `${(target / MAX_DEPTH) * 100}%` }}
          />
          <div
            className="absolute -inset-x-1 h-1 -translate-y-1/2 bg-amber-300 shadow-[0_0_6px_#fcd34d]"
            style={{ top: `${(depth / MAX_DEPTH) * 100}%` }}
          />
        </div>

        <div className="relative hidden flex-1 sm:block">
          {ZONES.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => diveTo((z.min + z.max) / 2)}
              className={`absolute left-0 -translate-y-1/2 rounded px-1.5 py-0.5 text-left text-xs transition ${
                zone.id === z.id
                  ? "bg-amber-300/20 text-amber-200"
                  : "text-cyan-100/70 hover:text-cyan-50"
              }`}
              style={{ top: `${(((z.min + z.max) / 2) / MAX_DEPTH) * 100}%` }}
            >
              {z.name}
              <span className="block font-mono text-[10px] opacity-60">
                {z.min}–{z.max}m
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="hud-button"
          onClick={() => diveTo(diveStore.get().targetDepth - STEP * 2)}
        >
          ▲ 浮上
        </button>
        <button
          type="button"
          className="hud-button"
          onClick={() => diveTo(diveStore.get().targetDepth + STEP * 2)}
        >
          ▼ 潜行
        </button>
      </div>
      <p className="hidden text-center text-[10px] leading-snug text-cyan-100/50 sm:block">
        ↑↓キーでも操作できます
      </p>
    </div>
  );
}
