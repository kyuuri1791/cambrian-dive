import { CREATURES, type Creature } from "@/data/creatures";
import { zoneAt } from "@/data/zones";

export type CardInput = {
  photo: HTMLCanvasElement;
  /** 写っている生き物の ID。大きく写っている順 */
  subjects: string[];
  /**
   * 生き物を追いかけて撮ったか。
   * true なら先頭の生き物を主役にした「生き物の写真」、false なら「海の風景写真」にする
   */
  focused: boolean;
  depth: number;
  /** 観察記録の番号 */
  number: number;
  /** 主役を突っついた直後に撮ったか */
  poked: boolean;
  /** カードに載せるサイトの URL（表示用） */
  siteLabel: string;
};

/** X のタイムラインで切れずに表示される 16:9 */
export const CARD_WIDTH = 1600;
export const CARD_HEIGHT = 900;

const FONT = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", system-ui, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

const COLORS = {
  bg: "#0b141a",
  bgEdge: "#05090c",
  brass: "#9a7640",
  brassLight: "#e2c48a",
  cream: "#fdf3d6",
  amber: "#fcd34d",
  cyan: "#bfeef2",
  muted: "rgba(191, 238, 242, 0.6)",
  rule: "rgba(201, 164, 106, 0.45)",
};

function formatLength(cm: number) {
  return cm >= 10 ? `約${cm}cm` : `約${cm}cm（${cm * 10}mm）`;
}

/** 指定の幅に収まるまで文字を小さくして描く */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight = "bold",
  family = FONT,
) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 16) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  ctx.fillText(text, x, y);
  return s;
}

const NO_LINE_START = "、。，．）」』！？ー";

/** 日本語の文章を、幅に合わせて文字単位で折り返して描く */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    // 句読点や閉じかっこは行の頭に来ないよう、はみ出してでも前の行に付ける
    if (ctx.measureText(line + ch).width > maxWidth && !NO_LINE_START.includes(ch)) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => {
    const last = i === maxLines - 1 && lines.length > maxLines;
    ctx.fillText(last ? `${l.slice(0, -1)}…` : l, x, y + i * lineHeight);
  });
}

function drawPorthole(ctx: CanvasRenderingContext2D, photo: HTMLCanvasElement) {
  const cx = 450;
  const cy = 450;
  const r = 360;

  // 写真
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(photo, cx - r, cy - r, r * 2, r * 2);
  // ガラスの映り込みと周辺の暗がり
  const glare = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.2);
  glare.addColorStop(0, "rgba(255,255,255,0.12)");
  glare.addColorStop(0.35, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const vignette = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  // 真鍮の枠
  ctx.lineWidth = 34;
  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.addColorStop(0, COLORS.brassLight);
  ring.addColorStop(0.5, COLORS.brass);
  ring.addColorStop(1, "#5a4220");
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.stroke();

  // リベット
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = cx + Math.cos(a) * (r + 17);
    const y = cy + Math.sin(a) * (r + 17);
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 8);
    g.addColorStop(0, "#f6e2b4");
    g.addColorStop(0.6, COLORS.brass);
    g.addColorStop(1, "#3d2e17");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  ctx.strokeStyle = "rgba(252, 211, 77, 0.9)";
  ctx.fillStyle = "rgba(252, 211, 77, 0.9)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(-150, -42, 300, 84, 14);
  ctx.stroke();
  ctx.font = `bold 40px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("突っついた！", 0, 2);
  ctx.restore();
}

/** 観察記録カードを描く */
export function drawObservationCard(input: CardInput) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // 背景
  const bg = ctx.createRadialGradient(450, 450, 200, 800, 450, 1100);
  bg.addColorStop(0, COLORS.bg);
  bg.addColorStop(1, COLORS.bgEdge);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, CARD_WIDTH - 48, CARD_HEIGHT - 48);

  drawPorthole(ctx, input.photo);

  const creatures = input.subjects
    .map((id) => CREATURES.find((c) => c.id === id))
    .filter((c): c is Creature => !!c);
  const main = input.focused ? creatures[0] : undefined;
  const others = input.focused ? creatures.slice(1, 4) : creatures.slice(0, 6);
  const zone = zoneAt(input.depth);

  const left = 900;
  const width = CARD_WIDTH - left - 80;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // 見出し
  ctx.fillStyle = COLORS.amber;
  ctx.font = `bold 26px ${MONO}`;
  ctx.fillText("CAMBRIAN DIVE", left, 120);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `24px ${FONT}`;
  ctx.fillText(`観察記録 No.${String(input.number).padStart(3, "0")}`, left, 160);

  // 主役の名前
  ctx.fillStyle = COLORS.cream;
  if (main) {
    fitText(ctx, main.name, left, 260, width, 68);
    ctx.fillStyle = COLORS.muted;
    fitText(ctx, main.latin, left, 306, width, 30, "italic", FONT);
  } else {
    fitText(ctx, `${zone.name}の海`, left, 260, width, 68);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `28px ${FONT}`;
    ctx.fillText("風景写真", left, 306);
  }

  // 区切り線
  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, 344);
  ctx.lineTo(left + width, 344);
  ctx.stroke();

  // 観察データ
  const rows: [string, string][] = [
    ["水深", `${Math.round(input.depth)}m（${zone.name}）`],
    ["時代", "約5億800万年前 カンブリア紀"],
  ];
  if (main) rows.push(["体長", formatLength(main.lengthCm)]);
  rows.forEach(([label, value], i) => {
    const y = 404 + i * 56;
    ctx.fillStyle = "rgba(253, 230, 138, 0.7)";
    ctx.font = `24px ${FONT}`;
    ctx.fillText(label, left, y);
    ctx.fillStyle = COLORS.cyan;
    ctx.font = `30px ${FONT}`;
    ctx.fillText(value, left + 110, y);
  });

  // ひとこと（主役の説明、いなければ海域の説明）
  ctx.fillStyle = "rgba(230, 246, 248, 0.85)";
  ctx.font = `24px ${FONT}`;
  const note = main ? main.description : zone.description;
  wrapText(ctx, note, left, 404 + rows.length * 56 + 20, width, 38, 3);

  // 写っている生き物（生き物の写真なら主役以外）
  if (others.length > 0) {
    ctx.fillStyle = "rgba(253, 230, 138, 0.7)";
    ctx.font = `22px ${FONT}`;
    ctx.fillText(main ? "ほかに写っている生き物" : "写っている生き物", left, main ? 760 : 724);
    ctx.fillStyle = COLORS.cyan;
    ctx.font = `26px ${FONT}`;
    wrapText(ctx, others.map((c) => c.name).join("、"), left, main ? 796 : 760, width, 36, 2);
  }

  // 写真の右下に押す
  if (input.poked && main) drawStamp(ctx, 690, 790);

  // サイトの URL
  ctx.fillStyle = "rgba(191, 238, 242, 0.45)";
  ctx.font = `20px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(input.siteLabel, CARD_WIDTH - 60, CARD_HEIGHT - 52);

  return canvas;
}
