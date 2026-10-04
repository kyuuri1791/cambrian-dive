"use client";

import { useEffect, useMemo, useRef, type ComponentType, type RefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES, displayLength, type Creature, type ModelKind } from "@/data/creatures";
import { diveStore, startOptions } from "@/lib/diveStore";
import { VISIBLE_FADE, registerCreature, selectCreature } from "@/lib/focus";
import { getSchools } from "@/lib/school/client";
import { createRandom, floorY, hashString, presenceAt, useDepthFade } from "./utils";
import { ROCK_OBSTACLES } from "./Decorations";
import type { ModelProps } from "./models/types";
import { Anomalocaris, Opabinia } from "./models/FlappedSwimmers";
import { Hallucigenia, Trilobite, Wiwaxia } from "./models/Crawlers";
import { Ctenophore, Haikouichthys, Marrella, Pikaia } from "./models/Swimmers";
import {
  Aysheaia,
  Dinomischus,
  Eldonia,
  Hurdia,
  Ottoia,
  Sidneyia,
  Waptia,
} from "./models/MoreCreatures";

export const MODELS: Record<ModelKind, ComponentType<ModelProps>> = {
  anomalocaris: Anomalocaris,
  opabinia: Opabinia,
  trilobite: Trilobite,
  hallucigenia: Hallucigenia,
  marrella: Marrella,
  pikaia: Pikaia,
  haikouichthys: Haikouichthys,
  wiwaxia: Wiwaxia,
  ctenophore: Ctenophore,
  hurdia: Hurdia,
  waptia: Waptia,
  sidneyia: Sidneyia,
  aysheaia: Aysheaia,
  ottoia: Ottoia,
  eldonia: Eldonia,
  dinomischus: Dinomischus,
};

/**
 * 窓の前を横切る演出の管理。同時に横切るのは 1 匹だけにする。
 * nextAt はシーンの経過時間（秒）。
 * opening: 到着した直後に、アノマロカリスが横切る演出をまだ始めていないか
 */
const flybyDirector = { activeKey: null as number | null, nextAt: 6, opening: true };

/** 到着した直後に横切る生き物 */
const OPENING_FLYBY_ID = "anomalocaris";
/** 到着してから横切り始めるまでの時間 (秒)。窓の中の演出が消えきるのを待つ */
const OPENING_DELAY = 0.6;

/** 横切る経路。画面外の横から入って、窓のすぐ前をカーブして反対側へ抜ける */
const FLYBY = { halfWidth: 11, z: -5.2, bulge: 2.6, y: -0.7 };

function flybyPoint(side: number, p: number, out: THREE.Vector3) {
  return out.set(
    side * FLYBY.halfWidth * (1 - 2 * p),
    FLYBY.y + 0.25 * Math.sin(Math.PI * 2 * p),
    FLYBY.z + FLYBY.bulge * Math.sin(Math.PI * p),
  );
}

type Flyby = {
  /** wait: 画面の外で待つ（到着直後の演出用） / exit: 画面の外へ出る / pass: 窓の前を横切る */
  mode: "wait" | "exit" | "pass";
  side: number;
  t: number;
  duration: number;
};

/** 横切る演出を途中でやめる */
function cancelFlyby(flyby: RefObject<Flyby | null>, key: number) {
  if (!flyby.current) return;
  flyby.current = null;
  if (flybyDirector.activeKey === key) flybyDirector.activeKey = null;
}

const frustum = new THREE.Frustum();
const projScreen = new THREE.Matrix4();
const tmpSphere = new THREE.Sphere();

/**
 * 海底にいる生き物の位置と大きさ（真上から見た円）。
 * 這う生き物がお互いや固着した生き物をすり抜けないようにするのに使う
 */
type FloorBody = { object: THREE.Object3D; radius: number; moves: boolean };
const floorBodies = new Map<number, FloorBody>();

/** 体の長さに対する、ぶつかる範囲の半径の割合。細長い体を円で近似するので小さめにする */
const BODY_RADIUS = 0.4;

/**
 * 海底を這う生き物が、ほかの生き物や岩に重なっていたら押し出し、
 * よける向きへ少しずつ向きを変える
 */
