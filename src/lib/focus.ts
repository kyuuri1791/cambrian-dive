"use client";

import type * as THREE from "three";
import { diveStore } from "./diveStore";

type Entry = {
  creatureId: string;
  object: THREE.Object3D;
  /** 画面上の体長（ワールド単位） */
  size: number;
  /** カメラやアームが狙う高さ（原点から上へ、体長に対する割合） */
  centerHeight: number;
  /** 現在のフェード値 (0〜1) */
  fade: () => number;
  /** 突っつかれたときの反応を始める */
  poke: () => void;
};

/** 3D シーン上の生き物の個体。カメラが追いかける対象を探すのに使う */
const registry = new Map<number, Entry>();

export function registerCreature(key: number, entry: Entry) {
  registry.set(key, entry);
  return () => {
    registry.delete(key);
  };
}

export function getFocusEntry(key: number | null) {
  return key === null ? undefined : registry.get(key);
}

/** 見えているとみなすフェード値 */
export const VISIBLE_FADE = 0.3;

/** 今見えている生き物の個体（撮影で写っているものを調べるのに使う） */
export function getVisibleCreatures() {
  return [...registry].filter(([, e]) => e.fade() >= VISIBLE_FADE);
}

/**
 * 生き物を選択して、カメラで追いかける。
 * key を省略すると、その種類のうちカメラに一番近い個体を選ぶ。
 */
export function selectCreature(creatureId: string, key?: number) {
  // 突っついている途中は対象を変えない
  if (diveStore.get().pokePhase !== "idle") return;
  let focusKey: number | null = key ?? null;
  if (focusKey === null) {
    let best = Infinity;
    for (const [k, e] of registry) {
      if (e.creatureId !== creatureId || e.fade() < VISIBLE_FADE) continue;
      // カメラは原点付近にあるので、原点からの距離で比べる
      const d = e.object.position.lengthSq();
      if (d < best) {
        best = d;
        focusKey = k;
      }
    }
  }
  diveStore.set({ selectedId: creatureId, focusKey });
}

/**
 * ユーザーの操作で潜行・浮上する。
 * 追いかけている生き物は見失うことが多いので、操作した時点で選択を解除する。
 */
export function diveTo(depth: number) {
  const { targetDepth, selectedId } = diveStore.get();
  diveStore.setTargetDepth(depth);
  if (selectedId !== null && diveStore.get().targetDepth !== targetDepth) {
    diveStore.set({ selectedId: null, focusKey: null });
  }
}

/**
 * 選択を解除する（✕ボタンや Esc で、はっきり閉じる操作をしたとき）。
 * 突っついている途中でも解除する。アームは PokeArm が引っ込めて元の位置へ戻る
 */
export function clearSelection() {
  diveStore.set({ selectedId: null, focusKey: null });
}

/**
 * 窓の何もないところをクリックしたときの解除。
 * アームを伸ばしている最中のクリックは、うっかりのことが多いので無視する
 */
export function clearSelectionByMissedClick() {
  const { pokePhase } = diveStore.get();
  if (pokePhase === "approach" || pokePhase === "extend") return;
  clearSelection();
}

/** 追いかけている生き物をアームで突っつく */
export function requestPoke() {
  const { focusKey, pokePhase } = diveStore.get();
  if (focusKey === null || pokePhase !== "idle") return;
  diveStore.set({ pokePhase: "approach" });
}

/** 最後に突っついた生き物と時刻（撮影したカードにスタンプを押すのに使う） */
export const lastPoke = { creatureId: null as string | null, at: 0 };

/** 突っついた図鑑に記録する。ページを開き直すとまっさらに戻る */
export function recordPoke(creatureId: string) {
  lastPoke.creatureId = creatureId;
  lastPoke.at = performance.now();
  const { pokedIds } = diveStore.get();
  if (pokedIds.includes(creatureId)) return;
  diveStore.set({ pokedIds: [...pokedIds, creatureId] });
}
