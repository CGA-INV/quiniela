"use client";

import { useState } from "react";

/**
 * Par de marcadores (local–visitante) para una predicción, con botones +/−
 * cómodos en móvil y un botón "Borrar" que deja la predicción SIN DEFINIR.
 * Al vaciar ambos campos y guardar, el servidor elimina la predicción.
 */
export function ScorePredictionPair({
  matchId,
  defaultHome,
  defaultAway,
}: {
  matchId: string;
  defaultHome: number | null;
  defaultAway: number | null;
}) {
  const [home, setHome] = useState(defaultHome != null ? String(defaultHome) : "");
  const [away, setAway] = useState(defaultAway != null ? String(defaultAway) : "");
  const hasAny = home !== "" || away !== "";

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <Stepper name={`home_${matchId}`} value={home} setValue={setHome} />
        <span className="text-slate-500">–</span>
        <Stepper name={`away_${matchId}`} value={away} setValue={setAway} />
      </div>
      {hasAny && (
        <button
          type="button"
          onClick={() => { setHome(""); setAway(""); }}
          title="Deja la predicción sin definir (se aplica al guardar todo)"
          className="flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300 transition hover:bg-red-500/20 active:scale-95"
        >
          <span aria-hidden>✕</span> Borrar
        </button>
      )}
    </div>
  );
}

function Stepper({
  name,
  value,
  setValue,
}: {
  name: string;
  value: string;
  setValue: (v: string) => void;
}) {
  const cur = value === "" ? 0 : Number(value);
  const clamp = (n: number) => Math.max(0, Math.min(20, n));
  const btn =
    "grid h-6 w-11 place-items-center rounded-md bg-slate-700/60 text-lg font-bold leading-none text-slate-200 transition select-none hover:bg-slate-700 active:scale-90";

  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" aria-label="subir" className={btn} onClick={() => setValue(String(clamp(cur + 1)))}>
        +
      </button>
      <input
        name={name}
        type="number"
        min="0"
        max="20"
        inputMode="numeric"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="–"
        className="w-12 rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-center font-mono text-lg font-bold tabular-nums text-[#c6ff3d] placeholder:text-slate-600 focus:border-[#c6ff3d] focus:outline-none focus:ring-2 focus:ring-[#c6ff3d]/30"
      />
      <button type="button" aria-label="bajar" className={btn} onClick={() => setValue(String(clamp(cur - 1)))}>
        −
      </button>
    </div>
  );
}
