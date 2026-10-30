"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme, ThemeProvider } from "next-themes";
import { Command } from "cmdk";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Bell, Gauge, LayoutDashboard, Moon, Radar, Search, Settings, Store, Sun, Upload, Menu, X, FlaskConical } from "lucide-react";
import { Toaster } from "sonner";
import { useStore } from "@/lib/store";
import { supplyAlerts } from "@/lib/alerts";
import { cn, fmt } from "@/lib/format";
import { annualActive } from "@/lib/parse";
import { Badge, Dialog } from "./ui";
import { ImportPanel } from "./import-panel";

const NAV = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/radar", label: "Radar comercial", icon: Radar },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/mercado", label: "Energy Market", icon: Store },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-assessoria30.png" alt="Assessoria 3.0" width={40} height={40} className="size-10 shrink-0 rounded-full drop-shadow-[0_6px_16px_rgba(34,197,94,0.35)]" />
      {!compact && (
        <div className="leading-tight">
          <div className="text-[13px] font-bold tracking-[0.14em]">ASSESSORIA 3.0</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-fg-3">Energy Intelligence</div>
        </div>
      )}
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-fg-2 hover:text-fg"
      aria-label="Cambiar tema"
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  );
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const supplies = useStore((s) => s.supplies);
  const router = useRouter();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 min-w-0 flex-1 max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-fg-3 hover:border-border-strong">
        <Search className="size-4" />
        <span className="truncate">Buscar CUPS, dirección, localidad…</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] sm:inline">Ctrl K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="mx-auto mt-[12vh] w-[94vw] max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Command
              className="overflow-hidden rounded-2xl border border-border-strong bg-bg-elev shadow-2xl"
              filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase().replace(/\s/g, "")) || value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
            >
              <div className="flex items-center gap-2 border-b border-border px-4">
                <Search className="size-4 text-fg-3" />
                <Command.Input autoFocus placeholder="CUPS, dirección, localidad, comercializadora…" className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-fg-3" />
              </div>
              <Command.List className="max-h-[50vh] overflow-y-auto p-2">
                <Command.Empty className="p-6 text-center text-sm text-fg-3">{supplies.length ? "Sin resultados." : "Importa un Excel SIPS para empezar."}</Command.Empty>
                {supplies.slice(0, 2000).map((s) => (
                  <Command.Item
                    key={s.cups}
                    value={`${s.cups} ${s.direccion ?? ""} ${s.localidad ?? ""} ${s.provincia ?? ""} ${s.comercializadora ?? ""} ${s.cp ?? ""}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(`/suministro/?cups=${encodeURIComponent(s.cups)}`);
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm data-[selected=true]:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <div className="num truncate text-xs text-fg">{s.cups}</div>
                      <div className="truncate text-xs text-fg-3">
                        {s.direccion ?? "Sin dirección"} · {s.localidad ?? "—"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone="blue">{s.tarifa ?? s.tarifaRaw ?? "?"}</Badge>
                      <span className="num text-xs text-fg-2">{fmt.n((annualActive(s).value ?? 0) / 1000, 1)} MWh</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const supplies = useStore((s) => s.supplies);
  const cfg = useStore((s) => s.settings.alerts);
  const hydrated = useStore((s) => s.hydrated);
  const [importOpen, setImportOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const demo = supplies.some((s) => s.source.demo);
  const critical = useMemo(() => supplies.flatMap((s) => supplyAlerts(s, cfg)).filter((a) => a.severity === "critica" || a.severity === "alta").length, [supplies, cfg]);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setMobile(false)}
            className={cn("group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition", active ? "bg-surface-2 text-fg" : "text-fg-3 hover:bg-surface-2/60 hover:text-fg")}
          >
            {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />}
            <n.icon className="size-4" />
            {n.label}
            {n.href === "/alertas" && critical > 0 && <span className="num ml-auto rounded-full bg-critical/15 px-1.5 text-[10px] text-critical">{critical}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-bg-elev/80 p-4 backdrop-blur-xl lg:flex">
        <Logo />
        <div className="mt-8">{nav}</div>
        <div className="mt-auto space-y-3">
          <button onClick={() => setImportOpen(true)} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-sm text-fg-2 hover:border-accent hover:text-accent">
            <Upload className="size-4" /> Importar Excel SIPS
          </button>
          <div className="rounded-lg border border-border bg-surface/60 p-3 text-[11px] text-fg-3">
            <div className="flex items-center justify-between">
              <span>Suministros</span>
              <span className="num text-fg">{hydrated ? fmt.n(supplies.length) : "…"}</span>
            </div>
            {demo && (
              <div className="mt-1.5 flex items-center gap-1 text-warning">
                <FlaskConical className="size-3" /> Datos de demostración
              </div>
            )}
          </div>
        </div>
      </aside>

      {mobile && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobile(false)}>
          <div className="h-full w-64 border-r border-border bg-bg-elev p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setMobile(false)} aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-8">{nav}</div>
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg/70 px-4 backdrop-blur-xl sm:px-6">
          <button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <GlobalSearch />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {demo && (
              <Badge tone="warning" className="hidden sm:inline-flex">
                <FlaskConical /> Modo demo
              </Badge>
            )}
            <button onClick={() => setImportOpen(true)} className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-fg-2 hover:text-fg sm:flex">
              <Upload className="size-4" /> Importar
            </button>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
      <Dialog open={importOpen} onOpenChange={setImportOpen} title="Importar Excel SIPS" description="Exportación PuntoSuministro_*.xlsx del portal SIPS (hoja Page1, 97 columnas).">
        <ImportPanel onDone={() => setImportOpen(false)} />
      </Dialog>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <Shell>{children}</Shell>
    </ThemeProvider>
  );
}

export function PageTitle({ title, subtitle, right, icon }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && <div className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent [&_svg]:size-5">{icon}</div>}
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-fg-3">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export { Gauge };
