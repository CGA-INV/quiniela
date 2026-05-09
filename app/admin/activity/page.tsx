import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-context";

type LogRow = {
  id: string;
  actor_id: string;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
  profiles: { display_name: string } | { display_name: string }[] | null;
};

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `hace ${day}d`;
  if (hr > 0) return `hace ${hr}h`;
  if (min > 0) return `hace ${min}m`;
  return "hace segundos";
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const ctx = await getAdminContext();
  if (ctx.role !== "super") redirect("/pools?error=Solo%20super%20admin");

  const supabase = await createClient();
  let query = supabase
    .from("activity_log")
    .select("id, actor_id, action, meta, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter && filter !== "all") {
    query = query.eq("action", filter);
  }
  const { data: rows } = await query;
  const log = (rows ?? []) as unknown as LogRow[];

  const now = Date.now();

  const filters: { value: string; label: string }[] = [
    { value: "all", label: "Todo" },
    { value: "invite_created", label: "Códigos generados" },
    { value: "match_closed", label: "Partidos cerrados" },
    { value: "match_reopened", label: "Reaperturas" },
    { value: "admin_toggled", label: "Promociones" },
    { value: "invite_revoked", label: "Códigos revocados" },
    { value: "pool_created", label: "Salas creadas" },
    { value: "match_deleted", label: "Partidos eliminados" },
  ];
  const active = filter ?? "all";

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-100 transition">
              ←
            </Link>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">
              Bitácora de actividad
            </h1>
            <span className="hidden sm:inline rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/30">
              Super admin
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-1 text-sm">
          {filters.map(f => {
            const isActive = active === f.value;
            return (
              <Link
                key={f.value}
                href={f.value === "all" ? "/admin/activity" : `/admin/activity?filter=${f.value}`}
                className={[
                  "rounded-xl px-3 py-1.5 transition",
                  isActive
                    ? "bg-emerald-500 text-slate-950 font-medium"
                    : "text-slate-300 hover:bg-slate-800/60",
                ].join(" ")}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {log.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
            No hay actividad registrada{active !== "all" && " en esta categoría"}.
          </p>
        ) : (
          <ul className="space-y-2">
            {log.map(r => {
              const actorName = Array.isArray(r.profiles)
                ? (r.profiles[0]?.display_name ?? "—")
                : (r.profiles?.display_name ?? "—");
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <ActionIcon action={r.action} />
                      <div className="min-w-0 flex-1">
                        <ActionDescription
                          action={r.action}
                          actor={actorName}
                          meta={r.meta}
                        />
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 whitespace-nowrap">
                      <div>{timeAgo(r.created_at, now)}</div>
                      <div className="text-slate-600">{fmtFull(r.created_at)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-6 text-xs text-slate-500">
          Mostrando últimas {log.length} entradas (máx 200).
        </p>
      </div>
    </main>
  );
}

/* ───────────────────────────── Helpers de render ───────────────────────────── */

function ActionIcon({ action }: { action: string }) {
  const map: Record<string, { color: string; symbol: string }> = {
    invite_created:  { color: "bg-emerald-500/20 text-emerald-400", symbol: "+" },
    invite_revoked:  { color: "bg-red-500/20 text-red-400",         symbol: "×" },
    match_closed:    { color: "bg-emerald-500/20 text-emerald-400", symbol: "✓" },
    match_reopened:  { color: "bg-amber-500/20 text-amber-400",     symbol: "↻" },
    match_deleted:   { color: "bg-red-500/20 text-red-400",         symbol: "−" },
    match_created:   { color: "bg-blue-500/20 text-blue-400",       symbol: "+" },
    admin_toggled:   { color: "bg-amber-500/20 text-amber-400",     symbol: "⚡" },
    pool_created:    { color: "bg-blue-500/20 text-blue-400",       symbol: "★" },
  };
  const c = map[action] ?? { color: "bg-slate-700/50 text-slate-400", symbol: "·" };
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-bold ${c.color}`}>
      {c.symbol}
    </span>
  );
}

function ActionDescription({
  action,
  actor,
  meta,
}: {
  action: string;
  actor: string;
  meta: Record<string, unknown>;
}) {
  const m = meta as {
    pool_name?: string;
    code?: string;
    note?: string | null;
    home_team?: string;
    away_team?: string;
    home_score?: number;
    away_score?: number;
    target_name?: string;
    made_admin?: boolean;
    was_already_closed?: boolean;
    previous_score?: string;
    invite_code?: string;
  };

  switch (action) {
    case "invite_created":
      return (
        <p className="text-sm">
          <strong className="text-slate-100">{actor}</strong>{" "}
          <span className="text-slate-400">generó código</span>{" "}
          <span className="font-mono rounded bg-slate-800 px-1.5 py-0.5 text-emerald-400">{m.code}</span>{" "}
          <span className="text-slate-400">para</span>{" "}
          <span className="text-slate-200">{m.pool_name}</span>
          {m.note && (
            <span className="text-slate-500"> · destinado a {m.note}</span>
          )}
        </p>
      );
    case "invite_revoked":
      return (
        <p className="text-sm">
          <strong className="text-slate-100">{actor}</strong>{" "}
          <span className="text-slate-400">revocó código</span>{" "}
          <span className="font-mono rounded bg-slate-800 px-1.5 py-0.5 text-red-400 line-through">{m.code}</span>{" "}
          <span className="text-slate-400">de</span> <span className="text-slate-200">{m.pool_name}</span>
        </p>
      );
    case "match_closed":
      return (
        <p className="text-sm">
          <strong className="text-slate-100">{actor}</strong>{" "}
          <span className="text-slate-400">
            {m.was_already_closed ? "modificó resultado de" : "cerró"}
          </span>{" "}
          <span className="text-slate-200">{m.home_team} vs {m.away_team}</span>{" "}
          <span className="font-mono text-emerald-400">{m.home_score}–{m.away_score}</span>
        </p>
      );
    case "match_reopened":
      return (
        <p className="text-sm">
          <strong className="text-slate-100">{actor}</strong>{" "}
          <span className="text-slate-400">reabrió</span>{" "}
          <span className="text-slate-200">{m.home_team} vs {m.away_team}</span>
          {m.previous_score && (
            <span className="text-slate-500"> (antes: <span className="font-mono">{m.previous_score}</span>)</span>
          )}
        </p>
      );
    case "match_deleted":
      return (
        <p className="text-sm">
          <strong className="text-slate-100">{actor}</strong>{" "}
          <span className="text-slate-400">eliminó partido</span>{" "}
          <span className="text-slate-200 line-through">{m.home_team} vs {m.away_team}</span>
        </p>
      );
    case "admin_toggled":
      return (
        <p className="text-sm">
          <strong className="text-slate-100">{actor}</strong>{" "}
          <span className="text-slate-400">
            {m.made_admin ? "hizo admin de sala a" : "quitó admin de sala a"}
          </span>{" "}
          <span className="text-slate-200">{m.target_name}</span>{" "}
          <span className="text-slate-400">en</span>{" "}
          <span className="text-slate-200">{m.pool_name}</span>
        </p>
      );
    case "pool_created":
      return (
        <p className="text-sm">
          <strong className="text-slate-100">{actor}</strong>{" "}
          <span className="text-slate-400">creó sala</span>{" "}
          <span className="text-slate-200">{m.pool_name}</span>
          {m.invite_code && (
            <span className="text-slate-500"> con código <span className="font-mono">{m.invite_code}</span></span>
          )}
        </p>
      );
    default:
      return (
        <p className="text-sm text-slate-400">
          <strong className="text-slate-200">{actor}</strong> · {action}
        </p>
      );
  }
}
