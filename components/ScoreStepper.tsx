"use client";

import { useState } from "react";

/**
 * Campo de marcador con botones +/− grandes (cómodo en móvil) que mantiene
 * el `name` para que el formulario de predicciones lo envíe igual.
 */
export function ScoreStepper({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: number | null;
}) {
  const [v, setV] = useState(defaultValue != null ? String(defaultValue) : "");
  const cur = v === "" ? 0 : Number(v);
  const clamp = (n: number) => Math.max(0, Math.min(20, n));
  const btn =
    "grid h-6 w-11 place-items-center rounded-md bg-slate-700/60 text-lg font-bold leading-none text-slate-200 transition select-none hover:bg-slate-700 active:scale-90";

  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" aria-label="subir" className={btn} onClick={() => setV(String(clamp(cur + 1)))}>
        +
      </button>
      <input
        name={name}
        type="number"
        min="0"
        max="20"
        inputMode="numeric"
        value={v}
        onChange={e => setV(e.target.value)}
        className="w-12 rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-center font-mono text-lg font-bold tabular-nums text-[#c6ff3d] focus:border-[#c6ff3d] focus:outline-none focus:ring-2 focus:ring-[#c6ff3d]/30"
      />
      <button type="button" aria-label="bajar" className={btn} onClick={() => setV(String(clamp(cur - 1)))}>
        −
      </button>
    </div>
  );
}
