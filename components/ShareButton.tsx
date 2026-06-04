"use client";

import { useState } from "react";

/**
 * Comparte un texto (ranking) por la hoja de compartir del móvil
 * (WhatsApp, etc.). Si el navegador no soporta Web Share, copia al
 * portapapeles.
 */
export function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const full = `${text}\n${url}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: full });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(full);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* el usuario canceló: no hacemos nada */
    }
  };

  return (
    <button
      onClick={onClick}
      className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-[#c6ff3d]/30 bg-[#c6ff3d]/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#c6ff3d] transition hover:bg-[#c6ff3d]/20 active:scale-95"
    >
      <span aria-hidden>📲</span>
      {copied ? "Copiado" : "Compartir ranking"}
    </button>
  );
}
