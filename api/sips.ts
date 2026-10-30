/**
 * Función de servidor (Vercel Functions) — Buscador SIPS en vivo.
 *
 * Inicia sesión en el portal EAS (https://eas.renovaenergy.es, plataforma Serenity)
 * con credenciales guardadas SOLO en variables de entorno y consulta el servicio
 * interno `POST /Services/Core/PuntoSuministro/List`. Devuelve filas con las mismas
 * 97 cabeceras que la exportación PuntoSuministro_*.xlsx, para reutilizar el importador.
 *
 * Variables de entorno (Vercel → Settings → Environment Variables):
 *   SIPS_USER, SIPS_PASSWORD   credenciales del portal
 *   APP_ACCESS_KEY             clave que la app envía en la cabecera x-app-key
 *   SIPS_BASE_URL (opcional)   por defecto https://eas.renovaenergy.es
 */

type Cell = string | number | boolean | null;

/** Campo del servicio → cabecera del Excel (orden exacto de la exportación). */
export const FIELD_HEADERS: [string, string][] = [
  ["TipoEnergia", "Tipo Energía"],
  ["CUPS", "CUPS"],
  ["Direccion", "Dirección"],
  ["IdProvinciaNombreProvincia", "Provincia"],
  ["IdLocalidadNombreLocalidad", "Localidad"],
  ["CodigoPostal", "Código Postal"],
  ["IdDistribuidoraNombreDistribuidora", "Distribuidora"],
  ["IdComercializadoraNombreComercializadora", "Comercializadora"],
  ["IdTarifaNombreTarifa", "Tarifa"],
  ["PotenciaContratadaP1", "Pot. P1 (kW)"],
  ["PotenciaContratadaP2", "Pot. P2 (kW)"],
  ["PotenciaContratadaP3", "Pot. P3 (kW)"],
  ["PotenciaContratadaP4", "Pot. P4 (kW)"],
  ["PotenciaContratadaP5", "Pot. P5 (kW)"],
  ["PotenciaContratadaP6", "Pot. P6 (kW)"],
  ["FechaAlta", "F. Alta"],
  ["IdTensionNombreTension", "Tensión (V)"],
  ["PotenciaMaximaBIE", "Pot. Máx. BIE (kW)"],
  ["PotenciaMaximaAPM", "Pot. Máx. APM (kW)"],
  ["IdTipoPuntoMedidaNombreTipoPuntoMedida", "Tipo P.M."],
  ["DisponibilidadICP", "Disp. ICP"],
  ["IdTipoPerfilConsumoNombreTipoPerfilConsumo", "Tipo Perfil Consumo"],
  ["DerechosExtension", "Derechos Extensión (kW)"],
  ["DerechosAcceso", "Derechos Acceso (kW)"],
  ["IdTipoPropiedadEquipoMedidaNombreTipoPropiedad", "Prop. E.M."],
  ["IdTipoPropiedadICPNombreTipoPropiedad", "Prop. ICP"],
  ["FechaUltimoMovimientoContrato", "F. Últ. Mov. Contrato"],
  ["FechaUltimoCambioComercializadora", "F. Últ. Cambio Comer."],
  ["FechaLimiteDerechosReconocidos", "F. Límite Derechos Reconocidos"],
  ["FechaUltimaLectura", "F. Últ. Lectura"],
  ["InformacionImpagos", "Informacion Impagos"],
  ["ImporteDepositoGarantia", "Importe Deposito Garantía (€)"],
  ["IdTipoIdentificadorTitularNombreTipoIdentificadorTitular", "Tipo Id. Titular"],
  ["ViviendaHabitual", "Vivienda Habitual"],
  ["IdTipoTelegestionNombreTipoTelegestion", "Telegestión"],
  ["IdTipoFasesEquipoMedidaNombreTipoFasesEquipoMedida", "Fases E.M."],
  ["IdTipoAutoconsumoNombreTipoAutoconsumo", "Autoconsumo"],
  ["IdTipoContratoATRNombreTipoContratoATR", "Tipo Contrato ATR"],
  ["IdTipoPeriodicidadFacturacionNombreTipoPeriodicidadFacturacion", "Per. Facturación"],
  ["CodigoBIE", "Código BIE"],
  ["FechaEmisionBIE", "F. Emisión BIE"],
  ["FechaCaducidadBIE", "F. Caducidad BIE"],
  ["CodigoAPM", "Código APM"],
  ["FechaEmisionAPM", "F. Emisión APM"],
  ["FechaCaducidadAPM", "F. Caducidad APM"],
  ["RelacionTransformacionIntensidad", "Relación Trans. Intensidad"],
  ["IdCNAECodigoCNAE", "CNAE"],
  ["IdTipoControlPotenciaNombreTipoControlPotencia", "Ctrl Potencia"],
  ["PotenciaCgp", "Potencia CGP"],
  ["IdTipoDHEquipoMedidaNombreTipoDHEquipoMedida", "Tipo D.H. E.M."],
  ["IdTipoAccesoContadorNombreTipoAccesoContador", "Acceso Contador"],
  ["Contratable", "Contratable"],
  ["MotivoNoContratable", "Motivo NO Contratable"],
  ["IdTensionEquipoMedidaNombreTension", "Tensión E.M. (V)"],
  ["IdTipoExpedienteNombreTipoExpediente", "Tipo Exp."],
  ["IdTipoMotivoExpedienteNombreTipoMotivoExpediente", "Motivo Exp."],
  ["IdTipoSuministroNombreTipoSuministro", "Tipo Suministro"],
  ["BonoSocial", "Bono Social"],
  ["EActivaAnual", "E.A. Anual (kWh)"],
  ["EReactivaAnual", "E.R. Anual (kVArh)"],
  ["PotenciaAnual", "Pot. Anual (kW)"],
  ...monthFields("EActivaMes", "E.A.", "kWh"),
  ...monthFields("EReactivaMes", "E.R.", "kVArh"),
  ...monthFields("PotenciaMes", "Pot.", "kW"),
];

