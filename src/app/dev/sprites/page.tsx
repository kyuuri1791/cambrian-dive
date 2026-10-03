import { notFound } from "next/navigation";
import { SpriteStudio } from "./SpriteStudio";

/**
 * 開発用: シェアカード（/api/card）に使う生き物の画像を作るページ。
 * scripts/build-card-assets.mjs から開いて使う。本番では表示しない。
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SpriteStudio />;
}
