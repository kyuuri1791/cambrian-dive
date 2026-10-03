import { CREATURES } from "@/data/creatures";
import { ZONES } from "@/data/zones";

// diveStore は "use client" なので、サーバーでも使うここでは海域データから上限を取る
const MAX_DEPTH = ZONES[ZONES.length - 1].max;

/**
 * PC で X にシェアするときのカードの情報。
 * 撮影した構図（写っている生き物の位置・大きさ・向き）を URL に入れ、
 * サーバー（/api/card）で 2D の絵として並べ直す。
 */

/** 生き物の画像の幅が、体長の何倍分の範囲を写しているか */
export const SPRITE_SPAN = 1.3;

/** 構図に入れる生き物の最大数 */
export const MAX_LAYOUT = 8;

export type LayoutItem = {
  /** CREATURES の添字 */
  index: number;
  /** 丸窓の中心からの位置。窓の半径を 1 とする */
  x: number;
  y: number;
  /** 画面上の体長。窓の半径を 1 とする */
  length: number;
  /** 右を向いているか */
  right: boolean;
};

export type ShareCard = {
  /** 主役の生き物の CREATURES の添字。風景写真なら null */
  main: number | null;
  depth: number;
  number: number;
  poked: boolean;
  /** 遠いものから順に並ぶ */
  layout: LayoutItem[];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** URL のクエリに変換する。数値は小さな整数にして短くする */
export function encodeShareCard(card: ShareCard) {
  const params = new URLSearchParams();
  if (card.main !== null) params.set("m", card.main.toString(36));
  params.set("d", String(Math.round(card.depth)));
  params.set("n", String(card.number));
  if (card.poked) params.set("k", "1");
  const layout = card.layout
    .slice(-MAX_LAYOUT)
    .map((it) =>
      [
        it.index.toString(36),
        Math.round(clamp(it.x, -1.5, 1.5) * 100),
        Math.round(clamp(it.y, -1.5, 1.5) * 100),
        Math.round(clamp(it.length, 0.01, 4) * 100),
        it.right ? 1 : 0,
      ].join("."),
    )
    .join("_");
  if (layout) params.set("l", layout);
  return params.toString();
}

/** URL のクエリから読み取る。不正な値は無視する */
export function decodeShareCard(query: Record<string, string | string[] | undefined>): ShareCard {
  const get = (key: string) => {
    const v = query[key];
    return typeof v === "string" ? v : undefined;
  };
  const toIndex = (s: string | undefined) => {
    if (s === undefined || !/^[0-9a-z]{1,2}$/.test(s)) return null;
    const i = parseInt(s, 36);
    return i >= 0 && i < CREATURES.length ? i : null;
  };
  const toInt = (s: string | undefined, lo: number, hi: number, fallback: number) => {
    const n = Number(s);
    return s !== undefined && Number.isInteger(n) ? clamp(n, lo, hi) : fallback;
  };

  const layout: LayoutItem[] = [];
  for (const part of (get("l") ?? "").split("_").slice(0, MAX_LAYOUT)) {
    const [i, x, y, len, r] = part.split(".");
    const index = toIndex(i);
    if (index === null) continue;
    layout.push({
      index,
      x: toInt(x, -150, 150, 0) / 100,
      y: toInt(y, -150, 150, 0) / 100,
      length: toInt(len, 1, 400, 30) / 100,
      right: r === "1",
    });
  }

  return {
    main: toIndex(get("m")),
    depth: toInt(get("d"), 0, MAX_DEPTH, 10),
    number: toInt(get("n"), 1, 9999, 1),
    poked: get("k") === "1",
    layout,
  };
}
