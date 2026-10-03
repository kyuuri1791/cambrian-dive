// シェアカード（/api/card）用の素材を作る。
//   1. 生き物の画像: 開発サーバーの /dev/sprites を開いて、1 種ずつ PNG に書き出す
//   2. フォント: カードに出る文字だけを含む Noto Sans JP を Google Fonts から取得する
// 使い方: npm run dev を動かした状態で `npm run build:card-assets`（URL を変えるときは `-- <URL>`）
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const root = new URL("..", import.meta.url).pathname;
const outDir = join(root, "assets/card");
mkdirSync(join(outDir, "sprites"), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- 1. 生き物の画像 ---
const ids = [...readFileSync(join(root, "src/data/creatures.ts"), "utf8").matchAll(/^\s+id: "([a-z]+)"/gm)].map(
  (m) => m[1],
);
const port = 9450;
const chrome = spawn(
  "chromium",
  ["--headless=new", "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", `--remote-debugging-port=${port}`, "about:blank"],
  { stdio: "ignore" },
);
let targets;
for (let i = 0; i < 50; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    break;
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d.result);
    pending.delete(d.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
await send("Page.navigate", { url: `${base}/dev/sprites` });
for (let i = 0; i < 60; i++) {
  await sleep(500);
  const r = await send("Runtime.evaluate", { expression: "typeof window.renderSprite", returnByValue: true });
  if (r.result?.value === "function") break;
}
for (const cid of ids) {
  const r = await send("Runtime.evaluate", {
    expression: `window.renderSprite(${JSON.stringify(cid)})`,
    awaitPromise: true,
    returnByValue: true,
  });
  const data = r.result?.value ?? "";
  writeFileSync(join(outDir, "sprites", `${cid}.png`), Buffer.from(data.split(",")[1] ?? "", "base64"));
  console.log("sprite", cid, Math.round((data.length * 3) / 4 / 1024), "KB");
}
ws.close();
chrome.kill();

// --- 2. フォント ---
const texts = ["src/data/creatures.ts", "src/data/zones.ts", "src/lib/shareCardImage.tsx"]
  .map((p) => readFileSync(join(root, p), "utf8"))
  .join("");
const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const chars = [...new Set(texts + ascii + "、。・（）〜！？…")].filter((c) => c.trim() || c === " ").join("");
for (const weight of [400, 700]) {
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(chars)}`,
      // 古いブラウザのふりをすると TTF が返ってくる（ImageResponse は woff2 を読めない）
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 Safari/534.30" } },
    )
  ).text();
  const url = css.match(/src: url\((.+?)\)/)?.[1];
  if (!url) throw new Error(`font url not found:\n${css}`);
  const font = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(join(outDir, `NotoSansJP-${weight}.ttf`), font);
  console.log("font", weight, Math.round(font.length / 1024), "KB");
}
process.exit(0);
