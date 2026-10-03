"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { diveStore } from "@/lib/diveStore";
import { getVisibleCreatures } from "@/lib/focus";
import { PORTHOLE_RADIUS_VMIN } from "@/lib/porthole";
import { CREATURES } from "@/data/creatures";
import { MAX_LAYOUT, type LayoutItem } from "@/lib/shareCard";

export type Snapshot = {
  /** 丸窓の中を正方形に切り抜いた写真 */
  photo: HTMLCanvasElement;
  /** 写っている生き物の ID。主役から順に並ぶ */
  subjects: string[];
  /** 写っている生き物の構図。遠いものから順に並ぶ（PC 向けのシェアカードで使う） */
  layout: LayoutItem[];
};

/** 3D シーンの外（HUD）から撮影を呼び出すための窓口 */
export const photoCapture: { take: (() => Snapshot | null) | null } = { take: null };

const PHOTO_SIZE = 1000;
const tmp = new THREE.Vector3();
const center = new THREE.Vector3();
const edge = new THREE.Vector3();
const forward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const quat = new THREE.Quaternion();

/** 撮影の仕組みを 3D シーンに組み込む。表示するものはない */
export function PhotoCapture() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    photoCapture.take = () => {
      // 描画した直後なら、描画結果をそのまま読み出せる
      gl.render(scene, camera);
      const src = gl.domElement;
      const rect = src.getBoundingClientRect();
      const dpr = src.width / rect.width;
      // 丸窓は画面の中央にあり、半径は CSS で vmin 指定している
      const radius = (PORTHOLE_RADIUS_VMIN / 100) * Math.min(window.innerWidth, window.innerHeight);
      const cx = window.innerWidth / 2 - rect.left;
      const cy = window.innerHeight / 2 - rect.top;

      const photo = document.createElement("canvas");
      photo.width = PHOTO_SIZE;
      photo.height = PHOTO_SIZE;
      const ctx = photo.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(
        src,
        (cx - radius) * dpr,
        (cy - radius) * dpr,
        radius * 2 * dpr,
        radius * 2 * dpr,
        0,
        0,
        PHOTO_SIZE,
        PHOTO_SIZE,
      );

      // 写っている生き物を、画面上での大きさの順に並べる
      const { focusKey } = diveStore.get();
      const scored = new Map<string, number>();
      const placed: (LayoutItem & { distance: number })[] = [];
      const toScreen = (v: THREE.Vector3) => {
        tmp.copy(v).project(camera);
        return { x: ((tmp.x + 1) / 2) * rect.width, y: ((1 - tmp.y) / 2) * rect.height, z: tmp.z };
      };
      camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      for (const [key, entry] of getVisibleCreatures()) {
        entry.object.getWorldPosition(center);
        center.y += entry.size * entry.centerHeight;
        const distance = center.distanceTo(camera.position);
        const p = toScreen(center);
        if (p.z > 1) continue; // カメラの後ろ
        const sx = p.x;
        const sy = p.y;
        if (Math.hypot(sx - cx, sy - cy) > radius * 0.95) continue; // 窓の外

        // 構図: 画面上の位置・体長・向きを、窓の半径を 1 として記録する
        // 横から見たときの長さ
        const e = toScreen(edge.copy(center).addScaledVector(camRight, entry.size / 2));
        const side = 2 * Math.hypot(e.x - sx, e.y - sy);
        // 体の向きに沿った、実際に見えている長さ（正面向きだと短くなる）
        entry.object.getWorldQuaternion(quat);
        forward.set(1, 0, 0).applyQuaternion(quat);
        const f = toScreen(edge.copy(center).addScaledVector(forward, entry.size / 2));
        const along = 2 * Math.hypot(f.x - sx, f.y - sy);
        // 画像は真横から見た姿なので、正面向きでも点にならないよう下限を付ける
        const apparent = Math.max(along, side * 0.4);
        placed.push({
          index: CREATURES.findIndex((c) => c.id === entry.creatureId),
          x: (sx - cx) / radius,
          y: (sy - cy) / radius,
          length: apparent / radius,
          right: f.x >= sx,
          distance,
        });
        // 追いかけている個体は必ず主役にする
        const score = key === focusKey ? Infinity : entry.size / distance;
        if (score > (scored.get(entry.creatureId) ?? 0)) scored.set(entry.creatureId, score);
      }
      const subjects = [...scored].sort((a, b) => b[1] - a[1]).map(([id]) => id);
      // 手前に大きく写っているものを優先して残し、遠いものから描けるように並べる
      const layout = placed
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_LAYOUT)
        .reverse()
        .map((it) => ({ index: it.index, x: it.x, y: it.y, length: it.length, right: it.right }));
      return { photo, subjects, layout };
    };
    return () => {
      photoCapture.take = null;
    };
  }, [gl, scene, camera]);

  return null;
}
