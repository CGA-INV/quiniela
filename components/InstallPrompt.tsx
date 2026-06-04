"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/**
 * Banner discreto para instalar la app (PWA). Usa el evento
 * `beforeinstallprompt` (Android/Chrome/Edge). Se puede descartar y no
 * vuelve a salir (localStorage). En iOS ese evento no existe, así que
 * simplemente no aparece.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("pwa-dismissed")) return;
    } catch {
      /* ignore */
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!open || !evt) return null;

  const dismiss = () => {
    try {
      localStorage.setItem("pwa-dismissed", "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  const install = async () => {
    await evt.prompt();
    dismiss();
  };

  return (
    <div className="glass-panel fixed inset-x-3 bottom-24 z-[55] flex items-center gap-3 rounded-2xl p-3 shadow-2xl sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <span className="text-2xl" aria-hidden>⚽</span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg uppercase tracking-tight text-[#c6ff3d]">
          Instala la app
        </div>
        <div className="text-xs text-slate-400">Acceso directo, pantalla completa.</div>
      </div>
      <button
        onClick={install}
        className="shrink-0 rounded-lg bg-[#c6ff3d] px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#0a1f1c] transition hover:brightness-110 active:scale-95"
      >
        Instalar
      </button>
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="material-symbols-outlined shrink-0 text-slate-400 hover:text-slate-100"
      >
        close
      </button>
    </div>
  );
}
