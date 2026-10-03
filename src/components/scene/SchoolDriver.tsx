"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES } from "@/data/creatures";
import { diveStore } from "@/lib/diveStore";
import { getVisibleCreatures } from "@/lib/focus";
import { startSchools, stopSchools } from "@/lib/school/client";
import { presenceAt } from "./utils";

/** 群れを散らす天敵 */
const PREDATORS = new Set(["anomalocaris", "hurdia", "sidneyia"]);

/** 群れで泳ぐ生き物 */
const SCHOOLING = CREATURES.filter((c) => c.school);

const tmp = new THREE.Vector3();

/** 毎フレーム、天敵の位置などをワーカーに渡して群れの計算を進める */
export function SchoolDriver() {
  useEffect(() => {
    startSchools();
    return () => stopSchools();
  }, []);

  useFrame(({ clock }, dt) => {
    const schools = startSchools();
    const depth = diveStore.get().depth;

    // 見えていない海域の群れは計算しない
    const active = SCHOOLING.filter((c) => presenceAt(depth, c.depth) > 0).map((c) => c.id);

    const positions: number[] = [];
    for (const [, entry] of getVisibleCreatures()) {
      if (!PREDATORS.has(entry.creatureId)) continue;
      entry.object.getWorldPosition(tmp);
      positions.push(tmp.x, tmp.y + entry.size * entry.centerHeight, tmp.z);
    }

    schools.tick(dt, clock.elapsedTime, active, new Float32Array(positions));
  });

  return null;
}
