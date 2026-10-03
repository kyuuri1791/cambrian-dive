"use client";

import { useEffect } from "react";
import { useDive } from "@/lib/diveStore";
import { clearSelection, requestPoke } from "@/lib/focus";

/** 追跡中に窓の中央に出す照準とズーム倍率 */
export function Reticle() {
  const tracking = useDive((s) => s.focusKey !== null);
  const zoom = useDive((s) => s.zoom);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 追跡をやめたら少しだけ残してから消す（ズームが戻り切るのは待たない）
  const visible = tracking;

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity ${
          visible ? "opacity-100 duration-500" : "opacity-0 duration-[600ms]"
        }`}
        aria-hidden
      >
        <svg
          className="absolute left-[var(--cx)] top-[var(--cy)] h-[calc(var(--r)*1.36)] w-[calc(var(--r)*1.36)] -translate-x-1/2 -translate-y-1/2"
          viewBox="-100 -100 200 200"
        >
          <g
            stroke="#a7f3d0"
            strokeOpacity="0.55"
            fill="none"
            strokeWidth="0.8"
          >
            <circle r="62" strokeDasharray="4 6" />
            {/* 四隅の括弧 */}
            {[0, 90, 180, 270].map((deg) => (
              <path
                key={deg}
                d="M -40 -30 L -40 -40 L -30 -40"
                transform={`rotate(${deg})`}
              />
            ))}
            {/* 外側の目盛り */}
            {[0, 90, 180, 270].map((deg) => (
              <line
                key={deg}
                x1="0"
                y1="-70"
                x2="0"
                y2="-80"
                transform={`rotate(${deg})`}
              />
            ))}
          </g>
        </svg>
        <div className="absolute left-[var(--cx)] top-[calc(var(--cy)+var(--r)*0.7)] hidden -translate-x-1/2 sm:block font-mono text-xs tracking-widest text-emerald-200/80">
          ZOOM ×{zoom.toFixed(1)}
          {tracking && <span className="ml-2 animate-pulse">TRACKING</span>}
        </div>
      </div>
      <PokeButton />
    </>
  );
}

/** 照準の下に出す「突っつく」ボタン。見ている場所の近くに置いて気づきやすくする */
function PokeButton() {
  const tracking = useDive((s) => s.focusKey !== null);
  const pokePhase = useDive((s) => s.pokePhase);
  const busy = pokePhase !== "idle";
  if (!tracking && !busy) return null;

  // 窓の下の縁から一定の距離だけ内側に置く（窓の大きさに比例させると、小さい窓で縁にかかる）
  return (
    <div className="absolute left-[var(--cx)] top-[calc(var(--cy)+var(--r)-64px)] -translate-x-1/2">
      <button
        type="button"
        onClick={requestPoke}
        disabled={busy}
        className={`relative flex items-center gap-2 rounded-full border-2 border-amber-300/80 bg-[#1a140a]/85 px-5 py-2 text-sm font-bold text-amber-200 shadow-[0_0_14px_rgb(252_211_77/0.35)] disabled:opacity-60 ${
          busy ? "" : "poke-glow"
        }`}
      >
        <span aria-hidden>🦾</span>
        {busy ? "突っつき中…" : "突っつく"}
      </button>
    </div>
  );
}
