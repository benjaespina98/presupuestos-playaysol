import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hay un package-lock.json en el directorio padre (fuera de este proyecto), así
  // que Next infería ESA carpeta como raíz del workspace y avisaba en cada
  // arranque. Fijarla explícitamente saca el warning y evita que el dev server
  // rastree archivos de proyectos vecinos.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
