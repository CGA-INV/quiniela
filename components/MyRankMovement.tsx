"use client";

import { useEffect, useState } from "react";

/**
 * Muestra cuánto subiste/bajaste en el ranking desde tu última visita
 * (guardado en el dispositivo, sin BD). Tras leerlo, guarda la posición
 * actual como referencia para la próxima vez.
 */
export function MyRankMovement({ poolId, rank }: { poolId: string; rank: number }) {
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    if (rank <= 0) return;
    const key = `myrank:${poolId}`;
    try {
      const prev = Number(localStorage.getItem(key) ?? "");
      if (prev && prev !== rank) setDelta(prev - rank); // +: subiste (posición menor)
      localStorage.setItem(key, String(rank));
    } catch {
      /* ignore */
    }
  }, [poolId, rank]);

  if (delta === null || delta === 0) return null;
  const up = delta > 0;

  return (
    <span
      className={`mx-auto mt-2 flex w-fit items-center gap-1 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
        up ? "bg-[#c6ff3d]/10 text-[#c6ff3d]" : "bg-red-500/10 text-red-400"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)} desde tu última visita
    </span>
  );
}
