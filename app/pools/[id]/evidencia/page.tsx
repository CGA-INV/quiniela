import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/admin-context";
import { isAdminEmail } from "@/lib/auth";
import { fmtDate } from "@/lib/time";
import { EvidenceView, type DetailRow, type RankRow } from "@/components/EvidenceView";

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

  const fin = (m: Match) => m.finished && m.home_score !== null && m.away_score !== null;
  const finishedCount = matches.filter(fin).length;

  // Filas largas (una por predicción visible), agrupadas por partido y orden de ranking.
  const detail: DetailRow[] = [];
  for (const m of matches) {
    const marcador = fin(m) ? `${m.home_score}-${m.away_score}` : "sin jugar";
    const base = {
      matchNo: m.match_no,
      stageKey: m.stage,
      stageLabel: STAGE_LABEL[m.stage] ?? m.stage,
      fecha: fmtDate(m.kickoff_at),
      local: m.home_team,
      visitante: m.away_team,
      marcador,
    };
    const predictors = ranking.filter(r => predBy.has(`${r.user_id}|${m.id}`));
    if (predictors.length === 0) {
      detail.push({ ...base, userId: null, jugador: "—", pred: "", pts: null, predicted: false });
    } else {
      for (const r of predictors) {
        const p = predBy.get(`${r.user_id}|${m.id}`)!;
        detail.push({ ...base, userId: r.user_id, jugador: r.display_name, pred: `${p.pred_home}-${p.pred_away}`, pts: p.points, predicted: true });
      }
    }
  }

  const players = ranking.map(r => ({ id: r.user_id, name: r.display_name }));
  const stages = STAGE_ORDER
    .filter(st => matches.some(m => m.stage === st))
    .map(st => ({ key: st, label: STAGE_LABEL[st] ?? st }));

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
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

        <EvidenceView
          pool={{ name: pool.name, invite_code: pool.invite_code }}
          meta={{ totalMatches: matches.length, finishedCount }}
          ranking={ranking}
          detail={detail}
          players={players}
          stages={stages}
          currentUserId={user.id}
        />

        <p className="print-text mt-6 text-center text-xs text-slate-500">
          5 pts marcador exacto · 3 pts acertar ganador · 2 pts acertar empate · 0 si fallas.
        </p>
      </div>
    </main>
  );
}
