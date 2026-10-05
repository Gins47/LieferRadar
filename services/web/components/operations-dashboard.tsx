"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OperationsShipments, ShipmentReadModel } from "@/lib/operations-api";

function label(state: string) {
  return state.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
}

function ShipmentCard({ item, attention }: { item: ShipmentReadModel; attention: boolean }) {
  const shipment = item.shipment;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{shipment.id} · {shipment.pickupLocation.city} → {shipment.destination.city}</CardTitle>
            <CardDescription className="mt-1">{item.review.reason}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{shipment.status}</Badge>
            <Badge className={attention ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}>{label(item.review.state)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p>Planned road: {shipment.plannedRoute.join(", ") || "Not supplied"}</p>
        {shipment.id === "SHP-002" && (
          <Link href="/shipments/SHP-002" className="font-medium text-sky-700 hover:underline">
            Review shipment →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export function OperationsDashboard() {
  const [data, setData] = useState<OperationsShipments | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/operations/shipments", { cache: "no-store" });
    const body = (await response.json()) as OperationsShipments | { message?: string };
    if (!response.ok) throw new Error("message" in body ? body.message : "Unable to load operations.");
    setData(body as OperationsShipments);
  }, []);

  useEffect(() => {
    load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load operations.");
    });
  }, [load]);

  if (error) {
    return <Alert variant="destructive"><AlertTitle>Operations unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  }
  if (!data) return <p className="text-sm text-slate-600">Loading operations…</p>;

  const summary = [
    ["Shipments", data.totalShipments],
    ["Needs attention", data.needsAttentionCount],
    ["Relevant LIVE warnings", data.relevantLiveWarningCount],
  ];
  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        {summary.map(([label, value]) => <Card key={String(label)}><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-3xl">{value}</CardTitle></CardHeader></Card>)}
      </section>
      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold">Needs attention</h2><p className="mt-1 text-sm text-slate-600">Backend-identified shipments requiring operator review.</p></div>
        {data.shipmentsRequiringAttention.length ? data.shipmentsRequiringAttention.map((item) => <ShipmentCard key={item.shipment.id} item={item} attention />) : <Card><CardContent className="py-6 text-sm text-slate-600">No shipments currently require review based on available evidence.</CardContent></Card>}
      </section>
      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold">Other shipments</h2><p className="mt-1 text-sm text-slate-600">These states are not conclusions that a shipment is safe or unaffected.</p></div>
        {data.otherShipments.map((item) => <ShipmentCard key={item.shipment.id} item={item} attention={false} />)}
      </section>
    </div>
  );
}
