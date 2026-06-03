import Image from "next/image";
import { ParticleField } from "./ParticleField";

/**
 * Fondo fijo por pantalla: imagen mundialista + degradado suave (para que
 * la imagen se aprecie) + partículas sutiles. Va detrás de todo (-z-10);
 * las páginas/superficies van translúcidas para dejar ver la imagen.
 */
export function ScreenBackground({ src }: { src: string }) {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#0a1f1c]">
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1f1c]/40 via-[#0a1f1c]/55 to-[#0a1f1c]/85" />
      </div>
      <ParticleField subtle />
    </>
  );
}
