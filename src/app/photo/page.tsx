import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { CREATURES } from "@/data/creatures";
import { zoneAt } from "@/data/zones";
import { decodeShareCard, encodeShareCard } from "@/lib/shareCard";

/**
 * X にシェアするページ。
 * X が読みに来たときは OGP でカード画像（/api/card）を伝え、
 * 人が開いたときはカードを見せてアプリへ案内する。
 */

type Props = PageProps<"/photo">;

async function load(searchParams: Props["searchParams"]) {
  const card = decodeShareCard(await searchParams);
  const main = card.main !== null ? CREATURES[card.main] : null;
  const zone = zoneAt(card.depth);
  // 値を検証し直した URL を使う（変な値が付いていても正規化される）
  const query = encodeShareCard(card);
  const title = main ? `${main.name}の観察記録` : `${zone.name}の海の観察記録`;
  return { card, main, zone, query, title };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { main, zone, query, title } = await load(searchParams);
  // 画像の URL は絶対 URL にする必要がある。リクエストのヘッダーは偽装できるので、
  // 環境変数 SITE_URL（例: https://cambrian-dive.lolipop-now.app）があればそれを使う
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const siteUrl = process.env.SITE_URL ?? `${proto}://${host}`;
  const description = main
    ? `5億800万年前の${zone.name}で${main.name}を撮影しました。タイムマシン潜水艦でカンブリア紀の海へ。`
    : `5億800万年前の${zone.name}の海を撮影しました。タイムマシン潜水艦でカンブリア紀の海へ。`;
  const image = { url: `/api/card?${query}`, width: 1200, height: 630, alt: title };
  return {
    metadataBase: new URL(siteUrl),
    title: `${title} - CAMBRIAN DIVE`,
    description,
    openGraph: { title, description, images: [image], type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PhotoPage({ searchParams }: Props) {
  const { card, main, query, title } = await load(searchParams);
  // 撮った生き物（いなければ同じ深さ）から潜り始められるようにする
  const start = main ? `/?creature=${main.id}` : `/?depth=${card.depth}`;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#0b1116] px-4 py-10 text-cyan-50">
      <h1 className="text-lg font-bold tracking-widest text-amber-200">CAMBRIAN DIVE</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- サーバーで生成する画像なので next/image は使わない */}
      <img
        src={`/api/card?${query}`}
        alt={title}
        width={1200}
        height={630}
        className="h-auto w-full max-w-3xl rounded border border-amber-200/30"
      />
      <p className="text-center text-sm text-cyan-100/80">
        タイムマシン潜水艦で、5億800万年前のカンブリア紀の海へ。
      </p>
      <Link href={start} className="hud-button px-6 py-3 text-base font-bold">
        潜ってみる
      </Link>
    </main>
  );
}
