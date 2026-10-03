import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ロリポップ！デプロイナウでは standalone 出力が必須
  output: "standalone",
  // シェアカードの画像生成で読むフォントと生き物の画像を同梱する
  outputFileTracingIncludes: {
    "/api/card": ["./assets/card/**/*"],
  },
};

export default nextConfig;
