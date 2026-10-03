"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRandom, floorY, useDepthFade } from "./utils";

type DecorKind = "algae" | "mat" | "vauxia" | "choia" | "rock";

type Decor = {
  kind: DecorKind;
  x: number;
  z: number;
  scale: number;
  rotation: number;
  depth: [number, number];
};

/** 種類ごとの出現水深と数 */
const DECOR_TYPES: { kind: DecorKind; depth: [number, number]; count: number }[] = [
  { kind: "mat", depth: [0, 70], count: 14 },
  { kind: "algae", depth: [0, 180], count: 22 },
  { kind: "vauxia", depth: [40, 850], count: 16 },
  { kind: "choia", depth: [120, 750], count: 12 },
  { kind: "rock", depth: [0, 1000], count: 18 },
];

export function Decorations() {
  const items = useMemo(() => {
    const rand = createRandom(1234);
    const list: Decor[] = [];
    for (const type of DECOR_TYPES) {
      for (let i = 0; i < type.count; i++) {
        // 範囲を少しずつずらして、潜るにつれて徐々に入れ替わるようにする
        const span = type.depth[1] - type.depth[0];
        const a = type.depth[0] + rand() * span * 0.3;
        const b = type.depth[1] - rand() * span * 0.3;
        list.push({
          kind: type.kind,
          x: (rand() * 2 - 1) * 20,
          z: -5 - rand() * 32,
          scale: 0.6 + rand() * 0.9,
          rotation: rand() * Math.PI * 2,
          depth: [Math.min(a, b), Math.max(a, b)],
        });
      }
    }
    return list;
  }, []);

  return (
    <>
      {items.map((d, i) => (
        <DecorItem key={i} decor={d} seed={i} />
      ))}
    </>
  );
}

function DecorItem({ decor, seed }: { decor: Decor; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useDepthFade(ref, decor.depth);
  const y = floorY(decor.x, decor.z);

  return (
    <group
      ref={ref}
      position={[decor.x, y, decor.z]}
      rotation={[0, decor.rotation, 0]}
      scale={decor.scale}
    >
      {decor.kind === "algae" && <Algae seed={seed} />}
      {decor.kind === "mat" && <MicrobialMat />}
      {decor.kind === "vauxia" && <Vauxia seed={seed} />}
      {decor.kind === "choia" && <Choia />}
      {decor.kind === "rock" && <Rock seed={seed} />}
    </group>
  );
}

/** 海藻。根元から揺れる */
function Algae({ seed }: { seed: number }) {
  const fronds = useMemo(() => {
    const rand = createRandom(seed + 99);
    return Array.from({ length: 5 }, () => ({
      height: 0.8 + rand() * 1.4,
      angle: rand() * Math.PI * 2,
      lean: 0.1 + rand() * 0.25,
      phase: rand() * Math.PI * 2,
    }));
  }, [seed]);
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    fronds.forEach((f, i) => {
      const g = refs.current[i];
      if (g) g.rotation.z = f.lean + Math.sin(t * 0.9 + f.phase) * 0.18;
    });
  });

  return (
    <>
      {fronds.map((f, i) => (
        <group key={i} rotation={[0, f.angle, 0]}>
          <group
            ref={(g) => {
              refs.current[i] = g;
            }}
          >
            <mesh position={[0, f.height / 2, 0]}>
              <boxGeometry args={[0.12, f.height, 0.02]} />
              <meshStandardMaterial color="#5f7d37" roughness={0.8} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

/** 微生物マット（ストロマトライト状の盛り上がり） */
function MicrobialMat() {
  return (
    <>
      <mesh scale={[1.2, 0.25, 0.9]}>
        <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#8b8a5c" roughness={1} />
      </mesh>
      <mesh position={[0.9, 0, 0.5]} scale={[0.6, 0.18, 0.5]}>
        <sphereGeometry args={[1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7a7a50" roughness={1} />
      </mesh>
    </>
  );
}

/** バウキシア（枝分かれする海綿） */
function Vauxia({ seed }: { seed: number }) {
  const branches = useMemo(() => {
    const rand = createRandom(seed + 7);
    return Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({
      height: 0.6 + rand() * 0.9,
      angle: rand() * Math.PI * 2,
      tilt: 0.25 + rand() * 0.45,
    }));
  }, [seed]);

  return (
    <>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 1, 8]} />
        <meshStandardMaterial color="#c8b07c" roughness={0.9} />
      </mesh>
      {branches.map((b, i) => (
        <group key={i} position={[0, 0.7, 0]} rotation={[0, b.angle, b.tilt]}>
          <mesh position={[0, b.height / 2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, b.height, 8]} />
            <meshStandardMaterial color="#d2bb88" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** チョイア（トゲが放射状に伸びる海綿） */
function Choia() {
  const spikes = useMemo(() => {
    const rand = createRandom(5);
    return Array.from({ length: 22 }, () => ({
      yaw: rand() * Math.PI * 2,
      pitch: 0.2 + rand() * 1.2,
      length: 0.4 + rand() * 0.3,
    }));
  }, []);

  return (
    <group position={[0, 0.08, 0]}>
      <mesh scale={[0.25, 0.12, 0.25]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#b9aa86" roughness={0.9} />
      </mesh>
      {spikes.map((s, i) => (
        <group key={i} rotation={[0, s.yaw, 0]}>
          <group rotation={[0, 0, -Math.PI / 2 + s.pitch]}>
            <mesh position={[0, s.length / 2 + 0.15, 0]}>
              <coneGeometry args={[0.012, s.length, 4]} />
              <meshStandardMaterial color="#e3d6b6" roughness={0.6} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function Rock({ seed }: { seed: number }) {
  const shape = useMemo(() => {
    const rand = createRandom(seed + 31);
    return [0.5 + rand() * 0.8, 0.3 + rand() * 0.4, 0.5 + rand() * 0.7] as const;
  }, [seed]);
  return (
    <mesh position={[0, shape[1] * 0.3, 0]} scale={shape}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#6d6658" roughness={1} flatShading />
    </mesh>
  );
}
