"use client";

import { useEffect, useRef } from "react";

/**
 * Animación de partículas: destellos de luz lima que caen como reflectores.
 * - default: protagonista (onboarding), z-10 sobre el contenido.
 * - subtle: fondo global, detrás del contenido (-z-10), más tenue y lento.
 */
export function ParticleField({ subtle = false }: { subtle?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const create = () => {
      // Tope de nodos vivos para no acumular trabajo de render.
      if (container.childElementCount > (subtle ? 22 : 55)) return;
      const particle = document.createElement("div");
      const size = Math.random() * 2 + 1;
      particle.className = "absolute rounded-full opacity-0";
      particle.style.background = "#c6ff3d";
      particle.style.width = `${size}px`;
      particle.style.height = `${size * (Math.random() * 5 + 5)}px`;
      particle.style.left = `${Math.random() * 100}vw`;
      particle.style.top = "-10vh";
      container.appendChild(particle);

      const duration = Math.random() * 1000 + (subtle ? 2000 : 1000);
      const animation = particle.animate(
        [
          { transform: "translateY(0) rotate(15deg)", opacity: 0 },
          { transform: "translateY(50vh) rotate(15deg)", opacity: subtle ? 0.35 : 0.5 },
          { transform: "translateY(110vh) rotate(15deg)", opacity: 0 },
        ],
        { duration, easing: "linear" },
      );
      animation.onfinish = () => particle.remove();
    };

    const interval = setInterval(create, subtle ? 500 : 160);
    return () => clearInterval(interval);
  }, [subtle]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={
        subtle
          ? "pointer-events-none fixed inset-0 -z-10 opacity-20"
          : "pointer-events-none fixed inset-0 z-10 opacity-30"
      }
    />
  );
}
