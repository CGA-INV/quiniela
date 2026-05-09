import { teamFlagUrl, teamFlagSrcSet } from "@/lib/flags";

export function Flag({
  team,
  className = "",
  size = 20,
}: {
  team: string;
  className?: string;
  size?: number;
}) {
  const src = teamFlagUrl(team);
  if (!src) {
    return (
      <span
        className={`inline-block rounded-sm bg-slate-700 text-[8px] text-slate-400 ${className}`}
        style={{ width: size, height: Math.round(size * 0.66) }}
        aria-hidden
      />
    );
  }
  const srcSet = teamFlagSrcSet(team) ?? undefined;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      srcSet={srcSet}
      alt=""
      width={size}
      height={Math.round(size * 0.66)}
      loading="lazy"
      className={`inline-block rounded-sm ring-1 ring-slate-800 ${className}`}
    />
  );
}
