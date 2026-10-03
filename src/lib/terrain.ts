/**
 * 海底の地形。3D シーンとワーカー（群れの計算）の両方で使うので、
 * three.js や React に依存させない
 */

export const FLOOR_BASE = -5;

/** 海底の高さ。地形メッシュ、海底を這う生き物、群れの計算で共有する */
export function floorY(x: number, z: number) {
  return (
    FLOOR_BASE +
    0.45 * Math.sin(x * 0.28) * Math.cos(z * 0.22) +
    0.18 * Math.sin(x * 0.9 + z * 0.7) +
    0.06 * Math.sin(x * 2.3 - z * 1.7)
  );
}

/** 生き物が泳ぎ回れる範囲 */
export const SWIM_BOUNDS = { x: 14, zNear: -6, zFar: -30 };