function monthFields(prefix: string, label: string, unit: string): [string, string][] {
  const M = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return M.map((m, i) => [`${prefix}${String(i + 1).padStart(2, "0")}`, `${label} ${m} (${unit})`]);
}

export interface SearchInput {
  cups?: string;
  cp?: string;
  direccion?: string;
  tarifa?: string;
  minKWh?: number;
  skip?: number;
  take?: number;
}

const TARIFAS = ["2.0TD", "3.0TD", "6.1TD", "6.2TD", "6.3TD", "6.4TD"];

/** Variant-based matching for portals with a case-sensitive database collation.
 * Covers uppercase, lowercase and common title-case data without relying on
 * SQL functions that older Serenity installations might reject. */
export function caseVariants(field: string, value: string, prefix = "", suffix = ""): unknown {
  const title = value.toLocaleLowerCase("es-ES").replace(/(^|[\s/.,-])([^\s/.,-])/g, (_, sep: string, c: string) => sep + c.toLocaleUpperCase("es-ES"));
  const candidates = [...new Set([value, value.toLocaleUpperCase("es-ES"), value.toLocaleLowerCase("es-ES"), title])];
  const clauses = candidates.map((v) => [[field], "like", `${prefix}${v}${suffix}`]);
  return clauses.slice(1).reduce<unknown>((acc, c) => [acc, "or", c], clauses[0]);
}

/** Valida la consulta y construye la petición Serenity. Exige CUPS completo o código postal. */
export function buildListRequest(q: SearchInput): { ok: true; request: Record<string, unknown> } | { ok: false; error: string } {
  const cups = String(q.cups ?? "").toUpperCase().replace(/[\s\-.]/g, "");
  const cp = String(q.cp ?? "").trim();
  const take = Math.max(1, Math.min(100, Math.floor(Number(q.take ?? 50)) || 50));
  const skip = Math.max(0, Math.floor(Number(q.skip ?? 0)) || 0);
  const base: unknown = [["TipoEnergia"], "=", 1];
  const extra: unknown[] = [];
  const eq: Record<string, string> = {};
  if (cups) {
    if (!/^ES\d{16}[A-Z]{2}([0-9A-Z]{2})?$/.test(cups)) return { ok: false, error: "CUPS incompleto o con formato no válido (ES + 16 dígitos + 2 letras)." };
    // Los CUPS eléctricos del CRM suelen omitir los dos caracteres opcionales
    // de frontera (por ejemplo, 0F). Para 20 caracteres, buscar por prefijo
    // tanto suministros con sufijo como sin él; con 22, coincidencia exacta.
    extra.push(caseVariants("CUPS", cups, "", cups.length === 20 ? "%" : ""));
  } else {
    if (!/^\d{5}$/.test(cp)) return { ok: false, error: "Indica un CUPS completo o un código postal de 5 dígitos (sin código postal la búsqueda en 32 millones de suministros no responde)." };
    eq.CodigoPostal = cp;
    const dir = String(q.direccion ?? "").trim().replace(/[%_\[\]]/g, " ").replace(/\s+/g, " ").trim();
    if (dir) extra.push(caseVariants("Direccion", dir, "%", "%"));
    if (q.tarifa) {
      if (!TARIFAS.includes(q.tarifa)) return { ok: false, error: "Tarifa no válida." };
      extra.push([["IdTarifaNombreTarifa"], "=", q.tarifa]);
    }
    if (q.minKWh != null && Number(q.minKWh) > 0) extra.push([["EActivaAnual"], ">=", Number(q.minKWh)]);
  }
  const Criteria = extra.reduce((acc, c) => [acc, "and", c], base);
  return {
    ok: true,
    request: {
      Take: take,
      Skip: skip,
      EqualityFilter: eq,
      Criteria,
      Sort: ["EActivaAnual DESC"],
      IncludeColumns: FIELD_HEADERS.map(([f]) => f),
    },
  };
}

