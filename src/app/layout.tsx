import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAMBRIAN DIVE - カンブリア紀の海へ",
  description:
    "タイムマシン潜水艦でカンブリア紀の海へ。アノマロカリスやハルキゲニアなど、5億年前の生き物を窓から観察しよう。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
