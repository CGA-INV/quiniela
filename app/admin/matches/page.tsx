import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";
import { fmtDate, timeUntil } from "@/lib/time";
import { Flag } from "@/components/Flag";
import { createMatch, setMatchResult, reopenMatch, deleteMatch, importMatches } from "./actions";

const JSON_EXAMPLE = `[
  {
    "match_no": 1,
    "stage": "group",
    "group_label": "A",
    "home_team": "México",
    "away_team": "[oponente]",
    "kickoff_at": "2026-06-11T19:00:00-05:00",
    "venue": "Estadio Azteca",
    "city": "Ciudad de México"
  },
  {
    "match_no": 2,
    "stage": "group",
    "group_label": "B",
    "home_team": "[equipo]",
    "away_team": "[equipo]",
    "kickoff_at": "2026-06-12T16:00:00-04:00",
    "venue": "MetLife Stadium",
    "city": "Nueva York"
  }
]`;

const STAGE_LABEL: Record<string, string> = {
  group: "Grupos",
  round_of_32: "Treintaidosavos",
  round_of_16: "Octavos",
  quarter: "Cuartos",
  semi: "Semi",
  third_place: "Tercer puesto",
  final: "Final",
};

type Match = {
  id: string;
  stage: keyof typeof STAGE_LABEL;
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

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/pools?error=Acceso%20restringido");

  const [{ data: matches }, { data: preds }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, stage, group_label, home_team, away_team, kickoff_at, home_score, away_score, finished, venue, city, match_no")
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, user_id"),
  ]);

  const matchList = (matches ?? []) as Match[];

  // Cuenta miembros únicos que predijeron por partido (across pools).
  const usersByMatch = new Map<string, Set<string>>();
  for (const p of (preds ?? []) as { match_id: string; user_id: string }[]) {
    if (!usersByMatch.has(p.match_id)) usersByMatch.set(p.match_id, new Set());
    usersByMatch.get(p.match_id)!.add(p.user_id);
  }
  const memberCount = (matchId: string) => usersByMatch.get(matchId)?.size ?? 0;

  const now = Date.now();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-200">
          ← Admin
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Partidos</h1>

        {error && (
          <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {decodeURIComponent(error)}
          </p>
        )}
        {ok && (
          <p className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {decodeURIComponent(ok)}
          </p>
        )}

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold">Agregar partido</h2>
          <form action={createMatch} className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              name="stage"
              required
              defaultValue="group"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {Object.entries(STAGE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input
              name="group_label"
              maxLength={2}
              placeholder="Grupo (A-L) — opcional"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 uppercase text-slate-100 placeholder:text-slate-500 placeholder:normal-case focus:border-emerald-500 focus:outline-none"
            />
            <input
              name="match_no"
              type="number"
              min="1"
              max="999"
              placeholder="N° de partido (1-104) — opcional"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none md:col-span-2"
            />
            <input
              name="home_team"
              required
              maxLength={40}
              placeholder="Equipo local"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <input
              name="away_team"
              required
              maxLength={40}
              placeholder="Equipo visitante"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <input
              name="venue"
              maxLength={80}
              placeholder="Estadio (opcional)"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <input
              name="city"
              maxLength={60}
              placeholder="Ciudad (opcional)"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <input
              name="kickoff_at"
              type="datetime-local"
              required
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none md:col-span-2"
            />
            <button className="rounded-md bg-emerald-500 px-3 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition md:col-span-2">
              Guardar partido
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <details>
            <summary className="cursor-pointer font-semibold">
              Importar en bulk (JSON)
            </summary>
            <p className="mt-2 text-sm text-slate-400">
              Pega un array JSON con todos los partidos del Mundial. Si incluyes
              <code className="mx-1 rounded bg-slate-950 px-1 font-mono">match_no</code>
              y el partido ya existe con ese número, se actualiza. Si no, se inserta.
            </p>
            <form action={importMatches} className="mt-4 space-y-3">
              <textarea
                name="data"
                required
                rows={10}
                placeholder="Pega aquí el array JSON..."
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-3">
                <details className="text-xs text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200">
                    Ver formato y ejemplo
                  </summary>
                  <pre className="mt-2 max-w-full overflow-x-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
{JSON_EXAMPLE}
                  </pre>
                  <p className="mt-2">
                    <strong>Campos requeridos:</strong> stage, home_team, away_team, kickoff_at.{" "}
                    <strong>stage</strong> debe ser uno de:{" "}
                    <code className="font-mono">group, round_of_32, round_of_16, quarter, semi, third_place, final</code>.{" "}
                    <strong>kickoff_at</strong> en ISO-8601 con zona horaria (ej: <code className="font-mono">2026-06-11T19:00:00-05:00</code>).
                  </p>
                </details>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition"
                >
                  Importar
                </button>
              </div>
            </form>
          </details>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold">Calendario ({matchList.length})</h2>
          {matchList.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Aún no hay partidos. Agrégalos arriba o pega el seed
              (<code className="font-mono">supabase/seed_matches_sample.sql</code>) en Supabase.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {matchList.map(m => {
                const open = new Date(m.kickoff_at).getTime() > now;
                const memberCnt = memberCount(m.id);
                return (
                  <li
                    key={m.id}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-xs uppercase tracking-wider text-slate-400">
                          {m.match_no && (
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
                              #{m.match_no}
                            </span>
                          )}
                          <span>{STAGE_LABEL[m.stage] ?? m.stage}</span>
                          {m.group_label && <span>· Grupo {m.group_label}</span>}
                          <span>· {fmtDate(m.kickoff_at)}</span>
                          {open && (
                            <span className="text-emerald-400">· {timeUntil(m.kickoff_at, now)}</span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-medium">
                          <Flag team={m.home_team} size={18} />
                          <span>{m.home_team}</span>
                          <span className="text-slate-500">vs</span>
                          <span>{m.away_team}</span>
                          <Flag team={m.away_team} size={18} />
                        </div>
                        {(m.venue || m.city) && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            {m.venue && <span>📍 {m.venue}</span>}
                            {m.venue && m.city && " · "}
                            {m.city && <span>{m.city}</span>}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-slate-500">
                          {memberCnt > 0
                            ? `${memberCnt} ${memberCnt === 1 ? "miembro predijo" : "miembros predijeron"}`
                            : "nadie ha predicho aún"}
                        </div>
                      </div>
                      {m.finished && (
                        <div className="text-emerald-400 font-mono text-2xl leading-none">
                          {m.home_score}–{m.away_score}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
                      {m.finished ? (
                        <form action={reopenMatch}>
                          <input type="hidden" name="id" value={m.id} />
                          <button className="text-xs text-amber-400 hover:text-amber-300 underline decoration-dotted">
                            Reabrir partido
                          </button>
                        </form>
                      ) : (
                        <form action={setMatchResult} className="flex items-end gap-2">
                          <input type="hidden" name="id" value={m.id} />
                          <label className="text-xs text-slate-400">
                            Local
                            <input
                              type="number"
                              name="home_score"
                              min="0"
                              max="20"
                              required
                              className="mt-0.5 block w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Visitante
                            <input
                              type="number"
                              name="away_score"
                              min="0"
                              max="20"
                              required
                              className="mt-0.5 block w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none"
                            />
                          </label>
                          <button className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition">
                            Cerrar partido
                          </button>
                        </form>
                      )}
                      <form action={deleteMatch}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-xs text-red-400 hover:text-red-300">
                          eliminar
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
