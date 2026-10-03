"use client";

import { CREATURES, displayLength } from "@/data/creatures";
import {
  STRIDE,
  createSchool,
  stepAll,
  type Disturbance,
  type SchoolConfig,
  type SchoolState,
  type WorkerRequest,
  type WorkerResponse,
} from "./simulate";

/**
 * 群れの計算をワーカーに任せる窓口。
 * 結果は 2 つの配列を交互に使う（片方をワーカーに渡している間、もう片方を描画に使う）。
 * ワーカーが使えないときは、同じ計算をメインスレッドで行う。
 */
class SchoolClient {
  private worker: Worker | null = null;
  /** ワーカーがない、または失敗したときに使う */
  private local: Map<string, SchoolState> | null = null;
  /** 描画に使う最新の結果 */
  private latest = new Map<string, Float32Array>();
  /** 次にワーカーへ渡す配列 */
  private spare = new Map<string, Float32Array>();
  private busy = false;
  private pendingDt = 0;
  private pendingDisturbances: Disturbance[] = [];

  constructor(private configs: SchoolConfig[]) {
    // 最初の配置はワーカーと同じ計算でここでも作り、すぐ描画できるようにする
    for (const config of configs) {
      const school = createSchool(config);
      this.latest.set(config.id, school.data.slice());
      this.spare.set(config.id, new Float32Array(school.data.length));
    }

    if (typeof Worker === "undefined") {
      this.useLocal();
      return;
    }
    try {
      this.worker = new Worker(new URL("../../workers/school.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.receive(e.data);
      this.worker.onerror = () => this.useLocal();
      this.send({ type: "init", configs });
    } catch {
      this.useLocal();
    }
  }

  private send(msg: WorkerRequest, transfer: Transferable[] = []) {
    this.worker?.postMessage(msg, transfer);
  }

  private useLocal() {
    this.worker?.terminate();
    this.worker = null;
    this.busy = false;
    this.local = new Map(this.configs.map((c) => [c.id, createSchool(c)]));
  }

  private receive(msg: WorkerResponse) {
    for (const [id, buffer] of Object.entries(msg.buffers)) {
      const previous = this.latest.get(id);
      this.latest.set(id, buffer);
      if (previous) this.spare.set(id, previous);
    }
    this.busy = false;
  }

  /** 毎フレーム呼ぶ。ワーカーが前の計算中なら、経過時間をためて次に回す */
  tick(dt: number, t: number, active: string[], predators: Float32Array) {
    this.pendingDt += dt;
    if (this.busy) return;
    const input = {
      dt: this.pendingDt,
      t,
      active,
      predators,
      disturbances: this.pendingDisturbances,
    };
    this.pendingDt = 0;
    this.pendingDisturbances = [];

    if (this.local) {
      stepAll(this.local, input);
      for (const id of active) {
        const school = this.local.get(id);
        if (school) this.latest.get(id)?.set(school.data);
      }
      return;
    }

    const buffers: Record<string, Float32Array> = {};
    const transfer: Transferable[] = [];
    for (const [id, buffer] of this.spare) {
      buffers[id] = buffer;
      transfer.push(buffer.buffer);
    }
    this.spare.clear();
    this.busy = true;
    this.send({ type: "tick", input, buffers }, transfer);
  }

  /** index 番目の個体の [x, y, z, vx, vy, vz] が入った配列と、その開始位置 */
  get(id: string, index: number): { data: Float32Array; offset: number } | null {
    const data = this.latest.get(id);
    if (!data || (index + 1) * STRIDE > data.length) return null;
    return { data, offset: index * STRIDE };
  }

  /** 群れを驚かせる（突っつかれたとき） */
  disturb(school: string, x: number, y: number, z: number) {
    this.pendingDisturbances.push({ school, x, y, z });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}

/** 群れで泳ぐ生き物の設定 */
export function schoolConfigs(): SchoolConfig[] {
  return CREATURES.filter((c) => c.school).map((c, i) => {
    const size = displayLength(c);
    return {
      id: c.id,
      count: c.count,
      mode: c.behavior === "nearFloor" ? "nearFloor" : "swim",
      maxSpeed: c.speed * size * 1.3,
      size,
      seed: 9173 + i * 101,
    };
  });
}

let client: SchoolClient | null = null;

/** 群れの計算を始める。3D シーンが表示されている間だけ動かす */
export function startSchools() {
  client ??= new SchoolClient(schoolConfigs());
  return client;
}

export function stopSchools() {
  client?.dispose();
  client = null;
}

export function getSchools() {
  return client;
}
