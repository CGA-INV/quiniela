import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-context";
import { isAdminEmail, ADMIN_EMAIL } from "@/lib/auth";
import {
  createPool,
  generateInvitation,
  revokeInvitation,
  togglePoolAdmin,
  addExistingMember,
  deleteUser,
} from "./actions";
import { AdminNav } from "@/components/AdminNav";

type Pool = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
};

type Invitation = {
  id: string;
  pool_id: string;
  email: string | null;
  code: string;
  used_at: string | null;
  expires_at: string;
  created_at: string;
};

type RawMember = {
  user_id: string;
  is_admin: boolean;
  profiles: { display_name: string; id?: string } | { display_name: string; id?: string }[] | null;
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const ctx = await getAdminContext();
  if (ctx.role === "none") redirect("/pools?error=Acceso%20restringido");

  const isSuper = ctx.role === "super";
  const supabase = await createClient();

  // Salas: super admin ve todas; pool admin solo las que admin.
  const poolsQuery = supabase
    .from("pools")
    .select("id, name, invite_code, owner_id")
    .order("created_at", { ascending: false });
  if (!isSuper) poolsQuery.in("id", ctx.managedPools);
  const { data: pools } = await poolsQuery;
  const poolList = (pools ?? []) as Pool[];

  // Miembros (con flag is_admin) de las salas visibles.
  const poolIds = poolList.map(p => p.id);
  const { data: members } = poolIds.length > 0
    ? await supabase
        .from("pool_members")
        .select("pool_id, user_id, is_admin, profiles(display_name)")
        .in("pool_id", poolIds)
    : { data: [] };

  // Mapear: pool_id -> array de miembros con nombre
  type MemberView = { user_id: string; display_name: string; is_admin: boolean };
  const membersByPool = new Map<string, MemberView[]>();
  for (const r of (members ?? []) as (RawMember & { pool_id: string })[]) {
    const dn = Array.isArray(r.profiles)
      ? (r.profiles[0]?.display_name ?? "—")
      : (r.profiles?.display_name ?? "—");
    const list = membersByPool.get(r.pool_id) ?? [];
    list.push({ user_id: r.user_id, display_name: dn, is_admin: r.is_admin });
    membersByPool.set(r.pool_id, list);
  }

  const myUserId = ctx.userId;

  // Invitaciones (filtradas por las salas visibles).
  const { data: invitations } = poolIds.length > 0
    ? await supabase
        .from("invitations")
        .select("id, pool_id, email, code, used_at, expires_at, created_at")
        .in("pool_id", poolIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const inviteList = (invitations ?? []) as Invitation[];
  const poolName = (id: string) => poolList.find(p => p.id === id)?.name ?? "—";

  // Todos los perfiles registrados (para el dropdown de "agregar miembro existente").
  // RLS de profiles permite a authenticated leer todos.
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name", { ascending: true });
  const profileList = (allProfiles ?? []) as { id: string; display_name: string }[];

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <AdminNav
        active="salas"
        isSuper={isSuper}
        title={isSuper ? "Administración global" : "Mi panel de admin"}
      />

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
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

        {/* Crear sala (super y pool admin) */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="font-semibold tracking-tight">Crear nueva sala</h2>
            <form action={createPool} className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  name="name"
                  required
                  maxLength={60}
                  placeholder="Nombre (ej: La Oficina, Pruebas)"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <button className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition active:scale-95">
                  Crear sala
                </button>
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_sandbox"
                  className="mt-0.5 accent-amber-500"
                />
                <span>
                  <strong className="text-amber-400">Sala de pruebas</strong>{" "}
                  <span className="text-xs text-slate-500">
                    — esta sala tendrá su propio calendario de partidos (no comparte con las demás).
                    Útil para probar el flujo completo sin tocar el calendario real.
                  </span>
                </span>
              </label>
            </form>
            {!isSuper && (
              <p className="mt-3 text-xs text-slate-500">
                Como admin de sala, al crear una nueva quedas como su admin automáticamente.
              </p>
            )}
          </section>

        {/* Salas */}
        <section className="mb-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              {isSuper ? "Salas" : "Mis salas"}
              <span className="ml-2 text-xs text-slate-500">({poolList.length})</span>
            </h2>
          </div>

          {poolList.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
              {isSuper
                ? "Aún no hay salas. Crea la primera arriba."
                : "No tienes salas asignadas."}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {poolList.map(p => (
                <PoolCard
                  key={p.id}
                  pool={p}
                  members={membersByPool.get(p.id) ?? []}
                  isSuper={isSuper}
                  allProfiles={profileList}
                />
              ))}
            </div>
          )}
        </section>

        {/* Invitaciones recientes */}
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Invitaciones recientes
            <span className="ml-2 text-xs text-slate-500">({inviteList.length})</span>
          </h2>
          {inviteList.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
              No hay invitaciones todavía.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-base tracking-wider">{inv.code}</div>
                        <div className="text-xs text-slate-400 truncate">
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
                            type="submit"
                            className="text-xs text-red-400 hover:text-red-300"
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

        {/* Usuarios registrados — solo super admin puede borrar */}
        {isSuper && (
          <section className="mt-8" id="usuarios">
            <details>
              <summary className="cursor-pointer mb-3 select-none">
                <h2 className="inline text-lg font-semibold tracking-tight">
                  Usuarios registrados
                </h2>
                <span className="ml-2 text-xs text-slate-500">
                  ({profileList.length})
                </span>
              </summary>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {profileList.map(p => {
                  const isMe = p.id === ctx.userId;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
                    >
                      <span className="truncate">
                        {p.display_name}
                        {isMe && <span className="ml-1 text-xs text-amber-400">(tú)</span>}
                      </span>
                      {!isMe && (
                        <details className="shrink-0">
                          <summary className="text-xs text-slate-500 hover:text-red-400 cursor-pointer select-none">
                            eliminar
                          </summary>
                          <form action={deleteUser} className="mt-1 flex items-center gap-2">
                            <input type="hidden" name="user_id" value={p.id} />
                            <button
                              type="submit"
                              className="rounded-md bg-red-500/10 border border-red-500/30 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"
                              title="Borra el usuario y todos sus datos. Las salas que creó se mantienen sin owner."
                            >
                              Sí, eliminar todo
                            </button>
                          </form>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                Eliminar borra: predicciones, membresías, pagos, invitaciones generadas y la cuenta entera.
                Las salas que creó se conservan sin owner.
              </p>
            </details>
          </section>
        )}
      </div>
    </main>
  );
}

/* ───────────────────── Componentes ───────────────────── */

function PoolCard({
  pool,
  members,
  isSuper,
  allProfiles,
}: {
  pool: Pool;
  members: { user_id: string; display_name: string; is_admin: boolean }[];
  isSuper: boolean;
  allProfiles: { id: string; display_name: string }[];
}) {
  const memberIds = new Set(members.map(m => m.user_id));
  const candidates = allProfiles.filter(p => !memberIds.has(p.id));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/pools/${pool.id}`} className="text-lg font-semibold tracking-tight hover:text-emerald-400">
            {pool.name}
          </Link>
          <div className="mt-1 text-xs text-slate-400">
            código sala:{" "}
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
              {pool.invite_code}
            </span>
          </div>
        </div>
      </div>

      <form action={generateInvitation} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input type="hidden" name="pool_id" value={pool.id} />
        <input
          name="note"
          maxLength={80}
          placeholder="Para quién (nota interna, opcional)"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <button className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition active:scale-95 whitespace-nowrap">
          Generar código
        </button>
      </form>

      {candidates.length > 0 && (
        <form action={addExistingMember} className="mt-2 flex flex-col sm:flex-row gap-2">
          <input type="hidden" name="pool_id" value={pool.id} />
          <select
            name="user_id"
            required
            defaultValue=""
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="" disabled>Agregar usuario existente...</option>
            {candidates.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
          <button className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 transition whitespace-nowrap">
            Agregar
          </button>
        </form>
      )}

      <div className="mt-4 border-t border-slate-800 pt-3">
        <h3 className="text-xs uppercase tracking-wider text-slate-400">
          Miembros ({members.length})
        </h3>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin miembros aún.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {members.map(m => {
              // El super admin es siempre el owner_id de la sala (creó la sala).
              const isSuperAdminRow = m.user_id === pool.owner_id;
              return (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{m.display_name}</span>
                    {isSuperAdminRow && (
                      <span className="text-xs text-amber-400">⚡ super</span>
                    )}
                    {!isSuperAdminRow && m.is_admin && (
                      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-400 ring-1 ring-emerald-500/30">
                        admin sala
                      </span>
                    )}
                  </div>
                  {isSuper && !isSuperAdminRow && (
                    <form action={togglePoolAdmin}>
                      <input type="hidden" name="pool_id" value={pool.id} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <input type="hidden" name="make_admin" value={m.is_admin ? "false" : "true"} />
                      <button
                        type="submit"
                        className={
                          m.is_admin
                            ? "text-xs text-red-400 hover:text-red-300"
                            : "text-xs text-emerald-400 hover:text-emerald-300"
                        }
                      >
                        {m.is_admin ? "quitar admin" : "hacer admin"}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
