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
import Image from "next/image";
import { PoolMobileNav, type PoolTab } from "@/components/PoolMobileNav";
import { PricePoll, TimingPoll, VotePromptModal } from "@/components/PoolPolls";
import { WinnerCelebration } from "@/components/WinnerCelebration";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScoreStepper } from "@/components/ScoreStepper";
import { LiveRefresher } from "@/components/LiveRefresher";

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
  const activeTab: PoolTab = (tab === "partidos" || tab === "ranking" || tab === "pagos" || tab === "reglas") ? tab : "inicio";

  const [supabase, user] = await Promise.all([createClient(), getCachedUser()]);
  if (!user) redirect("/login");
  const isSuper = isAdminEmail(user.email);

  const { data: pool, error: poolErr } = await supabase
    .from("pools")
    .select("id, name, invite_code, is_sandbox")
    .eq("id", id)
    .single();
  if (poolErr || !pool) notFound();

  // Link del grupo de WhatsApp (tolerante si la columna aún no existe)
  const { data: waData } = await supabase.from("pools").select("whatsapp_url").eq("id", id).maybeSingle();
  const whatsappUrl = (waData as { whatsapp_url?: string | null } | null)?.whatsapp_url ?? null;

  // RPC pool_ranking agrega miembros + stats en server-side (1 query, mucho más rápido).
  const [{ data: matches }, { data: ownPreds }, { data: rankingData }, { data: payments }, priceVotesRes, paymentVotesRes] =
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
      supabase
        .from("pool_price_votes")
        .select("user_id, price")
        .eq("pool_id", id),
      supabase
        .from("pool_payment_votes")
        .select("user_id, timing")
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

  // Encuestas (graceful si las tablas aún no existen)
  const priceVotes = (priceVotesRes?.data ?? []) as { user_id: string; price: number }[];
  const voteTally: Record<number, number> = { 3: 0, 4: 0, 5: 0 };
  for (const v of priceVotes) if (voteTally[v.price] !== undefined) voteTally[v.price]++;
  const totalVotes = priceVotes.length;
  const myVote = priceVotes.find(v => v.user_id === user.id)?.price;

  const paymentVotes = (paymentVotesRes?.data ?? []) as { user_id: string; timing: string }[];
  const timingTally: Record<string, number> = { antes: 0, despues: 0 };
  for (const v of paymentVotes) if (timingTally[v.timing] !== undefined) timingTally[v.timing]++;
  const totalTiming = paymentVotes.length;
  const myTiming = paymentVotes.find(v => v.user_id === user.id)?.timing;

  // Si no votó en ambas, el modal aparece al abrir la sala.
  const needsVote = !myVote || !myTiming;
  const prizeCount = ranking.length >= 50 ? 3 : ranking.length >= 30 ? 2 : 1;

  // Fondo según la pestaña activa
  const tabBackground: Record<PoolTab, string> = {
    inicio: "/imagen/balon-original.webp",
    partidos: "/imagen/balon-original.webp",
    ranking: "/imagen/trofeo.webp",
    pagos: "/imagen/estadio.webp",
    reglas: "/imagen/balon.webp",
  };

  return (
    <main className="min-h-dvh text-slate-100">
      <ScreenBackground src={tabBackground[activeTab]} />
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
            <Link href="/perfil" className="rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-100">
              Perfil
            </Link>
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
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
            <span className="text-base">✓</span>
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

            {/* Hero estilo Apple Sports: código + nombre + rank */}
            <section className={`flex items-end justify-between gap-3 ${activeTab === "inicio" ? "flex" : "hidden lg:flex"}`}>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400">Código:</span>
                  <span className="font-mono text-[11px] uppercase tracking-wide text-slate-200">{pool.invite_code}</span>
                </div>
                <h2 className="truncate text-4xl uppercase tracking-tight">{pool.name}</h2>
              </div>
              <div className="shrink-0 text-right">
                <span className="block font-mono text-[11px] uppercase tracking-wider text-slate-400">Rank</span>
                <div className="font-display text-6xl leading-none text-[#c6ff3d]">{myRank > 0 ? myRank : "—"}</div>
              </div>
            </section>

            {/* KPIs agrupados (translúcidos) */}
            <section className={`space-y-3 ${activeTab === "inicio" ? "block" : "hidden lg:block"}`}>
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label="Posición"
                  value={myRank > 0 ? `#${myRank}` : "—"}
                  sub={`de ${ranking.length}`}
                  accent="emerald"
                />
                <Stat
                  label="Puntos"
                  value={myStats.total}
                  sub={
                    myStats.exactos > 0 || myStats.ganador > 0 || myStats.empate > 0
                      ? `${myStats.exactos} ex · ${myStats.ganador} gan · ${myStats.empate} emp`
                      : "sin puntos"
                  }
                  accent="emerald"
                />
                <Stat
                  label="Por predecir"
                  value={counts.open}
                  sub={counts.open > 0 ? "no te quedes" : "al día"}
                  accent={counts.open > 0 ? "amber" : "slate"}
                />
              </div>
              <Stat
                label="Próximo partido"
                value={nextOpen ? `${nextOpen.home_team} vs ${nextOpen.away_team}` : "—"}
                sub={nextOpen ? `cierra ${timeUntil(new Date(lockAtMs(nextOpen.kickoff_at)).toISOString(), now)}` : "no hay próximos"}
                accent="amber"
                compact
              />
            </section>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-500/15 px-4 py-3 text-sm font-medium text-green-300 transition hover:bg-green-500/25 ${activeTab === "inicio" ? "flex" : "hidden lg:flex"}`}
              >
                💬 Unirse al grupo de WhatsApp
              </a>
            )}

            {/* Posiciones por grupo - bento - colapsable */}
            {groupLabels.length > 0 && (
              <section className={activeTab === "inicio" ? "block" : "hidden lg:block"}>
                <details open className="group">
                  <summary className="mb-3 flex items-baseline justify-between gap-3 select-none">
                    <div className="flex items-baseline gap-2">
                      <Chevron />
                      <h2 className="text-xl uppercase tracking-tight">Posiciones por grupo</h2>
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
              <section className={`overflow-x-hidden ${activeTab === "partidos" ? "block" : "hidden lg:block"}`}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-xl uppercase tracking-tight">Partidos</h2>
                </div>

                <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-slate-800 bg-slate-900/35 backdrop-blur-xl p-1 text-sm">
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

            {/* Reglas + encuesta de precio */}
            <section className={`space-y-4 ${activeTab === "reglas" ? "block" : "hidden lg:block"}`}>
              <h2 className="text-xl uppercase tracking-tight">Reglas</h2>

              <div className="space-y-3">
                <RuleCard icon="⏰" title="Predicciones">
                  Debes llenar el marcador de cada partido{" "}
                  <strong className="text-slate-100">hasta 1 hora antes</strong> de que empiece.
                  Al cerrar ese plazo el partido se bloquea y ya no puedes modificar tu predicción.
                </RuleCard>
                <RuleCard icon="🎯" title="Puntos">
                  <strong className="text-[#c6ff3d]">5 pts</strong> marcador exacto ·{" "}
                  <strong className="text-[#c6ff3d]">3 pts</strong> acertar al ganador ·{" "}
                  <strong className="text-[#c6ff3d]">2 pts</strong> acertar empate · 0 si fallas.
                </RuleCard>
                <RuleCard icon="🏆" title="Premios">
                  Al terminar se reparten <strong className="text-slate-100">1, 2 o 3 premios</strong> según
                  la cantidad de jugadores: menos de 30 → 1 premio; 30 a 49 → 2 premios (1º y 2º); 50 o más → 3 premios (1º, 2º y 3º).
                  <span className="mt-1 block text-slate-400">
                    Ahora mismo: <strong className="text-[#c6ff3d]">{ranking.length}</strong>{" "}
                    jugador{ranking.length === 1 ? "" : "es"} →{" "}
                    <strong className="text-[#c6ff3d]">{prizeCount} premios</strong>.
                  </span>
                </RuleCard>
                <RuleCard icon="💵" title="Cómo se paga al ganador">
                  Cuando termina la fase de grupos, el sistema marca al ganador. En la pestaña{" "}
                  <strong className="text-slate-100">Pagos</strong> cada jugador sube su comprobante de pago
                  (foto JPG/PNG/WebP, máx 5MB) y el ganador valida cada comprobante que recibe.
                </RuleCard>
              </div>

              {/* Encuestas */}
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
                ⏳ Estas votaciones cierran antes del domingo.
              </p>
              <div className="glass-panel rounded-2xl p-5">
                <PricePoll poolId={id} tally={voteTally} total={totalVotes} mine={myVote} />
              </div>
              <div className="glass-panel rounded-2xl p-5">
                <TimingPoll poolId={id} tally={timingTally} total={totalTiming} mine={myTiming} />
              </div>
              <p className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Toca una opción para votar · puedes cambiar tu voto
              </p>
            </section>
          </main>

          {/* Sidebar ranking / Tabla General (estilo Stitch) - sticky en lg+; tab activo en mobile */}
          <aside className={`lg:sticky lg:top-[4.5rem] lg:self-start lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto ${activeTab === "ranking" ? "block" : "hidden lg:block"}`}>
            <div className="rounded-2xl border border-white/10 bg-slate-900/5 p-5 backdrop-blur-sm">
              <div className="mb-6 text-center">
                <h2 className="text-3xl uppercase italic tracking-tight">Tabla general</h2>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  {pool.name} • {ranking.length} {ranking.length === 1 ? "jugador" : "jugadores"}
                </p>
              </div>

              {ranking.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">Sin miembros todavía.</p>
              ) : (
                <>
                  {/* Podio top 3 */}
                  <div className="mb-8 flex items-end justify-center gap-3">
                    {[1, 0, 2].map(slot => {
                      const r = ranking[slot];
                      if (!r) return <div key={slot} className="flex-1" />;
                      const isLeader = slot === 0;
                      const isMe = r.user_id === user.id;
                      const initials = r.display_name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
                      const ring = isLeader
                        ? "border-4 border-[#c6ff3d]"
                        : slot === 1 ? "border-2 border-slate-100/30" : "border-2 border-amber-600/40";
                      const dim = isLeader ? "h-24 w-24" : "h-16 w-16";
                      return (
                        <div key={slot} className="flex flex-1 flex-col items-center">
                          <div className="relative mb-3">
                            <div className={`grid ${dim} place-items-center rounded-full ${ring} ${isLeader ? "glow-lime" : ""} bg-slate-800/40 font-display${isLeader ? "text-2xl text-[#c6ff3d]" : "text-lg text-slate-200"}`}>
                              {initials}
                            </div>
                            {isLeader ? (
                              <>
                                <span className="material-symbols-outlined absolute -top-5 left-1/2 -translate-x-1/2 text-3xl text-[#c6ff3d]" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#c6ff3d] px-3 py-0.5 font-display text-[10px] uppercase italic text-[#0a1f1c]">Líder</span>
                              </>
                            ) : (
                              <span className="absolute -bottom-1 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-slate-100 font-display text-xs italic text-[#0a1f1c]">{slot === 1 ? 2 : 3}</span>
                            )}
                          </div>
                          <p className={`mb-1 truncate max-w-full font-mono text-[10px] uppercase ${isLeader ? "font-bold tracking-wider text-[#c6ff3d]" : "text-slate-400"}`}>
                            {r.display_name}{isMe ? " (tú)" : ""}
                          </p>
                          <p className={`font-display tabular-nums ${isLeader ? "text-4xl text-[#c6ff3d]" : "text-2xl text-slate-100"}`}>{r.total}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Lista (posiciones 4+) */}
                  {ranking.length > 3 && (
                    <div className="space-y-1">
                      <div className="mb-2 flex items-center border-b border-slate-100/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-slate-400">
                        <span className="w-7">Pos</span>
                        <span className="flex-1">Participante</span>
                        <span className="w-16 text-right">Pts</span>
                      </div>
                      {ranking.slice(3).map((r, i) => {
                        const pos = i + 4;
                        const isMe = r.user_id === user.id;
                        const initials = r.display_name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
                        return (
                          <div
                            key={r.user_id}
                            className={[
                              "flex items-center rounded-xl px-3 py-3 transition-colors",
                              isMe
                                ? "glow-lime border border-[#c6ff3d]/40 bg-slate-800/20"
                                : "border border-white/5 bg-slate-800/8 hover:bg-slate-800/20",
                            ].join(" ")}
                          >
                            <span className={`w-7 font-display italic ${isMe ? "text-[#c6ff3d]" : "text-slate-400"}`}>
                              {String(pos).padStart(2, "0")}
                            </span>
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-700/40 font-mono text-[10px] text-slate-200">
                                {initials}
                              </span>
                              <span className="min-w-0">
                                <span className={`block truncate text-sm font-bold tracking-tight ${isMe ? "text-[#c6ff3d]" : "text-slate-100"}`}>
                                  {r.display_name}{isMe ? " (tú)" : ""}
                                </span>
                                {(r.exactos > 0 || r.ganador > 0 || r.empate > 0) && (
                                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                                    {r.exactos} exactos · {r.ganador} ganador · {r.empate} empate
                                  </span>
                                )}
                              </span>
                            </div>
                            <span className={`w-16 text-right font-display tabular-nums ${isMe ? "text-2xl text-[#c6ff3d]" : "text-lg text-slate-100"}`}>
                              {r.total}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              <p className="mt-6 border-t border-slate-800 pt-3 text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
                5 pts exacto · 3 pts ganador · 2 pts empate
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Bottom nav solo mobile */}
      <PoolMobileNav
        poolId={id}
        active={activeTab}
        pagosBadge={!!winner && !payments?.some(p => p.payer_id === user.id && p.validated_at)}
      />

      {/* Modal de votaciones al abrir la sala (si falta votar alguna) */}
      <VotePromptModal
        needsVote={needsVote}
        poolId={id}
        price={{ tally: voteTally, total: totalVotes, mine: myVote }}
        timing={{ tally: timingTally, total: totalTiming, mine: myTiming }}
      />

      {/* Celebración del ganador al terminar la fase de grupos */}
      {winner && <WinnerCelebration poolId={id} winnerName={winner.display_name} />}

      {/* Auto-refresco de marcadores mientras haya partidos en vivo */}
      <LiveRefresher active={liveMatches.length > 0} />
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
    <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-emerald-500/5 p-5">
      <Image src="/imagen/trofeo.webp" alt="" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover opacity-[0.12]" />
      <div className="relative z-10 flex items-center gap-3">
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

      <div className="relative z-10 mt-4">
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
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/35 backdrop-blur-xl px-4 py-3"
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
                      Validado · {new Date(p.validated_at).toLocaleDateString("es-VE", { timeZone: "America/Caracas" })}
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

      <div className="rounded-xl border border-slate-800 bg-slate-900/35 backdrop-blur-xl p-4">
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
            {new Date(myPayment!.validated_at!).toLocaleDateString("es-VE", {
              timeZone: "America/Caracas", day: "2-digit", month: "long", year: "numeric",
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

function RuleCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel flex gap-3 rounded-2xl p-4">
      <span className="text-xl leading-none" aria-hidden>{icon}</span>
      <div className="min-w-0 text-sm text-slate-300">
        <h3 className="mb-0.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-100">
          {title}
        </h3>
        {children}
      </div>
    </div>
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
  const valueColor =
    accent === "emerald" ? "text-[#c6ff3d]"
    : accent === "amber" ? "text-amber-400"
    : "text-slate-100";

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4 backdrop-blur-md">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-300">{label}</div>
      <div className={`mt-1.5 tabular-nums ${valueColor} ${compact ? "truncate text-base font-semibold" : "font-display text-3xl"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[10px] leading-tight text-slate-200/80">{sub}</div>}
    </div>
  );
}

