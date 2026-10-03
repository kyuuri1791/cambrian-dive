"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { MAX_DEPTH, diveStore, motion, useDive } from "@/lib/diveStore";
import { ZONES, zoneAt } from "@/data/zones";
import { diveTo } from "@/lib/focus";

/** ↑↓キー 1 回で動く深さ */
const KEY_STEP = 50;
/** ボタンを軽くタップしたときに動く深さ */
const TAP_STEP = 100;
/** これより長く押したら「押している間ずっと動く」にする (ms) */
const HOLD_DELAY = 220;
/** 押している間、今の深さからどれだけ先を目標にするか。大きいほど速く動く */
const HOLD_LEAD = 110;
/** 離したあと、今の速さで何秒分だけ惰性で進んでから止まるか */
const COAST_SECONDS = 0.35;

/** ↑↓（W/S）キーでも潜れるようにする（レバーを倒すイメージ） */
export function useDepthKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "s") {
        diveTo(diveStore.get().targetDepth + KEY_STEP);
      } else if (e.key === "ArrowUp" || e.key === "w") {
        diveTo(diveStore.get().targetDepth - KEY_STEP);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

type Hold = { raf: number; holding: boolean };

/**
 * 浮上・潜行ボタン。押している間はレバーを倒したように進み続け、離すと止まる。
 * 軽くタップしたときは TAP_STEP だけ動く。
 */
function useLever(direction: 1 | -1) {
  const hold = useRef<Hold | null>(null);

  const release = (tap: boolean) => {
    const h = hold.current;
    if (!h) return;
    cancelAnimationFrame(h.raf);
    hold.current = null;
    if (h.holding) {
      // 今の速さのまま少しだけ進んで、なめらかに止まる
      diveTo(diveStore.get().depth + motion.velocity * COAST_SECONDS);
    } else if (tap) {
      diveTo(diveStore.get().targetDepth + direction * TAP_STEP);
    }
  };

  // 押したまま画面を離れたときに動き続けないようにする
  useEffect(
    () => () => {
      if (hold.current) cancelAnimationFrame(hold.current.raf);
    },
    [],
  );

  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = performance.now();
      const tick = () => {
        const h = hold.current;
        if (!h) return;
        if (performance.now() - start > HOLD_DELAY) {
          h.holding = true;
          diveTo(diveStore.get().depth + direction * HOLD_LEAD);
        }
        h.raf = requestAnimationFrame(tick);
      };
      hold.current = { raf: requestAnimationFrame(tick), holding: false };
    },
    onPointerUp: () => release(true),
    onPointerCancel: () => release(false),
    onLostPointerCapture: () => release(false),
    // キーボード（Enter / Space）で押したときはタップと同じにする
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) diveTo(diveStore.get().targetDepth + direction * TAP_STEP);
    },
    // 長押しで文字選択やメニューが出ないようにする
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}

function LeverButton({ direction, className }: { direction: 1 | -1; className?: string }) {
  const lever = useLever(direction);
  return (
    <button
      type="button"
      className={`hud-button touch-none select-none ${className ?? ""}`}
      style={{ WebkitTouchCallout: "none" }}
      aria-label={direction < 0 ? "浮上（押している間浮上する）" : "潜行（押している間潜行する）"}
      {...lever}
    >
      {direction < 0 ? "▲ 浮上" : "▼ 潜行"}
    </button>
  );
}

function useDepthState() {
  const depth = useDive((s) => s.depth);
  const target = useDive((s) => s.targetDepth);
  const zone = zoneAt(depth);
  const moving = Math.abs(target - depth) > 0.5;
  return { depth, target, zone, moving };
}

function MovingLabel({ depth, target }: { depth: number; target: number }) {
  return (
    <span className="ml-1 text-xs text-amber-300">{target > depth ? "▼潜行中" : "▲浮上中"}</span>
  );
}

/** PC 用の縦長の深度計 */
export function DepthGauge() {
  const { depth, target, zone, moving } = useDepthState();

  return (
    <div className="hud-panel flex w-44 flex-col items-stretch gap-3 p-3">
      <div className="text-center">
        <div className="hud-label">水深</div>
        <div className="font-mono text-3xl leading-none text-amber-200 tabular-nums">
          {Math.round(depth)}
          <span className="ml-1 text-base text-amber-200/70">m</span>
        </div>
        <div className="mt-1 text-sm text-cyan-100">
          {zone.name}
          {moving && <MovingLabel depth={depth} target={target} />}
        </div>
      </div>

      <div className="flex gap-2">
        {/* 深度のバー。クリックした深さへ移動する */}
        <div
          className="relative mx-auto h-72 w-8 cursor-pointer overflow-hidden rounded border border-amber-200/30"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            diveTo(((e.clientY - rect.top) / rect.height) * MAX_DEPTH);
          }}
          role="slider"
          aria-label="水深"
          aria-orientation="vertical"
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

        <div className="relative flex-1">
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
              style={{ top: `${((z.min + z.max) / 2 / MAX_DEPTH) * 100}%` }}
            >
              {z.name}
              <span className="block font-mono text-[10px] opacity-60">
                {z.min}–{z.max}m
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <LeverButton direction={-1} />
        <LeverButton direction={1} />
      </div>
      <p className="text-center text-[10px] leading-snug text-cyan-100/50">
        ボタン長押し / ↑↓キーでも操作できます
      </p>
    </div>
  );
}

/** スマホ用の横長の深度計。窓のすぐ下に置く */
export function DepthGaugeCompact() {
  const { depth, target, zone, moving } = useDepthState();

  return (
    <div className="hud-panel flex items-center gap-2 p-2">
      <LeverButton direction={-1} className="h-11 shrink-0 px-3" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-center gap-1.5 whitespace-nowrap">
          <span className="font-mono text-xl leading-none text-amber-200 tabular-nums">
            {Math.round(depth)}
            <span className="ml-0.5 text-xs text-amber-200/70">m</span>
          </span>
          <span className="text-sm text-cyan-100">{zone.name}</span>
          {moving && <MovingLabel depth={depth} target={target} />}
        </div>
        {/* 深度のバー（左が浅い）。タップした深さへ移動する */}
        <div
          className="relative mt-1.5 h-3 cursor-pointer overflow-hidden rounded border border-amber-200/30"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            diveTo(((e.clientX - rect.left) / rect.width) * MAX_DEPTH);
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
              className="absolute inset-y-0"
              style={{
                left: `${(z.min / MAX_DEPTH) * 100}%`,
                width: `${((z.max - z.min) / MAX_DEPTH) * 100}%`,
                background: z.color,
              }}
            />
          ))}
          <div
            className="absolute -inset-y-1 w-1 -translate-x-1/2 bg-amber-300 shadow-[0_0_6px_#fcd34d]"
            style={{ left: `${(depth / MAX_DEPTH) * 100}%` }}
          />
        </div>
      </div>
      <LeverButton direction={1} className="h-11 shrink-0 px-3" />
    </div>
  );
}
