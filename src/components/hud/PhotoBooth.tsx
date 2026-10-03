"use client";

import { useEffect, useState } from "react";
import { CREATURES } from "@/data/creatures";
import { zoneAt } from "@/data/zones";
import { diveStore } from "@/lib/diveStore";
import { lastPoke } from "@/lib/focus";
import { encodeShareCard } from "@/lib/shareCard";
import { drawObservationCard } from "@/lib/observationCard";
import { photoCapture } from "@/components/scene/PhotoCapture";

/** 突っついてからこの時間内に撮ると、カードにスタンプが押される (ms) */
const POKE_STAMP_WINDOW = 6000;

type Card = {
  url: string;
  blob: Blob;
  /** PC で X にシェアするページのクエリ（構図を 2D で再現したカードになる） */
  shareQuery: string;
  /** 主役の生き物の名前。風景写真なら null */
  name: string | null;
  zoneName: string;
  number: number;
};

/** この訪問で撮った枚数（ページを開き直すと 1 から） */
let photoCount = 0;

/** 撮影ボタンと、撮影した観察記録カードの表示 */
export function PhotoBooth() {
  const [card, setCard] = useState<Card | null>(null);
  const [flash, setFlash] = useState(0);
  const [busy, setBusy] = useState(false);
  // 閉じたら画像の URL を解放する
  useEffect(() => {
    return () => {
      if (card) URL.revokeObjectURL(card.url);
    };
  }, [card]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCard(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card]);

  const takePhoto = () => {
    const snapshot = photoCapture.take?.();
    if (!snapshot || busy) return;
    setBusy(true);
    setFlash((n) => n + 1);

    // 追いかけているときだけ主役を決める。そうでなければ海の風景写真にする
    const { focusKey, depth } = diveStore.get();
    const focused = focusKey !== null;
    const main = focused ? (snapshot.subjects[0] ?? null) : null;
    const number = ++photoCount;
    const poked =
      main !== null &&
      lastPoke.creatureId === main &&
      performance.now() - lastPoke.at < POKE_STAMP_WINDOW;
    const canvas = drawObservationCard({
      ...snapshot,
      focused,
      depth,
      number,
      poked,
      siteLabel: window.location.host,
    });
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) return;
        setCard({
          url: URL.createObjectURL(blob),
          blob,
          name: CREATURES.find((c) => c.id === main)?.name ?? null,
          zoneName: zoneAt(depth).name,
          shareQuery: encodeShareCard({
            main: main ? CREATURES.findIndex((c) => c.id === main) : null,
            depth,
            number,
            poked,
            layout: snapshot.layout,
          }),
          number,
        });
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <>
      {/* シャッターの光。窓の中だけを白く光らせる */}
      {flash > 0 && (
        <div
          key={flash}
          className="shutter-flash pointer-events-none absolute left-[var(--cx)] top-[var(--cy)] h-[calc(var(--r)*2)] w-[calc(var(--r)*2)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          aria-hidden
        />
      )}

      {/* 撮影ボタン。丸窓の右上の縁に付ける（下の「突っつく」と離す） */}
      <button
        type="button"
        onClick={takePhoto}
        disabled={busy}
        className="photo-button absolute left-[calc(var(--cx)+var(--r)*0.72)] top-[calc(var(--cy)-var(--r)*0.72)] -translate-x-1/2 -translate-y-1/2"
        aria-label="撮影する"
        title="撮影する"
      >
        {/* 絵文字だと端末ごとに絵柄や位置が変わり、読み込み時に位置も動くので、
            絵の範囲に合わせて中央を揃えた画像（Noto Color Emoji のカメラ）を使う */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 小さな固定のSVGなので最適化はいらない */}
        <img src="/icons/camera.svg" alt="" width={64} height={64} className="h-[50%] w-[50%]" draggable={false} />
      </button>

      {card && <CardDialog card={card} onClose={() => setCard(null)} />}
    </>
  );
}

function CardDialog({ card, onClose }: { card: Card; onClose: () => void }) {
  const fileName = `cambrian-dive-${String(card.number).padStart(3, "0")}.jpg`;
  const shareText = card.name
    ? `5億800万年前の海で${card.name}を撮影しました📷 #CAMBRIANDIVE`
    : `5億800万年前の${card.zoneName}の海を撮影しました📷 #CAMBRIANDIVE`;

  const share = async () => {
    const file = new File([card.blob], fileName, { type: "image/jpeg" });
    const url = window.location.origin;
    // スマホでは、画像を添付した状態で OS の共有画面から X に送れる。
    // PC でも共有画面に対応したブラウザはあるが、X が選べないことが多いので使わない
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    if (isMobile && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${shareText}\n${url}` });
      } catch {
        // 共有をキャンセルしたときは何もしない
      }
      return;
    }
    // PC では、撮った構図を再現したカードが出るページの URL を付けて X の投稿画面を開く
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", shareText);
    intent.searchParams.set("url", `${url}/photo?${card.shareQuery}`);
    window.open(intent, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="観察記録カード"
      onClick={onClose}
    >
      <div
        className="hud-panel flex w-full max-w-4xl flex-col gap-3 p-3 sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- その場で作った画像なので next/image は使えない */}
        <img
          src={card.url}
          alt={card.name ? `${card.name}の観察記録カード` : `${card.zoneName}の海の観察記録カード`}
          className="w-full rounded"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <a href={card.url} download={fileName} className="hud-button px-4 py-2 text-sm">
            画像を保存
          </a>
          <button type="button" onClick={share} className="hud-button px-4 py-2 text-sm">
            Xでシェア
          </button>
          <button type="button" onClick={onClose} className="hud-button px-4 py-2 text-sm">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