function toCell(field: string, v: unknown): Cell {
  if (v == null || v === "") return null;
  if (field === "TipoEnergia") return v === 1 ? "Electricidad" : v === 2 ? "Gas" : String(v);
  if (typeof v === "boolean") return v ? "S" : "N";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  if (typeof v === "number" || typeof v === "string") return v;
  return String(v);
}

export function entitiesToRows(entities: Record<string, unknown>[]): Cell[][] {
  return [FIELD_HEADERS.map(([, h]) => h), ...entities.map((e) => FIELD_HEADERS.map(([f]) => toCell(f, e[f])))];
}

/* ---------- Sesión con el portal ---------- */

type Session = { cookies: Map<string, string>; at: number };
let session: Session | null = null;
const SESSION_TTL = 15 * 60 * 1000;

function absorb(cookies: Map<string, string>, res: Response) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const cookieHeader = (c: Map<string, string>) => [...c.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
const csrf = (c: Map<string, string>) => c.get("CSRF-TOKEN") ?? [...c.entries()].find(([k]) => /csrf/i.test(k))?.[1] ?? "";

export async function login(base: string, user: string, pass: string, f: typeof fetch = fetch): Promise<Session> {
  const cookies = new Map<string, string>();
  const r1 = await f(`${base}/Account/Login/`, { redirect: "manual" });
  absorb(cookies, r1);
  const r2 = await f(`${base}/Account/Login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrf(cookies), Cookie: cookieHeader(cookies) },
    body: JSON.stringify({ NombreUsuario: user, Password: pass }),
  });
  absorb(cookies, r2);
  if (r2.status >= 400 || (r2.status === 200 && /"Error"\s*:\s*\{/.test(await r2.clone().text().catch(() => "")))) {
    const t = await r2.text().catch(() => "");
    throw new Error(`Inicio de sesión rechazado por el portal (${r2.status}). ${t.slice(0, 160)}`);
  }
  return { cookies, at: Date.now() };
}

export async function listSupplies(base: string, s: Session, request: Record<string, unknown>, f: typeof fetch = fetch) {
  const r = await f(`${base}/Services/Core/PuntoSuministro/List`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrf(s.cookies), Cookie: cookieHeader(s.cookies) },
    body: JSON.stringify(request),
  });
  absorb(s.cookies, r);
  if (r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400)) return { expired: true as const };
  if (!r.ok) throw new Error(`El portal SIPS respondió ${r.status}${r.status === 504 ? " (tiempo agotado: acota la búsqueda)" : ""}.`);
  const j = (await r.json()) as { Entities?: Record<string, unknown>[]; TotalCount?: number; Error?: { Message?: string } };
  if (j.Error) throw new Error(`Error del portal: ${j.Error.Message ?? "desconocido"}`);
  return { expired: false as const, entities: j.Entities ?? [], total: j.TotalCount ?? 0 };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function env() {
  return {
    base: (process.env.SIPS_BASE_URL ?? "https://eas.renovaenergy.es").replace(/\/$/, ""),
    user: process.env.SIPS_USER ?? "",
    pass: process.env.SIPS_PASSWORD ?? "",
    key: process.env.APP_ACCESS_KEY ?? "",
  };
}

export function GET() {
  const e = env();
  return json({ configured: !!(e.user && e.pass && e.key), credentials: !!(e.user && e.pass), accessKey: !!e.key, base: e.base });
}

/** Lógica del endpoint; `f` permite inyectar un fetch simulado en las pruebas. */
export async function handlePost(req: Request, f: typeof fetch) {
  const e = env();
  if (!e.user || !e.pass || !e.key) return json({ error: "Buscador no configurado: faltan SIPS_USER, SIPS_PASSWORD o APP_ACCESS_KEY en Vercel." }, 503);
  if (req.headers.get("x-app-key") !== e.key) return json({ error: "Clave de acceso incorrecta. Revísala en Ajustes." }, 401);
  const q = (await req.json().catch(() => ({}))) as SearchInput;
  const built = buildListRequest(q);
  if (!built.ok) return json({ error: built.error }, 400);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!session || Date.now() - session.at > SESSION_TTL || attempt > 0) session = await login(e.base, e.user, e.pass, f);
      const r = await listSupplies(e.base, session, built.request, f);
      if (r.expired) {
        session = null;
        continue;
      }
      return json({ total: r.total, rows: entitiesToRows(r.entities), consultedAt: new Date().toISOString(), source: "Portal SIPS · EAS Renovae" });
    }
    return json({ error: "No se pudo mantener la sesión en el portal SIPS." }, 502);
  } catch (err) {
    session = null;
    return json({ error: (err as Error).message }, 502);
  }
}

/** Vercel invoca POST(request, context): el segundo argumento NO es fetch. */
export function POST(req: Request) {
  return handlePost(req, (...a: Parameters<typeof fetch>) => fetch(...a));
}

/** Solo para pruebas. */
export function __resetSession() {
  session = null;
}
