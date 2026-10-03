"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { diveStore } from "@/lib/diveStore";
import { selectCreature } from "@/lib/focus";
import { CREATURES } from "@/data/creatures";
import { DepthGauge } from "./hud/DepthGauge";
import { InfoPanel } from "./hud/InfoPanel";
import { Reticle } from "./hud/Reticle";
import { TimeSlipIntro } from "./hud/TimeSlipIntro";
import { PhotoBooth } from "./hud/PhotoBooth";

// three.js はブラウザでしか動かないので、サーバーでは描画しない
const Scene = dynamic(() => import("./scene/Scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-cyan-100/70">
      タイムマシンを起動中…
    </div>
  ),
});

export function DiveExperience() {
  // ?depth=300 で開始水深、?creature=marrella で最初に追いかける生き物を指定できる
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const creature = CREATURES.find((c) => c.id === params.get("creature"));
    const param = params.get("depth");
    let depth = Number(param);
    if (!param || !Number.isFinite(depth)) {
      if (!creature) return;
      depth = (creature.depth[0] + creature.depth[1]) / 2;
    }
    diveStore.setTargetDepth(depth);
    diveStore.set({ depth: diveStore.get().targetDepth });
    if (!creature) return;

    // 3D シーンの読み込みを待ってから選択する
    let tries = 0;
    const timer = window.setInterval(() => {
      selectCreature(creature.id);
      if (diveStore.get().focusKey !== null || ++tries > 20) {
        window.clearInterval(timer);
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0b1116] text-cyan-50">
      <div className="absolute inset-0">
        <Scene />
      </div>

      <Reticle />

      {/* 起動時の演出。窓枠より下に置いて、窓の中だけで見せる */}
      <TimeSlipIntro />

      {/* 潜水艦の窓。クリックは下の 3D シーンに通す */}
      <div className="porthole pointer-events-none absolute inset-0" aria-hidden>
        <div className="porthole-glass" />
        <div className="porthole-ring">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="porthole-rivet"
              style={{ transform: `rotate(${i * 22.5}deg) translateY(calc(var(--r) * -1 - 2.2vmin))` }}
            />
          ))}
        </div>
      </div>

      <PhotoBooth />

      <header className="pointer-events-none absolute left-4 right-32 top-4 sm:right-auto">
        <h1 className="text-base font-bold tracking-widest text-amber-200 sm:text-xl">
          CAMBRIAN DIVE
        </h1>
        <p className="font-mono text-xs text-cyan-100/70">
          時空座標: 約5億800万年前<span className="hidden sm:inline"> / </span><br className="sm:hidden" />カンブリア紀の海
        </p>
      </header>

      <div className="pointer-events-auto absolute bottom-6 left-4 right-4 max-h-[40%] sm:right-auto sm:top-20 sm:bottom-auto sm:max-h-[calc(100%-6rem)]">
        <InfoPanel />
      </div>

      <div className="pointer-events-auto absolute right-4 top-4">
        <DepthGauge />
      </div>

      <p className="pointer-events-none absolute bottom-1 right-4 text-[10px] text-cyan-100/40 sm:bottom-2">
        ※ 生息深度や大きさはゲーム用の目安です
      </p>
    </main>
  );
}
