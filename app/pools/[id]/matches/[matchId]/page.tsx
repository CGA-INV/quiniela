import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDateLong, isPredictionOpen } from "@/lib/time";
import { Flag } from "@/components/Flag";
import { getCachedUser } from "@/lib/admin-context";

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
  venue: string | null;
  city: string | null;
  match_no: number | null;
};

type RawMember = {
  user_id: string;
  profiles: { display_name: string } | { display_name: string }[] | null;
};

type Prediction = {
  user_id: string;
  pred_home: number;
  pred_away: number;
  points: number;
};

const STAGE_LABEL: Record<string, string> = {
  group: "Grupos",
  round_of_32: "Treintaidosavos",
  round_of_16: "Octavos",
  quarter: "Cuartos",
  semi: "Semi",
  third_place: "Tercer puesto",
  final: "Final",
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id: poolId, matchId } = await params;
  const [supabase, user] = await Promise.all([createClient(), getCachedUser()]);
  if (!user) redirect("/login");

  const [{ data: pool }, { data: match }] = await Promise.all([
    supabase.from("pools").select("id, name").eq("id", poolId).single(),
    supabase
      .from("matches")
      .select("id, stage, group_label, home_team, away_team, kickoff_at, home_score, away_score, finished, venue, city, match_no")
      .eq("id", matchId)
      .single(),
  ]);

  if (!pool || !match) notFound();
  const m = match as Match;

  // Solo se ven las predicciones de otros una vez cerrado el plazo.
  if (isPredictionOpen(m.kickoff_at)) {
    redirect(`/pools/${poolId}?error=Las%20predicciones%20se%20ven%20al%20cerrar%20el%20plazo`);
  }

  const [{ data: members }, { data: predictions }] = await Promise.all([
    supabase.from("pool_members").select("user_id, profiles(display_name)").eq("pool_id", poolId),
    supabase
      .from("predictions")
      .select("user_id, pred_home, pred_away, points")
      .eq("pool_id", poolId)
      .eq("match_id", matchId),
  ]);

  const rawMembers = (members ?? []) as unknown as RawMember[];
  const memberRows = rawMembers.map(mb => ({
    user_id: mb.user_id,
    display_name: Array.isArray(mb.profiles)
      ? (mb.profiles[0]?.display_name ?? "—")
      : (mb.profiles?.display_name ?? "—"),
  }));

  const predMap = new Map<string, Prediction>(
    ((predictions ?? []) as Prediction[]).map(p => [p.user_id, p]),
  );

  // Combina miembros con sus predicciones (los que no predijeron quedan abajo).
  const rows = memberRows
    .map(mb => {
      const pred = predMap.get(mb.user_id);
      return {
        user_id: mb.user_id,
        display_name: mb.display_name,
        pred_home: pred?.pred_home ?? null,
        pred_away: pred?.pred_away ?? null,
        points: pred?.points ?? 0,
        predicted: pred !== undefined,
      };
    })
    .sort((a, b) => {
      if (a.predicted !== b.predicted) return a.predicted ? -1 : 1;
      if (b.points !== a.points) return b.points - a.points;
      return a.display_name.localeCompare(b.display_name);
    });

  const finished = m.finished && m.home_score !== null && m.away_score !== null;
  const stats = {
    exactos: rows.filter(r => r.points === 5).length,
    ganador: rows.filter(r => r.points === 3).length,
    empate: rows.filter(r => r.points === 2).length,
    fallaron: rows.filter(r => r.predicted && r.points === 0).length,
    noParticipo: rows.filter(r => !r.predicted).length,
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/pools/${poolId}`}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← {pool.name}
        </Link>

        <header className="mt-3">
          <div className="flex flex-wrap items-center gap-x-2 text-xs uppercase tracking-wider text-slate-400">
            {m.match_no && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
                #{m.match_no}
              </span>
            )}
            <span>{STAGE_LABEL[m.stage] ?? m.stage}</span>
            {m.group_label && <span>· Grupo {m.group_label}</span>}
            <span>· {fmtDateLong(m.kickoff_at)}</span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-1 items-center justify-end gap-3 text-2xl font-semibold">
              <span>{m.home_team}</span>
              <Flag team={m.home_team} size={32} />
            </div>
            {finished ? (
              <div className="font-mono text-4xl text-emerald-400">
                {m.home_score}–{m.away_score}
              </div>
            ) : (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-sm text-amber-300">
                esperando resultado
              </div>
            )}
            <div className="flex flex-1 items-center justify-start gap-3 text-2xl font-semibold">
              <Flag team={m.away_team} size={32} />
              <span>{m.away_team}</span>
            </div>
          </div>

          {(m.venue || m.city) && (
            <div className="mt-2 text-center text-sm text-slate-400">
              {m.venue && <>📍 <span className="text-slate-300">{m.venue}</span></>}
              {m.venue && m.city && " · "}
              {m.city}
            </div>
          )}
        </header>

        {finished && (
          <section className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
            <Stat label="Exactos" value={stats.exactos} color="text-emerald-400" />
            <Stat label="Ganador" value={stats.ganador} color="text-emerald-300" />
            <Stat label="Empate" value={stats.empate} color="text-blue-400" />
            <Stat label="Fallaron" value={stats.fallaron} color="text-slate-400" />
            <Stat label="No participó" value={stats.noParticipo} color="text-slate-500" />
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Predicciones</h2>
          <ul className="mt-3 space-y-1.5">
            {rows.map(r => {
              const isMe = r.user_id === user.id;
              const color = !r.predicted
                ? "border-slate-800 bg-slate-900/50 text-slate-500"
                : r.points === 5
                ? "border-emerald-500/40 bg-emerald-500/10"
                : r.points === 3
                ? "border-emerald-500/20 bg-slate-900"
                : r.points === 2
                ? "border-blue-500/20 bg-slate-900"
                : "border-slate-800 bg-slate-900";
              return (
                <li
                  key={r.user_id}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${color}`}
                >
                  <span className={isMe ? "font-medium" : ""}>
                    {r.display_name}
                    {isMe && <span className="ml-1 text-xs text-emerald-400">(tú)</span>}
                  </span>
                  <div className="flex items-center gap-3">
                    {r.predicted ? (
                      <span className="font-mono">{r.pred_home}–{r.pred_away}</span>
                    ) : (
                      <span className="text-xs italic text-slate-500">no participó</span>
                    )}
                    {finished && (
                      <span className={[
                        "w-12 text-right text-sm",
                        r.points > 0 ? "text-emerald-400 font-semibold" : "text-slate-500",
                      ].join(" ")}>
                        {r.predicted ? `${r.points} pts` : ""}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}
