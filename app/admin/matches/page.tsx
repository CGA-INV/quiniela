import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-context";
import { fmtDate, timeUntil } from "@/lib/time";
import { Flag } from "@/components/Flag";
import { createMatch, setMatchResult, updateMatchScore, reopenMatch, deleteMatch, importMatches } from "./actions";
import { AdminNav } from "@/components/AdminNav";

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
  pool_id: string | null;
};

type SandboxPool = { id: string; name: string };

function FilterTab({
  href,
  label,
  active,
  count,
}: {
  href: string;
  label: string;
  active: boolean;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-md px-2.5 py-1 transition whitespace-nowrap",
        active
          ? "bg-emerald-500 text-slate-950 font-medium"
          : "text-slate-300 hover:bg-slate-800/60",
      ].join(" ")}
    >
      {label} <span className={active ? "text-slate-800" : "text-slate-500"}>({count})</span>
    </Link>
  );
}

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; scope?: string; st?: string }>;
}) {
  const { error, ok, scope, st } = await searchParams;
  const ctx = await getAdminContext();
  if (ctx.role === "none") redirect("/pools?error=Acceso%20restringido");
  const isSuper = ctx.role === "super";
  const supabase = await createClient();

  const [{ data: matches }, { data: preds }, { data: sandboxPools }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, stage, group_label, home_team, away_team, kickoff_at, home_score, away_score, finished, venue, city, match_no, pool_id")
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, user_id"),
    supabase
      .from("pools")
      .select("id, name")
      .eq("is_sandbox", true)
      .order("name", { ascending: true }),
  ]);

  const matchListAll = (matches ?? []) as Match[];
  const sandboxList = (sandboxPools ?? []) as SandboxPool[];

  // Filtrar por scope si viene en query.
  const activeScope = scope ?? "all";
  const matchesByScope = matchListAll.filter(m => {
    if (activeScope === "all") return true;
    if (activeScope === "global") return m.pool_id === null;
    return m.pool_id === activeScope;
  });

  // Filtrar por status (estado del partido). Default: "open" (por jugar).
  const activeStatus = (st === "live" || st === "done" || st === "all") ? st : "open";
  const nowMs = Date.now();
  const matchList = matchesByScope.filter(m => {
    if (activeStatus === "all") return true;
    const started = new Date(m.kickoff_at).getTime() <= nowMs;
    if (activeStatus === "open") return !m.finished && !started;
    if (activeStatus === "live") return !m.finished && started;
    if (activeStatus === "done") return m.finished;
    return true;
  });

  // Counts por status (sobre el scope ya filtrado)
  const statusCounts = matchesByScope.reduce(
    (acc, m) => {
      const started = new Date(m.kickoff_at).getTime() <= nowMs;
      if (m.finished) acc.done++;
      else if (started) acc.live++;
      else acc.open++;
      acc.all++;
      return acc;
    },
    { all: 0, open: 0, live: 0, done: 0 },
  );

  const sandboxName = (id: string) => sandboxList.find(p => p.id === id)?.name ?? "—";

  // Genera href manteniendo otros params.
  const buildHref = (overrides: Partial<{ scope: string; st: string }>) => {
    const params = new URLSearchParams();
    const finalScope = overrides.scope ?? (activeScope === "all" ? null : activeScope);
    const finalSt = overrides.st ?? (activeStatus === "open" ? null : activeStatus);
    if (finalScope) params.set("scope", finalScope);
    if (finalSt) params.set("st", finalSt);
    const qs = params.toString();
    return qs ? `/admin/matches?${qs}` : "/admin/matches";
  };

  // Cuenta miembros únicos que predijeron por partido (across pools).
  const usersByMatch = new Map<string, Set<string>>();
  for (const p of (preds ?? []) as { match_id: string; user_id: string }[]) {
    if (!usersByMatch.has(p.match_id)) usersByMatch.set(p.match_id, new Set());
    usersByMatch.get(p.match_id)!.add(p.user_id);
  }
  const memberCount = (matchId: string) => usersByMatch.get(matchId)?.size ?? 0;

  const now = Date.now();

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <AdminNav
        active="partidos"
        isSuper={isSuper}
        title="Partidos"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Partidos" },
        ]}
      />

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {decodeURIComponent(error)}
          </p>
        )}
        {ok && (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
            {decodeURIComponent(ok)}
          </p>
        )}

        {!isSuper && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300">
            Como admin de sala puedes <strong>cerrar partidos</strong> con su resultado.
            No puedes reabrir, modificar resultados ya cerrados, ni eliminar partidos.
          </div>
        )}

        {isSuper && (
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
            <select
              name="pool_id"
              defaultValue={sandboxList.length > 0 && activeScope !== "all" && activeScope !== "global" ? activeScope : "global"}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none md:col-span-2"
            >
              <option value="global">📡 Global Mundial (visible en todas las salas reales)</option>
              {sandboxList.map(p => (
                <option key={p.id} value={p.id}>🧪 Sandbox: {p.name}</option>
              ))}
            </select>
            <button className="rounded-md bg-emerald-500 px-3 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition md:col-span-2">
              Guardar partido
            </button>
          </form>
          {sandboxList.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">
              ¿Querés probar el flujo aislado? Crea una sala con la opción
              "Sala de pruebas" en /admin y aparecerá acá como destino.
            </p>
          )}
        </section>
        )}

        {isSuper && (
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
        )}

        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-xl font-semibold">
              Calendario <span className="text-slate-500 text-base">({matchList.length})</span>
            </h2>
          </div>

          {/* Filtros: status y scope */}
          <div className="mb-4 flex flex-col gap-2">
            {/* Status (siempre visible) */}
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-xs">
              <FilterTab href={buildHref({ st: "open" })} label="Por jugar" active={activeStatus === "open"} count={statusCounts.open} />
              <FilterTab href={buildHref({ st: "live" })} label="En vivo" active={activeStatus === "live"} count={statusCounts.live} />
              <FilterTab href={buildHref({ st: "done" })} label="Finalizados" active={activeStatus === "done"} count={statusCounts.done} />
              <FilterTab href={buildHref({ st: "all" })} label="Todos" active={activeStatus === "all"} count={statusCounts.all} />
            </div>
            {/* Scope (solo cuando hay sandbox) */}
            {sandboxList.length > 0 && (
              <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-xs">
                <FilterTab href={buildHref({ scope: "all" })} label="Todos los partidos" active={activeScope === "all"} count={matchListAll.length} />
                <FilterTab href={buildHref({ scope: "global" })} label="📡 Global" active={activeScope === "global"} count={matchListAll.filter(m => m.pool_id === null).length} />
                {sandboxList.map(p => (
                  <FilterTab
                    key={p.id}
                    href={buildHref({ scope: p.id })}
                    label={`🧪 ${p.name}`}
                    active={activeScope === p.id}
                    count={matchListAll.filter(m => m.pool_id === p.id).length}
                  />
                ))}
              </div>
            )}
          </div>
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
                          {m.pool_id ? (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400 normal-case tracking-normal">
                              🧪 {sandboxName(m.pool_id)}
                            </span>
                          ) : (
                            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-400 normal-case tracking-normal">
                              📡 Global
                            </span>
                          )}
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
                        isSuper ? (
                          <form action={reopenMatch}>
                            <input type="hidden" name="id" value={m.id} />
                            <button className="text-xs text-amber-400 hover:text-amber-300 underline decoration-dotted">
                              Reabrir partido
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-500 italic">cerrado</span>
                        )
                      ) : (
                        <form className="flex items-end gap-2 flex-wrap">
                          <input type="hidden" name="id" value={m.id} />
                          <label className="text-xs text-slate-400">
                            Local
                            <input
                              type="number"
                              name="home_score"
                              min="0"
                              max="30"
                              defaultValue={m.home_score ?? 0}
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
                              max="30"
                              defaultValue={m.away_score ?? 0}
                              required
                              className="mt-0.5 block w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none"
                            />
                          </label>
                          <button
                            type="submit"
                            formAction={updateMatchScore}
                            className="rounded-md border border-emerald-500/40 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 transition"
                            title="Actualiza el marcador en vivo. No cierra el partido."
                          >
                            Actualizar
                          </button>
                          <button
                            type="submit"
                            formAction={setMatchResult}
                            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition"
                            title="Cierra el partido y calcula puntos finales."
                          >
                            Cerrar partido
                          </button>
                        </form>
                      )}
                      {isSuper && (
                        <form action={deleteMatch}>
                          <input type="hidden" name="id" value={m.id} />
                          <button className="text-xs text-red-400 hover:text-red-300">
                            eliminar
                          </button>
                        </form>
                      )}
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
