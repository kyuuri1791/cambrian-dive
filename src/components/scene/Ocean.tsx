"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { diveStore, motion } from "@/lib/diveStore";
import { createRandom, floorY } from "./utils";
import { Decorations } from "./Decorations";

/** 水深に対する海の色。上から順に補間する */
const WATER_STOPS: [number, THREE.Color][] = [
  [0, new THREE.Color("#4fb8cc")],
  [60, new THREE.Color("#1f86a3")],
  [200, new THREE.Color("#0d4763")],
  [500, new THREE.Color("#04192a")],
  [1000, new THREE.Color("#010509")],
];

const SAND = new THREE.Color("#c9b78a");
const MUD = new THREE.Color("#4a463b");

function waterColor(depth: number, out: THREE.Color) {
  for (let i = 1; i < WATER_STOPS.length; i++) {
    const [d1, c1] = WATER_STOPS[i];
    if (depth <= d1 || i === WATER_STOPS.length - 1) {
      const [d0, c0] = WATER_STOPS[i - 1];
      const t = THREE.MathUtils.clamp((depth - d0) / (d1 - d0), 0, 1);
      return out.copy(c0).lerp(c1, t);
    }
  }
  return out;
}

export function Ocean() {
  const camera = useThree((s) => s.camera);

  const fogRef = useRef<THREE.Fog>(null);
  const backgroundRef = useRef<THREE.Color>(null);

  const ambient = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const floorMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }, dt) => {
    const depth = diveStore.get().depth;
    const t = clock.elapsedTime;
    const fog = fogRef.current;
    const background = backgroundRef.current;
    if (!fog || !background) return;

    waterColor(depth, background);
    fog.color.copy(background);
    // 深いほど見通しが悪くなる
    fog.near = THREE.MathUtils.lerp(2, 0.5, depth / 1000);
    fog.far = THREE.MathUtils.lerp(55, 24, Math.min(1, depth / 600));

    const sunlight = Math.exp(-depth / 110);
    if (sun.current) {
      // 水面の揺らぎで光がちらつく
      const flicker = 1 + 0.08 * Math.sin(t * 2.1) + 0.05 * Math.sin(t * 3.7);
      sun.current.intensity = 2.6 * sunlight * flicker;
    }
    if (ambient.current) {
      ambient.current.intensity = 0.06 + 0.9 * Math.exp(-depth / 160);
    }
    if (hemi.current) {
      hemi.current.color.copy(background).multiplyScalar(1.6);
      hemi.current.intensity = 1.4 * Math.exp(-depth / 140);
    }
    if (spot.current) {
      // 暗くなってきたら探照灯を点ける
      const on = THREE.MathUtils.smoothstep(depth, 60, 320);
      // 生き物に近づいているときは照らしすぎないように弱める
      const near = diveStore.get().pokePhase !== "idle" ? 0.08 : 1;
      spot.current.intensity = THREE.MathUtils.damp(
        spot.current.intensity,
        160 * on * near,
        3,
        dt,
      );
      spot.current.position.copy(camera.position).add(new THREE.Vector3(0.6, -0.4, 0));
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const target = spot.current.target;
      target.position.copy(camera.position).addScaledVector(forward, 10);
      target.updateMatrixWorld();
    }
    if (floorMat.current) {
      floorMat.current.color
        .copy(SAND)
        .lerp(MUD, THREE.MathUtils.smoothstep(depth, 30, 700));
    }
  });

  return (
    <>
      <fog ref={fogRef} attach="fog" args={["#4fb8cc", 1, 60]} />
      <color ref={backgroundRef} attach="background" args={["#4fb8cc"]} />
      <ambientLight ref={ambient} intensity={0.9} />
      <hemisphereLight ref={hemi} groundColor="#3a3020" intensity={1.2} />
      <directionalLight ref={sun} position={[4, 20, 6]} intensity={2.4} />
      <spotLight
        ref={spot}
        angle={0.55}
        penumbra={0.6}
        distance={45}
        decay={1.4}
        color="#fff4dc"
        intensity={0}
      />

      <Seafloor materialRef={floorMat} />
      <Decorations />
      <MarineSnow />
      <LightRays />
    </>
  );
}

function Seafloor({
  materialRef,
}: {
  materialRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(140, 120, 140, 120);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -40);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, floorY(pos.getX(i), pos.getZ(i)));
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial ref={materialRef} roughness={1} color="#c9b78a" />
    </mesh>
  );
}

const SNOW_COUNT = 1400;
const SNOW_BOX = { x: 22, yMin: -6, yMax: 9, zMin: -40, zMax: 2 };

/** マリンスノー。潜行中は上へ流れて移動感を出す */
function MarineSnow() {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  const geometry = useMemo(() => {
    const rand = createRandom(42);
    const arr = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      arr[i * 3] = (rand() * 2 - 1) * SNOW_BOX.x;
      arr[i * 3 + 1] = THREE.MathUtils.lerp(SNOW_BOX.yMin, SNOW_BOX.yMax, rand());
      arr[i * 3 + 2] = THREE.MathUtils.lerp(SNOW_BOX.zMin, SNOW_BOX.zMax, rand());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useFrame(({ clock }, dt) => {
    if (!points.current) return;
    const pos = points.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    // 速く潜っても粒が流れすぎないように上限を設ける
    const rise = Math.min(14, Math.max(-14, motion.velocity * 0.04)) - 0.08;
    const h = SNOW_BOX.yMax - SNOW_BOX.yMin;
    const t = clock.elapsedTime;
    for (let i = 0; i < SNOW_COUNT; i++) {
      let y = arr[i * 3 + 1] + rise * dt;
      if (y > SNOW_BOX.yMax) y -= h;
      if (y < SNOW_BOX.yMin) y += h;
      arr[i * 3 + 1] = y;
      arr[i * 3] += Math.sin(t * 0.3 + i) * 0.002;
    }
    pos.needsUpdate = true;

    if (material.current) {
      const depth = diveStore.get().depth;
      material.current.opacity = THREE.MathUtils.lerp(0.35, 0.75, Math.min(1, depth / 500));
    }
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        size={0.07}
        color="#e8f4f0"
        transparent
        opacity={0.4}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/** 浅いところで差し込む光の筋 */
function LightRays() {
  const group = useRef<THREE.Group>(null);
  const rays = useMemo(() => {
    const rand = createRandom(7);
    return Array.from({ length: 9 }, () => ({
      x: (rand() * 2 - 1) * 16,
      z: -6 - rand() * 26,
      width: 0.6 + rand() * 1.6,
      tilt: (rand() - 0.5) * 0.3,
      phase: rand() * Math.PI * 2,
    }));
  }, []);
  const materials = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    const depth = diveStore.get().depth;
    const strength = Math.exp(-depth / 45);
    if (group.current) group.current.visible = strength > 0.01;
    rays.forEach((r, i) => {
      const m = materials.current[i];
      if (m) {
        m.opacity =
          strength * (0.07 + 0.05 * Math.sin(clock.elapsedTime * 0.6 + r.phase));
      }
    });
  });

  return (
    <group ref={group}>
      {rays.map((r, i) => (
        <mesh
          key={i}
          position={[r.x, 6, r.z]}
          rotation={[0, 0, 0.25 + r.tilt]}
        >
          <cylinderGeometry args={[r.width * 0.6, r.width, 26, 12, 1, true]} />
          <meshBasicMaterial
            ref={(m) => {
              materials.current[i] = m;
            }}
            color="#f4fff8"
            transparent
            opacity={0.1}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
