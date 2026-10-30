import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIELD_HEADERS, handlePost, GET, buildListRequest, entitiesToRows, caseVariants, __resetSession } from "../api/sips";
import { COLUMNS } from "@/lib/columns";
import { parseRows } from "@/lib/parse";

describe("Buscador SIPS · mapeo", () => {
  it("97 campos en el mismo orden que el Excel", () => {
    expect(FIELD_HEADERS).toHaveLength(97);
    expect(FIELD_HEADERS.map(([, h]) => h)).toEqual(COLUMNS.map((c) => c.header));
  });
  it("valida la consulta y construye criterios Serenity", () => {
    expect(buildListRequest({ cups: "ES0031" }).ok).toBe(false);
    expect(buildListRequest({}).ok).toBe(false);
    expect(buildListRequest({ cp: "0820" }).ok).toBe(false);
    const r = buildListRequest({ cp: "08201", direccion: "Migdia 5%", tarifa: "3.0TD", minKWh: 100000, take: 500 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.Take).toBe(100);
      expect(r.request.EqualityFilter).toEqual({ CodigoPostal: "08201" });
      expect(JSON.stringify(r.request.Criteria)).toBe(
        JSON.stringify([[[[["TipoEnergia"], "=", 1], "and", caseVariants("Direccion", "Migdia 5", "%", "%")], "and", [["IdTarifaNombreTarifa"], "=", "3.0TD"]], "and", [["EActivaAnual"], ">=", 100000]]),
      );
    }
    const c = buildListRequest({ cups: "es 0021 0000 0000 0001 rk 0f" });
    expect(c.ok && c.request.EqualityFilter).toEqual({});
    // CUPS eléctrico de 20 caracteres: encuentra el mismo CUPS con cualquier
    // extensión de dos caracteres (por ejemplo 0F).
    const short = buildListRequest({ cups: "es 0021 0000 0000 0001 rk" });
    expect(short.ok).toBe(true);
    if (short.ok) {
      expect(short.request.EqualityFilter).toEqual({});
      expect(short.request.Criteria).toEqual([
        [["TipoEnergia"], "=", 1], "and", caseVariants("CUPS", "ES0021000000000001RK", "", "%")
      ]);
    }
    // Un CUPS de 22 caracteres sigue buscando por coincidencia exacta.
    expect(c.ok && c.request.Criteria).toEqual([["TipoEnergia"], "=", 1], "and", caseVariants("CUPS", "ES0021000000000001RK0F"));
  });
  it("las filas devueltas pasan por el importador", () => {
    const rows = entitiesToRows([
      { TipoEnergia: 1, CUPS: "ES0021000000000001RK0F", Direccion: "C/ TEST 1", IdTarifaNombreTarifa: "3.0TD", PotenciaContratadaP1: 20, FechaCaducidadBIE: "2025-01-02T00:00:00.000", Contratable: true, EActivaAnual: 120000, PotenciaMes07: 18.5 },
    ]);
    const { supplies, report } = parseRows(rows, { file: "Portal SIPS", sheet: "API" });
    expect(report.recognized).toHaveLength(97);
    const s = supplies[0];
    expect(s.tarifa).toBe("3.0TD");
    expect(s.fCaducidadBIE).toBe("2025-01-02");
    expect(s.contratable).toBe(true);
    expect(s.potMensual[6]).toBe(18.5);
    expect(s.tipoEnergia).toBe("Electricidad");
  });
});

describe("Buscador SIPS · sesión y seguridad (portal simulado)", () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let listStatus = 200;
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/Account/Login/")) return new Response("<html/>", { status: 200, headers: [["Set-Cookie", "CSRF-TOKEN=tok123; path=/"]] });
    if (url.endsWith("/Account/Login")) {
      const b = JSON.parse(String(init?.body));
      if (b.Password !== "secreto") return new Response('{"Error":{"Message":"bad"}}', { status: 400 });
      return new Response("{}", { status: 200, headers: [["Set-Cookie", ".AspNetAuth=AUTH; path=/; HttpOnly"]] });
    }
    if (url.endsWith("/Services/Core/PuntoSuministro/List")) {
      if (listStatus === 302) {
        listStatus = 200;
        return new Response("", { status: 302 });
      }
      return new Response(JSON.stringify({ Entities: [{ TipoEnergia: 1, CUPS: "ES0021000000000001RK0F", EActivaAnual: 5 }], TotalCount: 1 }), { status: 200 });
    }
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  const req = (body: unknown, key = "k1") => new Request("http://x/api/sips", { method: "POST", headers: { "x-app-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });

  beforeEach(() => {
    calls.length = 0;
    __resetSession();
    process.env.SIPS_USER = "SIPS";
    process.env.SIPS_PASSWORD = "secreto";
    process.env.APP_ACCESS_KEY = "k1";
  });
  afterEach(() => {
    delete process.env.SIPS_USER;
    delete process.env.SIPS_PASSWORD;
    delete process.env.APP_ACCESS_KEY;
  });

  it("rechaza sin clave y no expone credenciales en GET", async () => {
    expect((await handlePost(req({ cp: "08201" }, "mala"), fake)).status).toBe(401);
    const g = await GET().json();
    expect(JSON.stringify(g)).not.toContain("secreto");
    expect(g.configured).toBe(true);
  });
  it("login con CSRF + cookies y consulta", async () => {
    const r = await handlePost(req({ cups: "ES0021000000000001RK0F" }), fake);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.total).toBe(1);
    expect(j.rows[0]).toHaveLength(97);
    const list = calls.find((c) => c.url.endsWith("/List"))!;
    const h = list.init!.headers as Record<string, string>;
    expect(h["X-CSRF-TOKEN"]).toBe("tok123");
    expect(h.Cookie).toContain(".AspNetAuth=AUTH");
    // segunda consulta reutiliza la sesión
    await handlePost(req({ cp: "08201" }), fake);
    expect(calls.filter((c) => c.url.endsWith("/Account/Login")).length).toBe(1);
  });
  it("si la sesión caduca, vuelve a iniciar sesión", async () => {
    await handlePost(req({ cp: "08201" }), fake);
    listStatus = 302;
    const r = await handlePost(req({ cp: "08201" }), fake);
    expect(r.status).toBe(200);
    expect(calls.filter((c) => c.url.endsWith("/Account/Login")).length).toBe(2);
  });
  it("credenciales incorrectas → error claro", async () => {
    process.env.SIPS_PASSWORD = "otra";
    const r = await handlePost(req({ cp: "08201" }), fake);
    expect(r.status).toBe(502);
    expect((await r.json()).error).toMatch(/rechazado/);
  });
});
