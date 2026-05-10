import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, timeUntil, isPredictionOpen, lockAtMs } from "@/lib/time";
import { buildStandings, type StandingRow } from "@/lib/standings";
import { computePoolWinner } from "@/lib/winner";
import { Flag } from "@/components/Flag";
import { isAdminEmail } from "@/lib/auth";
import { getCachedUser } from "@/lib/admin-context";
import { signOut } from "../../login/actions";
import { saveAllPredictions } from "./actions";
import { uploadPaymentProof, validatePayment, unvalidatePayment } from "./payments-actions";
import { PoolMobileNav, type PoolTab } from "@/components/PoolMobileNav";

const STAGE_LABEL: Record<string, string> = {
  group: "Grupos",
  round_of_32: "Treintaidosavos",
  round_of_16: "Octavos",
  quarter: "Cuartos",
  semi: "Semi",
  third_place: "Tercer puesto",
  final: "Final",
};

const STAGE_ORDER = [
  "group", "round_of_32", "round_of_16",
  "quarter", "semi", "third_place", "final",
];

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

type Prediction = {
  match_id: string;
  pred_home: number;
  pred_away: number;
  points: number;
};

type Payment = {
  id: string;
  payer_id: string;
  payee_id: string;
  proof_url: string;
  uploaded_at: string;
  validated_at: string | null;
};

type Filter = "all" | "open" | "live" | "done";

