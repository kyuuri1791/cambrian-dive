"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { diveStore, motion } from "@/lib/diveStore";
import { getFocusEntry, recordPoke } from "@/lib/focus";
import { floorY } from "./utils";

type FocusEntry = NonNullable<ReturnType<typeof getFocusEntry>>;

/** 生き物の中心（海底にいるモデルは原点が足元なので上げる） */
export function focusCenter(entry: FocusEntry, out: THREE.Vector3) {
  entry.object.getWorldPosition(out);
  out.y += entry.size * entry.centerHeight;
  return out;
}

const tmpDir = new THREE.Vector3();

/** 突っつくときに潜水艦が近づく位置 */
export function approachPoint(entry: FocusEntry, from: THREE.Vector3, out: THREE.Vector3) {
  focusCenter(entry, out);
  tmpDir.copy(out).sub(from);
  tmpDir.y = Math.max(tmpDir.y, -tmpDir.length() * 0.5);
  tmpDir.normalize();
  out.addScaledVector(tmpDir, -(entry.size * 1.6 + 0.8));
  // 海底にめり込まないようにする
  out.y = Math.max(out.y, floorY(out.x, out.z) + 0.5);
  return out;
}

/** 押した直後にアームを少しせり出させて、すぐ反応したことが分かるようにする */
const DEPLOY_REACH = 0.2;
const DEPLOY_TIME = 0.35;
/** 伸ばす・戻すはゆっくり動き出してじわっと止まる。重い機械の手応えを出す */
const EXTEND_TIME = 1.0;
/** 手前で止めたあと、先端だけをちょんと前に出して戻す時間 */
const TAP_TIME = 0.4;
/** つついてから戻し始めるまでの間 */
const HOLD_TIME = 0.2;
/** アームを止める位置（生き物の中心から、体長に対するこの割合だけ手前） */
const STANDOFF = 0.4;
/** つつくときに先端を前に出す量（体長に対する割合） */
const TAP_DEPTH = 0.22;
/** 手の位置から、先端の棒の先までの長さ */
const TIP_LENGTH = 0.12;
const RETRACT_TIME = 0.9;
/** 近づき切る前にアームを伸ばし始める。残りの距離がこの割合を切ったら伸ばす */
const EXTEND_AT_REMAINING = 0.4;
const APPROACH_TIMEOUT = 1.0;
const RETURN_TIME = 1.2;

/** アームの付け根（カメラから見た位置） */
const BASE_LOCAL = new THREE.Vector3(0.22, -0.55, -0.35);
const UP = new THREE.Vector3(0, 1, 0);

const base = new THREE.Vector3();
const target = new THREE.Vector3();
const tip = new THREE.Vector3();

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
const elbow = new THREE.Vector3();
const desired = new THREE.Vector3();
const camUp = new THREE.Vector3();

/** 2 点の間に円柱を配置する */
function placeBetween(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  tmpDir.copy(b).sub(a);
  const length = tmpDir.length();
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  if (length > 1e-5) {
    mesh.quaternion.setFromUnitVectors(UP, tmpDir.divideScalar(length));
  }
  mesh.scale.set(1, Math.max(length, 1e-4), 1);
}

/**
 * 潜水艦のアーム。突っつく動作の進行もここで管理する。
 * カメラの移動は CameraRig が pokePhase を見て行う。
 */
