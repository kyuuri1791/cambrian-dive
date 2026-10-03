"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { diveStore, startOptions } from "@/lib/diveStore";
import { selectCreature } from "@/lib/focus";
import { CREATURES } from "@/data/creatures";
import { DepthGauge, DepthGaugeCompact, useDepthKeys } from "./hud/DepthGauge";
import { InfoPanel } from "./hud/InfoPanel";
import { Reticle } from "./hud/Reticle";
import { TimeSlipIntro } from "./hud/TimeSlipIntro";
import { PhotoBooth } from "./hud/PhotoBooth";
import { CompleteCelebration } from "./hud/CompleteCelebration";

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
  useDepthKeys();

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
    startOptions.fromUrl = true;
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
      {/* 3D の中心が窓の中心に来るよう、窓の中心の高さの 2 倍の高さにする */}
      <div className="absolute inset-x-0 top-0 h-[calc(var(--cy)*2)]">
        <Scene />
      </div>

      <Reticle />
      <CompleteCelebration />

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

      <header className="pointer-events-none absolute left-4 right-4 top-4 sm:right-auto">
        <h1 className="text-base font-bold tracking-widest text-amber-200 sm:text-xl">
          CAMBRIAN DIVE
        </h1>
        <p className="font-mono text-xs text-cyan-100/70">
          時空座標: 約5億800万年前<span className="hidden sm:inline"> / </span><br className="sm:hidden" />カンブリア紀の海
        </p>
      </header>

      {/* スマホでは窓の下に深度計、その下に情報パネル。PC では左に情報パネル、右に深度計 */}
      <div className="pointer-events-auto absolute left-4 right-4 top-[calc(var(--cy)+var(--r)+16px)] sm:hidden">
        <DepthGaugeCompact />
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-4 right-4 top-[calc(var(--cy)+var(--r)+82px)] flex flex-col sm:bottom-auto sm:right-auto sm:top-20 sm:max-h-[calc(100%-6rem)]">
        <InfoPanel />
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 hidden sm:block">
        <DepthGauge />
      </div>
    </main>
  );
}
