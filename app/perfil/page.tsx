import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/admin-context";
import { ScreenBackground } from "@/components/ScreenBackground";
import { signOut } from "../login/actions";
import { updateDisplayName, changePassword } from "./actions";

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [supabase, user] = await Promise.all([createClient(), getCachedUser()]);
  if (!user) redirect("/login");

  const [{ data: profile }, { data: preds }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("predictions").select("pred_home, pred_away, points, pool_id, matches(home_team, away_team, home_score, away_score, finished, kickoff_at)").eq("user_id", user.id),
    supabase.from("pool_members").select("pool_id, pools(name)").eq("user_id", user.id),
  ]);

  type MatchInfo = {
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    finished: boolean;
    kickoff_at: string;
  };
  type PredRow = {
    pred_home: number;
    pred_away: number;
    points: number;
    pool_id: string;
    matches: MatchInfo | MatchInfo[] | null;
  };
  const predList = (preds ?? []) as PredRow[];
  const totalPts = predList.reduce((a, p) => a + (p.points ?? 0), 0);
  const exactos = predList.filter(p => p.points === 5).length;
  const predichos = predList.length;
  const ptsByPool = new Map<string, number>();
  for (const p of predList) ptsByPool.set(p.pool_id, (ptsByPool.get(p.pool_id) ?? 0) + (p.points ?? 0));

  // Historial: últimas predicciones de partidos finalizados
  const mInfo = (p: PredRow) => (Array.isArray(p.matches) ? p.matches[0] : p.matches);
  const history = predList
    .map(p => ({ p, m: mInfo(p) }))
    .filter((x): x is { p: PredRow; m: MatchInfo } => !!x.m && x.m.finished && x.m.home_score != null)
    .sort((a, b) => new Date(b.m.kickoff_at).getTime() - new Date(a.m.kickoff_at).getTime())
    .slice(0, 12);

  // Logros (derivados de las predicciones)
  const allFinishedAsc = predList
    .map(p => ({ p, m: mInfo(p) }))
    .filter((x): x is { p: PredRow; m: MatchInfo } => !!x.m && x.m.finished && x.m.home_score != null)
    .sort((a, b) => new Date(a.m.kickoff_at).getTime() - new Date(b.m.kickoff_at).getTime());
  let bestStreak = 0;
  let curStreak = 0;
  for (const x of allFinishedAsc) {
    if (x.p.points > 0) { curStreak++; bestStreak = Math.max(bestStreak, curStreak); } else curStreak = 0;
  }
  const achievements = [
    { icon: "🎯", name: "Primer exacto", desc: "1 marcador exacto", earned: exactos >= 1 },
    { icon: "🏹", name: "Francotirador", desc: "5 exactos", earned: exactos >= 5 },
    { icon: "🔮", name: "Oráculo", desc: "10 exactos", earned: exactos >= 10 },
    { icon: "⭐", name: "50 puntos", desc: "50 puntos", earned: totalPts >= 50 },
    { icon: "🌟", name: "100 puntos", desc: "100 puntos", earned: totalPts >= 100 },
    { icon: "🔥", name: "En racha", desc: "3 aciertos seguidos", earned: bestStreak >= 3 },
    { icon: "💥", name: "Imparable", desc: "5 aciertos seguidos", earned: bestStreak >= 5 },
    { icon: "📅", name: "Fiel", desc: "30 partidos predichos", earned: predichos >= 30 },
  ];
  const earnedCount = achievements.filter(a => a.earned).length;

  type M = { pool_id: string; pools: { name: string } | { name: string }[] | null };
  const pools = ((memberships ?? []) as M[]).map(m => ({
    id: m.pool_id,
    name: Array.isArray(m.pools) ? (m.pools[0]?.name ?? "—") : (m.pools?.name ?? "—"),
    pts: ptsByPool.get(m.pool_id) ?? 0,
  }));

  const name: string = profile?.display_name ?? user.email ?? "—";
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 transition-colors focus:border-[#c6ff3d] focus:outline-none focus:ring-1 focus:ring-[#c6ff3d]";
  const labelCls = "font-mono text-xs font-bold uppercase tracking-[0.1em] text-slate-400";
  const btnCls =
    "rounded-lg bg-[#c6ff3d] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#0a1f1c] transition hover:brightness-110 active:scale-95";

  return (
    <main className="relative min-h-dvh text-slate-100">
      <ScreenBackground src="/imagen/balon.webp" />

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-100/10 bg-[#0a1f1c]/70 px-5 backdrop-blur-md">
        <Link href="/pools" className="text-slate-400 transition hover:text-slate-100">←</Link>
        <h1 className="text-xl uppercase tracking-tight">Perfil</h1>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-xl space-y-5 px-5 py-6">
        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {decodeURIComponent(error)}
          </p>
        )}
        {ok && (
          <p className="rounded-md border border-[#c6ff3d]/30 bg-[#c6ff3d]/10 px-3 py-2 text-sm text-[#c6ff3d]">
            {decodeURIComponent(ok)}
          </p>
        )}

        {/* Identidad */}
        <section className="glass-panel flex items-center gap-4 rounded-2xl p-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-[#c6ff3d]/30 bg-slate-800/40 font-display text-2xl text-[#c6ff3d]">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-2xl tracking-tight">{name}</div>
            <div className="truncate text-sm text-slate-400">{user.email}</div>
          </div>
        </section>

        {/* Estadísticas globales */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Puntos" value={totalPts} />
          <Stat label="Exactos" value={exactos} />
          <Stat label="Predichos" value={predichos} />
          <Stat label="Salas" value={pools.length} />
        </section>

        {/* Logros */}
        <section className="glass-panel rounded-2xl p-5">
          <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
            Logros <span className="text-slate-500">({earnedCount}/{achievements.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {achievements.map((a, i) => (
              <div
                key={i}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center ${
                  a.earned ? "border-[#c6ff3d]/30 bg-[#c6ff3d]/5" : "border-white/5 bg-slate-800/20"
                }`}
              >
                <span className="text-2xl" style={a.earned ? undefined : { filter: "grayscale(1) opacity(0.5)" }}>
                  {a.icon}
                </span>
                <span className={`text-[11px] font-bold ${a.earned ? "text-slate-100" : "text-slate-500"}`}>{a.name}</span>
                <span className="text-[9px] leading-tight text-slate-500">{a.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Mis salas */}
        {pools.length > 0 && (
          <section className="glass-panel rounded-2xl p-5">
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-300">Mis salas</h2>
            <ul className="space-y-1.5">
              {pools.map(p => (
                <li key={p.id}>
                  <Link
                    href={`/pools/${p.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 transition hover:bg-slate-800/40"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono tabular-nums text-[#c6ff3d]">{p.pts} pts</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Historial reciente */}
        {history.length > 0 && (
          <section className="glass-panel rounded-2xl p-5">
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-300">Historial reciente</h2>
            <ul className="space-y-1.5">
              {history.map(({ p, m }, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/20 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {m.home_team} <span className="font-mono text-slate-400">{m.home_score}–{m.away_score}</span> {m.away_team}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-mono text-xs">
                    <span className="text-slate-400">tú {p.pred_home}–{p.pred_away}</span>
                    <span className={p.points > 0 ? "font-bold text-[#c6ff3d]" : "text-slate-500"}>{p.points} pts</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Editar nombre */}
        <section className="glass-panel rounded-2xl p-5">
          <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-300">Editar nombre</h2>
          <form action={updateDisplayName} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="display_name"
              defaultValue={profile?.display_name ?? ""}
              required
              minLength={2}
              maxLength={40}
              className={`flex-1 ${inputCls}`}
            />
            <button type="submit" className={`${btnCls} whitespace-nowrap`}>Guardar</button>
          </form>
        </section>

        {/* Cambiar contraseña */}
        <section className="glass-panel rounded-2xl p-5">
          <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-300">Cambiar contraseña</h2>
          <form action={changePassword} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className={labelCls}>Nueva contraseña</label>
              <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="••••••••" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className={labelCls}>Repetir contraseña</label>
              <input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" placeholder="••••••••" className={inputCls} />
            </div>
            <button type="submit" className={`${btnCls} self-start`}>Cambiar contraseña</button>
          </form>
        </section>

        {/* Salir */}
        <form action={signOut}>
          <button className="w-full rounded-lg border border-red-500/30 bg-red-500/10 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-red-400 transition hover:bg-red-500/20">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4 backdrop-blur-md">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-300">{label}</div>
      <div className="mt-1.5 font-display text-3xl tabular-nums text-[#c6ff3d]">{value}</div>
    </div>
  );
}
