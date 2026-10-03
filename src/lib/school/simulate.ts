import { SWIM_BOUNDS, floorY } from "@/lib/terrain";

/**
 * 群れで泳ぐ動き（ボイド）の計算。
 * ワーカーでもメインスレッドでも動くよう、three.js や DOM に依存させない。
 *
 * 各個体は次のルールで向きと速さを決める。
 * - 整列: 近くの仲間と泳ぐ向きをそろえる
 * - 結合: 近くの仲間の中心へ寄る
 * - 分離: 近すぎる仲間から離れる
 * - 天敵: アノマロカリスなどが近いと逃げる。突っつかれても群れごと散る
 */

export type SchoolConfig = {
  /** 生き物の ID */
  id: string;
  count: number;
  /** swim: 中層を泳ぐ / nearFloor: 海底付近を泳ぐ */
  mode: "swim" | "nearFloor";
  /** 普段の最高速度（ワールド単位/秒） */
  maxSpeed: number;
  /** 画面上の体長（ワールド単位）。仲間との距離の基準にする */
  size: number;
  seed: number;
};

export type Disturbance = { school: string; x: number; y: number; z: number };

export type TickInput = {
  dt: number;
  t: number;
  /** 計算する群れの ID（見えていない海域の群れは計算しない） */
  active: string[];
  /** 天敵の位置。[x, y, z, x, y, z, ...] */
  predators: Float32Array;
  /** 突っつかれた位置（群れを驚かせる） */
  disturbances: Disturbance[];
};

/** 1 個体あたりの値の数。[x, y, z, vx, vy, vz] */
export const STRIDE = 6;

export type SchoolState = {
  config: SchoolConfig;
  /** 個体ごとの [x, y, z, vx, vy, vz] */
  data: Float32Array;
  /** 驚いている度合い (0〜1)。逃げるときは速くなる */
  panic: number;
  /** 個体ごとのゆらぎの位相 */
  phases: Float32Array;
};

const SWIM_Y = { min: -2.5, max: 2 };
const NEAR_FLOOR = { min: 0.4, max: 1.4 };
const PREDATOR_RADIUS = 4.5;
const DISTURB_RADIUS = 6;

function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 群れの初期配置。群れの中心の近くに、だいたい同じ向きで並べる */
export function createSchool(config: SchoolConfig): SchoolState {
  const rand = random(config.seed);
  const data = new Float32Array(config.count * STRIDE);
  const phases = new Float32Array(config.count);
  const cx = (rand() * 2 - 1) * SWIM_BOUNDS.x * 0.6;
  const cz = SWIM_BOUNDS.zNear + (SWIM_BOUNDS.zFar - SWIM_BOUNDS.zNear) * (0.3 + rand() * 0.4);
  const heading = rand() * Math.PI * 2;
  for (let i = 0; i < config.count; i++) {
    const o = i * STRIDE;
    const x = cx + (rand() * 2 - 1) * config.size * 3;
    const z = cz + (rand() * 2 - 1) * config.size * 3;
    const y =
      config.mode === "swim"
        ? (SWIM_Y.min + SWIM_Y.max) / 2 + (rand() * 2 - 1)
        : floorY(x, z) + NEAR_FLOOR.min + rand() * (NEAR_FLOOR.max - NEAR_FLOOR.min);
    data[o] = x;
    data[o + 1] = y;
    data[o + 2] = z;
    data[o + 3] = Math.cos(heading) * config.maxSpeed * 0.6;
    data[o + 4] = 0;
    data[o + 5] = -Math.sin(heading) * config.maxSpeed * 0.6;
    phases[i] = rand() * Math.PI * 2;
  }
  return { config, data, panic: 0, phases };
}

/** 範囲の外に出そうなら内側へ押し戻す力 */
function boundsForce(x: number, z: number, margin: number) {
  let fx = 0;
  let fz = 0;
  if (x > SWIM_BOUNDS.x - margin) fx -= (x - (SWIM_BOUNDS.x - margin)) / margin;
  if (x < -SWIM_BOUNDS.x + margin) fx += (-SWIM_BOUNDS.x + margin - x) / margin;
  if (z > SWIM_BOUNDS.zNear - margin) fz -= (z - (SWIM_BOUNDS.zNear - margin)) / margin;
  if (z < SWIM_BOUNDS.zFar + margin) fz += (SWIM_BOUNDS.zFar + margin - z) / margin;
  return [fx, fz] as const;
}

