import type { NextConfig } from "next";

/**
 * Exportación estática a `dist/`: toda la lógica se ejecuta en el navegador,
 * por lo que la aplicación se publica en Vercel (o cualquier hosting estático)
 * sin depender del "Framework Preset" ni del "Output Directory" del proyecto.
 */
const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
