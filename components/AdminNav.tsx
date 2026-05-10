import Link from "next/link";
import { signOut } from "../app/login/actions";
import { GridIcon, CalendarIcon, UsersIcon, ActivityIcon } from "./Icons";

export type AdminSection = "salas" | "partidos" | "usuarios" | "bitacora";

const ITEMS: {
  value: AdminSection;
  label: string;
  href: string;
  superOnly?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "salas",     label: "Salas",     href: "/admin",          Icon: GridIcon },
  { value: "partidos",  label: "Partidos",  href: "/admin/matches",  Icon: CalendarIcon },
  { value: "usuarios",  label: "Usuarios",  href: "/admin#usuarios", superOnly: true, Icon: UsersIcon },
  { value: "bitacora",  label: "Bitácora",  href: "/admin/activity", superOnly: true, Icon: ActivityIcon },
];

export function AdminNav({
  active,
  isSuper,
  title,
  breadcrumb,
}: {
  active: AdminSection;
  isSuper: boolean;
  title: string;
  breadcrumb?: { label: string; href?: string }[];
}) {
  const items = ITEMS.filter(i => !i.superOnly || isSuper);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Top row: title + role badge + back/logout */}
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/pools" className="text-sm text-slate-400 hover:text-slate-100 transition" aria-label="Volver a salas">
              ←
            </Link>
            <div className="min-w-0">
              {breadcrumb && breadcrumb.length > 0 && (
                <nav className="flex items-center gap-1 text-xs text-slate-500" aria-label="breadcrumb">
                  {breadcrumb.map((b, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {b.href ? (
                        <Link href={b.href} className="hover:text-slate-300">{b.label}</Link>
                      ) : (
                        <span>{b.label}</span>
                      )}
                      {i < breadcrumb.length - 1 && <span>/</span>}
                    </span>
                  ))}
                </nav>
              )}
              <h1 className="truncate text-base sm:text-lg font-semibold tracking-tight">
                {title}
              </h1>
            </div>
            <span className={`hidden sm:inline shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
              isSuper
                ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30"
                : "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
            }`}>
              {isSuper ? "Super admin" : "Admin de sala"}
            </span>
          </div>
          <form action={signOut}>
            <button className="rounded-md px-2 py-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition">
              Salir
            </button>
          </form>
        </div>

        {/* Tab nav */}
        <nav className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto" aria-label="Secciones admin">
          <ul className="flex gap-1 pb-2 sm:pb-0 sm:border-b sm:border-slate-800/60">
            {items.map(({ value, label, href, Icon }) => {
              const isActive = active === value;
              return (
                <li key={value} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "inline-flex items-center gap-2 rounded-lg sm:rounded-none px-3 py-2 text-sm transition-colors",
                      "sm:border-b-2 sm:rounded-b-none",
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 sm:bg-transparent sm:border-emerald-500"
                        : "text-slate-300 hover:bg-slate-800/40 sm:hover:text-slate-100 sm:border-transparent",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
