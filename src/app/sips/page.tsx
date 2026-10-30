"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, CheckSquare, DatabaseZap, KeyRound, Loader2, PlusCircle, Search, Square } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { parseRows, annualActive, maxContracted } from "@/lib/parse";
import { validateCups } from "@/lib/cups";
import { TARIFFS } from "@/lib/tariffs";
import type { RawCell } from "@/lib/xlsx";
import { sipsSearch, sipsStatus, type SipsQuery, type SipsResult, type SipsStatus } from "@/lib/sips-client";
import { cn, fmt } from "@/lib/format";
import { Badge, Button, Callout, Card, Empty, Field, Input, NumInput, Select } from "@/components/ui";
import { PageTitle } from "@/components/shell";

export default function SipsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
      <SipsSearch />
    </Suspense>
  );
}

const PER = 50;

function SipsSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const key = useStore((s) => s.settings.sipsKey);
  const hydrated = useStore((s) => s.hydrated);
  const importRows = useStore((s) => s.importRows);
  const supplies = useStore((s) => s.supplies);
  const inPortfolio = useMemo(() => new Set(supplies.filter((x) => !x.source.demo).map((x) => x.cups)), [supplies]);
  const [status, setStatus] = useState<SipsStatus | null>(null);
  const [mode, setMode] = useState<"cups" | "zona">("cups");
  const [cups, setCups] = useState(params.get("cups") ?? "");
  const [cp, setCp] = useState("");
  const [dir, setDir] = useState("");
  const [tarifa, setTarifa] = useState("");
  const [minKWh, setMinKWh] = useState<number | null>(null);
  const [res, setRes] = useState<SipsResult | null>(null);
  const [query, setQuery] = useState<SipsQuery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const auto = useRef(false);

  useEffect(() => {
    sipsStatus().then(setStatus);
  }, []);

  const parsed = useMemo(() => (res ? parseRows(res.rows, { file: `Portal SIPS · ${fmt.dateTime(res.consultedAt)}`, sheet: "Consulta en vivo", importedAt: res.consultedAt }) : null), [res]);

  async function run(q: SipsQuery) {
    if (!key) {
      setError("Falta la clave de acceso del buscador. Introdúcela en Ajustes.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await sipsSearch(q, key);
      setRes(r);
      setQuery(q);
      setSel(new Set());
      if (r.total === 0) toast("Sin resultados en el portal SIPS");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!auto.current && hydrated && key && params.get("cups")) {
      auto.current = true;
      run({ cups: params.get("cups")! });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "cups") {
      const v = validateCups(cups);
      if (!v.valid) {
        setError(`CUPS: ${v.reason}. Introduce los 20 caracteres base o el CUPS de 22 caracteres.`);
        return;
      }
      run({ cups, take: 20 });
    } else run({ cp, direccion: dir, tarifa: tarifa || undefined, minKWh, skip: 0, take: PER });
  }

  function add(rows: RawCell[][], open?: string) {
    if (!res) return;
    const rep = importRows([res.rows[0], ...rows], { file: `Portal SIPS · ${fmt.dateTime(res.consultedAt)}`, sheet: "Consulta en vivo" }, "merge");
    toast.success(`${rep.imported} suministro(s) añadidos a la cartera`);
    if (open) router.push(`/suministro/?cups=${encodeURIComponent(open)}`);
  }
  const rowFor = (c: string) => res!.rows.slice(1).filter((r) => String(r[1]).toUpperCase().replace(/\s/g, "") === c);

  return (
    <div className="space-y-5">
      <PageTitle icon={<DatabaseZap />} title="Buscador SIPS" subtitle="Consulta en vivo del Sistema de Información de Puntos de Suministro (portal EAS Renovae)" right={status && <Badge tone={status.configured ? "good" : "warning"}>{status.available ? (status.configured ? "Conectado" : "Pendiente de configurar") : "Solo disponible en Vercel"}</Badge>} />

      {status && !status.available && <Callout tone="warning" title="El buscador funciona en la web publicada">Esta copia no tiene la función de servidor. En Vercel se activa sola al configurar las variables de entorno (ver Ajustes).</Callout>}
      {status?.available && !status.configured && (
        <Callout tone="warning" title="Falta configuración en Vercel">
          Añade las variables {!status.credentials && <b>SIPS_USER y SIPS_PASSWORD</b>} {!status.accessKey && <b>APP_ACCESS_KEY</b>} en Vercel → Settings → Environment Variables y vuelve a desplegar.
        </Callout>
      )}
      {hydrated && !key && (
        <Callout tone="info" title="Introduce la clave de acceso">
          Por seguridad, el buscador exige la clave <b>APP_ACCESS_KEY</b>. Guárdala una vez en{" "}
          <Link href="/ajustes/" className="text-accent underline">
            Ajustes
          </Link>
          .
        </Callout>
      )}

      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mb-4 flex gap-2">
          {(
            [
              ["cups", "Por CUPS"],
              ["zona", "Por código postal y dirección"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={cn("rounded-lg border px-3 py-1.5 text-sm", mode === k ? "border-accent bg-accent/10 text-fg" : "border-border text-fg-3 hover:text-fg")}>
              {l}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="relative grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {mode === "cups" ? (
            <Field label="CUPS eléctrico (con o sin sufijo)" className="sm:col-span-2 lg:col-span-5">
              <Input value={cups} onChange={(e) => setCups(e.target.value)} placeholder="ES0031…" className="num h-11 text-base" autoFocus />
            </Field>
          ) : (
            <>
              <Field label="Código postal *">
                <Input value={cp} onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="08201" className="num" />
              </Field>
              <Field label="Dirección (contiene)" className="lg:col-span-2">
                <Input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Calle, número…" />
              </Field>
              <Field label="Tarifa">
                <Select value={tarifa} onChange={(e) => setTarifa(e.target.value)}>
                  <option value="">Todas</option>
                  {TARIFFS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Consumo mínimo (kWh/año)">
                <NumInput value={minKWh} onChange={setMinKWh} placeholder="p. ej. 50000" />
              </Field>
            </>
          )}
          <Button type="submit" size="lg" disabled={busy || !key}>
            {busy ? <Loader2 className="animate-spin" /> : <Search />} Buscar
          </Button>
        </form>
        <p className="relative mt-3 text-[11px] text-fg-3">Para suministros eléctricos puedes buscar con los 20 caracteres base (sin 0F ni otro sufijo) o con los 22 completos. También puedes buscar por código postal. Resultados ordenados por consumo anual.</p>
      </Card>

      {error && <Callout tone="critical">{error}</Callout>}

      {parsed && res && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {parsed.supplies.length === 0 ? (
            <Empty icon={<Search />} title="Sin resultados">
              Revisa el CUPS o amplía la búsqueda (otra dirección o sin filtro de tarifa).
            </Empty>
          ) : (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="text-sm">
                  <b className="num">{fmt.n(res.total)}</b> <span className="text-fg-3">resultados · {res.source} · consultado {fmt.dateTime(res.consultedAt)}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!sel.size} onClick={() => add([...sel].flatMap(rowFor))}>
                    <PlusCircle /> Añadir seleccionados ({sel.size})
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => add(res.rows.slice(1))}>
                    <PlusCircle /> Añadir todos ({parsed.supplies.length})
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-fg-3">
                    <tr>
                      <th className="w-10 px-3 py-2.5" />
                      <th className="px-3 py-2.5 text-left">Suministro</th>
                      <th className="px-3 py-2.5 text-left">Tarifa</th>
                      <th className="px-3 py-2.5 text-left">Comercializadora</th>
                      <th className="px-3 py-2.5 text-right">Consumo</th>
                      <th className="px-3 py-2.5 text-right">Pot. máx.</th>
                      <th className="px-3 py-2.5 text-right">Últ. lectura</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.supplies.map((s) => {
                      const on = sel.has(s.cups);
                      return (
                        <tr key={s.cups} className="border-t border-border hover:bg-surface-2/50">
                          <td className="px-3 py-2.5">
                            <button aria-label="Seleccionar" onClick={() => setSel((p) => (p.has(s.cups) ? new Set([...p].filter((x) => x !== s.cups)) : new Set([...p, s.cups])))} className="text-fg-3 hover:text-accent">
                              {on ? <CheckSquare className="size-4 text-accent" /> : <Square className="size-4" />}
                            </button>
                          </td>
                          <td className="max-w-[340px] px-3 py-2.5">
                            <div className="truncate font-medium">{s.direccion ?? "—"}</div>
                            <div className="num truncate text-[11px] text-fg-3">
                              {s.cups} · {s.cp} {s.localidad}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone="blue">{s.tarifa ?? s.tarifaRaw ?? "—"}</Badge>
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-2.5 text-xs text-fg-2">{s.comercializadora ?? "—"}</td>
                          <td className="num whitespace-nowrap px-3 py-2.5 text-right">{fmt.n((annualActive(s).value ?? 0) / 1000, 1)} MWh</td>
                          <td className="num whitespace-nowrap px-3 py-2.5 text-right">{fmt.kw(maxContracted(s))}</td>
                          <td className="num whitespace-nowrap px-3 py-2.5 text-right text-xs">{fmt.date(s.fUltLectura)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            {inPortfolio.has(s.cups) && <Badge tone="accent" className="mr-2">En cartera</Badge>}
                            <Button size="sm" onClick={() => add(rowFor(s.cups), s.cups)}>
                              Radiografía <ArrowRight />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {query && query.cp && res.total > PER && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-fg-3">
                  <span>
                    {fmt.n((query.skip ?? 0) + 1)}–{fmt.n(Math.min(res.total, (query.skip ?? 0) + PER))} de {fmt.n(res.total)}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy || !query.skip} onClick={() => run({ ...query, skip: Math.max(0, (query.skip ?? 0) - PER) })}>
                      Anterior
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy || (query.skip ?? 0) + PER >= res.total} onClick={() => run({ ...query, skip: (query.skip ?? 0) + PER })}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </motion.div>
      )}
      {!res && !busy && (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["1", "Busca", "Por CUPS eléctrico con o sin sufijo, o por código postal, dirección, tarifa y consumo mínimo."],
            ["2", "Selecciona", "Añade a la cartera los suministros que te interesen."],
            ["3", "Analiza", "Radiografía, Power Optimizer, reactiva y ofertas con los datos oficiales del SIPS."],
          ].map(([n, t, d]) => (
            <div key={n} className="flex gap-3 rounded-xl border border-border bg-surface/50 p-4">
              <div className="num grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-sm font-semibold text-accent">{n}</div>
              <div>
                <div className="text-sm font-medium">{t}</div>
                <div className="text-xs text-fg-3">{d}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-fg-3">
        <KeyRound className="size-3" /> Las credenciales del portal se guardan solo en el servidor (variables de entorno de Vercel); el navegador nunca las recibe.
      </p>
    </div>
  );
}
