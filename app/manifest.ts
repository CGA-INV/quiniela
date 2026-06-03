import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quiniela Mundial 2026",
    short_name: "Quiniela 2026",
    description: "Predice los marcadores, compite con tus amigos y gana puntos.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a1f1c",
    theme_color: "#0a1f1c",
    lang: "es",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
