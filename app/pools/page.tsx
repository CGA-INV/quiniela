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
    .select("pool_id, pools(id, name, invite_code, owner_id)")
    .eq("user_id", user!.id);

  type PoolRow = { id: string; name: string; invite_code: string; owner_id: string };
  type Membership = { pools: PoolRow | PoolRow[] | null };
  const pools: PoolRow[] = ((memberships ?? []) as unknown as Membership[])
    .flatMap(m => (Array.isArray(m.pools) ? m.pools : m.pools ? [m.pools] : []));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mis salas</h1>
          <div className="flex items-center gap-4 text-sm">
            {admin && (
              <Link
                href="/admin"
                className="rounded-md bg-emerald-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-emerald-400 transition"
              >
                Panel admin
              </Link>
            )}
            <form action={signOut}>
              <button className="text-slate-400 hover:text-slate-200">
                Salir
              </button>
            </form>
          </div>
        </header>

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

        <section className="mt-8">
          {pools.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center text-slate-400">
              <p>Aún no perteneces a ninguna sala.</p>
              <p className="mt-1 text-sm">
                Espera a que el administrador te envíe una invitación por correo.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pools.map(p => (
                <li key={p.id}>
                  <Link
                    href={`/pools/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:border-emerald-500/50 transition"
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-400">Quiniela activa</div>
                    </div>
                    <span className="text-slate-500">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
