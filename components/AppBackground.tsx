import { ParticleField } from "./ParticleField";

/**
 * Fondo global de toda la web: imagen mundialista oscura + degradado para
 * legibilidad + partículas sutiles. Va detrás de todo el contenido (-z-10),
 * así que las páginas deben tener fondo transparente para que se vea.
 *
 * Reemplaza /imagen/cancha.jpg por tu imagen generada (debe ser oscura para
 * que el texto encima se lea bien).
 */
export function AppBackground() {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#0a1f1c]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/imagen/cancha.jpg"
          alt=""
          className="h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1f1c]/80 via-[#0a1f1c]/85 to-[#0a1f1c]/95" />
      </div>
      <ParticleField subtle />
    </>
  );
}
