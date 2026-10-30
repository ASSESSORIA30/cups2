"use client";
/** Cliente del buscador SIPS en vivo (función de servidor /api/sips). */
import type { RawCell } from "./xlsx";

export interface SipsQuery {
  cups?: string;
  cp?: string;
  direccion?: string;
  tarifa?: string;
  minKWh?: number | null;
  skip?: number;
  take?: number;
}
export interface SipsResult {
  total: number;
  rows: RawCell[][];
  consultedAt: string;
  source: string;
}
export interface SipsStatus {
  available: boolean; // la función existe (desplegado en Vercel)
  configured: boolean;
  credentials: boolean;
  accessKey: boolean;
}

export async function sipsStatus(): Promise<SipsStatus> {
  try {
    const r = await fetch("/api/sips", { cache: "no-store" });
    if (!r.ok) return { available: false, configured: false, credentials: false, accessKey: false };
    const j = await r.json();
    return { available: true, configured: !!j.configured, credentials: !!j.credentials, accessKey: !!j.accessKey };
  } catch {
    return { available: false, configured: false, credentials: false, accessKey: false };
  }
}

export async function sipsSearch(q: SipsQuery, key: string): Promise<SipsResult> {
  const r = await fetch("/api/sips", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-app-key": key },
    body: JSON.stringify({ ...q, minKWh: q.minKWh ?? undefined }),
  });
  const j = await r.json().catch(() => ({ error: `Respuesta no válida (${r.status})` }));
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j as SipsResult;
}

export const looksLikeCups = (s: string) => /^ES\d{16}[A-Z]{2}([0-9A-Z]{2})?$/.test(s.toUpperCase().replace(/[\s\-.]/g, ""));
