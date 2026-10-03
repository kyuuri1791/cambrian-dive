"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ModelProps } from "./types";
import { FlappedBody, JointedArm, StalkedEye, TailFan } from "./FlappedSwimmers";

/**
 * 追加の生き物のモデル。
 * 泳ぐものは +x が頭で原点が体の中心、海底にいるものは原点を足元（y = 0）に置く。
 */

/** フルディア。アノマロカリスの仲間で、頭の前に大きな甲羅が突き出ている */
export function Hurdia({ phase, excite }: ModelProps) {
  const body = "#8a5646";
  const flap = "#ad7a62";
  const shell = "#b48a6a";
  return (
    <FlappedBody
      segments={9}
      front={0.14}
      back={-0.4}
      width={0.2}
      height={0.05}
      flapLength={0.12}
      bodyColor={body}
      flapColor={flap}
      beat={4.5}
      phase={phase}
      excite={excite}
    >
      {/* 頭 */}
      <mesh position={[0.18, 0, 0]} scale={[0.07, 0.05, 0.07]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>
      {/* 前に突き出た甲羅（上と左右の3枚） */}
      <mesh position={[0.33, 0.05, 0]} rotation={[0, 0, 0.12]} scale={[0.24, 0.035, 0.09]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color={shell} roughness={0.45} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[0.26, -0.005, s * 0.085]}
          rotation={[s * 0.25, 0, 0]}
          scale={[0.17, 0.06, 0.012]}
        >
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={shell} roughness={0.45} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <StalkedEye
          key={s}
          position={[0.16, 0.03, s * 0.08]}
          rotation={[-s * 1.1, 0, 0]}
          length={0.05}
          size={0.018}
          color={body}
        />
      ))}
      {/* 前部付属肢 */}
      {[1, -1].map((s) => (
        <group key={s} position={[0.2, -0.04, s * 0.03]} rotation={[0, s * -0.1, -0.6]}>
          <JointedArm
            links={7}
            linkLength={0.026}
            radius={0.011}
            color="#a86a4c"
            curl={[1.4, 2.6]}
            curlSpeed={1.1}
            phase={phase + s}
            spines
          />
        </group>
      ))}
      <TailFan x={-0.4} color={flap} blades={3} />
    </FlappedBody>
  );
}

