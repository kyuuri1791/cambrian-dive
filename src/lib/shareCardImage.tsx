import { CREATURES } from "@/data/creatures";
import { zoneAt } from "@/data/zones";
import { SPRITE_SPAN, type ShareCard } from "./shareCard";

/**
 * /api/card で返すカード画像のレイアウト（ImageResponse 用の JSX）。
 * ImageResponse は flexbox と一部の CSS しか使えないので、
 * 子要素が複数ある div にはすべて display: flex を付ける。
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const CX = 315;
const CY = 315;
const R = 250;
const RIM = 20;

/** アプリの Ocean.tsx と同じ、水深に対する海の色 */
const WATER: [number, [number, number, number]][] = [
  [0, [0x4f, 0xb8, 0xcc]],
  [60, [0x1f, 0x86, 0xa3]],
  [200, [0x0d, 0x47, 0x63]],
  [500, [0x04, 0x19, 0x2a]],
  [1000, [0x01, 0x05, 0x09]],
];

function lerpColor(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function waterColor(depth: number) {
  for (let i = 1; i < WATER.length; i++) {
    const [d1, c1] = WATER[i];
    if (depth <= d1 || i === WATER.length - 1) {
      const [d0, c0] = WATER[i - 1];
      return lerpColor(c0, c1, Math.min(1, Math.max(0, (depth - d0) / (d1 - d0))));
    }
  }
  return WATER[0][1];
}

const rgb = (c: number[], a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

function formatLength(cm: number) {
  return cm >= 10 ? `約${cm}cm` : `約${cm}cm（${cm * 10}mm）`;
}

type Props = {
  card: ShareCard;
  /** 生き物 ID → 画像の data URL */
  sprites: Record<string, string>;
};

export function ShareCardImage({ card, sprites }: Props) {
  const zone = zoneAt(card.depth);
  const main = card.main !== null ? CREATURES[card.main] : null;
  const water = waterColor(card.depth);
  const deep = Math.min(1, card.depth / 700);
  const sand = lerpColor([0xc9, 0xb7, 0x8a], [0x4a, 0x46, 0x3b], deep);
  // 深いほど暗く見えるように、生き物の上から海の色を重ねる
  const fog = 0.08 + 0.42 * deep;

  // 手前（リストの後ろ）ほど大きく写っているので、名前は手前から順に並べる
  const seen = new Set<string>();
  const pictured = [...card.layout]
    .reverse()
    .map((it) => CREATURES[it.index])
    .filter((c) => {
      if (seen.has(c.id) || c.id === main?.id) return false;
      seen.add(c.id);
      return true;
    })
    .slice(0, main ? 3 : 6);

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: "flex",
        position: "relative",
        background: "radial-gradient(circle at 30% 50%, #0f1c24, #05090c)",
        fontFamily: "Noto Sans JP",
        color: "#e6f6f8",
      }}
    >
      {/* 丸窓の中 */}
      <div
        style={{
          position: "absolute",
          left: CX - R,
          top: CY - R,
          width: R * 2,
          height: R * 2,
          borderRadius: R,
          overflow: "hidden",
          display: "flex",
          background: `linear-gradient(to bottom, ${rgb(lerpColor(water, [255, 255, 255], 0.12))}, ${rgb(water)} 48%, ${rgb(lerpColor(water, sand, 0.6))} 58%, ${rgb(sand)} 68%, ${rgb(lerpColor(sand, [0, 0, 0], 0.35))})`,
        }}
      >
        {card.layout.map((it, i) => {
          const c = CREATURES[it.index];
          const src = sprites[c.id];
          if (!src) return null;
          const size = it.length * SPRITE_SPAN * R;
          return (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse 内では img を使う
            <img
              key={i}
              src={src}
              width={size}
              height={size}
              alt=""
              style={{
                position: "absolute",
                left: R + it.x * R - size / 2,
                top: R + it.y * R - size / 2,
                // 画像は右向きなので、左向きのときだけ反転する（"none" は使えない）
                ...(it.right ? {} : { transform: "scaleX(-1)" }),
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: `radial-gradient(circle, ${rgb(water, fog * 0.6)} 40%, ${rgb(water, fog)} 100%)`,
          }}
        />
        {/* ガラスの映り込み */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 35%)",
          }}
        />
      </div>

      {/* 真鍮の枠とリベット */}
      <div
        style={{
          position: "absolute",
          left: CX - R - RIM,
          top: CY - R - RIM,
          width: (R + RIM) * 2,
          height: (R + RIM) * 2,
          borderRadius: R + RIM,
          border: `${RIM}px solid #9a7640`,
          display: "flex",
          boxShadow: "inset 0 0 0 3px #e2c48a, 0 0 30px rgba(0,0,0,0.8)",
        }}
      />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: CX + Math.cos(a) * (R + RIM / 2) - 6,
              top: CY + Math.sin(a) * (R + RIM / 2) - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              display: "flex",
              background: "radial-gradient(circle at 35% 35%, #f6e2b4, #9a7640 60%, #3d2e17)",
            }}
          />
        );
      })}

      {card.poked && main && (
        <div
          style={{
            position: "absolute",
            // 説明文にかからないよう、窓の中の右下に収める
            left: CX - 10,
            top: CY + 165,
            display: "flex",
            padding: "6px 22px",
            border: "4px solid rgba(252, 211, 77, 0.95)",
            borderRadius: 12,
            color: "rgba(252, 211, 77, 0.95)",
            fontSize: 34,
            fontWeight: 700,
            transform: "rotate(-7deg)",
            background: "rgba(10, 8, 2, 0.35)",
          }}
        >
          突っついた！
        </div>
      )}

      {/* 右側の文字 */}
      <div
        style={{
          position: "absolute",
          left: 640,
          top: 70,
          width: 500,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#fcd34d", letterSpacing: 2 }}>
          CAMBRIAN DIVE
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "rgba(191,238,242,0.6)", marginTop: 4 }}>
          観察記録 No.{String(card.number).padStart(3, "0")}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: (main ? main.name : `${zone.name}の海`).length > 9 ? 40 : 52,
            fontWeight: 700,
            color: "#fdf3d6",
            marginTop: 22,
          }}
        >
          {main ? main.name : `${zone.name}の海`}
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "rgba(191,238,242,0.6)", marginTop: 2 }}>
          {main ? main.latin : "風景写真"}
        </div>
        <div style={{ display: "flex", height: 2, background: "rgba(201,164,106,0.45)", marginTop: 20 }} />
        {[
          ["水深", `${card.depth}m（${zone.name}）`],
          ["時代", "約5億800万年前 カンブリア紀"],
          ...(main ? [["体長", formatLength(main.lengthCm)]] : []),
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", marginTop: 14 }}>
            <div style={{ display: "flex", width: 80, fontSize: 19, color: "rgba(253,230,138,0.7)" }}>{label}</div>
            <div style={{ display: "flex", fontSize: 24, color: "#bfeef2" }}>{value}</div>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            fontSize: 19,
            lineHeight: 1.6,
            color: "rgba(230,246,248,0.85)",
            marginTop: 18,
            maxHeight: 92,
            overflow: "hidden",
          }}
        >
          {main ? main.description : zone.description}
        </div>
        {pictured.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
            <div style={{ display: "flex", fontSize: 17, color: "rgba(253,230,138,0.7)" }}>
              {main ? "ほかに写っている生き物" : "写っている生き物"}
            </div>
            <div style={{ display: "flex", fontSize: 21, color: "#bfeef2", marginTop: 4 }}>
              {pictured.map((c) => c.name).join("、")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
