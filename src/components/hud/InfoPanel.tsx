"use client";

import { CREATURES } from "@/data/creatures";
import { zoneAt } from "@/data/zones";
import { useDive } from "@/lib/diveStore";
import { clearSelection, selectCreature } from "@/lib/focus";

function formatLength(cm: number) {
  return cm >= 10 ? `約${cm}cm` : `約${cm}cm（${cm * 10}mm）`;
}

export function InfoPanel() {
  const selectedId = useDive((s) => s.selectedId);
  const tracking = useDive((s) => s.focusKey !== null);
  const pokedCount = useDive((s) => s.pokedIds.length);
  const alreadyPoked = useDive((s) => s.selectedId !== null && s.pokedIds.includes(s.selectedId));
  // 再描画を減らすため、水深は 10m 単位で購読する
  const depth = useDive((s) => Math.round(s.depth / 10) * 10);
  const selected = CREATURES.find((c) => c.id === selectedId);
  const nearby = CREATURES.filter((c) => depth >= c.depth[0] && depth <= c.depth[1]);
  const zone = zoneAt(depth);

  if (selected) {
    return (
      <div className="hud-panel max-h-full w-full overflow-y-auto p-4 sm:w-80">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-amber-100">{selected.name}</h2>
            <p className="text-sm italic text-cyan-100/70">{selected.latin}</p>
          </div>
          <button
            type="button"
            className="hud-button px-2 py-1 text-xs"
            onClick={clearSelection}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          {tracking ? (
            <span className="text-emerald-300">● 追跡中</span>
          ) : (
            <>
              <span className="text-cyan-100/60">○ 見失いました</span>
              {nearby.some((c) => c.id === selected.id) && (
                <button
                  type="button"
                  className="hud-button px-2 py-0.5 text-xs"
                  onClick={() => selectCreature(selected.id)}
                >
                  探す
                </button>
              )}
            </>
          )}
        </div>
        {alreadyPoked && (
          <p className="mt-2 text-[11px] text-emerald-200/60">✓ 突っついた図鑑に記録済み</p>
        )}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="hud-label">体長</dt>
          <dd>{formatLength(selected.lengthCm)}</dd>
          <dt className="hud-label">産地</dt>
          <dd>{selected.locality}</dd>
          <dt className="hud-label">出現水深</dt>
          <dd>
            {selected.depth[0]}〜{selected.depth[1]}m
          </dd>
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-cyan-50">
          {selected.description}
        </p>
        <div className="mt-3 rounded border border-amber-200/20 bg-amber-200/5 p-2 text-sm leading-relaxed text-amber-50/90">
          <span className="mr-1 text-amber-300">豆知識</span>
          {selected.trivia}
        </div>
      </div>
    );
  }

  return (
    <div className="hud-panel max-h-full w-full overflow-y-auto p-3 sm:w-80 sm:p-4">
      <div className="flex items-baseline justify-between">
        <div className="hud-label">現在の海域</div>
        <div className="text-[11px] text-emerald-200/80">
          🦾 突っついた図鑑 {pokedCount}/{CREATURES.length}
        </div>
      </div>
      <h2 className="text-lg font-bold text-amber-100">{zone.name}</h2>
      <p className="mt-1 hidden text-sm leading-relaxed text-cyan-50/80 sm:block">{zone.description}</p>
      <div className="hud-label mt-3">この深さで見られる生き物</div>
      <ul className="mt-1 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {nearby.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="hud-button whitespace-nowrap px-2 py-1 text-xs"
              onClick={() => selectCreature(c.id)}
            >
              {c.name}
            </button>
          </li>
        ))}
        {nearby.length === 0 && (
          <li className="text-sm text-cyan-100/60">見当たらない…</li>
        )}
      </ul>
      <p className="hint-roomy-only mt-2 text-xs text-cyan-100/50 sm:mt-3">
        名前を押すか、窓の外の生き物をクリックすると近くで観察できます
      </p>
    </div>
  );
}
