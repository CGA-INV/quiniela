"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Celebración a pantalla completa que se reproduce cuando la sala ya tiene
 * ganador (fase de grupos terminada). Se muestra una vez por dispositivo
 * por sala; el video arranca silenciado (requisito de autoplay) con botón
 * para activar el sonido.
 */
export function WinnerCelebration({
  poolId,
  winnerName,
}: {
  poolId: string;
  winnerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(`celebrated:${poolId}`)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [poolId]);

  const close = () => {
    try {
      localStorage.setItem(`celebrated:${poolId}`, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#c6ff3d]">
        Fase de grupos terminada
      </p>
      <h2 className="mb-4 mt-1 text-center text-4xl uppercase tracking-tight text-[#c6ff3d]">
        🏆 {winnerName}
      </h2>

      <video
        ref={videoRef}
        src="/imagen/ganador.mp4"
        autoPlay
        muted
        playsInline
        onEnded={close}
        className="max-h-[65dvh] w-auto max-w-full rounded-2xl border border-[#c6ff3d]/20 shadow-2xl"
      />

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={toggleSound}
          className="flex items-center gap-2 rounded-lg border border-slate-100/15 bg-slate-800/70 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-200 transition hover:bg-slate-700/70"
        >
          <span className="material-symbols-outlined text-[18px]">
            {muted ? "volume_off" : "volume_up"}
          </span>
          {muted ? "Sonido" : "Silenciar"}
        </button>
        <button
          onClick={close}
          className="rounded-lg bg-[#c6ff3d] px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#0a1f1c] transition hover:brightness-110"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
