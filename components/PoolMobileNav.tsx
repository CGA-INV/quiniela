import Link from "next/link";
import { HomeIcon, BallIcon, TrophyIcon, CashIcon } from "./Icons";

export type PoolTab = "inicio" | "partidos" | "ranking" | "pagos";

const TABS: { value: PoolTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "inicio", label: "Inicio", Icon: HomeIcon },
  { value: "partidos", label: "Partidos", Icon: BallIcon },
  { value: "ranking", label: "Ranking", Icon: TrophyIcon },
  { value: "pagos", label: "Pagos", Icon: CashIcon },
];

export function PoolMobileNav({
  poolId,
  active,
  pagosBadge,
}: {
  poolId: string;
  active: PoolTab;
  pagosBadge?: boolean; // true = mostrar puntito en Pagos
}) {
  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ value, label, Icon }) => {
          const isActive = active === value;
          const showBadge = value === "pagos" && pagosBadge;
          return (
            <li key={value}>
              <Link
                href={value === "inicio" ? `/pools/${poolId}` : `/pools/${poolId}?tab=${value}`}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-emerald-400" : "text-slate-400 hover:text-slate-200",
                ].join(" ")}
                style={{ minHeight: 56 }}
              >
                <Icon className={`h-6 w-6 ${isActive ? "drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]" : ""}`} />
                <span className="leading-none">{label}</span>
                {showBadge && (
                  <span className="absolute top-1.5 right-[calc(50%-1.25rem)] h-2 w-2 rounded-full bg-amber-400 ring-2 ring-slate-950" />
                )}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b bg-emerald-400" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
