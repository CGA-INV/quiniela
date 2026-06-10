import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/admin-context";
import { isAdminEmail } from "@/lib/auth";
import { fmtDate } from "@/lib/time";
import { EvidenceExport } from "@/components/EvidenceExport";

const STAGE_LABEL: Record<string, string> = {
  group: "Grupos",
  round_of_32: "32avos",
  round_of_16: "Octavos",
  quarter: "Cuartos",
  semi: "Semis",
  third_place: "3er puesto",
  final: "Final",
};
const STAGE_ORDER = ["group", "round_of_32", "round_of_16", "quarter", "semi", "third_place", "final"];

type Match = {
  id: string;
  stage: string;
  group_label: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
  match_no: number | null;
};
type Pred = { user_id: string; match_id: string; pred_home: number; pred_away: number; points: number };
type RankRow = {
  user_id: string;
  display_name: string;
  total: number;
  exactos: number;
  ganador: number;
  empate: number;
};

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvRow = (cells: (string | number | null)[]) => cells.map(csvCell).join(",");

export default async function EvidenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supabase, user] = await Promise.all([createClient(), getCachedUser()]);
  if (!user) redirect("/login");
  const isSuper = isAdminEmail(user.email);

  const { data: pool, error: poolErr } = await supabase
    .from("pools")
    .select("id, name, invite_code, is_sandbox")
    .eq("id", id)
    .single();
  if (poolErr || !pool) notFound();

  const [{ data: matchesData }, { data: predsData }, { data: rankingData }] = await Promise.all([
    (pool.is_sandbox
      ? supabase.from("matches")
          .select("id, stage, group_label, home_team, away_team, kickoff_at, home_score, away_score, finished, match_no")
          .eq("pool_id", id)
      : supabase.from("matches")
          .select("id, stage, group_label, home_team, away_team, kickoff_at, home_score, away_score, finished, match_no")
          .is("pool_id", null)
    ).order("kickoff_at", { ascending: true }),
    // RLS solo devuelve predicciones visibles (propias + de fases ya cerradas).
    supabase.from("predictions").select("user_id, match_id, pred_home, pred_away, points").eq("pool_id", id),
    supabase.rpc("pool_ranking", { p_pool: id }),
  ]);

  const ranking = (rankingData ?? []) as RankRow[];
  // Solo miembros (o super admin) acceden a la evidencia.
  const isMember = ranking.some(r => r.user_id === user.id);
  if (!isMember && !isSuper) {
    redirect(`/pools/${id}?error=${encodeURIComponent("No eres miembro de esta sala")}`);
  }

  const matches = (matchesData ?? []) as Match[];
  matches.sort((a, b) => {
    const s = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
    if (s !== 0) return s;
    if (a.match_no != null && b.match_no != null) return a.match_no - b.match_no;
    return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
  });

  const preds = (predsData ?? []) as Pred[];
  const predBy = new Map<string, Pred>(preds.map(p => [`${p.user_id}|${p.match_id}`, p]));
  const nameById = new Map<string, string>(ranking.map(r => [r.user_id, r.display_name]));

  const fin = (m: Match) => m.finished && m.home_score !== null && m.away_score !== null;
  const finishedCount = matches.filter(fin).length;

  // Filas largas (una por predicción visible), agrupadas por partido y orden de ranking.
  type DetailRow = {
    matchNo: number | null; stage: string; fecha: string;
    local: string; visitante: string; marcador: string;
    jugador: string; pred: string; pts: number | null; predicted: boolean;
  };
  const detail: DetailRow[] = [];
  for (const m of matches) {
    const marcador = fin(m) ? `${m.home_score}-${m.away_score}` : "sin jugar";
    const base = {
      matchNo: m.match_no, stage: STAGE_LABEL[m.stage] ?? m.stage,
      fecha: fmtDate(m.kickoff_at), local: m.home_team, visitante: m.away_team, marcador,
    };
    const predictors = ranking.filter(r => predBy.has(`${r.user_id}|${m.id}`));
    if (predictors.length === 0) {
      detail.push({ ...base, jugador: "—", pred: "", pts: null, predicted: false });
    } else {
      for (const r of predictors) {
        const p = predBy.get(`${r.user_id}|${m.id}`)!;
        detail.push({ ...base, jugador: r.display_name, pred: `${p.pred_home}-${p.pred_away}`, pts: p.points, predicted: true });
      }
    }
  }

  // CSV completo (RANKING + DETALLE).
  const lines: string[] = [];
  lines.push(csvRow([`EVIDENCIA — ${pool.name} (Mundial 2026)`]));
  lines.push(csvRow([`Código: ${pool.invite_code}`, `Jugadores: ${ranking.length}`, `Partidos con resultado: ${finishedCount}/${matches.length}`]));
  lines.push("");
  lines.push(csvRow(["RANKING"]));
  lines.push(csvRow(["Pos", "Jugador", "Puntos", "Exactos", "Ganador", "Empate"]));
  ranking.forEach((r, i) => lines.push(csvRow([i + 1, r.display_name, r.total, r.exactos, r.ganador, r.empate])));
  lines.push("");
  lines.push(csvRow(["DETALLE DE PARTIDOS Y PREDICCIONES"]));
  lines.push(csvRow(["#", "Fase", "Fecha", "Local", "Visitante", "Marcador", "Jugador", "Pred", "Pts"]));
  for (const d of detail) {
    lines.push(csvRow([d.matchNo, d.stage, d.fecha, d.local, d.visitante, d.marcador, d.jugador, d.pred, d.pts]));
  }
  const csv = lines.join("\n");
  const safeName = pool.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "quiniela";
  const fileName = `evidencia_${safeName}.csv`;

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      {/* Estilos de impresión: limpio para PDF */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .print-card { background: #fff !important; border-color: #ddd !important; box-shadow: none !important; }
          .print-text { color: #000 !important; }
          table { font-size: 10px; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="no-print mb-4">
          <Link href={`/pools/${id}?tab=ranking`} className="text-sm text-slate-400 transition hover:text-slate-100">
            ← {pool.name}
          </Link>
        </div>

        <header className="print-text mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Evidencia de resultados</h1>
            <p className="mt-1 text-sm text-slate-400 print-text">
              {pool.name} · código {pool.invite_code} · {ranking.length} jugadores ·{" "}
              {finishedCount}/{matches.length} partidos con resultado
            </p>
          </div>
          <EvidenceExport csv={csv} fileName={fileName} />
        </header>

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
                  <tr key={r.user_id} className={`border-b border-slate-800/50 ${r.user_id === user.id ? "bg-emerald-500/5" : ""}`}>
                    <td className="py-1.5 pr-3 tabular-nums">{i + 1}</td>
                    <td className="py-1.5 pr-3">{r.display_name}{r.user_id === user.id ? " (tú)" : ""}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{r.total}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400 print-text">{r.exactos}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400 print-text">{r.ganador}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-400 print-text">{r.empate}</td>
                  </tr>
                ))}
                {ranking.length === 0 && (
                  <tr><td colSpan={6} className="py-3 text-center text-slate-500">Sin jugadores.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* DETALLE */}
        <section className="print-card rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="print-text mb-1 text-lg font-semibold uppercase tracking-tight">Partidos y predicciones</h2>
          <p className="no-print mb-3 text-xs text-slate-500">
            Las predicciones de otros jugadores aparecen una vez que cierra la fase de cada partido.
          </p>
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
                {detail.map((d, i) => (
                  <tr key={i} className="border-b border-slate-800/40">
                    <td className="py-1.5 pr-3 tabular-nums text-slate-400 print-text">{d.matchNo ?? ""}</td>
                    <td className="py-1.5 pr-3 text-slate-400 print-text">{d.stage}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{d.local} <span className="text-slate-500">vs</span> {d.visitante}</td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums">{d.marcador}</td>
                    <td className="py-1.5 pr-3">{d.predicted ? d.jugador : <span className="text-slate-500 italic">sin predicciones visibles</span>}</td>
                    <td className="py-1.5 pr-3 text-center font-mono tabular-nums">{d.pred}</td>
                    <td className={`py-1.5 text-right tabular-nums ${d.pts && d.pts > 0 ? "font-semibold text-emerald-400 print-text" : "text-slate-400 print-text"}`}>
                      {d.predicted ? d.pts : ""}
                    </td>
                  </tr>
                ))}
                {detail.length === 0 && (
                  <tr><td colSpan={7} className="py-3 text-center text-slate-500">Sin partidos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="print-text mt-6 text-center text-xs text-slate-500">
          5 pts marcador exacto · 3 pts acertar ganador · 2 pts acertar empate · 0 si fallas.
        </p>
      </div>
    </main>
  );
}
