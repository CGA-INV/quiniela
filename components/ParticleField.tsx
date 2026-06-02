"use client";

import { useEffect, useRef } from "react";

/**
 * Réplica de la animación de partículas del onboarding de Stitch:
 * destellos de luz lima que caen como lluvia/reflectores de estadio.
 */
export function ParticleField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const create = () => {
      const particle = document.createElement("div");
      const size = Math.random() * 2 + 1;
      particle.className = "absolute rounded-full opacity-0";
      particle.style.background = "#c6ff3d";
      particle.style.width = `${size}px`;
      particle.style.height = `${size * (Math.random() * 5 + 5)}px`;
      particle.style.left = `${Math.random() * 100}vw`;
      particle.style.top = "-10vh";
      container.appendChild(particle);

      const duration = Math.random() * 1000 + 1000;
      const animation = particle.animate(
        [
          { transform: "translateY(0) rotate(15deg)", opacity: 0 },
          { transform: "translateY(50vh) rotate(15deg)", opacity: 0.5 },
          { transform: "translateY(110vh) rotate(15deg)", opacity: 0 },
        ],
        { duration, easing: "linear" },
      );
      animation.onfinish = () => particle.remove();
    };

    const interval = setInterval(create, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10 opacity-30"
    />
  );
}