function avoidObstacles(
  key: number,
  s: { pos: THREE.Vector3; heading: number },
  radius: number,
  dt: number,
) {
  let pushX = 0;
  let pushZ = 0;
  const collide = (x: number, z: number, r: number, share: number) => {
    const dx = s.pos.x - x;
    const dz = s.pos.z - z;
    const min = radius + r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2);
    // 真上に重なっていたら、適当な向きへ押し出す
    const nx = d > 1e-4 ? dx / d : Math.cos(key);
    const nz = d > 1e-4 ? dz / d : Math.sin(key);
    pushX += nx * (min - d) * share;
    pushZ += nz * (min - d) * share;
  };

  for (const [other, body] of floorBodies) {
    if (other === key || !body.object.visible) continue;
    // 動く生き物どうしは半分ずつ押し合う。動かない生き物からは全部自分がよける
    collide(body.object.position.x, body.object.position.z, body.radius, body.moves ? 0.5 : 1);
  }
  const depth = diveStore.get().depth;
  for (const rock of ROCK_OBSTACLES) {
    if (presenceAt(depth, rock.depth) <= 0) continue;
    collide(rock.x, rock.z, rock.radius, 1);
  }
  if (pushX === 0 && pushZ === 0) return;

  s.pos.x += pushX;
  s.pos.z += pushZ;
  // 押し出された向きへ向きを変えて、回り込むように進む
  const desired = Math.atan2(-pushZ, pushX);
  const diff = Math.atan2(Math.sin(desired - s.heading), Math.cos(desired - s.heading));
  s.heading += diff * Math.min(1, dt * 2.5);
}

/** 泳ぎ回れる範囲 */
const BOUNDS = { x: 14, zNear: -6, zFar: -30 };
const CENTER = new THREE.Vector3(0, 0, (BOUNDS.zNear + BOUNDS.zFar) / 2);

/**
 * 窓の近くの海底の位置 (x, z)。ランダムに置くと全部が遠くになることがあるので、
 * 海底の生き物は種類ごとに 1 匹だけ、最初はここから歩き始める。
 * 窓の下半分に見える範囲で、互いに重ならないよう散らしてある
 */
const FRONT_SLOTS: [number, number][] = [
  [-3, -10],
  [2.6, -9.6],
  [-0.4, -12.6],
  [4.2, -12.2],
  [-4.6, -13.2],
  [1, -10.8],
  [-2, -15],
  [3.4, -14.6],
];

export function CreatureSwarm() {
  const instances = useMemo(() => {
    let slot = 0;
    return CREATURES.flatMap((c) =>
      Array.from({ length: c.count }, (_, i) => {
        const nearFront =
          i === 0 && !c.school && (c.behavior === "crawl" || c.behavior === "nearFloor");
        return {
          creature: c,
          index: i,
          seed: hashString(c.id) + i * 7919,
          front: nearFront ? FRONT_SLOTS[slot++ % FRONT_SLOTS.length] : undefined,
        };
      }),
    );
  }, []);

  return (
    <>
      {instances.map(({ creature, index, seed, front }) => (
        <CreatureInstance key={seed} creature={creature} index={index} seed={seed} front={front} />
      ))}
    </>
  );
}