export default async function PoolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string; f?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { error, ok, f, tab } = await searchParams;
  const filter: Filter = (f === "open" || f === "live" || f === "done") ? f : "all";
  const activeTab: PoolTab = (tab === "partidos" || tab === "ranking" || tab === "pagos") ? tab : "inicio";

  const [supabase, user] = await Promise.all([createClient(), getCachedUser()]);
  if (!user) redirect("/login");
  const isSuper = isAdminEmail(user.email);

  const { data: pool, error: poolErr } = await supabase
    .from("pools")
    .select("id, name, invite_code, is_sandbox")
    .eq("id", id)
    .single();
  if (poolErr || !pool) notFound();

  // RPC pool_ranking agrega miembros + stats en server-side (1 query, mucho más rápido).
  const [{ data: matches }, { data: ownPreds }, { data: rankingData }, { data: payments }] =
    await Promise.all([
      // Sandbox pool: solo ve sus propios partidos. Pool real: solo globales.
      (pool.is_sandbox
        ? supabase
            .from("matches")
            .select("id, stage, group_label, home_team, away_team, kickoff_at, home_score, away_score, finished, venue, city, match_no")
            .eq("pool_id", id)
        : supabase
            .from("matches")
            .select("id, stage, group_label, home_team, away_team, kickoff_at, home_score, away_score, finished, venue, city, match_no")
            .is("pool_id", null)
      ).order("kickoff_at", { ascending: true }),
      supabase
        .from("predictions")
        .select("match_id, pred_home, pred_away, points")
        .eq("user_id", user.id)
        .eq("pool_id", id),
      supabase.rpc("pool_ranking", { p_pool: id }),
      supabase
        .from("payments")
        .select("id, payer_id, payee_id, proof_url, uploaded_at, validated_at")
        .eq("pool_id", id),
    ]);

  const matchList = (matches ?? []) as Match[];
  const predMap = new Map<string, Prediction>(
    ((ownPreds ?? []) as Prediction[]).map(p => [p.match_id, p]),
  );

  // RPC ya devuelve rows ordenados con stats + is_admin
  type RankingRow = {
    user_id: string;
    display_name: string;
    is_admin: boolean;
    total: number;
    exactos: number;
    ganador: number;
    empate: number;
  };
  const ranking = ((rankingData ?? []) as RankingRow[]);
  const memberRows = ranking.map(r => ({
    user_id: r.user_id,
    display_name: r.display_name,
    is_admin: r.is_admin,
  }));

  const myRow = ranking.find(r => r.user_id === user.id);
  const isPoolAdmin = myRow?.is_admin ?? false;
  const showAdminLink = isSuper || isPoolAdmin;

  const myStats = myRow
    ? { total: myRow.total, exactos: myRow.exactos, ganador: myRow.ganador, empate: myRow.empate }
    : { total: 0, exactos: 0, ganador: 0, empate: 0 };
  const myRank = ranking.findIndex(r => r.user_id === user.id) + 1;

  // statsByUser para computePoolWinner
  const statsByUser = new Map<string, { total: number; exactos: number }>();
  for (const r of ranking) statsByUser.set(r.user_id, { total: r.total, exactos: r.exactos });

  // Winner se computa desde la data ya fetchada (sync, sin queries extra).
  const winner = computePoolWinner({
    matches: matchList,
    members: memberRows,
    statsByUser,
  });

  // Standings y "hot groups"
  const standings = buildStandings(matchList);
  const groupLabels = Array.from(standings.keys()).sort();

  const now = Date.now();
  const liveMatches = matchList.filter(
    m => new Date(m.kickoff_at).getTime() <= now && !m.finished,
  );
  const hotGroups = new Set(
    liveMatches.map(m => m.group_label).filter((g): g is string => !!g),
  );

  // Counts y filtros de partidos
  const counts = matchList.reduce(
    (acc, m) => {
      const open = isPredictionOpen(m.kickoff_at, now);
      if (open) acc.open++;
      else if (!m.finished) acc.live++;
      else acc.done++;
      acc.all++;
      return acc;
    },
    { all: 0, open: 0, live: 0, done: 0 },
  );

  const filteredMatches = matchList.filter(m => {
    const open = isPredictionOpen(m.kickoff_at, now);
    if (filter === "open") return open;
    if (filter === "live") return !open && !m.finished;
    if (filter === "done") return m.finished;
    return true;
  });

  // Próximo partido para predecir
  const nextOpen = matchList.find(m => isPredictionOpen(m.kickoff_at, now));
  const visibleOpenMatches = filteredMatches.filter(
    m => isPredictionOpen(m.kickoff_at, now),
  ).length;

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      {/* Header sticky con backdrop blur */}
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/pools" className="text-sm text-slate-400 hover:text-slate-100 transition">
              ←
            </Link>
            <h1 className="truncate text-base sm:text-lg font-semibold tracking-tight">
              {pool.name}
            </h1>
            {pool.is_sandbox && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/30">
                🧪 sandbox
              </span>
            )}
            <span className="hidden sm:inline rounded-md bg-slate-800/70 px-2 py-0.5 font-mono text-xs text-slate-300">
              {pool.invite_code}
            </span>
            <span className="hidden md:inline text-xs text-slate-500">
              · {memberRows.length} {memberRows.length === 1 ? "miembro" : "miembros"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {showAdminLink && (
              <Link
                href="/admin"
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400 transition"
              >
                {isSuper ? "Admin" : "Panel"}
              </Link>
            )}
            <form action={signOut}>
              <button className="rounded-md px-2 py-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {decodeURIComponent(error)}
          </div>
        )}
        {ok && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
            {decodeURIComponent(ok)}
          </div>
        )}

        {/* Layout principal: main + sidebar (sticky en lg+) */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 space-y-6">
            {/* Pagos (cuando termina la fase de grupos) */}
            {winner && (
              <div className={activeTab === "pagos" ? "block" : "hidden lg:block"}>
                <PaymentsSection
                  poolId={id}
                  winner={winner}
                  currentUserId={user.id}
                  memberRows={memberRows}
                  payments={(payments ?? []) as Payment[]}
                />
              </div>
            )}
            {/* Estado vacío de pagos en mobile cuando aún no termina */}
            {!winner && activeTab === "pagos" && (
              <div className="lg:hidden rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                <p>La sección de pagos se activa cuando termina la fase de grupos.</p>
              </div>
            )}

            {/* KPI strip */}
            <section className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${activeTab === "inicio" ? "block" : "hidden lg:grid"}`}>
              <Stat
                label="Tu posición"
                value={myRank > 0 ? `#${myRank}` : "—"}
                sub={`de ${ranking.length}`}
                accent="emerald"
              />
              <Stat
                label="Tus puntos"
                value={myStats.total}
                sub={
                  myStats.exactos > 0 || myStats.ganador > 0 || myStats.empate > 0
                    ? `${myStats.exactos} exactos · ${myStats.ganador} ganador · ${myStats.empate} empate`
                    : "sin puntos aún"
                }
                accent="emerald"
              />
              <Stat
                label="Próximo partido"
                value={nextOpen ? `${nextOpen.home_team} vs ${nextOpen.away_team}` : "—"}
                sub={nextOpen ? `cierra ${timeUntil(new Date(lockAtMs(nextOpen.kickoff_at)).toISOString(), now)}` : "no hay próximos"}
                accent="amber"
                compact
              />
              <Stat
                label="Por predecir"
                value={counts.open}
                sub={counts.open > 0 ? "no te quedes" : "todo al día"}
                accent={counts.open > 0 ? "amber" : "slate"}
              />
            </section>

            {/* Posiciones por grupo - bento - colapsable */}
            {groupLabels.length > 0 && (
              <section className={activeTab === "inicio" ? "block" : "hidden lg:block"}>
                <details open className="group">
                  <summary className="mb-3 flex items-baseline justify-between gap-3 select-none">
                    <div className="flex items-baseline gap-2">
                      <Chevron />
                      <h2 className="text-lg font-semibold tracking-tight">Posiciones por grupo</h2>
                    </div>
                    <span className="text-xs text-slate-500">
                      {groupLabels.length} {groupLabels.length === 1 ? "grupo" : "grupos"}
                    </span>
                  </summary>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 auto-rows-fr">
                    {groupLabels.map(g => (
                      <GroupCard
                        key={g}
                        label={g}
                        rows={standings.get(g)!}
                        hot={hotGroups.has(g)}
                      />
                    ))}
                  </div>
                </details>
              </section>
            )}

            {/* Filtros */}
            {matchList.length > 0 && (
              <section className={activeTab === "partidos" ? "block" : "hidden lg:block"}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold tracking-tight">Partidos</h2>
                </div>

                <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-1 text-sm">
                  <FilterTab poolId={id} active={filter} value="all" label="Todos" count={counts.all} />
                  <FilterTab poolId={id} active={filter} value="open" label="Abiertos" count={counts.open} />
                  <FilterTab poolId={id} active={filter} value="live" label="En juego" count={counts.live} />
                  <FilterTab poolId={id} active={filter} value="done" label="Finalizados" count={counts.done} />
                </div>

                <form action={saveAllPredictions}>
                  <input type="hidden" name="pool_id" value={id} />

                  {visibleOpenMatches > 0 && (
                    <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                      <p className="text-sm">
                        <span className="font-semibold text-emerald-400">
                          {visibleOpenMatches}
                        </span>{" "}
                        <span className="text-slate-400">
                          {visibleOpenMatches === 1 ? "partido abierto" : "partidos abiertos"}
                        </span>
                      </p>
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition active:scale-95"
                      >
                        Guardar todo
                      </button>
                    </div>
                  )}

                  {filteredMatches.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                      No hay partidos en esta categoría.
                    </p>
                  ) : (
                    <ByStageGrid
                      matches={filteredMatches}
                      predMap={predMap}
                      poolId={id}
                      now={now}
                    />
                  )}

                  {visibleOpenMatches > 0 && (
                    <div className="mt-6 flex justify-end">
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 hover:bg-emerald-400 transition active:scale-95"
                      >
                        Guardar todo
                      </button>
                    </div>
                  )}
                </form>
              </section>
            )}
          </main>

          {/* Sidebar ranking - sticky en lg+; tab activo en mobile */}
          <aside className={`lg:sticky lg:top-[4.5rem] lg:self-start lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto ${activeTab === "ranking" ? "block" : "hidden lg:block"}`}>
            <details open className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur">
              <summary className="flex items-baseline justify-between gap-2 select-none">
                <div className="flex items-baseline gap-2">
                  <Chevron />
                  <h2 className="font-semibold tracking-tight">Ranking</h2>
                </div>
                <span className="text-xs text-slate-500">
                  Tú: <span className="text-emerald-400 font-bold">{myStats.total}</span>
                  {myRank > 0 && <> · #{myRank}</>}
                </span>
              </summary>
              <div className="mt-3 hidden">
                <span className="text-xs text-slate-500">
                  {ranking.length} {ranking.length === 1 ? "jugador" : "jugadores"}
                </span>
              </div>

              {ranking.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">Sin miembros todavía.</p>
              ) : (
                <ol className="mt-4 space-y-1">
                  {ranking.map((r, i) => {
                    const isMe = r.user_id === user.id;
                    return (
                      <li
                        key={r.user_id}
                        className={[
                          "rounded-lg px-2 py-2 transition",
                          isMe
                            ? "bg-emerald-500/10 border border-emerald-500/30"
                            : "border border-transparent hover:bg-slate-800/40",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span className={[
                              "shrink-0 w-5 text-right text-xs tabular-nums pt-0.5",
                              i === 0 ? "text-amber-400 font-semibold"
                              : i === 1 ? "text-slate-300 font-semibold"
                              : i === 2 ? "text-orange-400 font-semibold"
                              : "text-slate-500",
                            ].join(" ")}>
                              {i + 1}
                            </span>
                            <span className="text-sm break-words">
                              {r.display_name}
                              {isMe && <span className="ml-1 text-xs text-emerald-400">(tú)</span>}
                            </span>
                          </div>
                          <span className={[
                            "font-mono tabular-nums text-sm",
                            isMe ? "text-emerald-400 font-bold" : "text-slate-300",
                          ].join(" ")}>
                            {r.total}
                          </span>
                        </div>
                        {(r.exactos > 0 || r.ganador > 0 || r.empate > 0) && (
                          <div className="ml-7 mt-0.5 text-xs text-slate-500 flex flex-wrap gap-x-2">
                            {r.exactos > 0 && (
                              <span><span className="text-emerald-400 font-medium">{r.exactos}</span> exacto{r.exactos === 1 ? "" : "s"}</span>
                            )}
                            {r.ganador > 0 && (
                              <span><span className="text-emerald-300 font-medium">{r.ganador}</span> ganador</span>
                            )}
                            {r.empate > 0 && (
                              <span><span className="text-blue-400 font-medium">{r.empate}</span> empate</span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
                5 pts marcador exacto · 3 pts ganador · 2 pts empate
              </p>
            </details>
          </aside>
        </div>
      </div>

      {/* Bottom nav solo mobile */}
      <PoolMobileNav
        poolId={id}
        active={activeTab}
        pagosBadge={!!winner && !payments?.some(p => p.payer_id === user.id && p.validated_at)}
      />
    </main>
  );
}

/* ───────────────────── Componentes auxiliares ───────────────────── */

/* ───────────────────── PaymentsSection ───────────────────── */

function PaymentsSection({
  poolId,
  winner,
  currentUserId,
  memberRows,
  payments,
}: {
  poolId: string;
  winner: { user_id: string; display_name: string; total: number; exactos: number };
  currentUserId: string;
  memberRows: { user_id: string; display_name: string }[];
  payments: Payment[];
}) {
  const isWinner = winner.user_id === currentUserId;
  const myPayment = payments.find(p => p.payer_id === currentUserId);

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-emerald-500/5 p-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏆</span>
        <div>
          <h2 className="font-semibold tracking-tight">Fase de grupos terminada</h2>
          <p className="text-sm text-slate-300">
            Ganador: <span className="font-semibold text-amber-400">{winner.display_name}</span>
            <span className="text-slate-500"> · {winner.total} pts · {winner.exactos} exactos</span>
            {isWinner && <span className="ml-2 text-xs rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-400">tú</span>}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {isWinner
          ? <WinnerView poolId={poolId} memberRows={memberRows} payments={payments} winnerId={winner.user_id} />
          : <PayerView poolId={poolId} winnerName={winner.display_name} myPayment={myPayment} />}
      </div>
    </section>
  );
}

function WinnerView({
  poolId,
  memberRows,
  payments,
  winnerId,
}: {
  poolId: string;
  memberRows: { user_id: string; display_name: string }[];
  payments: Payment[];
  winnerId: string;
}) {
  const others = memberRows.filter(m => m.user_id !== winnerId);
  const paymentsByPayer = new Map(payments.map(p => [p.payer_id, p]));
  const validated = others.filter(m => paymentsByPayer.get(m.user_id)?.validated_at).length;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Cobros pendientes
        </h3>
        <span className="text-xs text-slate-500">
          {validated} / {others.length} validados
        </span>
      </div>
      <ul className="space-y-2">
        {others.map(m => {
          const p = paymentsByPayer.get(m.user_id);
          return (
            <li
              key={m.user_id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.display_name}</div>
                <div className="text-xs text-slate-400">
                  {!p && <span>Sin subir comprobante</span>}
                  {p && !p.validated_at && (
                    <span className="text-amber-400">Esperando tu validación</span>
                  )}
                  {p?.validated_at && (
                    <span className="text-emerald-400">
                      Validado · {new Date(p.validated_at).toLocaleDateString("es-MX")}
                    </span>
                  )}
                </div>
              </div>

              {p && (
                <a
                  href={p.proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                  title="Click para ver el comprobante"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.proof_url}
                    alt="comprobante"
                    className="h-12 w-12 rounded-md border border-slate-700 object-cover hover:opacity-80 transition"
                  />
                </a>
              )}

              {p && !p.validated_at && (
                <form action={validatePayment}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400 transition active:scale-95"
                  >
                    Validar
                  </button>
                </form>
              )}
              {p?.validated_at && (
                <form action={unvalidatePayment}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    revertir
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PayerView({
  poolId,
  winnerName,
  myPayment,
}: {
  poolId: string;
  winnerName: string;
  myPayment?: Payment;
}) {
  const validated = !!myPayment?.validated_at;
  const uploaded = !!myPayment;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Tu pago a {winnerName}
      </h3>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm">
            Estado:{" "}
            {validated && <span className="text-emerald-400 font-semibold">✓ Validado</span>}
            {!validated && uploaded && <span className="text-amber-400">En revisión</span>}
            {!uploaded && <span className="text-slate-400">Sin subir</span>}
          </div>
          {myPayment && (
            <a
              href={myPayment.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver mi comprobante"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={myPayment.proof_url}
                alt="mi comprobante"
                className="h-16 w-16 rounded-md border border-slate-700 object-cover hover:opacity-80 transition"
              />
            </a>
          )}
        </div>

        {!validated && (
          <form action={uploadPaymentProof} className="space-y-3">
            <input type="hidden" name="pool_id" value={poolId} />
            <input
              type="file"
              name="proof"
              accept="image/*"
              required
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-emerald-400 file:cursor-pointer cursor-pointer"
            />
            <p className="text-xs text-slate-500">
              Imagen JPG/PNG/WebP, máximo 5MB. Subir reemplaza el comprobante anterior y resetea la validación.
            </p>
            <button
              type="submit"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition active:scale-95"
            >
              {uploaded ? "Reemplazar comprobante" : "Subir comprobante"}
            </button>
          </form>
        )}

        {validated && (
          <p className="text-xs text-slate-400">
            Tu pago fue validado el{" "}
            {new Date(myPayment!.validated_at!).toLocaleDateString("es-MX", {
              day: "2-digit", month: "long", year: "numeric",
            })}
            . ¡Gracias!
          </p>
        )}
      </div>
    </div>
  );
}

function Chevron({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="chevron text-slate-500"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = "slate",
  compact = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "emerald" | "amber" | "slate";
  compact?: boolean;
}) {
  const ringClass =
    accent === "emerald" ? "ring-emerald-500/20"
    : accent === "amber" ? "ring-amber-500/20"
    : "ring-slate-700/50";
  const valueColor =
    accent === "emerald" ? "text-emerald-400"
    : accent === "amber" ? "text-amber-400"
    : "text-slate-100";

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 ring-1 ${ringClass}`}>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 ${compact ? "text-base font-semibold truncate" : "text-3xl font-bold"} tabular-nums ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500 truncate">{sub}</div>}
    </div>
  );
}

function GroupCard({ label, rows, hot }: { label: string; rows: StandingRow[]; hot: boolean }) {
  const leader = rows[0];
  return (
    <details
      open
      className={[
        "rounded-2xl border bg-slate-900/60 p-4 transition",
        hot
          ? "border-emerald-500/40 ring-1 ring-emerald-500/20 lg:col-span-2"
          : "border-slate-800",
      ].join(" ")}
    >
      <summary className="flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Chevron size={14} />
          <h3 className="font-semibold tracking-tight">Grupo {label}</h3>
          {leader && (
            <span className="hidden sm:inline text-xs text-slate-500">
              · líder <Flag team={leader.team} size={12} />{" "}
              <span className="text-slate-300">{leader.team}</span> {leader.pts} pts
            </span>
          )}
        </div>
        {hot && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
            EN VIVO
          </span>
        )}
      </summary>
      <table className="mt-3 w-full text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="text-left font-normal w-4">#</th>
            <th className="text-left font-normal">Equipo</th>
            <th className="text-center font-normal w-6">J</th>
            <th className="text-center font-normal w-6">G</th>
            <th className="text-center font-normal w-6">E</th>
            <th className="text-center font-normal w-6">P</th>
            <th className="text-center font-normal w-8" title="Diferencia de gol">±</th>
            <th className="text-right font-normal w-6 text-slate-300">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const cls = i < 2 ? "text-emerald-300" : "text-slate-300";
            return (
              <tr key={r.team} className="border-t border-slate-800/50">
                <td className={`py-1 tabular-nums ${cls}`}>{i + 1}</td>
                <td className="py-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Flag team={r.team} size={16} />
                    <span className={`truncate ${cls}`}>{r.team}</span>
                  </span>
                </td>
                <td className="text-center text-slate-400 tabular-nums">{r.played}</td>
                <td className="text-center text-slate-400 tabular-nums">{r.won}</td>
                <td className="text-center text-slate-400 tabular-nums">{r.drawn}</td>
                <td className="text-center text-slate-400 tabular-nums">{r.lost}</td>
                <td className={`text-center tabular-nums ${r.gd > 0 ? "text-emerald-400" : r.gd < 0 ? "text-red-400" : "text-slate-400"}`}>
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td className="text-right font-semibold tabular-nums">{r.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

function ByStageGrid({
  matches,
  predMap,
  poolId,
  now,
}: {
  matches: Match[];
  predMap: Map<string, Prediction>;
  poolId: string;
  now: number;
}) {
  const byStage = new Map<string, Match[]>();
  for (const m of matches) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, []);
    byStage.get(m.stage)!.push(m);
  }
  const stagesPresent = STAGE_ORDER.filter(s => byStage.has(s));

  return (
    <div className="space-y-8">
      {stagesPresent.map(stage => (
        <section key={stage}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {STAGE_LABEL[stage]}
          </h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {byStage.get(stage)!.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                pred={predMap.get(m.id)}
                poolId={poolId}
                now={now}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FilterTab({
  poolId,
  active,
  value,
  label,
  count,
}: {
  poolId: string;
  active: Filter;
  value: Filter;
  label: string;
  count: number;
}) {
  const isActive = active === value;
  return (
    <Link
      href={`/pools/${poolId}${value === "all" ? "" : `?f=${value}`}`}
      className={[
        "flex-1 min-w-[6rem] rounded-xl px-3 py-1.5 text-center transition",
        isActive
          ? "bg-emerald-500 text-slate-950 font-medium shadow-sm"
          : "text-slate-300 hover:bg-slate-800/60",
      ].join(" ")}
    >
      {label}{" "}
      <span className={isActive ? "text-slate-800" : "text-slate-500"}>
        ({count})
      </span>
    </Link>
  );
}

function MatchCard({
  match: m,
  pred,
  now,
  poolId,
}: {
  match: Match;
  pred?: Prediction;
  now: number;
  poolId: string;
}) {
  const open = isPredictionOpen(m.kickoff_at, now);
  const lockMs = lockAtMs(m.kickoff_at);
  const lockIso = new Date(lockMs).toISOString();
  const kickoffMs = new Date(m.kickoff_at).getTime();
  const started = now >= kickoffMs;
  const finished = m.finished && m.home_score !== null && m.away_score !== null;
  const live = started && !finished;
  const closingSoon = open && lockMs - now < 60 * 60 * 1000;

  // Layout: live span 2 cols (más prominente)
  const wrapperClass = [
    "rounded-2xl border bg-slate-900/60 p-4 transition",
    live
      ? "md:col-span-2 border-emerald-500/40 ring-1 ring-emerald-500/20"
      : finished
      ? "border-slate-800 hover:border-slate-700"
      : open
      ? "border-slate-800 hover:border-emerald-500/30"
      : "border-slate-800",
  ].join(" ");

  const inner = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs uppercase tracking-wider text-slate-400">
        <div className="flex flex-wrap items-center gap-x-2">
          {m.match_no && (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
              #{m.match_no}
            </span>
          )}
          {m.group_label && <span>Grupo {m.group_label}</span>}
          <span>{fmtDate(m.kickoff_at)}</span>
          {open && (
            <span className={`normal-case ${closingSoon ? "text-amber-400 font-semibold" : "text-emerald-400"}`}>
              cierra {timeUntil(lockIso, now)}
            </span>
          )}
        </div>
        {finished ? (
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-emerald-400">
            {m.home_score}–{m.away_score}
          </span>
        ) : live ? (
          <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            EN VIVO
            {m.home_score !== null && m.away_score !== null && (
              <span className="ml-1 font-mono">{m.home_score}–{m.away_score}</span>
            )}
          </span>
        ) : open ? (
          <span className="text-emerald-400">abierto</span>
        ) : (
          <span className="text-slate-400">cerrado</span>
        )}
      </div>

      <div className={live ? "mt-4" : "mt-3"}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center justify-end gap-2 font-medium text-right flex-1 min-w-0">
            <span className="truncate">{m.home_team}</span>
            <Flag team={m.home_team} size={live ? 24 : 20} />
          </span>

          {open ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                name={`home_${m.id}`}
                type="number"
                min="0"
                max="20"
                defaultValue={pred?.pred_home ?? ""}
                className="w-12 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center font-mono tabular-nums text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <span className="text-slate-500">–</span>
              <input
                name={`away_${m.id}`}
                type="number"
                min="0"
                max="20"
                defaultValue={pred?.pred_away ?? ""}
                className="w-12 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center font-mono tabular-nums text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 font-mono tabular-nums shrink-0 ${live ? "text-3xl" : "text-lg"}`}>
              <span className={`${live ? "w-14" : "w-12"} rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-center`}>
                {pred?.pred_home ?? "–"}
              </span>
              <span className="text-slate-500">–</span>
              <span className={`${live ? "w-14" : "w-12"} rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-center`}>
                {pred?.pred_away ?? "–"}
              </span>
            </div>
          )}

          <span className="flex items-center justify-start gap-2 font-medium text-left flex-1 min-w-0">
            <Flag team={m.away_team} size={live ? 24 : 20} />
            <span className="truncate">{m.away_team}</span>
          </span>
        </div>
      </div>

      {(m.venue || m.city) && (
        <div className="mt-2 text-center text-xs text-slate-500">
          {m.venue && <>📍 {m.venue}</>}
          {m.venue && m.city && " · "}
          {m.city}
        </div>
      )}

      {!open && (
        <div className="mt-2 flex items-center justify-between border-t border-slate-800/60 pt-2 text-xs">
          <span className="text-slate-500">
            {pred ? "Ver predicciones de todos →" : "No participaste"}
          </span>
          {finished && pred && (
            <span className={pred.points > 0 ? "text-emerald-400 font-medium" : "text-slate-500"}>
              {pred.points} pts
            </span>
          )}
        </div>
      )}
    </>
  );

  if (open) {
    return <li className={wrapperClass}>{inner}</li>;
  }

  return (
    <li className="contents">
      <Link href={`/pools/${poolId}/matches/${m.id}`} className={wrapperClass + " block"}>
        {inner}
      </Link>
    </li>
  );
}
