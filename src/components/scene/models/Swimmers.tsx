"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ModelProps } from "./types";

export function Marrella({ phase }: ModelProps) {
  const gills = useRef<(THREE.Group | null)[]>([]);
  const segments = 9;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 9 + phase;
    gills.current.forEach((g, i) => {
      if (!g) return;
      const seg = Math.floor(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      g.rotation.x = side * (0.5 + Math.sin(t - seg * 0.8) * 0.4);
    });
  });

  const spineMaterial = (
    <meshPhysicalMaterial
      color="#a9c4d6"
      roughness={0.2}
      metalness={0.1}
      iridescence={1}
      iridescenceIOR={1.6}
      iridescenceThicknessRange={[200, 800]}
    />
  );

  return (
    <group>
      {/* 頭の盾 */}
      <mesh position={[0.3, 0.02, 0]} scale={[0.1, 0.05, 0.08]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color="#8fa6b4" roughness={0.4} />
      </mesh>
      {/* 後ろ向きに伸びる2対のトゲ */}
      {[1, -1].map((s) => (
        <group key={s}>
          <group position={[0.3, 0.04, s * 0.05]} rotation={[s * 0.5, 0, 0.12]}>
            <mesh position={[-0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.014, 0.7, 6]} />
              {spineMaterial}
            </mesh>
          </group>
          <group position={[0.3, 0.02, s * 0.07]} rotation={[s * -0.1, s * 0.45, -0.05]}>
            <mesh position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.012, 0.6, 6]} />
              {spineMaterial}
            </mesh>
          </group>
        </group>
      ))}
      {/* 胴体の節とエラのついた脚 */}
      {Array.from({ length: segments }, (_, i) => {
        const x = 0.2 - i * 0.05;
        const w = 0.07 * (1 - i / segments / 1.6);
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh scale={[0.028, 0.025, w]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color="#b3c0c4" roughness={0.5} />
            </mesh>
            {[1, -1].map((s, j) => (
              <group
                key={s}
                position={[0, -0.01, s * w * 0.8]}
                ref={(g) => {
                  gills.current[i * 2 + j] = g;
                }}
              >
                <mesh position={[0, 0, s * 0.04]} scale={[0.02, 0.003, 0.04]}>
                  <sphereGeometry args={[1, 6, 4]} />
                  <meshStandardMaterial
                    color="#d8e4e8"
                    roughness={0.4}
                    transparent
                    opacity={0.75}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
      {/* 触角 */}
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[0.52, 0, s * 0.06]}
          rotation={[0, s * 0.35, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.003, 0.006, 0.4, 5]} />
          <meshStandardMaterial color="#9fb2bc" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

type EelProps = ModelProps & {
  color: string;
  segments: number;
  height: number;
  /** 体をくねらせる速さ */
  wiggle: number;
  fish?: boolean;
};

/** 体をくねらせて泳ぐ細長い体。ピカイアとハイコウイクチスで共有 */
function EelBody({ phase, excite, color, segments, height, wiggle, fish = false }: EelProps) {
  const parts = useRef<(THREE.Group | null)[]>([]);
  const wave = useRef(phase);

  useFrame((_, dt) => {
    wave.current += dt * wiggle * (1 + 2.5 * (excite.current ?? 0));
    const t = wave.current;
    parts.current.forEach((p, i) => {
      if (!p) return;
      const k = i / (segments - 1);
      const amp = 0.015 + 0.06 * k;
      p.position.z = Math.sin(t - i * 0.55) * amp;
      p.rotation.y = Math.cos(t - i * 0.55) * 0.5 * k;
    });
  });

  const step = 1 / segments;
  return (
    <group>
      {Array.from({ length: segments }, (_, i) => {
        const k = i / (segments - 1);
        // 頭と尾が細い紡錘形
        const h = height * Math.sin(Math.PI * (0.12 + 0.88 * (1 - k) * 0.85 + 0.1 * k));
        return (
          <group
            key={i}
            position={[0.5 - step * (i + 0.5), 0, 0]}
            ref={(g) => {
              parts.current[i] = g;
            }}
          >
            <mesh scale={[step * 0.75, Math.max(0.012, h), Math.max(0.008, h * 0.4)]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial
                color={color}
                roughness={0.45}
                transparent={!fish}
                opacity={fish ? 1 : 0.88}
              />
            </mesh>
            {fish && k > 0.3 && k < 0.85 && (
              <mesh position={[0, h * 0.9, 0]} scale={[step * 0.6, h * 0.5, 0.003]}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color="#8f9a80" roughness={0.5} side={THREE.DoubleSide} />
              </mesh>
            )}
            {fish && i === 0 &&
              [1, -1].map((s) => (
                <mesh key={s} position={[0.01, h * 0.25, s * h * 0.4]}>
                  <sphereGeometry args={[0.012, 8, 6]} />
                  <meshStandardMaterial color="#111" roughness={0.2} />
                </mesh>
              ))}
            {!fish && i === 0 &&
              [1, -1].map((s) => (
                <mesh
                  key={s}
                  position={[0.04, h * 0.4, s * 0.008]}
                  rotation={[s * 0.4, 0, -0.8]}
                >
                  <cylinderGeometry args={[0.002, 0.003, 0.05, 4]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              ))}
          </group>
        );
      })}
    </group>
  );
}

export function Pikaia({ phase, excite }: ModelProps) {
  return (
    <EelBody phase={phase} excite={excite} color="#e6d3b0" segments={14} height={0.07} wiggle={7} />
  );
}

export function Haikouichthys({ phase, excite }: ModelProps) {
  return (
    <EelBody phase={phase} excite={excite} color="#b9c2a6" segments={12} height={0.1} wiggle={10} fish />
  );
}

export function Ctenophore({ phase, excite }: ModelProps) {
  const rows = 12;
  const rowMaterials = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const color = new THREE.Color();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    rowMaterials.current.forEach((m, i) => {
      if (!m) return;
      // くし板の虹色のきらめき
      color.setHSL((t * 0.25 + i / rows) % 1, 0.9, 0.6);
      m.emissive.copy(color);
      // 突っつかれると強くきらめく
      const k = excite.current ?? 0;
      m.emissiveIntensity = (0.6 + 0.4 * Math.sin(t * (6 + 14 * k) + i)) * (1 + 3 * k);
    });
  });

  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh scale={[0.32, 0.5, 0.32]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial
          color="#cfe9f0"
          roughness={0.1}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: rows }, (_, i) => (
        <group key={i} rotation={[0, (i / rows) * Math.PI * 2, 0]}>
          <mesh scale={[0.33, 0.48, 0.33]} rotation={[0, 0, -Math.PI * 0.4]}>
            <torusGeometry args={[1, 0.02, 4, 24, Math.PI * 0.8]} />
            <meshStandardMaterial
              ref={(m) => {
                rowMaterials.current[i] = m;
              }}
              color="#ffffff"
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
