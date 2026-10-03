"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ModelProps } from "./types";

/**
 * モデルはすべて +x 方向が頭、全長およそ 1 で作る。
 * 実際の大きさは呼び出し側で scale する。
 */

type FlappedBodyProps = {
  segments: number;
  /** 頭側の x 座標 */
  front: number;
  /** 尾側の x 座標 */
  back: number;
  /** 胴体の最大幅 */
  width: number;
  height: number;
  /** ヒレの長さ（体の横方向） */
  flapLength: number;
  bodyColor: string;
  flapColor: string;
  /** ヒレを波打たせる速さ */
  beat: number;
  phase: number;
  excite: RefObject<number>;
  children?: ReactNode;
};

/** 体の両脇にヒレが並んだ胴体。ラディオドンタ類やオパビニアに使う */
export function FlappedBody({
  segments,
  front,
  back,
  width,
  height,
  flapLength,
  bodyColor,
  flapColor,
  beat,
  phase,
  excite,
  children,
}: FlappedBodyProps) {
  const flaps = useRef<(THREE.Group | null)[]>([]);
  const step = (front - back) / segments;
  const wave = useRef(phase);

  useFrame((_, dt) => {
    // 興奮すると速く羽ばたく
    wave.current += dt * beat * (1 + 2.5 * (excite.current ?? 0));
    const t = wave.current;
    for (let i = 0; i < segments; i++) {
      // 頭から尾へ波が伝わる
      const angle = Math.sin(t - i * 0.7) * 0.55;
      const left = flaps.current[i * 2];
      const right = flaps.current[i * 2 + 1];
      if (left) left.rotation.x = angle;
      if (right) right.rotation.x = -angle;
    }
  });

  return (
    <group>
      {Array.from({ length: segments }, (_, i) => {
        const k = i / (segments - 1);
        const x = front - step * (i + 0.5);
        const w = width * (1 - 0.55 * k * k);
        const len = flapLength * (1 - 0.45 * k);
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh scale={[step * 0.62, height * (1 - 0.4 * k), w / 2]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={bodyColor} roughness={0.65} />
            </mesh>
            {[1, -1].map((side, s) => (
              <group
                key={side}
                position={[0, 0, (side * w) / 2.3]}
                ref={(g) => {
                  flaps.current[i * 2 + s] = g;
                }}
              >
                <mesh
                  position={[0, 0, (side * len) / 2]}
                  scale={[step * 0.75, 0.006, len / 2]}
                >
                  <sphereGeometry args={[1, 10, 6]} />
                  <meshStandardMaterial
                    color={flapColor}
                    roughness={0.5}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
      {children}
    </group>
  );
}

/** 関節でつながった触手。curl で巻き具合を変える */
export function JointedArm({
  links,
  linkLength,
  radius,
  color,
  curl,
  curlSpeed,
  phase,
  spines = false,
}: {
  links: number;
  linkLength: number;
  radius: number;
  color: string;
  curl: [number, number];
  curlSpeed: number;
  phase: number;
  spines?: boolean;
}) {
  const joints = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const s = (Math.sin(clock.elapsedTime * curlSpeed + phase) + 1) / 2;
    const total = THREE.MathUtils.lerp(curl[0], curl[1], s);
    joints.current.forEach((j) => {
      if (j) j.rotation.z = -total / links;
    });
  });

  const build = (i: number): ReactNode => {
    if (i >= links) return null;
    const r = radius * (1 - (i / links) * 0.6);
    return (
      <group
        ref={(g) => {
          joints.current[i] = g;
        }}
        position={[i === 0 ? 0 : linkLength, 0, 0]}
      >
        <mesh position={[linkLength / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[r * 0.85, r, linkLength * 1.05, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        {spines && (
          <mesh
            position={[linkLength / 2, -r * 1.6, 0]}
            rotation={[0, 0, Math.PI]}
          >
            <coneGeometry args={[r * 0.35, r * 2, 5]} />
            <meshStandardMaterial color="#f0d8b0" roughness={0.5} />
          </mesh>
        )}
        {build(i + 1)}
      </group>
    );
  };

  return <>{build(0)}</>;
}

export function StalkedEye({
  position,
  rotation,
  length,
  size,
  color = "#3a2a20",
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  size: number;
  color?: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, length / 2, 0]}>
        <cylinderGeometry args={[size * 0.3, size * 0.4, length, 6]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, length, 0]}>
        <sphereGeometry args={[size, 12, 10]} />
        <meshStandardMaterial color="#111" roughness={0.2} metalness={0.3} />
      </mesh>
    </group>
  );
}

export function TailFan({
  x,
  color,
  blades,
  upward = 0,
}: {
  x: number;
  color: string;
  blades: number;
  upward?: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      {Array.from({ length: blades }, (_, i) =>
        [1, -1].map((side) => (
          <group
            key={`${i}-${side}`}
            rotation={[side * upward, side * (0.25 + i * 0.3), 0]}
          >
            <mesh position={[-0.07, 0, 0]} scale={[0.08, 0.006, 0.022]}>
              <sphereGeometry args={[1, 10, 6]} />
              <meshStandardMaterial
                color={color}
                roughness={0.5}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

export function Anomalocaris({ phase, excite }: ModelProps) {
  const body = "#a9533a";
  const flap = "#c97b55";
  return (
    <group>
      <FlappedBody
        segments={11}
        front={0.34}
        back={-0.36}
        width={0.22}
        height={0.045}
        flapLength={0.13}
        bodyColor={body}
        flapColor={flap}
        beat={5}
        phase={phase}
        excite={excite}
      >
        {/* 頭 */}
        <mesh position={[0.38, 0.005, 0]} scale={[0.075, 0.045, 0.07]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>
        <StalkedEye
          position={[0.37, 0.03, 0.05]}
          rotation={[-0.9, 0, -0.2]}
          length={0.06}
          size={0.02}
          color={body}
        />
        <StalkedEye
          position={[0.37, 0.03, -0.05]}
          rotation={[0.9, 0, -0.2]}
          length={0.06}
          size={0.02}
          color={body}
        />
        {/* 前部付属肢（大きな触手） */}
        {[1, -1].map((side) => (
          <group
            key={side}
            position={[0.43, -0.015, side * 0.025]}
            rotation={[0, side * -0.15, -0.3]}
          >
            <JointedArm
              links={10}
              linkLength={0.028}
              radius={0.013}
              color="#c4683f"
              curl={[2.2, 3.6]}
              curlSpeed={1.3}
              phase={phase + side}
              spines
            />
          </group>
        ))}
        {/* 口（円形の口器） */}
        <mesh
          position={[0.38, -0.04, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.022, 0.007, 6, 14]} />
          <meshStandardMaterial color="#e3b48a" roughness={0.5} />
        </mesh>
        <TailFan x={-0.36} color={flap} blades={3} />
      </FlappedBody>
    </group>
  );
}

export function Opabinia({ phase, excite }: ModelProps) {
  const body = "#b98466";
  const flap = "#d3a283";
  return (
    <group>
      <FlappedBody
        segments={9}
        front={0.22}
        back={-0.34}
        width={0.15}
        height={0.04}
        flapLength={0.09}
        bodyColor={body}
        flapColor={flap}
        beat={6}
        phase={phase}
        excite={excite}
      >
        <mesh position={[0.26, 0.01, 0]} scale={[0.06, 0.045, 0.055]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={body} roughness={0.6} />
        </mesh>
        {/* 5つの眼 */}
        {[
          [0.27, 0.0, 0.0, 0.0],
          [0.25, 0.035, 0.6, -0.15],
          [0.25, -0.035, -0.6, -0.15],
          [0.23, 0.03, 0.45, 0.2],
          [0.23, -0.03, -0.45, 0.2],
        ].map(([x, z, roll, pitch], i) => (
          <StalkedEye
            key={i}
            position={[x, 0.035, z]}
            rotation={[-roll, 0, pitch]}
            length={0.05}
            size={0.014}
            color={body}
          />
        ))}
        {/* 先端にハサミがついたノズル */}
        <group position={[0.3, -0.02, 0]} rotation={[0, 0, -0.35]}>
          <JointedArm
            links={7}
            linkLength={0.032}
            radius={0.009}
            color="#c99674"
            curl={[0.2, 1.4]}
            curlSpeed={0.9}
            phase={phase}
          />
        </group>
        <TailFan x={-0.34} color="#d07a5a" blades={3} upward={0.5} />
      </FlappedBody>
    </group>
  );
}
