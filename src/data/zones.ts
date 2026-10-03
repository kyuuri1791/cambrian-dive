export type Zone = {
  id: string;
  name: string;
  min: number;
  max: number;
  /** ゲージ上の色 */
  color: string;
  description: string;
};

export const ZONES: Zone[] = [
  {
    id: "shallow",
    name: "浅瀬",
    min: 0,
    max: 30,
    color: "#5fc4d6",
    description: "陽の光がたっぷり届く明るい海。藻類や微生物マットが広がる。",
  },
  {
    id: "photic",
    name: "陽光帯",
    min: 30,
    max: 200,
    color: "#2a8fb0",
    description: "光が届く大陸棚。多くの生き物が泳ぎ回るにぎやかな海。",
  },
  {
    id: "twilight",
    name: "薄明帯",
    min: 200,
    max: 600,
    color: "#155070",
    description: "光が弱まる崖下の海。海綿や海底を這う生き物が目立つ。",
  },
  {
    id: "deep",
    name: "深海",
    min: 600,
    max: 1000,
    color: "#062033",
    description: "ほぼ真っ暗な世界。探照灯だけが頼り。",
  },
];

export function zoneAt(depth: number): Zone {
  return ZONES.find((z) => depth < z.max) ?? ZONES[ZONES.length - 1];
}
