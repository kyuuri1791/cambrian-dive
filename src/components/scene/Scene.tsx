"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { diveStore, motion } from "@/lib/diveStore";
import { VISIBLE_FADE, clearSelectionByMissedClick, getFocusEntry } from "@/lib/focus";
import { Ocean } from "./Ocean";
import { CreatureSwarm } from "./CreatureSwarm";
import { PokeArm, approachPoint, focusCenter } from "./PokeArm";
import { PhotoCapture } from "./PhotoCapture";
import { SchoolDriver } from "./SchoolDriver";

/**
 * 潜行の速さの設定。0→1000m で約5秒、100m で約1.5秒かかる。
 * MAX_DIVE_SPEED: 最高速度 (m/s)。上げると長距離の移動が速くなる
 * DIVE_GAIN: 目標までの距離に対する速さ。上げると短い移動が速くなる
 * DIVE_ACCEL: 加速・減速の鋭さ。下げるとゆったり動き出す
 */
const MAX_DIVE_SPEED = 220;
const DIVE_GAIN = 1.5;
const DIVE_ACCEL = 2;

const BASE_FOV = 62;
const MIN_FOV = 5;
/** 追いかけている生き物が画面の高さに占める割合 */
const FRAMING = 0.4;

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 0], fov: BASE_FOV, near: 0.05, far: 120 }}
      dpr={[1, 2]}
      onPointerMissed={clearSelectionByMissedClick}
    >
      <DepthController />
      <CameraRig />
      <Ocean />
      <SchoolDriver />
      <CreatureSwarm />
      <PokeArm />
      <PhotoCapture />
    </Canvas>
  );
}

/** 現在の水深を目標の水深へ近づける */
function DepthController() {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { depth, targetDepth } = diveStore.get();
    const diff = targetDepth - depth;
    if (Math.abs(diff) < 0.05) {
      motion.velocity = THREE.MathUtils.damp(motion.velocity, 0, 4, dt);
      if (diff !== 0) diveStore.set({ depth: targetDepth });
      return;
    }
    const desired = THREE.MathUtils.clamp(diff * DIVE_GAIN, -MAX_DIVE_SPEED, MAX_DIVE_SPEED);
    motion.velocity = THREE.MathUtils.damp(motion.velocity, desired, DIVE_ACCEL, dt);
    let next = depth + motion.velocity * dt;
    // 行き過ぎないようにする
    if ((diff > 0 && next > targetDepth) || (diff < 0 && next < targetDepth)) {
      next = targetDepth;
    }
    diveStore.set({ depth: next });
  });
  return null;
}

const tmpTarget = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();
/** 揺れを除いたカメラの位置 */
const rigPosition = new THREE.Vector3();
const desiredPosition = new THREE.Vector3();

/**
 * 視点の制御。
 * 通常はマウスの位置に合わせて窓から見回し、生き物を選ぶとその個体を追いかけてズームする。
 */
function CameraRig() {
  useFrame(({ camera, pointer, clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;
    cam.rotation.order = "YXZ";

    let yaw = -pointer.x * 0.35;
    let pitch = -0.2 + pointer.y * 0.18;
    let fov = BASE_FOV;
    let follow = 2;

    const { focusKey, pokePhase } = diveStore.get();
    const entry = getFocusEntry(focusKey);
    if (focusKey !== null && (!entry || entry.fade() < VISIBLE_FADE)) {
      // 深さを変えて見えなくなったら、選択ごと解除して海域の表示に戻す
      diveStore.set({ focusKey: null, selectedId: null });
    } else if (entry) {
      focusCenter(entry, tmpTarget);
      const v = tmpTarget.sub(cam.position);
      const horizontal = Math.hypot(v.x, v.z);
      yaw = Math.atan2(-v.x, -v.z);
      pitch = Math.atan2(v.y, horizontal);
      const distance = v.length();
      fov = THREE.MathUtils.clamp(
        THREE.MathUtils.radToDeg(2 * Math.atan(entry.size / (2 * FRAMING * distance))),
        MIN_FOV,
        BASE_FOV,
      );
      follow = 6;
    }

    cam.rotation.y = THREE.MathUtils.damp(cam.rotation.y, yaw, follow, dt);
    cam.rotation.x = THREE.MathUtils.damp(cam.rotation.x, pitch, follow, dt);
    // 潜行中は少し揺れる。ズーム中は揺れが大きく見えるので抑える
    const zoom =
      Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) /
      Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const shake = (Math.min(1, Math.abs(motion.velocity) / MAX_DIVE_SPEED) * 0.006) / zoom;
    cam.rotation.z = (Math.sin(t * 0.5) * 0.01) / zoom + Math.sin(t * 23) * shake;
    // 突っつくときは生き物に近づき、終わったら元の位置へ戻る
    const approaching =
      entry && (pokePhase === "approach" || pokePhase === "extend" || pokePhase === "retract");
    if (approaching) approachPoint(entry, ORIGIN, desiredPosition);
    else desiredPosition.copy(ORIGIN);
    const lambda = approaching ? 3.2 : 2;
    rigPosition.x = THREE.MathUtils.damp(rigPosition.x, desiredPosition.x, lambda, dt);
    rigPosition.y = THREE.MathUtils.damp(rigPosition.y, desiredPosition.y, lambda, dt);
    rigPosition.z = THREE.MathUtils.damp(rigPosition.z, desiredPosition.z, lambda, dt);
    cam.position.copy(rigPosition);
    cam.position.y += Math.sin(t * 0.6) * 0.06;

    // アームが当たったときの揺れ
    if (motion.impact > 0.001) {
      motion.impact *= Math.exp(-dt * 7);
      cam.position.y += Math.sin(t * 60) * 0.025 * motion.impact;
      cam.rotation.z += Math.sin(t * 47) * 0.006 * motion.impact;
    }

    const nextFov = THREE.MathUtils.damp(cam.fov, fov, 2.5, dt);
    if (Math.abs(nextFov - cam.fov) > 0.001) {
      cam.fov = nextFov;
      cam.updateProjectionMatrix();
    }
    if (Math.abs(zoom - diveStore.get().zoom) > 0.05) {
      diveStore.set({ zoom });
    }
  });
  return null;
}
