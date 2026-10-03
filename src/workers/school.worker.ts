/// <reference lib="webworker" />

/**
 * 群れで泳ぐ動きを計算するワーカー。
 * メインスレッドから毎フレーム天敵の位置などを受け取り、全個体の位置と向きを返す。
 */

import {
  createSchool,
  stepAll,
  type SchoolState,
  type WorkerRequest,
  type WorkerResponse,
} from "@/lib/school/simulate";

const schools = new Map<string, SchoolState>();

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === "init") {
    schools.clear();
    for (const config of msg.configs) schools.set(config.id, createSchool(config));
    return;
  }

  stepAll(schools, msg.input);

  // 受け取った配列に結果を書き込み、そのまま送り返す（コピーせずに移すので軽い）
  const buffers: Record<string, Float32Array> = {};
  const transfer: ArrayBuffer[] = [];
  for (const [id, buffer] of Object.entries(msg.buffers)) {
    const school = schools.get(id);
    if (school && buffer.length === school.data.length) buffer.set(school.data);
    buffers[id] = buffer;
    transfer.push(buffer.buffer as ArrayBuffer);
  }
  const response: WorkerResponse = { type: "state", buffers };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(response, transfer);
};
