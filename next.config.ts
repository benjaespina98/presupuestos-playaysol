import path from "node:path";
import type { NextConfig } from "next";
import { headersDeSeguridad } from "./lib/seguridad/headers";

const nextConfig: NextConfig = {
  // Hay un package-lock.json en el directorio padre (fuera de este proyecto), así
  // que Next infería ESA carpeta como raíz del workspace y avisaba en cada
  // arranque. Fijarla explícitamente saca el warning y evita que el dev server
  // rastree archivos de proyectos vecinos.
  turbopack: {
    root: path.join(__dirname),
  },

  // Headers de seguridad en todas las rutas (qué se enforza y qué sólo se
  // reporta: lib/seguridad/headers.ts; cómo endurecer la CSP: docs/seguridad-csp.md).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: headersDeSeguridad({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          esDesarrollo: process.env.NODE_ENV === "development",
        }),
      },
    ];
  },
};

export default nextConfig;
