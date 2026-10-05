"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveWarning, OperationsWarnings, ProviderTimestamp } from "@/lib/operations-api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value));
}

function timestamp(timestamp: ProviderTimestamp) {
  return timestamp.kind === "value" ? formatDate(timestamp.value) : "Not supplied";
}

function description(warning: LiveWarning) {
  return warning.descriptions.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "No provider description supplied.";
}

export function LiveWarnings() {
  const [data, setData] = useState<OperationsWarnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const response = await fetch(`/api/operations/warnings?page=${page}&limit=20`, { cache: "no-store" });
    const body = (await response.json()) as OperationsWarnings | { message?: string };
    if (!response.ok) throw new Error("message" in body ? body.message : "Unable to load LIVE warnings.");
    setData(body as OperationsWarnings);
  }, [page]);

  useEffect(() => {
    setData(null);
    load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load LIVE warnings."));
  }, [load]);

  if (error) return <Alert variant="destructive"><AlertTitle>LIVE warnings unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (!data) return <p className="text-sm text-slate-600">Loading LIVE warnings…</p>;
  const hasPrevious = data.page > 1;
  const hasNext = data.page * data.limit < data.total;
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-semibold tracking-tight">Live Warnings</h1><p className="mt-2 text-sm leading-6 text-slate-600">LIVE Autobahn warnings observed today on roads used by saved shipments. Observation time is freshness information, not a claim that a warning is currently active.</p></div>
      {!data.items.length ? <Card><CardContent className="py-6 text-sm text-slate-600">No LIVE Autobahn warnings were observed today on roads used by saved shipments.</CardContent></Card> : data.items.map((warning) => <Card key={warning.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{warning.road} · {warning.title}</CardTitle><CardDescription className="mt-2 text-base leading-6 text-slate-700">{description(warning)}</CardDescription></div><Badge className="bg-sky-100 text-sky-800">LIVE</Badge></div></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><p><span className="font-medium">Direction:</span> {warning.direction ?? "Not supplied"}</p><p><span className="font-medium">Warning time:</span> {timestamp(warning.startTimestamp)}</p><p><span className="font-medium">Last observed:</span> {warning.lastLiveSeenAt ? formatDate(warning.lastLiveSeenAt) : "Not supplied"}</p><p><span className="font-medium">Source:</span> {warning.source}</p></CardContent></Card>)}
      {(hasPrevious || hasNext) && <div className="flex items-center justify-between gap-3"><Button variant="outline" onClick={() => setPage((current) => current - 1)} disabled={!hasPrevious}>Previous</Button><p className="text-sm text-slate-600">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.limit))}</p><Button variant="outline" onClick={() => setPage((current) => current + 1)} disabled={!hasNext}>Next</Button></div>}
    </div>
  );
}
