import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth";
import { createPool, generateInvitation, revokeInvitation } from "./actions";

type Pool = { id: string; name: string; invite_code: string };
type Invitation = {
  id: string;
  pool_id: string;
  email: string | null;
  code: string;
  used_at: string | null;
  expires_at: string;
  created_at: string;
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/pools?error=Acceso%20restringido");

  const { data: pools } = await supabase
    .from("pools")
    .select("id, name, invite_code")
    .order("created_at", { ascending: false });
  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, pool_id, email, code, used_at, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const poolList = (pools ?? []) as Pool[];
  const inviteList = (invitations ?? []) as Invitation[];
  const poolName = (id: string) =>
    poolList.find(p => p.id === id)?.name ?? "—";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <Link href="/pools" className="text-sm text-slate-400 hover:text-slate-200">
            ← Mis salas
          </Link>
          <span className="text-xs uppercase tracking-wider text-emerald-400">
            Panel admin
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-bold">Administración</h1>

        <nav className="mt-4 flex gap-2 text-sm">
          <Link
            href="/admin/matches"
            className="rounded-md border border-slate-700 px-3 py-1.5 hover:bg-slate-800 transition"
          >
            Partidos →
          </Link>
        </nav>

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

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Crear nueva sala</h2>
            <form action={createPool} className="mt-4 space-y-3">
              <input
                name="name"
                required
                maxLength={60}
                placeholder="Nombre (ej: La Oficina)"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button className="w-full rounded-md bg-emerald-500 px-3 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition">
                Crear sala
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Generar código de invitación</h2>
            <p className="mt-1 text-xs text-slate-400">
              Cada código es de un solo uso y vence en 7 días. Cópialo y mándalo
              por WhatsApp a quien quieras invitar.
            </p>
            <form action={generateInvitation} className="mt-4 space-y-3">
              <select
                name="pool_id"
                required
                defaultValue=""
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="" disabled>Elige una sala...</option>
                {poolList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                name="note"
                type="text"
                maxLength={80}
                placeholder="Para quién (opcional, solo nota interna)"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                disabled={poolList.length === 0}
                className="w-full rounded-md bg-emerald-500 px-3 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generar código
              </button>
              {poolList.length === 0 && (
                <p className="text-xs text-slate-400">
                  Crea primero una sala para poder generar códigos.
                </p>
              )}
            </form>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Salas ({poolList.length})</h2>
          {poolList.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No hay salas todavía.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {poolList.map(p => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
                >
                  <Link href={`/pools/${p.id}`} className="font-medium hover:text-emerald-400">
                    {p.name}
                  </Link>
                  <span className="text-xs text-slate-500 font-mono">
                    código sala: {p.invite_code}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Invitaciones recientes</h2>
          {inviteList.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Aún no se ha enviado ninguna.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {inviteList.map(inv => {
                const expired = new Date(inv.expires_at) < new Date();
                const status = inv.used_at
                  ? { label: "usado", color: "text-slate-500" }
                  : expired
                  ? { label: "expirado", color: "text-red-400" }
                  : { label: "disponible", color: "text-emerald-400" };
                return (
                  <li
                    key={inv.id}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-lg tracking-wider">{inv.code}</div>
                        <div className="text-xs text-slate-400">
                          {poolName(inv.pool_id)}
                          {inv.email && ` · para ${inv.email}`}
                          {" · "}
                          <span className={status.color}>{status.label}</span>
                        </div>
                      </div>
                      {!inv.used_at && (
                        <form action={revokeInvitation}>
                          <input type="hidden" name="id" value={inv.id} />
                          <button
                            className="text-xs text-red-400 hover:text-red-300"
                            type="submit"
                          >
                            revocar
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
