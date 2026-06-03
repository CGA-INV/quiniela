"use client";

import { useState } from "react";
import { votePrice, votePaymentTiming } from "@/app/pools/[id]/actions";

type Tally = Record<string | number, number>;

/** Encuesta de monto: $3 / $4 / $5 */
export function PricePoll({
  poolId,
  tally,
  total,
  mine,
}: {
  poolId: string;
  tally: Tally;
  total: number;
  mine?: number;
}) {
  const options = [3, 4, 5];
  let leading = options[0];
  for (const p of options) if ((tally[p] ?? 0) > (tally[leading] ?? 0)) leading = p;

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
        ¿Cuánto debería costar la quiniela?
      </h3>
      <p className="mt-0.5 text-xs text-slate-400">
        Fase de grupos · gana el más votado · {total} voto{total === 1 ? "" : "s"}
      </p>
      <form action={votePrice} className="mt-3 grid grid-cols-3 gap-2">
        <input type="hidden" name="pool_id" value={poolId} />
        {options.map(p => {
          const count = tally[p] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const m = mine === p;
          return (
            <button
              key={p}
              type="submit"
              name="price"
              value={p}
              className={[
                "relative overflow-hidden rounded-xl border px-3 py-4 text-center transition active:scale-95",
                m ? "border-[#c6ff3d] bg-[#c6ff3d]/10" : "border-slate-700 bg-slate-800/50 hover:border-[#c6ff3d]/40",
              ].join(" ")}
            >
              <span className="absolute inset-x-0 bottom-0 bg-[#c6ff3d]/15" style={{ height: `${pct}%` }} aria-hidden />
              <span className="relative block font-display text-2xl text-[#c6ff3d]">${p}</span>
              <span className="relative mt-1 block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {count} ({pct}%){m ? " · tú" : ""}
              </span>
            </button>
          );
        })}
      </form>
      {total > 0 && (
        <p className="mt-3 text-center text-sm text-slate-300">
          Va ganando: <strong className="text-[#c6ff3d]">${leading} USD</strong>
        </p>
      )}
    </div>
  );
}

/** Encuesta: pagar antes o después de saber el ganador */
export function TimingPoll({
  poolId,
  tally,
  total,
  mine,
}: {
  poolId: string;
  tally: Tally;
  total: number;
  mine?: string;
}) {
  const options: { value: string; label: string; caption: string }[] = [
    { value: "antes", label: "Antes", caption: "al iniciar la quiniela" },
    { value: "despues", label: "Después", caption: "cuando se sepa el ganador" },
  ];
  const leading = (tally["antes"] ?? 0) >= (tally["despues"] ?? 0) ? "antes" : "despues";

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
        ¿Cuándo se debe pagar?
      </h3>
      <p className="mt-0.5 text-xs text-slate-400">
        Gana la opción más votada · {total} voto{total === 1 ? "" : "s"}
      </p>
      <form action={votePaymentTiming} className="mt-3 grid grid-cols-2 gap-2">
        <input type="hidden" name="pool_id" value={poolId} />
        {options.map(o => {
          const count = tally[o.value] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const m = mine === o.value;
          return (
            <button
              key={o.value}
              type="submit"
              name="timing"
              value={o.value}
              className={[
                "relative overflow-hidden rounded-xl border px-3 py-4 text-center transition active:scale-95",
                m ? "border-[#c6ff3d] bg-[#c6ff3d]/10" : "border-slate-700 bg-slate-800/50 hover:border-[#c6ff3d]/40",
              ].join(" ")}
            >
              <span className="absolute inset-x-0 bottom-0 bg-[#c6ff3d]/15" style={{ height: `${pct}%` }} aria-hidden />
              <span className="relative block font-display text-xl uppercase text-[#c6ff3d]">{o.label}</span>
              <span className="relative mt-0.5 block text-[10px] leading-tight text-slate-400">{o.caption}</span>
              <span className="relative mt-1 block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {count} ({pct}%){m ? " · tú" : ""}
              </span>
            </button>
          );
        })}
      </form>
      {total > 0 && (
        <p className="mt-3 text-center text-sm text-slate-300">
          Va ganando: <strong className="text-[#c6ff3d]">{leading === "antes" ? "Pagar antes" : "Pagar después"}</strong>
        </p>
      )}
    </div>
  );
}

/** Modal que aparece al abrir la sala si el usuario aún no votó en ambas
 *  encuestas. Se puede cerrar; reaparece al recargar hasta votar ambas. */
export function VotePromptModal({
  needsVote,
  poolId,
  price,
  timing,
}: {
  needsVote: boolean;
  poolId: string;
  price: { tally: Tally; total: number; mine?: number };
  timing: { tally: Tally; total: number; mine?: string };
}) {
  const [open, setOpen] = useState(needsVote);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="glass-panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl uppercase tracking-tight text-[#c6ff3d]">Vota antes del domingo</h2>
          <button
            onClick={() => setOpen(false)}
            className="material-symbols-outlined shrink-0 text-slate-400 hover:text-slate-100"
            aria-label="Cerrar"
          >
            close
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Estas votaciones <strong className="text-slate-200">cierran antes del domingo</strong>. Ayuda a
          definir el precio y cuándo se paga. Puedes cambiar tu voto luego en la pestaña Reglas.
        </p>

        <div className="mt-5 space-y-6">
          <PricePoll poolId={poolId} tally={price.tally} total={price.total} mine={price.mine} />
          <div className="border-t border-slate-100/10" />
          <TimingPoll poolId={poolId} tally={timing.tally} total={timing.total} mine={timing.mine} />
        </div>

        <button
          onClick={() => setOpen(false)}
          className="mt-5 w-full rounded-lg border border-slate-100/15 bg-slate-800/60 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-300 transition hover:bg-slate-700/60"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
