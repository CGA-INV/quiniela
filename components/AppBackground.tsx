import { BackgroundSlideshow } from "./BackgroundSlideshow";
import { ParticleField } from "./ParticleField";

/**
 * Fondo global de toda la web: imágenes mundialistas rotando (una distinta
 * en cada refresh, crossfade automático) + degradado para legibilidad +
 * partículas sutiles. Detrás de todo (-z-10); las páginas van transparentes.
 */
export function AppBackground() {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#0a1f1c]">
        <BackgroundSlideshow />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1f1c]/75 via-[#0a1f1c]/82 to-[#0a1f1c]/95" />
      </div>
      <ParticleField subtle />
    </>
  );
}
