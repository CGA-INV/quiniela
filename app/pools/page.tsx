import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { isAdminEmail } from "@/lib/auth";
import { getCachedUser } from "@/lib/admin-context";

export default async function PoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [supabase, user] = await Promise.all([createClient(), getCachedUser()]);
  const admin = isAdminEmail(user?.email);

  const { data: memberships } = await supabase
    .from("pool_members")
    .select("pool_id, pools(id, name, invite_code, owner_id, is_sandbox)")
    .eq("user_id", user!.id);

  type PoolRow = {
    id: string;
    name: string;
    invite_code: string;
    owner_id: string;
    is_sandbox: boolean;
  };
  type Membership = { pools: PoolRow | PoolRow[] | null };
  const pools: PoolRow[] = ((memberships ?? []) as unknown as Membership[])
    .flatMap(m => (Array.isArray(m.pools) ? m.pools : m.pools ? [m.pools] : []));

  // Conteo de miembros por sala (para mostrar "N miembros" como en Stitch)
  const poolIds = pools.map(p => p.id);
  const { data: allMembers } = poolIds.length
    ? await supabase.from("pool_members").select("pool_id").in("pool_id", poolIds)
    : { data: [] as { pool_id: string }[] };
  const countByPool = new Map<string, number>();
  for (const row of (allMembers ?? []) as { pool_id: string }[]) {
    countByPool.set(row.pool_id, (countByPool.get(row.pool_id) ?? 0) + 1);
  }

  return (
    <main className="relative min-h-screen bg-[#0a1f1c] text-slate-100 pb-16">
      <div className="atmosphere pointer-events-none absolute inset-0 z-0 opacity-[0.12]" />

      {/* Top app bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-100/10 bg-[#0a1f1c]/70 px-5 backdrop-blur-md">
        <span className="flex items-center gap-1.5 font-display text-2xl uppercase italic tracking-tight text-[#c6ff3d]">
          <span
            className="material-symbols-outlined text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            sports_soccer
          </span>
          Mundial 2026
        </span>
        <div className="flex items-center gap-3 text-sm">
          {admin && (
            <Link
              href="/admin"
              className="rounded-full border border-slate-100/15 bg-slate-800 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-slate-300 transition hover:text-[#c6ff3d] active:scale-95"
            >
              Panel admin
            </Link>
          )}
          <form action={signOut}>
            <button className="text-slate-400 transition hover:text-slate-200">
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-5 pt-8">
        <div className="mb-8">
          <h1 className="mb-1 text-4xl tracking-tight text-slate-100">Mis Quinielas</h1>
          <p className="text-base text-slate-400">
            Gestiona y participa en tus grupos de predicción.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {decodeURIComponent(error)}
          </p>
        )}
        {ok && (
          <p className="mb-4 rounded-md border border-[#c6ff3d]/30 bg-[#c6ff3d]/10 px-3 py-2 text-sm text-[#c6ff3d]">
            {decodeURIComponent(ok)}
          </p>
        )}

        {pools.length === 0 ? (
          <div className="rounded-2xl border-t border-slate-100/10 pt-10 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-slate-100/10 bg-slate-800/50 text-2xl">
              ✉️
            </div>
            <p className="mx-auto max-w-md leading-relaxed text-slate-400">
              Aún no perteneces a ninguna sala. Espera a que el administrador te
              envíe una invitación por correo para unirte a un grupo.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pools.map(p => (
              <Link
                key={p.id}
                href={`/pools/${p.id}`}
                className="glass-panel group flex items-center justify-between rounded-2xl p-4 transition-all duration-300 hover:shadow-[0_0_25px_rgb(198_255_61/0.15)] active:scale-[0.98]"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl tracking-wide text-slate-100 transition-colors group-hover:text-[#c6ff3d]">
                      {p.name}
                    </h2>
                    {p.is_sandbox && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-400">
                        Sandbox
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="rounded-full border border-[#c6ff3d]/20 bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#c6ff3d]">
                      Activa
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">group</span>
                      <span className="font-mono text-xs tabular-nums">
                        {countByPool.get(p.id) ?? 1} miembros
                      </span>
                    </span>
                  </div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-100/20 bg-slate-800 text-slate-100 transition-colors group-hover:bg-[#c6ff3d]/10 group-hover:text-[#c6ff3d]">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
