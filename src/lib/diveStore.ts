"use client";

import { useSyncExternalStore } from "react";

export const MAX_DEPTH = 1000;

/**
 * 最初に潜る深さ。最初の海が明るく見えるよう陽光帯にする。
 * 群れで泳ぐ生き物や、窓の前を横切るアノマロカリスも見られる
 */
export const START_DEPTH = 100;

/**
 * 突っつく動作の段階。
 * approach: 近づく / extend: アームを伸ばす / retract: 戻す / return: 元の位置へ戻る
 */
export type PokePhase = "idle" | "approach" | "extend" | "retract" | "return";

export type DiveState = {
  /** 目標の水深 (m)。UI 操作で変わる */
  targetDepth: number;
  /** 現在の水深 (m)。目標に向かってゆっくり変化する */
  depth: number;
  /** 選択中の生き物 ID */
  selectedId: string | null;
  /** カメラが追いかけている個体（CreatureSwarm のインスタンスキー） */
  focusKey: number | null;
  /** カメラのズーム倍率 */
  zoom: number;
  pokePhase: PokePhase;
  /** これまでに突っついた生き物 ID */
  pokedIds: string[];
};

// 起動時の演出の間は水面（0m）にいて、到着してから START_DEPTH まで潜る
const initialState: DiveState = {
  targetDepth: 0,
  depth: 0,
  selectedId: null,
  focusKey: null,
  zoom: 1,
  pokePhase: "idle",
  pokedIds: [],
};

let state = initialState;
const listeners = new Set<() => void>();

/**
 * URL（?depth= や ?creature=）で始める深さを指定されたか。
 * 指定されたときは、到着時に水面から潜っていく描写をしない
 */
export const startOptions = { fromUrl: false };

/** 3D シーン側で毎フレーム参照する値。再レンダリング不要なので store とは分ける */
export const motion = {
  /** 潜行速度 (m/s)。正の値で潜っている */
  velocity: 0,
  /** アームが当たったときの揺れの強さ (0〜1)。時間とともに減る */
  impact: 0,
};

export const diveStore = {
  get: () => state,
  set(partial: Partial<DiveState>) {
    state = { ...state, ...partial };
    listeners.forEach((l) => l());
  },
  setTargetDepth(depth: number) {
    diveStore.set({
      targetDepth: Math.min(MAX_DEPTH, Math.max(0, depth)),
    });
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useDive<T>(selector: (s: DiveState) => T): T {
  return useSyncExternalStore(
    diveStore.subscribe,
    () => selector(state),
    () => selector(initialState),
  );
}
