"use client";

import dynamic from "next/dynamic";

const Studio = dynamic(() => import("./Studio"), { ssr: false });

export function SpriteStudio() {
  return <Studio />;
}