export function PokeArm() {
  const group = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Mesh>(null);
  const lower = useRef<THREE.Mesh>(null);
  const joint = useRef<THREE.Mesh>(null);
  const hand = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const timer = useRef(0);
  /** アームの伸び具合 (0〜1) */
  const reach = useRef(0);
  /** 近づき始めたときの距離 */
  const approachFrom = useRef<number | null>(null);
  /** 伸ばし始めたときの伸び具合 */
  const extendFrom = useRef(0);
  const contacted = useRef(false);
  /** つつく動きの量 (0〜1) */
  const tap = useRef(0);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { pokePhase, focusKey } = diveStore.get();
    const entry = getFocusEntry(focusKey);
    timer.current += dt;

    const goTo = (phase: typeof pokePhase) => {
      timer.current = 0;
      diveStore.set({ pokePhase: phase });
    };

    if (pokePhase !== "idle" && pokePhase !== "return" && !entry) {
      // 途中で見失ったら引き上げる
      reach.current = 0;
      goTo("return");
    }

    switch (pokePhase) {
      case "idle":
        timer.current = 0;
        reach.current = 0;
        approachFrom.current = null;
        contacted.current = false;
        break;
      case "approach": {
        if (!entry) break;
        reach.current = DEPLOY_REACH * easeInOutCubic(Math.min(1, timer.current / DEPLOY_TIME));
        approachPoint(entry, new THREE.Vector3(), desired);
        const distance = camera.position.distanceTo(desired);
        approachFrom.current ??= distance;
        // 近づきながらアームを伸ばして、押してから突っつくまでの間を短くする
        if (
          distance < Math.max(0.2, approachFrom.current * EXTEND_AT_REMAINING) ||
          timer.current > APPROACH_TIMEOUT
        ) {
          approachFrom.current = null;
          extendFrom.current = reach.current;
          goTo("extend");
        }
        break;
      }
      case "extend": {
        const p = Math.min(1, timer.current / EXTEND_TIME);
        reach.current = THREE.MathUtils.lerp(extendFrom.current, 1, easeInOutCubic(p));
        // 手前で止めてから、先端だけをちょんと前に出して戻す
        const tapP = THREE.MathUtils.clamp((timer.current - EXTEND_TIME) / TAP_TIME, 0, 1);
        tap.current = Math.sin(Math.PI * tapP);
        if (tapP >= 0.5 && entry && !contacted.current) {
          contacted.current = true;
          entry.poke();
          // 触れた手応え程度に、ほんの少しだけ揺らす
          motion.impact = 0.25;
          const { selectedId } = diveStore.get();
          if (selectedId) recordPoke(selectedId);
        }
        if (contacted.current && timer.current > EXTEND_TIME + TAP_TIME + HOLD_TIME) {
          contacted.current = false;
          tap.current = 0;
          goTo("retract");
        }
        break;
      }
      case "retract": {
        const p = Math.min(1, timer.current / RETRACT_TIME);
        reach.current = 1 - easeInOutCubic(p);
        if (p >= 1) goTo("return");
        break;
      }
      case "return":
        reach.current = 0;
        if (timer.current > RETURN_TIME) goTo("idle");
        break;
    }

    const g = group.current;
    if (!g) return;
    g.visible = reach.current > 0.001 && !!entry;
    if (light.current) light.current.intensity = g.visible ? 0.4 : 0;
    if (!g.visible || !entry) return;

    base.copy(BASE_LOCAL).applyMatrix4(camera.matrixWorld);
    focusCenter(entry, target);
    // 上から叩きつけないように、つつく向きは水平寄りにする
    tmpDir.copy(target).sub(base);
    tmpDir.y *= 0.3;
    tmpDir.normalize();
    // 生き物の手前で止め、つつくときだけ先端を前に出す
    target.addScaledVector(
      tmpDir,
      -(entry.size * (STANDOFF - TAP_DEPTH * tap.current) + TIP_LENGTH),
    );

    const k = reach.current;
    tip.copy(base).lerp(target, k);
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    elbow
      .copy(base)
      .add(tip)
      .multiplyScalar(0.5)
      .addScaledVector(camUp, 0.12 + base.distanceTo(tip) * 0.12);

    if (upper.current) placeBetween(upper.current, base, elbow);
    if (lower.current) placeBetween(lower.current, elbow, tip);
    joint.current?.position.copy(elbow);
    if (hand.current) {
      hand.current.position.copy(tip);
      tmpDir.copy(tip).sub(elbow).normalize();
      hand.current.quaternion.setFromUnitVectors(UP, tmpDir);
    }
    light.current?.position.copy(tip);
  });

  const metal = <meshStandardMaterial color="#a08a5c" metalness={0.7} roughness={0.35} />;

  return (
    <>
      {/* 先端のライト。暗い海でもアームが見えるように。
          ライトの数が変わるとシェーダーが作り直されて止まるので、常に置いておく */}
      <pointLight ref={light} color="#fff1d0" intensity={0} distance={1.5} decay={2} />
      <group ref={group} visible={false}>
        <mesh ref={upper}>
          <cylinderGeometry args={[0.035, 0.045, 1, 12]} />
          {metal}
        </mesh>
        <mesh ref={lower}>
          <cylinderGeometry args={[0.025, 0.035, 1, 12]} />
          {metal}
        </mesh>
        <mesh ref={joint}>
          <sphereGeometry args={[0.055, 16, 12]} />
          <meshStandardMaterial color="#5d5040" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* 先端。細い棒の先を小さく丸めた、指示棒のような形（+y が前） */}
        <group ref={hand}>
          <mesh position={[0, 0.005, 0]}>
            <cylinderGeometry args={[0.028, 0.03, 0.03, 14]} />
            <meshStandardMaterial color="#5d5040" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.014, 0.018, 0.09, 12]} />
            <meshStandardMaterial color="#8a7a5a" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.105, 0]}>
            <sphereGeometry args={[0.017, 12, 10]} />
            <meshStandardMaterial color="#2f2b27" metalness={0} roughness={0.9} />
          </mesh>
        </group>
      </group>
    </>
  );
}