/** 群れを dt 秒だけ進める */
export function stepSchool(state: SchoolState, input: TickInput) {
  const { config, data, phases } = state;
  const { count, maxSpeed, size, mode } = config;
  const dt = Math.min(input.dt, 0.1);
  // 密集すると苦手な人もいるので、ゆるくまとまる程度の間隔を保つ
  const neighborR = size * 4.2;
  const separationR = size * 1.8;
  const margin = 3;

  // 突っつかれたら、群れ全体が驚く
  const disturb = input.disturbances.filter((d) => d.school === config.id);
  if (disturb.length > 0) state.panic = 1;

  // 天敵が近くにいても驚く
  const predators = input.predators;
  for (let p = 0; p < predators.length; p += 3) {
    for (let i = 0; i < count; i++) {
      const o = i * STRIDE;
      const dx = data[o] - predators[p];
      const dy = data[o + 1] - predators[p + 1];
      const dz = data[o + 2] - predators[p + 2];
      if (dx * dx + dy * dy + dz * dz < PREDATOR_RADIUS * PREDATOR_RADIUS) {
        state.panic = Math.max(state.panic, 0.7);
        break;
      }
    }
  }

  const panic = state.panic;

  // 群れ全体の中心。散ったあとに集まり直すのに使う
  let gx = 0;
  let gy = 0;
  let gz = 0;
  for (let i = 0; i < count; i++) {
    gx += data[i * STRIDE];
    gy += data[i * STRIDE + 1];
    gz += data[i * STRIDE + 2];
  }
  gx /= count;
  gy /= count;
  gz /= count;
  const regroupW = 0.25 * (1 - panic) * (1 - panic);
  const speedLimit = maxSpeed * (1 + 3.5 * panic);
  // 驚いているときは、群れのまとまりより逃げることを優先する
  const cohesionW = 0.5 * (1 - panic);
  const alignW = 1.0 * (1 - 0.6 * panic);

  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const x = data[o];
    const y = data[o + 1];
    const z = data[o + 2];
    let vx = data[o + 3];
    let vy = data[o + 4];
    let vz = data[o + 5];

    let ax = 0;
    let ay = 0;
    let az = 0;
    let n = 0;
    let avx = 0;
    let avy = 0;
    let avz = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;

    for (let j = 0; j < count; j++) {
      if (j === i) continue;
      const q = j * STRIDE;
      const dx = data[q] - x;
      const dy = data[q + 1] - y;
      const dz = data[q + 2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > neighborR * neighborR) continue;
      n++;
      avx += data[q + 3];
      avy += data[q + 4];
      avz += data[q + 5];
      cx += data[q];
      cy += data[q + 1];
      cz += data[q + 2];
      if (d2 < separationR * separationR && d2 > 1e-6) {
        // 近いほど強く離れる
        const k = (separationR * separationR) / d2 - 1;
        ax -= dx * k * 1.6;
        ay -= dy * k * 1.6;
        az -= dz * k * 1.6;
      }
    }

    if (n > 0) {
      ax += (avx / n - vx) * alignW;
      ay += (avy / n - vy) * alignW;
      az += (avz / n - vz) * alignW;
      ax += (cx / n - x) * cohesionW;
      ay += (cy / n - y) * cohesionW;
      az += (cz / n - z) * cohesionW;
    }

    // 仲間を感じ取れないほど離れたら、群れ全体の中心へゆっくり戻る
    const gdx = gx - x;
    const gdz = gz - z;
    const gd = Math.hypot(gdx, gdz);
    if (gd > neighborR) {
      ax += (gdx / gd) * maxSpeed * regroupW * 4;
      ay += (gy - y) * regroupW;
      az += (gdz / gd) * maxSpeed * regroupW * 4;
    }

    // ゆらゆらとした寄り道
    const ph = phases[i] + input.t * 0.7;
    ax += Math.sin(ph) * maxSpeed * 0.4;
    az += Math.cos(ph * 0.8) * maxSpeed * 0.4;

    // 範囲の外に出ないようにする
    const [bx, bz] = boundsForce(x, z, margin);
    ax += bx * maxSpeed * 3;
    az += bz * maxSpeed * 3;

    // 高さを保つ
    if (mode === "swim") {
      if (y > SWIM_Y.max) ay -= (y - SWIM_Y.max) * 2;
      if (y < SWIM_Y.min) ay += (SWIM_Y.min - y) * 2;
    } else {
      const h = y - floorY(x, z);
      const target = (NEAR_FLOOR.min + NEAR_FLOOR.max) / 2;
      ay += (target - h) * 2.5;
      // 海底付近では上下にはあまり動かない
      vy *= 1 - Math.min(1, dt * 2);
    }

    // 天敵から逃げる
    for (let p = 0; p < predators.length; p += 3) {
      const dx = x - predators[p];
      const dy = y - predators[p + 1];
      const dz = z - predators[p + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < PREDATOR_RADIUS * PREDATOR_RADIUS && d2 > 1e-6) {
        const k = (1 - Math.sqrt(d2) / PREDATOR_RADIUS) * maxSpeed * 6;
        const inv = 1 / Math.sqrt(d2);
        ax += dx * inv * k;
        ay += dy * inv * k * 0.4;
        az += dz * inv * k;
      }
    }

    // 突っつかれたら、ばらばらの方向へぱっと散る。
    // 突っつかれた位置から離れる向き・群れの中心から外向き・個体ごとのぶれを混ぜる。
    // 時間に関係なく一瞬で速くなるよう、速度に直接足す
    for (const d of disturb) {
      const dx = x - d.x;
      const dz = z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist > DISTURB_RADIUS) continue;
      const awayX = dist > 1e-3 ? dx / dist : 0;
      const awayZ = dist > 1e-3 ? dz / dist : 0;
      const ox = x - gx;
      const oz = z - gz;
      const od = Math.hypot(ox, oz);
      const outX = od > 1e-3 ? ox / od : 0;
      const outZ = od > 1e-3 ? oz / od : 0;
      const jitter = phases[i] * 2.3;
      let dirX = awayX * 0.6 + outX + Math.cos(jitter) * 0.8;
      let dirZ = awayZ * 0.6 + outZ + Math.sin(jitter) * 0.8;
      const len = Math.hypot(dirX, dirZ) || 1;
      dirX /= len;
      dirZ /= len;
      const k = maxSpeed * 4.5 * (1 - (dist / DISTURB_RADIUS) * 0.5);
      vx += dirX * k;
      vz += dirZ * k;
      vy += (Math.sin(jitter * 1.7) * 0.5) * k * (mode === "swim" ? 1 : 0.2);
    }

    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;

    // 速すぎず、止まりもしないようにする
    const speed = Math.hypot(vx, vy, vz);
    const minSpeed = maxSpeed * 0.35;
    if (speed > speedLimit) {
      const k = speedLimit / speed;
      vx *= k;
      vy *= k;
      vz *= k;
    } else if (speed < minSpeed && speed > 1e-6) {
      const k = minSpeed / speed;
      vx *= k;
      vy *= k;
      vz *= k;
    }

    data[o] = x + vx * dt;
    data[o + 1] = y + vy * dt;
    data[o + 2] = z + vz * dt;
    data[o + 3] = vx;
    data[o + 4] = vy;
    data[o + 5] = vz;
  }

  // 驚きは少しずつおさまる（その間はばらけたまま泳ぐ）
  state.panic *= Math.exp(-dt / 2.4);
}

/** 有効な群れをすべて進める */
export function stepAll(schools: Map<string, SchoolState>, input: TickInput) {
  for (const id of input.active) {
    const school = schools.get(id);
    if (school) stepSchool(school, input);
  }
}

/** ワーカーとのやりとりの形 */
export type WorkerRequest =
  | { type: "init"; configs: SchoolConfig[] }
  | { type: "tick"; input: TickInput; buffers: Record<string, Float32Array> };

export type WorkerResponse = { type: "state"; buffers: Record<string, Float32Array> };
