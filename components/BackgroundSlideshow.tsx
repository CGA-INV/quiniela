"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const IMAGES = [
  "/imagen/estadio.webp",
  "/imagen/balon.webp",
  "/imagen/cancha.webp",
  "/imagen/aficion.webp",
  "/imagen/trofeo.webp",
];

/**
 * Fondo rotatorio liviano: solo se monta UNA imagen a la vez (no las 5).
 * Arranca en una aleatoria (distinta en cada refresh) y cambia con
 * crossfade cada 9s; la nueva se carga en ese momento (lazy).
 */
export function BackgroundSlideshow() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(Math.floor(Math.random() * IMAGES.length));
    const t = setInterval(() => setIdx(i => (i + 1) % IMAGES.length), 9000);
    return () => clearInterval(t);
  }, []);

  return (
    <Image
      key={idx}
      src={IMAGES[idx]}
      alt=""
      fill
      sizes="100vw"
      className="bg-rotate-fade object-cover"
    />
  );
}
