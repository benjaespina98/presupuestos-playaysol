import type { MetadataRoute } from "next";

/** Para instalar el portal en el celular como una app (pantalla de inicio, sin barra del navegador). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Playa y Sol — Presupuestos",
    short_name: "Playa y Sol",
    description: "Portal interno de presupuestos de Playa y Sol",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1B3A5C",
    lang: "es-AR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
