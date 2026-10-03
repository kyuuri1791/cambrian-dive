"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ModelProps } from "./types";

/** 海底を這うモデルは原点を足元（y = 0）に置く */

export function Trilobite({ phase }: ModelProps) {
  const shell = "#7f6a4b";
  const dark = "#5b4a33";
  const antennae = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 2 + phase;
    antennae.current.forEach((a, i) => {
      if (a) a.rotation.y = (i === 0 ? 1 : -1) * (0.35 + Math.sin(t + i) * 0.15);
    });
  });

  const thorax = 8;
  return (
    <group position={[0, 0.03, 0]}>
      {/* 頭部 */}
      <mesh position={[0.27, 0.02, 0]} scale={[0.17, 0.06, 0.32]}>
        <sphereGeometry args={[1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={shell} roughness={0.55} />
      </mesh>
      {/* 中央の盛り上がり（頭鞍） */}
      <mesh position={[0.29, 0.05, 0]} scale={[0.11, 0.06, 0.08]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={dark} roughness={0.5} />
      </mesh>
      {/* 眼 */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.25, 0.06, s * 0.13]} scale={[0.03, 0.025, 0.025]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#2a2218" roughness={0.3} />
        </mesh>
      ))}
      {/* 頬のトゲ */}
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[0.08, 0.02, s * 0.3]}
          rotation={[0, 0, Math.PI / 2 + 0.05]}
        >
          <coneGeometry args={[0.02, 0.24, 6]} />
          <meshStandardMaterial color={shell} roughness={0.55} />
        </mesh>
      ))}
      {/* 胸部の節 */}
      {Array.from({ length: thorax }, (_, i) => {
        const x = 0.14 - i * 0.042;
        const w = 0.6 - i * 0.03;
        return (
          <group key={i} position={[x, 0.02, 0]}>
            <mesh scale={[0.019, 0.035, w / 2]}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial color={shell} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.025, 0]} scale={[0.02, 0.035, 0.07]}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial color={dark} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      {/* 尾部 */}
      <mesh position={[-0.27, 0.015, 0]} scale={[0.12, 0.04, 0.2]}>
        <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={shell} roughness={0.55} />
      </mesh>
      {[-0.12, 0, 0.12].map((z, i) => (
        <mesh key={i} position={[-0.38, 0.01, z]} rotation={[0, z * 2, Math.PI / 2]}>
          <coneGeometry args={[0.012, 0.07, 5]} />
          <meshStandardMaterial color={dark} roughness={0.55} />
        </mesh>
      ))}
      {/* 触角 */}
      {[1, -1].map((s, i) => (
        <group
          key={s}
          position={[0.42, 0.01, s * 0.04]}
          ref={(g) => {
            antennae.current[i] = g;
          }}
        >
          <mesh position={[0.11, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.003, 0.006, 0.22, 5]} />
            <meshStandardMaterial color="#9a8462" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Hallucigenia({ phase }: ModelProps) {
  const body = "#e0aea4";
  const legs = useRef<(THREE.Group | null)[]>([]);
  const pairs = 7;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 5 + phase;
    legs.current.forEach((l, i) => {
      if (!l) return;
      const pair = Math.floor(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      l.rotation.z = Math.sin(t - pair * 0.9 + (side > 0 ? 0 : Math.PI)) * 0.35;
    });
  });

  return (
    <group>
      {/* 胴体 */}
      <mesh position={[0, 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.035, 0.75, 6, 12]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>
      {/* 頭 */}
      <mesh position={[0.44, 0.17, 0]} scale={[0.06, 0.04, 0.04]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#e8bcb0" roughness={0.6} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.48, 0.19, s * 0.018]}>
          <sphereGeometry args={[0.008, 8, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      {Array.from({ length: pairs }, (_, i) => {
        const x = 0.25 - i * 0.075;
        return (
          <group key={i} position={[x, 0, 0]}>
            {/* 背中のトゲ */}
            {[1, -1].map((s) => (
              <mesh
                key={`spine${s}`}
                position={[-0.02, 0.25, s * 0.03]}
                rotation={[s * -0.35, 0, 0.25]}
              >
                <coneGeometry args={[0.012, 0.19, 6]} />
                <meshStandardMaterial color="#f1e2c6" roughness={0.4} />
              </mesh>
            ))}
            {/* 脚 */}
            {[1, -1].map((s, j) => (
              <group
                key={`leg${s}`}
                position={[0, 0.15, s * 0.025]}
                ref={(g) => {
                  legs.current[i * 2 + j] = g;
                }}
              >
                <mesh position={[0, -0.075, s * 0.02]} rotation={[s * 0.3, 0, 0]}>
                  <cylinderGeometry args={[0.008, 0.012, 0.16, 6]} />
                  <meshStandardMaterial color={body} roughness={0.6} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
      {/* 前方の細い触手 */}
      {[0, 1, 2].map((i) =>
        [1, -1].map((s) => (
          <mesh
            key={`t${i}${s}`}
            position={[0.32 + i * 0.03, 0.09, s * 0.03]}
            rotation={[s * 0.4, 0, 0.3]}
          >
            <cylinderGeometry args={[0.003, 0.005, 0.11, 5]} />
            <meshStandardMaterial color={body} roughness={0.6} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Wiwaxia({ phase }: ModelProps) {
  const spineGroup = useRef<THREE.Group>(null);

  // 体を覆う小片（スクレライト）の配置。数が多いのでインスタンス描画する
  const sclerites = useMemo(() => {
    const list: THREE.Matrix4[] = [];
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const v = (r + 0.5) / rows; // 0: 底の縁 → 1: 頂上
      const elev = v * (Math.PI / 2) * 0.92;
      const count = Math.max(4, Math.round(22 * Math.cos(elev)));
      for (let c = 0; c < count; c++) {
        const a = (c / count) * Math.PI * 2 + r * 0.3;
        const p = new THREE.Vector3(
          0.48 * Math.cos(elev) * Math.cos(a),
          0.2 * Math.sin(elev),
          0.3 * Math.cos(elev) * Math.sin(a),
        );
        const normal = new THREE.Vector3(
          p.x / (0.48 * 0.48),
          p.y / (0.2 * 0.2),
          p.z / (0.3 * 0.3),
        ).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normal,
        );
        // 小片が後ろ向きに重なるように少し傾ける
        q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.4)));
        list.push(
          new THREE.Matrix4().compose(
            p,
            q,
            new THREE.Vector3(0.07, 0.012, 0.035),
          ),
        );
      }
    }
    return list;
  }, []);

  const instanced = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(false);

  useFrame(({ clock }) => {
    if (instanced.current && !applied.current) {
      sclerites.forEach((m, i) => instanced.current!.setMatrixAt(i, m));
      instanced.current.instanceMatrix.needsUpdate = true;
      applied.current = true;
    }
    if (spineGroup.current) {
      spineGroup.current.rotation.x = Math.sin(clock.elapsedTime * 0.7 + phase) * 0.04;
    }
  });

  return (
    <group>
      <mesh scale={[0.46, 0.19, 0.28]}>
        <sphereGeometry args={[1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#5e4d31" roughness={0.8} />
      </mesh>
      <instancedMesh ref={instanced} args={[undefined, undefined, sclerites.length]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshPhysicalMaterial
          color="#8e7a4f"
          roughness={0.4}
          iridescence={0.6}
          iridescenceIOR={1.4}
        />
      </instancedMesh>
      {/* 背中の2列のトゲ */}
      <group ref={spineGroup}>
        {Array.from({ length: 8 }, (_, i) =>
          [1, -1].map((s) => {
            const x = 0.24 - i * 0.065;
            const h = 0.28 - Math.abs(i - 3.5) * 0.025;
            return (
              <group key={`${i}${s}`} position={[x, 0.17, s * 0.06]} rotation={[s * -0.3, 0, 0.35]}>
                <mesh position={[0, h / 2, 0]} scale={[1, 1, 0.35]}>
                  <coneGeometry args={[0.022, h, 6]} />
                  <meshPhysicalMaterial
                    color="#9c8758"
                    roughness={0.35}
                    iridescence={0.8}
                    iridescenceIOR={1.5}
                  />
                </mesh>
              </group>
            );
          }),
        )}
      </group>
    </group>
  );
}
