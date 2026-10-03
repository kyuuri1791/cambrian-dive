"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CREATURES } from "@/data/creatures";
import { useDive } from "@/lib/diveStore";

/** 演出を見せる時間 (ms) */
const SHOW_MS = 4200;

/** 全部の生き物を突っついた瞬間に、窓の中で泡を湧き上がらせてお祝いする */
export function CompleteCelebration() {
  const count = useDive((s) => s.pokedIds.length);
  const total = CREATURES.length;
  const prev = useRef(count);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 16 種目を突っついた瞬間だけ出す（最初から揃っている場合は出さない）
    if (prev.current < total && count >= total) {
      setShow(true);
      const timer = window.setTimeout(() => setShow(false), SHOW_MS);
      prev.current = count;
      return () => window.clearTimeout(timer);
    }
    prev.current = count;
  }, [count, total]);

  const bubbles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: (i * 37) % 100,
        size: 6 + ((i * 53) % 18),
        delay: ((i * 29) % 100) / 100,
        duration: 1.8 + ((i * 17) % 10) / 10,
      })),
    [],
  );

  if (!show) return null;

  return (
    <div
      className="pointer-events-none absolute left-[var(--cx)] top-[var(--cy)] h-[calc(var(--r)*2)] w-[calc(var(--r)*2)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
      role="status"
      aria-live="polite"
    >
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="celebrate-bubble"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
          aria-hidden
        />
      ))}
      <div className="celebrate-text absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-xs tracking-[0.3em] text-amber-200/90 sm:text-sm">図鑑コンプリート</div>
        <div className="mt-1 text-2xl font-bold text-amber-200 drop-shadow-[0_0_12px_rgb(252_211_77/0.8)] sm:text-4xl">
          カンブリア紀の生き物
          <br />
          {total}種 制覇！
        </div>
      </div>
    </div>
  );
}