function CreatureInstance({
  creature,
  index,
  seed,
  front,
}: {
  creature: Creature;
  /** 同じ種類の中での番号。群れの計算結果を取り出すのに使う */
  index: number;
  seed: number;
  /** 最初に置く窓の近くの位置 (x, z)。なければランダムに置く */
  front?: [number, number];
}) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const fade = useDepthFade(outer, creature.depth);
  const size = displayLength(creature);
  const Model = MODELS[creature.model];

  const phase = useMemo(() => createRandom(seed + 1)() * Math.PI * 2, [seed]);
  const simRef = useRef<Sim | null>(null);
  if (simRef.current === null) simRef.current = createSim(creature, seed, phase, front);
  const excite = useRef(0);
  /** 突っつかれてからの経過時間。反応していないときは null */
  const reactionTime = useRef<number | null>(null);
  const camera = useThree((s) => s.camera);
  const flyby = useRef<Flyby | null>(null);
  const schoolSnapped = useRef(false);

  useEffect(() => {
    if (!outer.current) return;
    return registerCreature(seed, {
      creatureId: creature.id,
      object: outer.current,
      size,
      // 固着する生き物は背が高いので、上の方（萼）を狙う
      centerHeight: creature.behavior === "sessile" ? 0.6 : 0.08,
      fade: () => fade.current,
      poke: () => {
        reactionTime.current = 0;
        // 横切っている途中なら、その場から普段の動きに戻る
        cancelFlyby(flyby, seed);
        const s = simRef.current;
        // 群れで泳ぐ生き物は、群れ全体が驚いて散る
        if (creature.school && outer.current) {
          const p = outer.current.position;
          getSchools()?.disturb(creature.id, p.x, p.y, p.z);
          return;
        }
        if (s && creature.reaction !== "burrow" && creature.reaction !== "freeze") {
          // カメラと反対の方向へ逃げる
          s.heading = Math.atan2(
            -(s.pos.z - camera.position.z),
            s.pos.x - camera.position.x,
          );
          s.turn = 0;
        }
      },
    });
  }, [creature.id, creature.behavior, creature.reaction, creature.school, seed, size, fade, camera]);

  /**
   * 横切る演出を進める。横切っている間は true を返し、普段の動きを止める。
   * 見えている個体を瞬間移動させないよう、まず近いほうの横へ泳いで画面の外へ出てから、
   * 同じ側から窓のすぐ前へ戻ってきて横切る。
   */
  const updateFlyby = (t: number, dt: number) => {
    const g = outer.current;
    const s = simRef.current;
    if (!g || !s) return false;

    if (!flyby.current && flybyDirector.opening) {
      // 到着直後の演出。URL で深さを指定されたときは、到着の描写がないのでやらない
      if (startOptions.fromUrl) {
        flybyDirector.opening = false;
      } else if (creature.id === OPENING_FLYBY_ID && flybyDirector.activeKey === null) {
        // 演出中は窓が隠れているので、その間に画面の外の出発点へ移しておく
        flybyDirector.opening = false;
        flybyDirector.activeKey = seed;
        flyby.current = {
          mode: "wait",
          side: s.rand() < 0.5 ? 1 : -1,
          t: 0,
          duration: (FLYBY.halfWidth * 2) / (size * 0.8),
        };
        // 途中で取りやめになったときは、いつもの間隔で横切る
        flybyDirector.nextAt = t + 20;
      }
    }

    if (!flyby.current) {
      const { focusKey, pokePhase } = diveStore.get();
      if (
        flybyDirector.activeKey !== null ||
        t < flybyDirector.nextAt ||
        fade.current < 0.99 ||
        focusKey === seed ||
        pokePhase !== "idle"
      ) {
        return false;
      }
      flyby.current = {
        mode: "exit",
        side: s.pos.x >= 0 ? 1 : -1,
        t: 0,
        duration: (FLYBY.halfWidth * 2) / (size * 0.8),
      };
      flybyDirector.activeKey = seed;
    }

    const fb = flyby.current;
    fb.t += dt;

    if (fb.mode === "wait") {
      flybyPoint(fb.side, 0, s.pos);
      s.heading = fb.side > 0 ? Math.PI : 0;
      s.turn = 0;
      g.position.copy(s.pos);
      g.rotation.set(0, s.heading, 0);
      // 到着するまでは待ち時間を数えない
      if (!diveStore.get().arrived) fb.t = 0;
      if (fb.t >= OPENING_DELAY) {
        fb.mode = "pass";
        fb.t = 0;
      }
      return true;
    }

    if (fb.mode === "exit") {
      // 横へ向きを変えて、少し速めに泳いで画面の外へ出る
      const desired = fb.side > 0 ? 0 : Math.PI;
      const diff = Math.atan2(Math.sin(desired - s.heading), Math.cos(desired - s.heading));
      s.heading += diff * Math.min(1, dt * 2);
      s.turn = 0;
      const speed = creature.speed * size * 2.5;
      s.pos.x += Math.cos(s.heading) * speed * dt;
      s.pos.z -= Math.sin(s.heading) * speed * dt;
      g.position.set(s.pos.x, s.baseY + Math.sin(t * 0.4 + phase) * 0.5, s.pos.z);
      g.rotation.set(0, s.heading, 0);

      projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreen);
      const offscreen = !frustum.intersectsSphere(tmpSphere.set(g.position, size));
      if (offscreen || Math.abs(s.pos.x) > 30 || fb.t > 12) {
        fb.mode = "pass";
        fb.t = 0;
      }
      return true;
    }

    const p = Math.min(1, fb.t / fb.duration);
    flybyPoint(fb.side, p, s.pos);
    // 進む向きに体を向ける
    const dx = -2 * FLYBY.halfWidth * fb.side;
    const dz = FLYBY.bulge * Math.PI * Math.cos(Math.PI * p);
    s.heading = Math.atan2(-dz, dx);
    s.turn = 0;
    g.position.copy(s.pos);
    g.rotation.set(0, s.heading, 0);
    if (inner.current) inner.current.rotation.z = Math.sin(t * 0.4 + phase) * 0.08;

    if (p >= 1) {
      // 抜けたら普段の動きに戻る。baseY も今の高さに合わせる
      s.baseY = s.pos.y;
      flyby.current = null;
      flybyDirector.activeKey = null;
      flybyDirector.nextAt = t + 18 + s.rand() * 17;
    }
    return true;
  };

  /**
   * 群れの計算結果に合わせて動かす。計算はワーカーで少し遅れて届くので、
   * 位置と向きはなめらかに追いかける。結果がまだなければ false を返す
   */
  const followSchool = (dt: number) => {
    const g = outer.current;
    const s = simRef.current;
    const boid = getSchools()?.get(creature.id, index);
    if (!g || !s || !boid) return false;
    const { data, offset } = boid;
    const [x, y, z, vx, vy, vz] = data.subarray(offset, offset + 6);
    if (!schoolSnapped.current) {
      // 最初は計算結果の位置へそのまま置く
      s.pos.set(x, y, z);
      schoolSnapped.current = true;
    } else {
      s.pos.x = THREE.MathUtils.damp(s.pos.x, x, 12, dt);
      s.pos.y = THREE.MathUtils.damp(s.pos.y, y, 12, dt);
      s.pos.z = THREE.MathUtils.damp(s.pos.z, z, 12, dt);
    }
    const horizontal = Math.hypot(vx, vz);
    if (horizontal > 1e-4) {
      const desired = Math.atan2(-vz, vx);
      const diff = Math.atan2(Math.sin(desired - s.heading), Math.cos(desired - s.heading));
      s.heading += diff * Math.min(1, dt * 8);
    }
    g.position.copy(s.pos);
    g.rotation.set(0, s.heading, 0);
    if (inner.current) {
      const pitch = THREE.MathUtils.clamp(Math.atan2(vy, horizontal), -0.5, 0.5);
      inner.current.rotation.z = THREE.MathUtils.damp(inner.current.rotation.z, pitch, 6, dt);
    }
    return true;
  };

  // 外されたときに「横切り中」のまま残らないようにする
  useEffect(() => () => cancelFlyby(flyby, seed), [seed]);

  // 海底にいる生き物は、ほかの這う生き物がすり抜けないよう位置を知らせる
  const onFloor = creature.behavior === "crawl" || creature.behavior === "sessile";
  useEffect(() => {
    if (!onFloor || !outer.current) return;
    floorBodies.set(seed, {
      object: outer.current,
      radius: size * BODY_RADIUS,
      moves: creature.behavior === "crawl",
    });
    return () => {
      floorBodies.delete(seed);
    };
  }, [onFloor, seed, size, creature.behavior]);

  useFrame(({ clock }, rawDt) => {
    const g = outer.current;
    const s = simRef.current;
    if (!g || !s) return;
    if (!g.visible) {
      cancelFlyby(flyby, seed);
      return;
    }
    const dt = Math.min(rawDt, 0.1);
    const t = clock.elapsedTime;

    const r = reactionEffect(creature.reaction, reactionTime.current, size);
    excite.current = r.excite;
    if (reactionTime.current !== null) {
      reactionTime.current += dt;
      if (r.done) reactionTime.current = null;
    }

    // 窓の前を横切る
    if (creature.flyby && updateFlyby(t, dt)) return;

    // 群れで泳ぐ生き物は、ワーカーが計算した位置と向きに合わせる
    if (creature.school && followSchool(dt)) return;

    // ゆっくりランダムに向きを変える
    s.turn += (s.rand() - 0.5) * dt * 1.5;
    s.turn *= 0.98;
    s.heading += s.turn * dt;

    // 範囲の外に出そうなら中心へ向かう
    const outside =
      Math.abs(s.pos.x) > BOUNDS.x ||
      s.pos.z > BOUNDS.zNear ||
      s.pos.z < BOUNDS.zFar;
    if (outside) {
      const desired = Math.atan2(-(CENTER.z - s.pos.z), CENTER.x - s.pos.x);
      let diff = desired - s.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.heading += diff * Math.min(1, dt * 1.2);
    }

    const speed = creature.speed * size * s.speedJitter * r.speedMul;
    s.pos.x += Math.cos(s.heading) * speed * dt;
    s.pos.z -= Math.sin(s.heading) * speed * dt;
    if (creature.behavior === "crawl") avoidObstacles(seed, s, size * BODY_RADIUS, dt);

    let y: number;
    let pitch = 0;
    switch (creature.behavior) {
      case "swim": {
        y = s.baseY + Math.sin(t * 0.4 + phase) * 0.5;
        pitch = Math.cos(t * 0.4 + phase) * 0.15;
        break;
      }
      case "nearFloor":
        y = floorY(s.pos.x, s.pos.z) + s.baseY + Math.sin(t * 0.7 + phase) * 0.15;
        break;
      case "drift":
        y = s.baseY + Math.sin(t * 0.3 + phase) * 0.4;
        break;
      default:
        y = floorY(s.pos.x, s.pos.z);
    }
    g.position.set(s.pos.x, y - r.sink, s.pos.z);
    g.rotation.set(0, s.heading + r.shiver, 0);
    if (inner.current) {
      inner.current.rotation.z = pitch;
      // 漂う生き物はゆらゆら傾く
      if (creature.behavior === "drift") {
        inner.current.rotation.x = Math.sin(t * 0.3 + phase) * 0.35;
      }
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (fade.current < VISIBLE_FADE) return;
    e.stopPropagation();
    selectCreature(creature.id, seed);
  };

  return (
    <group
      ref={outer}
      onClick={handleClick}
      onPointerOver={(e) => {
        if (fade.current < VISIBLE_FADE) return;
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <group ref={inner} scale={size}>
        <Model phase={phase} excite={excite} />
      </group>
    </group>
  );
}

type ReactionState = {
  /** 移動速度の倍率 */
  speedMul: number;
  /** 砂に潜る深さ */
  sink: number;
  /** 身震いの角度 */
  shiver: number;
  excite: number;
  done: boolean;
};

const NO_REACTION: ReactionState = { speedMul: 1, sink: 0, shiver: 0, excite: 0, done: true };

function easeInOut(x: number) {
  return x * x * (3 - 2 * x);
}

/** 突っつかれてから t 秒後の反応の状態 */
function reactionEffect(
  kind: Creature["reaction"],
  t: number | null,
  size: number,
): ReactionState {
  if (t === null) return NO_REACTION;
  switch (kind) {
    case "flee": {
      const k = Math.exp(-t / 1.2);
      return { speedMul: 1 + 7 * k, sink: 0, shiver: 0, excite: k, done: t > 5 };
    }
    case "flash": {
      const k = Math.exp(-t / 2);
      return { speedMul: 1 + 15 * k, sink: 0, shiver: 0, excite: k, done: t > 6 };
    }
    case "burrow": {
      // 一瞬ぶるっと震えてから、体を揺すりながら 0.9 秒かけて潜る。
      // 4 秒じっとして、1 秒かけて出てくる
      const down = easeInOut(THREE.MathUtils.clamp((t - 0.3) / 0.9, 0, 1));
      const up = THREE.MathUtils.clamp((t - 5.2) / 1, 0, 1);
      const wiggle = t < 1.2 ? Math.sin(t * 30) * 0.06 * (1 - down * 0.5) : 0;
      return {
        speedMul: t < 6.2 ? 0 : 1,
        sink: size * 0.09 * down * (1 - up),
        shiver: wiggle,
        excite: 0,
        done: t > 6.2,
      };
    }
    case "freeze": {
      const k = Math.exp(-t * 1.5);
      return {
        speedMul: t < 4 ? 0 : 1,
        sink: 0,
        shiver: Math.sin(t * 45) * 0.08 * k,
        excite: 0,
        done: t > 4,
      };
    }
  }
}

type Sim = {
  pos: THREE.Vector3;
  baseY: number;
  heading: number;
  turn: number;
  speedJitter: number;
  rand: () => number;
};

function createSim(
  creature: Creature,
  seed: number,
  phase: number,
  front?: [number, number],
): Sim {
  const rand = createRandom(seed);
  let x = (rand() * 2 - 1) * BOUNDS.x;
  let z = THREE.MathUtils.lerp(BOUNDS.zNear, BOUNDS.zFar, rand());
  if (front) [x, z] = front;
  let baseY: number;
  switch (creature.behavior) {
    case "swim":
      baseY = THREE.MathUtils.lerp(-2.5, 2, rand());
      break;
    case "nearFloor":
      baseY = 0.4 + rand() * 0.8; // 海底からの高さ
      break;
    case "drift":
      baseY = THREE.MathUtils.lerp(-3, 2.5, rand());
      break;
    default:
      baseY = 0;
  }
  return {
    pos: new THREE.Vector3(x, baseY, z),
    baseY,
    heading: rand() * Math.PI * 2 + phase,
    turn: 0,
    speedJitter: 0.7 + rand() * 0.6,
    rand,
  };
}
