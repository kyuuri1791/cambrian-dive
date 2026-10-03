import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { diveStore } from "@/lib/diveStore";

export { FLOOR_BASE, floorY } from "@/lib/terrain";

/** シード付き乱数。毎回同じ配置になるようにする */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FADE_MARGIN = 30;

/** 水深に対する出現度合い (0〜1)。範囲の外側 FADE_MARGIN m でフェードする */
export function presenceAt(depth: number, [min, max]: [number, number]) {
  const lo = THREE.MathUtils.clamp((depth - (min - FADE_MARGIN)) / FADE_MARGIN, 0, 1);
  const hi = THREE.MathUtils.clamp(((max + FADE_MARGIN) - depth) / FADE_MARGIN, 0, 1);
  return Math.min(lo, hi);
}

type FadeMaterial = THREE.Material & { userData: { baseOpacity?: number } };

/**
 * 現在の水深に応じて、グループ内のメッシュを透明度でフェードさせる。
 * 戻り値の ref で現在のフェード値を参照できる。
 */
export function useDepthFade(
  groupRef: RefObject<THREE.Object3D | null>,
  range: [number, number],
) {
  const fade = useRef(-1);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;
    const target = presenceAt(diveStore.get().depth, range);
    const prev = fade.current;
    let next = prev < 0 ? target : THREE.MathUtils.damp(prev, target, 3, dt);
    // damp は目標に近づくほど変化が小さくなり、いつまでも 0 や 1 にならない。
    // 目標の近くまで来たら合わせて、完全に消えたら確実に非表示にする
    if (Math.abs(next - target) < 0.01) next = target;
    fade.current = next;

    if (next === prev) return;

    group.visible = next > 0;
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of materials as FadeMaterial[]) {
        if (m.userData.baseOpacity === undefined) {
          m.userData.baseOpacity = m.opacity;
        }
        const base = m.userData.baseOpacity;
        const wantTransparent = base < 1 || next < 0.999;
        if (m.transparent !== wantTransparent) {
          m.transparent = wantTransparent;
          m.needsUpdate = true;
        }
        m.opacity = base * next;
      }
    });
  });

  return fade;
}
