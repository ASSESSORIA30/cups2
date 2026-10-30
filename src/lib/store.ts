"use client";
/**
 * Estado de la aplicación (cliente) persistido en IndexedDB.
 * La capa de persistencia está aislada para sustituirla por una API/BD
 * (ver docs/schema.sql) cuando se integre con el CRM de Assessoria 3.0.
 */
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { del, get, set } from "idb-keyval";
import { parseRows } from "./parse";
import { demoRows } from "./demo";
import { DEFAULT_ALERT_CONFIG, type AlertConfig } from "./alerts";
import { DEFAULT_SCORING, type ScoringConfig } from "./scoring";
import { REGULATED_2026, type RegulatedSet, type TariffCode, regulatedPowerPrice } from "./tariffs";
import type { ImportReport, Opportunity, Supply } from "./types";
import type { Offer } from "./market";
import type { PeriodMaxTable } from "./optimizer";
import type { RawCell } from "./xlsx";

const hasIdb = () => typeof indexedDB !== "undefined";
const idb: StateStorage = {
  getItem: async (k) => (hasIdb() ? ((await get<string>(k)) ?? null) : null),
  setItem: async (k, v) => {
    if (hasIdb()) await set(k, v);
  },
  removeItem: async (k) => {
    if (hasIdb()) await del(k);
  },
};

export interface Settings {
  regulated: RegulatedSet;
  marginPowerEurKWyr: number; // margen comercial sobre ATR por defecto
  modCosts: { extensionEurKW: number; accesoEurKW: number; fixedEur: number };
  scoring: ScoringConfig;
  alerts: AlertConfig;
  logoDataUrl: string | null;
  userName: string;
  reactiveShareOutsideP6: number | null;
  sipsKey: string;
}

export interface InvoiceData {
  kWhByPeriod: (number | null)[]; // anual por periodo, desde facturas
  source: string;
  date: string;
}

interface State {
  hydrated: boolean;
  supplies: Supply[];
  reports: ImportReport[];
  offers: Offer[];
  crm: Record<string, Opportunity>;
  periodMax: Record<string, PeriodMaxTable>;
  invoices: Record<string, InvoiceData>;
  settings: Settings;
  importRows: (rows: RawCell[][], meta: { file: string; sheet: string }, mode: "replace" | "merge") => ImportReport;
  loadDemo: () => ImportReport;
  clearSupplies: () => void;
  upsertOffer: (o: Offer) => void;
  deleteOffer: (id: string) => void;
  updateOpp: (cups: string, fn: (o: Opportunity) => Opportunity) => void;
  setPeriodMax: (cups: string, t: PeriodMaxTable | null) => void;
  setInvoice: (cups: string, d: InvoiceData | null) => void;
  setSettings: (fn: (s: Settings) => Settings) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  regulated: REGULATED_2026,
  marginPowerEurKWyr: 0,
  modCosts: { extensionEurKW: 17.374714, accesoEurKW: 19.703137, fixedEur: 9.04476 },
  scoring: DEFAULT_SCORING,
  alerts: DEFAULT_ALERT_CONFIG,
  logoDataUrl: null,
  userName: "Comercial Assessoria 3.0",
  reactiveShareOutsideP6: null,
  sipsKey: "",
};

export function emptyOpp(cups: string): Opportunity {
  return { cups, marked: false, status: "nueva", owner: "", notes: [], calls: [], proposals: [], updatedAt: new Date().toISOString() };
}

/** Oferta de referencia: ATR regulado 2026 sin margen (solo término de potencia). */
export function regulatedReferenceOffer(t: TariffCode, set: RegulatedSet): Offer {
  return {
    id: `ref-${t}`,
    comercializadora: "Referencia regulada",
    nombre: `ATR ${t} (peajes + cargos)`,
    tarifa: t,
    energia: Array(6).fill(0),
    potencia: [...regulatedPowerPrice(set, t)],
    sas: { applies: false, eurPerKWh: null, note: "" },
    servicios: [],
    alquilerEurMes: 0,
    ieePct: 0,
    ivaPct: 0,
    validFrom: set.validFrom,
    validTo: set.validTo,
    condiciones: "Solo referencia regulada",
    origen: set.sources.map((s) => s.ref).join(" · "),
  };
}

export const useStore = create<State>()(
  persist(
    (setState) => ({
      hydrated: false,
      supplies: [],
      reports: [],
      offers: [],
      crm: {},
      periodMax: {},
      invoices: {},
      settings: DEFAULT_SETTINGS,
      importRows: (rows, meta, mode) => {
        const { supplies, report } = parseRows(rows, meta);
        setState((st) => {
          if (mode === "replace") return { supplies, reports: [report, ...st.reports].slice(0, 20) };
          const map = new Map(st.supplies.filter((s) => !s.source.demo).map((s) => [s.cups, s]));
          for (const s of supplies) map.set(s.cups, s);
          return { supplies: [...map.values()], reports: [report, ...st.reports].slice(0, 20) };
        });
        return report;
      },
      loadDemo: () => {
        const { supplies, report } = parseRows(demoRows(42), { file: "DEMO · datos sintéticos", sheet: "Page1", demo: true });
        setState((st) => ({ supplies, reports: [report, ...st.reports].slice(0, 20) }));
        return report;
      },
      clearSupplies: () => setState({ supplies: [] }),
      upsertOffer: (o) => setState((st) => ({ offers: st.offers.some((x) => x.id === o.id) ? st.offers.map((x) => (x.id === o.id ? o : x)) : [...st.offers, o] })),
      deleteOffer: (id) => setState((st) => ({ offers: st.offers.filter((x) => x.id !== id) })),
      updateOpp: (cups, fn) =>
        setState((st) => ({ crm: { ...st.crm, [cups]: { ...fn(st.crm[cups] ?? emptyOpp(cups)), updatedAt: new Date().toISOString() } } })),
      setPeriodMax: (cups, t) =>
        setState((st) => {
          const n = { ...st.periodMax };
          if (t) n[cups] = t;
          else delete n[cups];
          return { periodMax: n };
        }),
      setInvoice: (cups, d) =>
        setState((st) => {
          const n = { ...st.invoices };
          if (d) n[cups] = d;
          else delete n[cups];
          return { invoices: n };
        }),
      setSettings: (fn) => setState((st) => ({ settings: fn(st.settings) })),
    }),
    {
      name: "assessoria30-energy-v1",
      storage: createJSONStorage(() => idb),
      partialize: ({ hydrated: _h, ...rest }) => {
        void _h;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function"));
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
      },
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

export function useSupply(cups: string | undefined) {
  return useStore((s) => (cups ? s.supplies.find((x) => x.cups === cups) : undefined));
}
