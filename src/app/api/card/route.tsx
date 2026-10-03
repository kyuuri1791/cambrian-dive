import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CREATURES } from "@/data/creatures";
import { decodeShareCard } from "@/lib/shareCard";
import { OG_HEIGHT, OG_WIDTH, ShareCardImage } from "@/lib/shareCardImage";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";

/**
 * 画像の生成は 1 枚 0.3 秒ほど CPU を使う。URL の値を変えながら大量に呼ばれると
 * CPU 時間の枠を使い切られるので、呼び出し回数と同時に作る枚数に上限を付ける。
 * 普通は、シェアされたときに X が 1 回取りに来る程度。
 */
const allow = createRateLimiter({ perClient: 20, total: 300, windowMs: 60_000 });
const MAX_CONCURRENT = 3;
let rendering = 0;

function busy() {
  return new Response("Too many requests", {
    status: 429,
    headers: { "Retry-After": "60", "Cache-Control": "no-store" },
  });
}

/**
 * X のリンクカードに表示する観察記録カードの画像。
 * URL のクエリ（/photo と同じ）から、撮影した構図を 2D で並べ直して描く。
 */

// 素材は scripts/build-card-assets.mjs で作る。next.config の outputFileTracingIncludes で同梱する
const ASSETS = join(process.cwd(), "assets/card");

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([400, 700] as const).map(async (weight) => ({
      name: "Noto Sans JP",
      data: await readFile(join(ASSETS, `NotoSansJP-${weight}.ttf`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

const spriteCache = new Map<string, Promise<string>>();
function loadSprite(id: string) {
  let p = spriteCache.get(id);
  if (!p) {
    p = readFile(join(ASSETS, "sprites", `${id}.png`)).then(
      (b) => `data:image/png;base64,${b.toString("base64")}`,
    );
    spriteCache.set(id, p);
  }
  return p;
}

export async function GET(request: Request) {
  if (rendering >= MAX_CONCURRENT || !allow(clientIp(request))) return busy();
  rendering++;
  try {
    return await render(request);
  } finally {
    rendering--;
  }
}

async function render(request: Request) {
  const card = decodeShareCard(Object.fromEntries(new URL(request.url).searchParams));
  const ids = [...new Set(card.layout.map((it) => CREATURES[it.index].id))];
  const sprites = Object.fromEntries(
    await Promise.all(ids.map(async (id) => [id, await loadSprite(id)] as const)),
  );

  try {
    const image = new ImageResponse(<ShareCardImage card={card} sprites={sprites} />, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: await loadFonts(),
    });
    // 画像は描きながら送られるので、途中で失敗するとエラーが分からない。
    // 最後まで作ってから返す
    const body = await image.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": "image/png",
        // 同じ URL なら必ず同じ画像になるので、長くキャッシュしてよい
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("failed to render share card", e);
    return new Response("Failed to generate the image", { status: 500 });
  }
}
