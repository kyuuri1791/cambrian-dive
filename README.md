# CAMBRIAN DIVE

タイムマシン潜水艦で、約5億800万年前のカンブリア紀の海へ。
丸窓から海を眺めながら、アノマロカリスやハルキゲニアなどの生き物を観察できる Web アプリです。

## できること

- **潜行・浮上**: 浅瀬（0m）から深海（1000m）まで。深さによって海の色や出てくる生き物が変わります
- **観察**: 生き物を選ぶと、カメラが追いかけてズームします
- **突っつく**: 潜水艦のアームで生き物を突っつくと、逃げたり砂に潜ったりします
- **撮影**: 窓の外を撮影して「観察記録カード」を作り、保存・X にシェアできます

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 を開きます。URL に `?depth=300` を付けるとその水深から、`?creature=marrella` を付けるとその生き物を追いかけた状態で始まります。

### 主な構成

| 場所 | 内容 |
|---|---|
| `src/data/creatures.ts` | 生き物のデータ（名前・説明・出現水深・突っついたときの反応など） |
| `src/data/zones.ts` | 海域（浅瀬・陽光帯・薄明帯・深海）のデータ |
| `src/components/scene/` | 3D シーン（React Three Fiber）。海、生き物の動き、アーム、撮影 |
| `src/components/scene/models/` | 生き物の 3D モデル。図形を組み合わせてコードで作っている |
| `src/components/hud/` | 画面の UI（深度計、情報パネル、照準、撮影、起動時の演出） |
| `src/app/photo/` | X にシェアするページ。OGP でカード画像を伝える |
| `src/app/api/card/` | シェア用のカード画像をサーバーで生成する |

### X へのシェア

- **スマホ**: 撮った写真入りのカード画像を、OS の共有画面からそのまま投稿します
- **PC**: X はブラウザから画像を添付できないため、`/photo?...` の URL を付けて投稿します。
  X がこのページを読みに来ると、`/api/card` が撮影した構図（写っている生き物の位置・大きさ・向き）を 2D で並べ直したカード画像を返します

### シェアカードの素材

`/api/card` は `assets/card/` の生き物の画像とフォント（Noto Sans JP をカードに出る文字だけに絞ったもの）を使います。
**生き物を追加したり、説明文などカードに出る文字を変えたりしたら、作り直してください。**

```bash
npm run dev          # 別のターミナルで動かしておく
npm run build:card-assets
```

生き物の画像は開発用ページ `/dev/sprites`（本番では表示されない）で描いて書き出します。

## デプロイ

[ロリポップ！デプロイナウ](https://lolipop.jp/deploy-now/) で公開します。`next.config.ts` で `output: "standalone"` を設定済みです。

## ライセンス

- フォント: [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（SIL Open Font License 1.1）
