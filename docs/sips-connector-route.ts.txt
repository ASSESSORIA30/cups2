/**
 * Conector servidor con el portal SIPS (https://eas.renovaenergy.es/).
 *
 * Las credenciales se leen EXCLUSIVAMENTE de variables de entorno del servidor
 * (Vercel → Settings → Environment Variables): SIPS_USER, SIPS_PASSWORD y
 * opcionalmente SIPS_BASE_URL. Nunca se exponen al cliente ni se guardan en el código.
 *
 * Estado: la descarga automática requiere conocer el flujo de autenticación y el
 * endpoint de exportación del portal (no documentados públicamente y no accesibles
 * desde el entorno de desarrollo). La interfaz `fetchSupplyPoints` está preparada
 * para implementarlo; mientras tanto la importación se hace con el Excel exportado.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function config() {
  return {
    base: process.env.SIPS_BASE_URL ?? "https://eas.renovaenergy.es",
    user: process.env.SIPS_USER,
    pass: process.env.SIPS_PASSWORD,
  };
}

export async function GET() {
  const c = config();
  const configured = !!(c.user && c.pass);
  return NextResponse.json({
    configured,
    base: c.base,
    automaticDownload: false,
    message: configured
      ? "Credenciales presentes en el servidor. La descarga automática está pendiente de mapear el flujo de login y exportación del portal; usa la importación de Excel."
      : "Configura SIPS_USER y SIPS_PASSWORD en las variables de entorno del despliegue para habilitar el conector. Mientras tanto, importa el Excel exportado del portal.",
  });
}

export async function POST(req: Request) {
  const c = config();
  if (!c.user || !c.pass) return NextResponse.json({ error: "Conector no configurado" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { cups?: string[] };
  if (!Array.isArray(body.cups) || body.cups.length === 0) return NextResponse.json({ error: "Indica una lista de CUPS" }, { status: 400 });
  return NextResponse.json(
    {
      error: "Descarga automática no implementada",
      detail: "Falta documentar el flujo de autenticación y el endpoint de exportación del portal SIPS. Implementar en fetchSupplyPoints() y devolver filas con las 97 cabeceras de PuntoSuministro_*.xlsx para reutilizar el importador.",
    },
    { status: 501 },
  );
}
