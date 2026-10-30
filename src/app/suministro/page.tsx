"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Activity, ArrowLeft, Bell, Cpu, FileText, Store, Target, Waves } from "lucide-react";
import { useStore, useSupply } from "@/lib/store";
import { supplyAlerts } from "@/lib/alerts";
import { Empty, Tabs, TabsContent, TabsList, TabsTrigger, Button } from "@/components/ui";
import { SupplyHero, Overview } from "@/components/supply/overview";
import { PowerOptimizer } from "@/components/supply/optimizer";
import { ReactiveModule } from "@/components/supply/reactive";
import { MarketModule } from "@/components/supply/market";
import { OpportunityModule } from "@/components/supply/opportunity";
import { TechSheet } from "@/components/supply/tech-sheet";
import { AlertList } from "@/components/alert-list";

export default function SupplyPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
      <SupplyView />
    </Suspense>
  );
}

function SupplyView() {
  const id = (useSearchParams().get("cups") ?? "").trim();
  const s = useSupply(id);
  const hydrated = useStore((st) => st.hydrated);
  const cfg = useStore((st) => st.settings.alerts);
  const [tab, setTab] = useState("radiografia");

  if (!hydrated) return <div className="h-96 animate-pulse rounded-2xl bg-surface" />;
  if (!s)
    return (
      <Empty title="Suministro no encontrado">
        El CUPS {id} no está en la cartera importada.{" "}
        <Link href="/" className="text-accent underline">
          Volver al panel
        </Link>
      </Empty>
    );
  const alerts = supplyAlerts(s, cfg);
  const crit = alerts.filter((a) => a.severity === "critica" || a.severity === "alta").length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/radar">
          <ArrowLeft /> Radar comercial
        </Link>
      </Button>
      <SupplyHero s={s} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="sticky top-[72px] z-10">
          <TabsTrigger value="radiografia">
            <Activity /> Radiografía
          </TabsTrigger>
          <TabsTrigger value="optimizer">
            <Cpu /> Power Optimizer
          </TabsTrigger>
          <TabsTrigger value="reactiva">
            <Waves /> Reactiva
          </TabsTrigger>
          <TabsTrigger value="mercado">
            <Store /> Energy Market
          </TabsTrigger>
          <TabsTrigger value="alertas">
            <Bell /> Alertas {crit > 0 && <span className="num rounded-full bg-critical/15 px-1.5 text-[10px] text-critical">{crit}</span>}
          </TabsTrigger>
          <TabsTrigger value="oportunidad">
            <Target /> Oportunidad
          </TabsTrigger>
          <TabsTrigger value="ficha">
            <FileText /> Ficha técnica
          </TabsTrigger>
        </TabsList>
        <div className="mt-5">
          <TabsContent value="radiografia">
            <Overview s={s} />
          </TabsContent>
          <TabsContent value="optimizer">
            <PowerOptimizer key={s.cups} s={s} />
          </TabsContent>
          <TabsContent value="reactiva">
            <ReactiveModule key={s.cups} s={s} />
          </TabsContent>
          <TabsContent value="mercado">
            <MarketModule key={s.cups} s={s} />
          </TabsContent>
          <TabsContent value="alertas">
            <AlertList alerts={alerts} />
          </TabsContent>
          <TabsContent value="oportunidad">
            <OpportunityModule s={s} goTo={setTab} />
          </TabsContent>
          <TabsContent value="ficha">
            <TechSheet s={s} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