/** ワプティア。2 枚の殻と、しなる腹部、2 枚の尾びれをもつ */
export function Waptia({ phase, excite }: ModelProps) {
  const abdomen = useRef<(THREE.Group | null)[]>([]);
  const wave = useRef(phase);
  const segments = 6;

  useFrame((_, dt) => {
    wave.current += dt * 6 * (1 + 2.5 * (excite.current ?? 0));
    abdomen.current.forEach((g, i) => {
      if (g) g.rotation.z = Math.sin(wave.current - i * 0.6) * 0.12;
    });
  });

  const build = (i: number): ReactNode => {
    if (i >= segments) {
      // 尾びれ
      return [1, -1].map((s) => (
        <mesh
          key={s}
          position={[-0.07, 0, s * 0.045]}
          rotation={[0, s * 0.5, 0]}
          scale={[0.08, 0.008, 0.035]}
        >
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#d8c39c" roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ));
    }
    const r = 0.045 * (1 - i * 0.09);
    return (
      <group
        ref={(g) => {
          abdomen.current[i] = g;
        }}
        position={[i === 0 ? 0.07 : -0.06, 0, 0]}
      >
        <mesh scale={[0.034, r, r]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#d2bc94" roughness={0.5} />
        </mesh>
        {build(i + 1)}
      </group>
    );
  };

  return (
    <group>
      {/* 2 枚の殻 */}
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[0.24, 0.01, s * 0.04]}
          rotation={[s * 0.25, 0, 0]}
          scale={[0.16, 0.085, 0.045]}
        >
          <sphereGeometry args={[1, 16, 10]} />
          <meshStandardMaterial color="#c9b089" roughness={0.4} transparent opacity={0.9} />
        </mesh>
      ))}
      {/* 眼と触角 */}
      {[1, -1].map((s) => (
        <group key={s}>
          <StalkedEye
            position={[0.39, 0.02, s * 0.025]}
            rotation={[-s * 0.9, 0, -0.6]}
            length={0.03}
            size={0.012}
            color="#c9b089"
          />
          <mesh position={[0.52, 0.02, s * 0.04]} rotation={[0, s * 0.3, Math.PI / 2 - 0.15]}>
            <cylinderGeometry args={[0.002, 0.004, 0.26, 4]} />
            <meshStandardMaterial color="#b7a07c" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {build(0)}
    </group>
  );
}

/** シドネイア。平たい大型の節足動物 */
export function Sidneyia({ phase }: ModelProps) {
  const legs = useRef<(THREE.Group | null)[]>([]);
  const shell = "#6f6a52";
  const dark = "#57533f";
  const thorax = 9;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 4 + phase;
    legs.current.forEach((l, i) => {
      if (l) l.rotation.z = Math.sin(t - Math.floor(i / 2) * 0.8 + (i % 2) * Math.PI) * 0.3;
    });
  });

  return (
    <group position={[0, 0.04, 0]}>
      {/* 頭の盾 */}
      <mesh position={[0.3, 0.01, 0]} scale={[0.13, 0.05, 0.19]}>
        <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={shell} roughness={0.55} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.36, 0.04, s * 0.06]}>
          <sphereGeometry args={[0.018, 8, 6]} />
          <meshStandardMaterial color="#1f1c16" roughness={0.3} />
        </mesh>
      ))}
      {/* 胸部の節と脚 */}
      {Array.from({ length: thorax }, (_, i) => {
        const x = 0.17 - i * 0.04;
        const w = 0.42 - Math.abs(i - 3) * 0.035;
        return (
          <group key={i} position={[x, 0.01, 0]}>
            <mesh scale={[0.022, 0.035, w / 2]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color={i % 2 ? shell : dark} roughness={0.55} />
            </mesh>
            {[1, -1].map((s, j) => (
              <group
                key={s}
                position={[0, -0.01, s * w * 0.4]}
                ref={(g) => {
                  legs.current[i * 2 + j] = g;
                }}
              >
                <mesh position={[0, -0.025, s * 0.02]} rotation={[s * 0.5, 0, 0]}>
                  <cylinderGeometry args={[0.005, 0.007, 0.06, 5]} />
                  <meshStandardMaterial color={dark} roughness={0.6} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
      {/* 腹部と尾扇 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.2 - i * 0.045, 0.01, 0]} scale={[0.024, 0.03, 0.08 - i * 0.012]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={shell} roughness={0.55} />
        </mesh>
      ))}
      <TailFan x={-0.31} color={dark} blades={3} />
      {/* 触角 */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.47, 0.01, s * 0.05]} rotation={[0, s * 0.4, Math.PI / 2]}>
          <cylinderGeometry args={[0.003, 0.005, 0.14, 4]} />
          <meshStandardMaterial color={dark} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** アイシェアイア。カギムシに似た葉足動物 */
export function Aysheaia({ phase }: ModelProps) {
  const body = "#c79a78";
  const legs = useRef<(THREE.Group | null)[]>([]);
  const pairs = 10;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 4 + phase;
    legs.current.forEach((l, i) => {
      if (!l) return;
      const pair = Math.floor(i / 2);
      l.rotation.z = Math.sin(t - pair * 0.7 + (i % 2) * Math.PI) * 0.3;
    });
  });

  return (
    <group>
      {/* 輪のくびれがある胴体 */}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[0.38 - i * 0.05, 0.11, 0]} scale={[0.032, 0.05, 0.05]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={body} roughness={0.7} />
        </mesh>
      ))}
      {/* 脚 */}
      {Array.from({ length: pairs }, (_, i) =>
        [1, -1].map((s, j) => (
          <group
            key={`${i}${s}`}
            position={[0.3 - i * 0.07, 0.09, s * 0.035]}
            ref={(g) => {
              legs.current[i * 2 + j] = g;
            }}
          >
            <mesh position={[0, -0.045, s * 0.015]} rotation={[s * 0.35, 0, 0]}>
              <cylinderGeometry args={[0.01, 0.016, 0.1, 6]} />
              <meshStandardMaterial color={body} roughness={0.7} />
            </mesh>
            {/* 足先の小さなツメ */}
            <mesh position={[0.01, -0.095, s * 0.03]} rotation={[0, 0, -1.2]}>
              <coneGeometry args={[0.004, 0.02, 4]} />
              <meshStandardMaterial color="#8a6a50" roughness={0.6} />
            </mesh>
          </group>
        )),
      )}
      {/* 頭の付属肢 */}
      {[1, -1].map((s) => (
        <group key={s} position={[0.42, 0.12, s * 0.025]} rotation={[s * 0.3, 0, 0.3]}>
          <mesh position={[0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.01, 0.09, 5]} />
            <meshStandardMaterial color={body} roughness={0.7} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0.02 + k * 0.025, 0.012, 0]}>
              <coneGeometry args={[0.003, 0.02, 4]} />
              <meshStandardMaterial color="#8a6a50" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** オットイア。泥に体を半分うずめた鰓曳動物。トゲのある口を出し入れする */
export function Ottoia({ phase, excite }: ModelProps) {
  const rings = 18;
  const parts = useRef<(THREE.Mesh | null)[]>([]);
  const proboscis = useRef<THREE.Group>(null);
  const wave = useRef(phase);

  // U 字に曲がった体の中心線。両端は泥に埋まる
  const path = useMemo(
    () =>
      Array.from({ length: rings }, (_, i) => {
        const k = i / (rings - 1);
        return new THREE.Vector3(0.42 - k * 0.84, -0.03 + 0.13 * Math.sin(Math.PI * k), 0);
      }),
    [],
  );

  useFrame((_, dt) => {
    wave.current += dt * 3 * (1 + 3 * (excite.current ?? 0));
    const t = wave.current;
    // 体をうねらせる（ぜん動）
    parts.current.forEach((m, i) => {
      if (!m) return;
      const s = 1 + 0.15 * Math.sin(t * 2 - i * 0.6);
      m.scale.set(0.032, 0.042 * s, 0.042 * s);
    });
    // 口を出し入れする
    if (proboscis.current) {
      const out = (Math.sin(t * 0.7) + 1) / 2;
      proboscis.current.scale.setScalar(0.4 + 0.6 * out);
    }
  });

  return (
    <group>
      {path.map((p, i) => (
        <mesh
          key={i}
          position={p}
          ref={(m) => {
            parts.current[i] = m;
          }}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={i % 2 ? "#d8b49c" : "#c9a189"} roughness={0.7} />
        </mesh>
      ))}
      {/* トゲの並んだ口（頭側の端から斜め上に出る） */}
      <group position={[0.4, 0.02, 0]} rotation={[0, 0, 0.9]}>
        <group ref={proboscis}>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 0.1, 10]} />
            <meshStandardMaterial color="#e3c2aa" roughness={0.6} />
          </mesh>
          {Array.from({ length: 10 }, (_, k) => {
            const a = (k / 10) * Math.PI * 2;
            return (
              <mesh
                key={k}
                position={[Math.cos(a) * 0.032, 0.09, Math.sin(a) * 0.032]}
                rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}
              >
                <coneGeometry args={[0.005, 0.03, 4]} />
                <meshStandardMaterial color="#f2e2c8" roughness={0.5} />
              </mesh>
            );
          })}
        </group>
      </group>
    </group>
  );
}

/** エルドニア。円盤状の体で、中に渦巻き状の消化管が透けて見える */
export function Eldonia({ phase, excite }: ModelProps) {
  const tentacles = useRef<THREE.Group>(null);

  const gut = useMemo(() => {
    const points = Array.from({ length: 60 }, (_, i) => {
      const k = i / 59;
      const a = k * Math.PI * 3.2;
      const r = 0.08 + k * 0.28;
      // 半透明の円盤越しにはっきり見えるよう、表面近くに置く
      return new THREE.Vector3(Math.cos(a) * r, 0.055, Math.sin(a) * r);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 120, 0.024, 6, false);
  }, []);

  useFrame(({ clock }) => {
    if (tentacles.current) {
      const k = excite.current ?? 0;
      tentacles.current.rotation.y = clock.elapsedTime * (0.3 + k * 2) + phase;
    }
  });

  return (
    // 真横から見ると線になってしまうので、斜めに傾けて面が見えるようにする
    <group rotation={[0.75, 0, 0.6]}>
      {/* 円盤 */}
      <mesh scale={[0.5, 0.07, 0.5]}>
        <sphereGeometry args={[1, 32, 12]} />
        {/* 暗い深海でも見えるよう、ほんのり明るくしておく */}
        <meshStandardMaterial
          color="#dcc79f"
          emissive="#9a8258"
          emissiveIntensity={1}
          roughness={0.4}
          transparent
          opacity={0.88}
          depthWrite={false}
        />
      </mesh>
      {/* 縁の放射状の溝 */}
      {Array.from({ length: 32 }, (_, i) => (
        <group key={i} rotation={[0, (i / 32) * Math.PI * 2, 0]}>
          <mesh position={[0.42, 0.03, 0]}>
            <boxGeometry args={[0.12, 0.004, 0.006]} />
            <meshStandardMaterial color="#a88d64" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
      {/* 渦巻き状の消化管 */}
      <mesh geometry={gut}>
        <meshStandardMaterial color="#5e4226" emissive="#2e1e0e" roughness={0.6} />
      </mesh>
      {/* 中央下の触手 */}
      <group ref={tentacles} position={[0, -0.05, 0]}>
        {Array.from({ length: 5 }, (_, i) => (
          <group key={i} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
            <mesh position={[0.05, -0.06, 0]} rotation={[0, 0, 0.5]}>
              <cylinderGeometry args={[0.006, 0.012, 0.13, 5]} />
              <meshStandardMaterial color="#d9c19a" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** ディノミスクス。細い柄の先に、花びらのような板が並んだ萼（がく）がつく */
export function Dinomischus({ phase }: ModelProps) {
  const sway = useRef<THREE.Group>(null);
  const bracts = 16;

  useFrame(({ clock }) => {
    if (sway.current) {
      const t = clock.elapsedTime + phase;
      sway.current.rotation.z = Math.sin(t * 0.8) * 0.08;
      sway.current.rotation.x = Math.sin(t * 0.6 + 1) * 0.06;
    }
  });

  return (
    <group ref={sway}>
      {/* 柄 */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.012, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#c9b996" roughness={0.7} />
      </mesh>
      {/* 根元の付着部 */}
      <mesh scale={[0.05, 0.02, 0.05]}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color="#a8987a" roughness={0.8} />
      </mesh>
      {/* 萼 */}
      <mesh position={[0, 0.66, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.08, 0.14, 14]} />
        <meshStandardMaterial color="#d4c3a0" roughness={0.6} />
      </mesh>
      {/* 花びらのような板 */}
      {Array.from({ length: bracts }, (_, i) => (
        <group key={i} position={[0, 0.72, 0]} rotation={[0, (i / bracts) * Math.PI * 2, 0]}>
          {/* 外側へ開くように傾ける */}
          <group position={[0.06, 0, 0]} rotation={[0, 0, -0.55]}>
            <mesh position={[0, 0.12, 0]} scale={[0.004, 0.13, 0.025]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color="#e6d5b2" roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