function GroupCard({ label, rows, hot }: { label: string; rows: StandingRow[]; hot: boolean }) {
  const leader = rows[0];
  return (
    <details
      open
      className={[
        "min-w-0 rounded-2xl border bg-slate-900/35 backdrop-blur-xl p-4 transition",
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
    "min-w-0 rounded-2xl border bg-slate-900/35 backdrop-blur-xl p-4 transition",
    live
      ? "md:col-span-2 border-emerald-500/40 ring-1 ring-emerald-500/20"
      : finished
      ? "border-slate-800 hover:border-slate-700"
      : open && closingSoon
      ? "border-amber-500/50 ring-1 ring-amber-500/25"
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
        ) : open && closingSoon ? (
          <span className="flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-400">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            cierra pronto
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
            <div className="flex shrink-0 items-center gap-2">
              <ScoreStepper name={`home_${m.id}`} defaultValue={pred?.pred_home ?? null} />
              <span className="text-slate-500">–</span>
              <ScoreStepper name={`away_${m.id}`} defaultValue={pred?.pred_away ?? null} />
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
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800/60 pt-2 text-xs">
          <span className="flex items-center gap-1 font-medium text-[#c6ff3d]">
            Ver predicciones de todos
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
          <span className="flex items-center gap-2">
            {!pred && <span className="italic text-slate-500">no participaste</span>}
            {finished && pred && (
              <span className={pred.points > 0 ? "font-medium text-[#c6ff3d]" : "text-slate-500"}>
                {pred.points} pts
              </span>
            )}
          </span>
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
