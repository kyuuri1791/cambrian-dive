import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ロリポップ！デプロイナウでは standalone 出力が必須
  output: "standalone",
  // シェアカードの画像生成で読むフォントと生き物の画像を同梱する
  outputFileTracingIncludes: {
    "/api/card": ["./assets/card/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 他のサイトに iframe で埋め込まれないようにする
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // ファイルの種類を勝手に推測させない
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 使わないブラウザの機能を止める
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
