"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const IMAGES = [
  "/imagen/estadio.png",
  "/imagen/balon.png",
  "/imagen/cancha.png",
  "/imagen/aficion.png",
  "/imagen/trofeo.png",
];

/**
 * Fondo rotatorio: arranca en una imagen aleatoria (distinta en cada refresh)
 * y va cambiando con crossfade cada 8 segundos.
 */
export function BackgroundSlideshow() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(Math.floor(Math.random() * IMAGES.length));
    const t = setInterval(() => setIdx(i => (i + 1) % IMAGES.length), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {IMAGES.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="100vw"
          priority={i === 0}
          className={`object-cover transition-opacity duration-1000 ${
            i === idx ? "opacity-40" : "opacity-0"
          }`}
        />
      ))}
    </>
  );
}
