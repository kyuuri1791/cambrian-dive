"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES } from "@/data/creatures";
import { MODELS } from "@/components/scene/CreatureSwarm";
import { SPRITE_SPAN } from "@/lib/shareCard";

const SIZE = 512;

declare global {
  interface Window {
    /** 指定した生き物の画像を描いて、PNG の data URL を返す */
    renderSprite?: (id: string) => Promise<string>;
  }
}

/**
 * 生き物を 1 種ずつ、透明な背景に描く。
 * モデルの 1 単位（＝体長）が画像の幅の 1 / SPRITE_SPAN になるように描き、
 * 体の中心（バウンディングボックスの中心）を画像の中心に置く。
 */
export default function Studio() {
  // 同じ生き物を続けて指定しても描き直すよう、回数も持つ
  const [target, setTarget] = useState({ id: CREATURES[0].id, n: 0 });
  const ready = useRef<(() => void) | null>(null);

  useEffect(() => {
    window.renderSprite = (next) =>
      new Promise((resolve) => {
        ready.current = () => {
          const canvas = document.querySelector("canvas");
          resolve(canvas ? canvas.toDataURL("image/png") : "");
        };
        setTarget((t) => ({ id: next, n: t.n + 1 }));
      });
  }, []);

  return (
    <div style={{ width: SIZE, height: SIZE, background: "#334" }}>
      <Canvas
        gl={{ preserveDrawingBuffer: true, alpha: true }}
        dpr={1}
        orthographic
        camera={{ position: [0, 1.1, 3], zoom: SIZE / SPRITE_SPAN, near: 0.1, far: 20 }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          camera.lookAt(0, 0, 0);
        }}
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={[2, 4, 3]} intensity={2.2} />
        <directionalLight position={[-3, 1, -2]} intensity={0.6} />
        <Subject key={`${target.id}-${target.n}`} id={target.id} onReady={() => ready.current?.()} />
      </Canvas>
    </div>
  );
}

function Subject({ id, onReady }: { id: string; onReady: () => void }) {
  const group = useRef<THREE.Group>(null);
  const excite = useRef(0);
  const { gl, scene, camera } = useThree();
  const creature = CREATURES.find((c) => c.id === id)!;
  const Model = MODELS[creature.model];

  useEffect(() => {
    // モデルが組み上がるのを 2 フレーム待ってから中心を合わせて描く
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const g = group.current;
        if (!g) return;
        g.position.set(0, 0, 0);
        const box = new THREE.Box3().setFromObject(g);
        const center = box.getCenter(new THREE.Vector3());
        g.position.sub(center);
        gl.render(scene, camera);
        onReady();
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [gl, scene, camera, onReady]);

  return (
    <group ref={group}>
      <Model phase={1.2} excite={excite} />
    </group>
  );
}
