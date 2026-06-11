"use client";

import { useMemo, useState } from "react";
import { EvidenceExport } from "./EvidenceExport";

export type RankRow = {
  user_id: string;
  display_name: string;
  total: number;
  exactos: number;
  ganador: number;
  empate: number;
};
export type DetailRow = {
  matchNo: number | null;
  stageKey: string;
  stageLabel: string;
  fecha: string;
  local: string;
  visitante: string;
  marcador: string;
  userId: string | null;
  jugador: string;
  pred: string;
  pts: number | null;
  predicted: boolean;
};

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvRow = (cells: (string | number | null)[]) => cells.map(csvCell).join(",");

export function EvidenceView({
  pool,
  meta,
  ranking,
  detail,
  players,
  stages,
  currentUserId,
}: {
  pool: { name: string; invite_code: string };
  meta: { totalMatches: number; finishedCount: number };
  ranking: RankRow[];
  detail: DetailRow[];
  players: { id: string; name: string }[];
  stages: { key: string; label: string }[];
  currentUserId: string;
}) {
  const [player, setPlayer] = useState<string>("all");
  const [stage, setStage] = useState<string>("all");
  const [view, setView] = useState<"match" | "player">("player");

  const filtered = useMemo(
    () =>
      detail.filter(
        d =>
          (stage === "all" || d.stageKey === stage) &&
          (player === "all" || d.userId === player),
      ),
    [detail, stage, player],
  );

  const playerName = player === "all" ? null : players.find(p => p.id === player)?.name ?? null;
  const stageLabel = stage === "all" ? null : stages.find(s => s.key === stage)?.label ?? null;
  const highlightId = player === "all" ? currentUserId : player;

  // Info de ranking por usuario (posición + total).
  const rankInfo = useMemo(() => {
    const m = new Map<string, { pos: number; total: number }>();
    ranking.forEach((r, i) => m.set(r.user_id, { pos: i + 1, total: r.total }));
    return m;
  }, [ranking]);

  // Agrupación POR PARTICIPANTE -> POR FASE (solo filas con jugador).
  const byPlayer = useMemo(() => {
    const order = players
      .filter(p => player === "all" || p.id === player)
      .map(p => p.id);
    const rowsByUser = new Map<string, DetailRow[]>();
    for (const d of filtered) {
      if (!d.userId) continue;
      if (!rowsByUser.has(d.userId)) rowsByUser.set(d.userId, []);
      rowsByUser.get(d.userId)!.push(d);
    }
    return order.map(uid => {
      const rows = rowsByUser.get(uid) ?? [];
      // Agrupar por fase preservando orden.
      const phases: { label: string; rows: DetailRow[] }[] = [];
      for (const r of rows) {
        let g = phases.find(x => x.label === r.stageLabel);
        if (!g) { g = { label: r.stageLabel, rows: [] }; phases.push(g); }
        g.rows.push(r);
      }
      const info = rankInfo.get(uid);
      return {
        userId: uid,
        name: players.find(p => p.id === uid)?.name ?? "—",
        pos: info?.pos ?? 0,
        total: info?.total ?? 0,
        phases,
      };
    });
  }, [filtered, players, player, rankInfo]);

  const csv = useMemo(() => {
    const lines: string[] = [];
    lines.push(csvRow([`EVIDENCIA — ${pool.name} (Mundial 2026)`]));
    lines.push(csvRow([`Código: ${pool.invite_code}`, `Jugadores: ${ranking.length}`, `Partidos con resultado: ${meta.finishedCount}/${meta.totalMatches}`]));
    lines.push(csvRow([playerName ? `Jugador: ${playerName}` : "Jugador: Todos", stageLabel ? `Fase: ${stageLabel}` : "Fase: Todas"]));
    lines.push("");
    lines.push(csvRow(["RANKING"]));
    lines.push(csvRow(["Pos", "Jugador", "Puntos", "Exactos", "Ganador", "Empate"]));
    ranking.forEach((r, i) => lines.push(csvRow([i + 1, r.display_name, r.total, r.exactos, r.ganador, r.empate])));
    lines.push("");

    if (view === "player") {
      lines.push(csvRow(["PREDICCIONES POR PARTICIPANTE"]));
      for (const p of byPlayer) {
        lines.push("");
        lines.push(csvRow([`PARTICIPANTE: ${p.name}`, `Posición: ${p.pos}`, `Total: ${p.total} pts`]));
        if (p.phases.length === 0) {
          lines.push(csvRow(["(sin predicciones visibles)"]));
          continue;
        }
        lines.push(csvRow(["Fase", "Partido", "Marcador", "Predicción", "Pts"]));
        for (const ph of p.phases) {
          for (const r of ph.rows) {
            lines.push(csvRow([ph.label, `${r.local} vs ${r.visitante}`, r.marcador, r.pred, r.pts]));
          }
        }
      }
    } else {
      lines.push(csvRow(["DETALLE DE PARTIDOS Y PREDICCIONES"]));
      lines.push(csvRow(["#", "Fase", "Fecha", "Local", "Visitante", "Marcador", "Jugador", "Pred", "Pts"]));
      for (const d of filtered) {
        lines.push(csvRow([d.matchNo, d.stageLabel, d.fecha, d.local, d.visitante, d.marcador, d.predicted ? d.jugador : "", d.pred, d.pts]));
      }
    }
    return lines.join("\n");
  }, [pool, meta, ranking, filtered, byPlayer, view, playerName, stageLabel]);

  const safeName = pool.name.replace(/[^\w-]+/g, "_").slice(0, 40) || "quiniela";
  const fileParts = ["evidencia", safeName, view === "player" ? "participantes" : "partidos"];
  if (playerName) fileParts.push(playerName.replace(/[^\w-]+/g, "_").slice(0, 20));
  if (stageLabel) fileParts.push(stageLabel.replace(/[^\w-]+/g, "_"));
  const fileName = fileParts.join("_") + ".csv";

  const selectCls = "rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none";

  return (
    <>
      <header className="print-text mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evidencia de resultados</h1>
          <p className="mt-1 text-sm text-slate-400 print-text">
            {pool.name} · código {pool.invite_code} · {ranking.length} jugadores ·{" "}
            {meta.finishedCount}/{meta.totalMatches} partidos con resultado
          </p>
        </div>
        <EvidenceExport csv={csv} fileName={fileName} />
      </header>

      {/* Controles: vista + filtros */}
      <div className="no-print mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">Vista</span>
          <div className="flex rounded-lg border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => setView("player")}
              className={`rounded-md px-3 py-1.5 text-sm transition ${view === "player" ? "bg-emerald-500 font-medium text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
            >
              Por participante
            </button>
            <button
              type="button"
              onClick={() => setView("match")}
              className={`rounded-md px-3 py-1.5 text-sm transition ${view === "match" ? "bg-emerald-500 font-medium text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
            >
              Por partido
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">Jugador</span>
          <select value={player} onChange={e => setPlayer(e.target.value)} className={selectCls}>
            <option value="all">Todos</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">Fase</span>
          <select value={stage} onChange={e => setStage(e.target.value)} className={selectCls}>
            <option value="all">Todas</option>
            {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        {(player !== "all" || stage !== "all") && (
          <button type="button" onClick={() => { setPlayer("all"); setStage("all"); }} className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:text-slate-100">
            Limpiar filtros
          </button>
        )}
      </div>

      {(playerName || stageLabel) && (
        <p className="print-text mb-4 text-sm text-slate-300">
          Filtro: <strong>{playerName ?? "Todos los jugadores"}</strong> · <strong>{stageLabel ?? "Todas las fases"}</strong>
        </p>
      )}

      {/* RANKING */}
      <section className="print-card mb-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="print-text mb-3 text-lg font-semibold uppercase tracking-tight">Ranking final</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400 print-text">
              <tr className="border-b border-slate-800">
                <th className="py-2 pr-3 font-normal">Pos</th>
                <th className="py-2 pr-3 font-normal">Jugador</th>
                <th className="py-2 pr-3 text-right font-normal">Pts</th>
                <th className="py-2 pr-3 text-right font-normal">Exactos</th>
                <th className="py-2 pr-3 text-right font-normal">Ganador</th>
                <th className="py-2 text-right font-normal">Empate</th>
              </tr>
            </thead>
            <tbody className="print-text">
              {ranking.map((r, i) => (
                <tr key={r.user_id} className={`border-b border-slate-800/50 ${r.user_id === highlightId ? "bg-emerald-500/10" : ""}`}>
                  <td className="py-1.5 pr-3 tabular-nums">{i + 1}</td>
                  <td className="py-1.5 pr-3">{r.display_name}{r.user_id === currentUserId ? " (tú)" : ""}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{r.total}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400 print-text">{r.exactos}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400 print-text">{r.ganador}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-400 print-text">{r.empate}</td>
                </tr>
              ))}
              {ranking.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-slate-500">Sin jugadores.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* DETALLE */}
      {view === "player" ? (
        <section>
          <h2 className="print-text mb-1 text-lg font-semibold uppercase tracking-tight">Predicciones por participante</h2>
          <p className="no-print mb-4 text-xs text-slate-500">
            Cada participante con sus predicciones completas, agrupadas por fase. Las de otros aparecen al cerrar cada fase (tú, como admin, las ves todas).
          </p>
          <div className="space-y-5">
            {byPlayer.map(p => (
              <div key={p.userId} className="print-card rounded-2xl border border-slate-800 bg-slate-900/40 p-4 print:break-inside-avoid">
                <div className="print-text mb-3 flex items-baseline justify-between gap-3 border-b border-slate-800 pb-2">
                  <h3 className="text-base font-semibold">
                    <span className="mr-2 font-mono text-slate-400 print-text">#{p.pos}</span>
                    {p.name}{p.userId === currentUserId ? " (tú)" : ""}
                  </h3>
                  <span className="shrink-0 text-sm font-semibold text-emerald-400 print-text">{p.total} pts</span>
                </div>
                {p.phases.length === 0 ? (
                  <p className="text-sm italic text-slate-500">Sin predicciones visibles.</p>
                ) : (
                  <div className="space-y-3">
                    {p.phases.map(ph => (
                      <div key={ph.label}>
                        <h4 className="print-text mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">{ph.label}</h4>
                        <table className="w-full text-sm">
                          <tbody className="print-text">
                            {ph.rows.map((r, i) => (
                              <tr key={i} className="border-b border-slate-800/40">
                                <td className="py-1 pr-3 whitespace-nowrap">{r.local} <span className="text-slate-500">vs</span> {r.visitante}</td>
                                <td className="py-1 pr-3 text-right font-mono tabular-nums text-slate-400 print-text" title="Resultado real">{r.marcador}</td>
                                <td className="py-1 pr-3 text-right font-mono tabular-nums" title="Su predicción">{r.pred}</td>
                                <td className={`w-12 py-1 text-right tabular-nums ${r.pts && r.pts > 0 ? "font-semibold text-emerald-400 print-text" : "text-slate-500 print-text"}`}>{r.pts}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {byPlayer.length === 0 && <p className="text-sm text-slate-500">No hay participantes para este filtro.</p>}
          </div>
        </section>
      ) : (
        <section className="print-card rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="print-text mb-1 text-lg font-semibold uppercase tracking-tight">Partidos y predicciones</h2>
          <p className="no-print mb-3 text-xs text-slate-500">Una fila por predicción, ordenada por partido.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400 print-text">
                <tr className="border-b border-slate-800">
                  <th className="py-2 pr-3 font-normal">#</th>
                  <th className="py-2 pr-3 font-normal">Fase</th>
                  <th className="py-2 pr-3 font-normal">Partido</th>
                  <th className="py-2 pr-3 font-normal">Marcador</th>
                  <th className="py-2 pr-3 font-normal">Jugador</th>
                  <th className="py-2 pr-3 text-center font-normal">Pred</th>
                  <th className="py-2 text-right font-normal">Pts</th>
                </tr>
              </thead>
              <tbody className="print-text">
                {filtered.map((d, i) => (
                  <tr key={i} className="border-b border-slate-800/40">
                    <td className="py-1.5 pr-3 tabular-nums text-slate-400 print-text">{d.matchNo ?? ""}</td>
                    <td className="py-1.5 pr-3 text-slate-400 print-text">{d.stageLabel}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{d.local} <span className="text-slate-500">vs</span> {d.visitante}</td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums">{d.marcador}</td>
                    <td className="py-1.5 pr-3">{d.predicted ? d.jugador : <span className="text-slate-500 italic">sin predicciones visibles</span>}</td>
                    <td className="py-1.5 pr-3 text-center font-mono tabular-nums">{d.pred}</td>
                    <td className={`py-1.5 text-right tabular-nums ${d.pts && d.pts > 0 ? "font-semibold text-emerald-400 print-text" : "text-slate-400 print-text"}`}>{d.predicted ? d.pts : ""}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="py-3 text-center text-slate-500">No hay filas para este filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
