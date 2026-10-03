"use client";

import { useEffect, useRef, useState } from "react";
import { START_DEPTH, diveStore } from "@/lib/diveStore";

/** 到着する時代（年前） */
const TARGET_YEARS_AGO = 508_000_000;

/** 到着したとき、水面から最初の深さまで潜っていく描写を見せるか */
const DIVE_IN_ON_ARRIVAL = true;

/** 演出のタイミング (秒) */
const COUNT_START = 0.3;
const COUNT_END = 2.0;
const FADE_START = 2.4;
const FADE_END = 3.2;

/** 通り過ぎる時代の区切り（年前） */
const ERAS: [number, string][] = [
  [10_000, "現代"],
  [66_000_000, "新生代"],
  [252_000_000, "中生代"],
  [485_000_000, "古生代"],
  [Infinity, "古生代 カンブリア紀"],
];

function eraAt(yearsAgo: number) {
  return ERAS.find(([limit]) => yearsAgo < limit)![1];
}

function formatYears(yearsAgo: number) {
  if (yearsAgo < 1) return "西暦 2026年";
  if (yearsAgo < 10_000) return `${Math.round(yearsAgo).toLocaleString()}年前`;
  if (yearsAgo < 100_000_000) return `${Math.floor(yearsAgo / 10_000).toLocaleString()}万年前`;
  const oku = Math.floor(yearsAgo / 100_000_000);
  const man = Math.floor((yearsAgo % 100_000_000) / 10_000);
  return man > 0 ? `${oku}億${man}万年前` : `${oku}億年前`;
}

/**
 * 起動時のタイムスリップ演出。丸い窓の中だけで完結させる。
 * 窓の中が暗くなり、年数がさかのぼったあと、海がフェードで見えてくる。
 */
export function TimeSlipIntro() {
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const yearsRef = useRef<HTMLDivElement>(null);
  const eraRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let start = performance.now();
    let raf = 0;
    let arrived = false;

    // 到着したら、水面から最初の深さまで潜っていく（URL で深さを指定したときはそのまま）
    const arrive = () => {
      if (arrived) return;
      arrived = true;
      const { depth, targetDepth } = diveStore.get();
      if (DIVE_IN_ON_ARRIVAL && depth === START_DEPTH && targetDepth === START_DEPTH) {
        diveStore.set({ depth: 0 });
      }
    };

    skipRef.current = () => {
      start = Math.min(start, performance.now() - FADE_START * 1000);
    };
    if (reduced) start = performance.now() - FADE_START * 1000;

    const frame = (now: number) => {
      const t = (now - start) / 1000;

      const p = Math.min(1, Math.max(0, (t - COUNT_START) / (COUNT_END - COUNT_START)));
      // 年数は加速しながら増える
      const yearsAgo = TARGET_YEARS_AGO * p * p;
      if (yearsRef.current) {
        yearsRef.current.textContent = p >= 1 ? "約5億800万年前" : formatYears(yearsAgo);
      }
      if (eraRef.current) eraRef.current.textContent = eraAt(yearsAgo);

      if (t >= FADE_START) arrive();
      if (rootRef.current) {
        const fade = Math.min(1, Math.max(0, (t - FADE_START) / (FADE_END - FADE_START)));
        rootRef.current.style.opacity = String(1 - fade);
      }

      if (t >= FADE_END) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (done) return null;

  return (
    <div
      ref={rootRef}
      className="timeslip absolute left-[var(--cx)] top-[var(--cy)] h-[calc(var(--r)*2)] w-[calc(var(--r)*2)] -translate-x-1/2 -translate-y-1/2 cursor-pointer overflow-hidden rounded-full bg-[#03080e]"
      onClick={() => skipRef.current()}
      role="status"
      aria-live="polite"
    >
      {/* 中心から広がる波紋 */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="timeslip-ring"
          style={{ animationDelay: `${i * 0.45}s` }}
          aria-hidden
        />
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div
          ref={yearsRef}
          className="font-mono text-2xl font-bold text-amber-100 tabular-nums sm:text-3xl"
        >
          西暦 2026年
        </div>
        <div ref={eraRef} className="mt-1 text-xs text-cyan-100/70" />
      </div>
    </div>
  );
}
