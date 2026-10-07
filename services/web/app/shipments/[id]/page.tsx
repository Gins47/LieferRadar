"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TopNavigation } from "@/components/top-navigation";

type Check = { id: string; state: string; distanceMetres?: number | null; toleranceMetres?: number | null };
type Evidence = {
  checks: { geographic: Check; direction: Check; routePosition: Check; timing: Check };
  limitations: { id: string; description: string }[];
  excluded: boolean;
  exclusionReasons: string[];
};

type ProviderTimestamp =
  | { kind: "omitted" | "explicit-null" }
  | { kind: "value"; value: string };

type ReviewWarning = {
  evidenceId: string;
  source: string;
  providerId: string;
  ingestionMode: "LIVE" | "REPLAY";
  capturedAt: string;
  queriedRoad: string;
  title: string;
  subtitle?: string;
  descriptions: string[];
  startTimestamp: ProviderTimestamp;
  endTimestamp: ProviderTimestamp;
  delayMinutes?: number;
};

type AssessmentEvidence = {
  disruption: {
    evidenceId: string;
    source: string;
    providerId: string;
    ingestionMode: "LIVE" | "REPLAY";
    capturedAt: string;
    queriedRoad: string;
    title: string;
    subtitle: string | null;
    descriptions: string[];
    startTimestamp: ProviderTimestamp;
    endTimestamp: ProviderTimestamp;
    delayMinutes: number | null;
  };
  checks: Evidence["checks"];
  limitations: Evidence["limitations"];
};

type OperationsShipmentDetail = {
  shipment: {
    id: string;
    supplier: { name: string; location: { city: string; countryCode: string } };
    product: { name: string; sku: string };
    quantity: number;
    pickupLocation: { city: string; countryCode: string };
    destination: { city: string; countryCode: string };
    plannedRoute: string[];
    status: string;
    pickupAt: string;
    plannedDeliveryAt: string;
  };
  vehicle?: { vehicleId: string; simulatedAt: string; revision: number };
  review: { state: string; reason: string; needsAttention: boolean };
  evidence?: Evidence;
  reviewWarning?: ReviewWarning;
  aiAssessmentAvailable: boolean;
};

type Assessment = {
  assessmentId: string;
  operatorMessage: string;
  supportingEvidence: { factIds: string[]; explanation: string }[];
  missingEvidence: string[];
  uncertainty: string[];
  possibleConsequences: string[];
  recommendedActions: { action: string; rationale: string; requiresHumanReview: true }[];
};

type AssessmentResponse =
  | { outcome: "ASSESSED"; evidence: AssessmentEvidence; assessment: Assessment }
  | { outcome: "EXCLUDED"; evidence: AssessmentEvidence; exclusionReasons: string[] };

type ErrorResponse = { message?: string; evidence?: AssessmentEvidence; assessmentUnavailable?: boolean };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function reviewLabel(state: string) {
  if (state === "NEEDS_REVIEW") return "Needs review";
  if (state === "NOT_EVALUATED") return "Not evaluated";
  return "No review needed";
}

function timestampValue(timestamp: ProviderTimestamp): string | null {
  return timestamp.kind === "value" ? timestamp.value : null;
}

function providerDescriptions(descriptions: string[]): string[] {
  return descriptions
    .map((description) => description.trim())
    .filter(Boolean)
    .map((description) => description.replace(/^-+\s*/, ""));
}

function messageFrom(response: ErrorResponse, fallback: string) {
  return response.message ?? fallback;
}

function StringList({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm leading-6 text-slate-700">
      {values.map((value, index) => <li key={`${value}-${index}`}>• {value}</li>)}
    </ul>
  );
}

export default function ShipmentPage() {
  const params = useParams<{ id: string }>();
  const shipmentId = params.id;
  const [detail, setDetail] = useState<OperationsShipmentDetail | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [assessmentUnavailable, setAssessmentUnavailable] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshDetail = useCallback(async () => {
    const response = await fetch(`/api/operations/shipments/${encodeURIComponent(shipmentId)}`, { cache: "no-store" });
    const body = (await response.json()) as OperationsShipmentDetail | ErrorResponse;
    if (!response.ok) {
      if (response.status === 404) setNotFound(true);
      throw new Error(messageFrom(body as ErrorResponse, "Unable to load shipment detail."));
    }
    setDetail(body as OperationsShipmentDetail);
  }, [shipmentId]);

  useEffect(() => {
    setDetail(null);
    setAssessment(null);
    setAssessmentUnavailable(false);
    setNotFound(false);
    setError(null);
    refreshDetail().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load shipment detail.");
    });
  }, [refreshDetail]);

  async function analyze() {
    if (!detail?.vehicle || !detail.aiAssessmentAvailable) return;
    setBusy(true);
    setError(null);
    setAssessmentUnavailable(false);
    setAssessment(null);
    try {
      const response = await fetch(`/api/demo/shipments/${encodeURIComponent(shipmentId)}/assessment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: detail.vehicle.revision }),
      });
      const body = (await response.json()) as AssessmentResponse | ErrorResponse;
      if (!response.ok) {
        const failed = body as ErrorResponse;
        setAssessmentUnavailable(Boolean(failed.assessmentUnavailable));
        throw new Error(messageFrom(failed, "The assessment is unavailable."));
      }
      setAssessment(body as AssessmentResponse);
    } catch (assessmentError) {
      setError(assessmentError instanceof Error ? assessmentError.message : "The assessment is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  const needsReview = detail?.review.state === "NEEDS_REVIEW";
  const warningStart = detail?.reviewWarning
    ? timestampValue(detail.reviewWarning.startTimestamp)
    : null;
  const warningDescriptions = detail?.reviewWarning
    ? providerDescriptions(detail.reviewWarning.descriptions)
    : [];

  return (
    <><TopNavigation /><main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">LieferRadar</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Shipment review</h1>
     
          </div>
          <Badge variant="secondary" className="w-fit bg-sky-100 text-sky-800">Operator view</Badge>
        </header>

        {error && (
          <Alert className={notFound ? "border-slate-300 bg-slate-100" : "border-amber-300 bg-amber-50"}>
            <AlertTitle>{notFound ? "Shipment not found" : assessmentUnavailable ? "AI assessment unavailable" : "Shipment detail unavailable"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!detail && !error && <p className="text-sm text-slate-600">Loading shipment detail…</p>}

        {detail && <>
          <section className={detail.vehicle ? "grid gap-6 lg:grid-cols-2 lg:items-stretch" : "grid gap-6"}>
            <Card className={detail.vehicle ? "lg:h-full" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{detail.shipment.id}: {detail.shipment.pickupLocation.city} → {detail.shipment.destination.city}</CardTitle>
                    <CardDescription>{detail.shipment.supplier.name} · {detail.shipment.product.name} ({detail.shipment.product.sku})</CardDescription>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800">{detail.shipment.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-slate-500">Pickup</p><p className="font-medium">{formatDate(detail.shipment.pickupAt)} UTC</p></div>
                <div><p className="text-slate-500">Planned delivery</p><p className="font-medium">{formatDate(detail.shipment.plannedDeliveryAt)} UTC</p></div>
                <div className="sm:col-span-2"><p className="text-slate-500">Planned route</p><p className="font-medium">{detail.shipment.plannedRoute.join(", ") || "Not supplied"}</p></div>
              </CardContent>
            </Card>

            {detail.vehicle && <Card className="lg:h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle>{detail.vehicle.vehicleId}</CardTitle><CardDescription>Fictional, simulated vehicle state</CardDescription></div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-900">Simulated</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-slate-500">Simulated time</p><p className="font-medium">{formatDate(detail.vehicle.simulatedAt)} UTC</p></div>
                <p className="text-xs text-slate-500 sm:col-span-2">Revision {detail.vehicle.revision} · Vehicle position is fictional demonstration data.</p>
              </CardContent>
            </Card>}
          </section>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle>{needsReview ? "Potential disruption" : "No current disruption requiring review"}</CardTitle><CardDescription>{detail.review.reason}</CardDescription></div>
                <Badge className={detail.review.needsAttention ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}>{reviewLabel(detail.review.state)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 text-sm text-slate-700">
              {needsReview && detail.reviewWarning && <>
                <div>
                  <p className="font-semibold text-slate-900">{detail.reviewWarning.title}</p>
                  <p className="mt-1 text-slate-600">{detail.reviewWarning.queriedRoad}{detail.reviewWarning.subtitle ? ` · ${detail.reviewWarning.subtitle}` : ""}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div><p className="text-slate-500">Warning observed</p><p className="font-medium">{formatDate(detail.reviewWarning.capturedAt)} UTC</p></div>
                  {warningStart && <div><p className="text-slate-500">Warning started</p><p className="font-medium">{formatDate(warningStart)} UTC</p></div>}
                  {detail.reviewWarning.delayMinutes !== undefined && <div><p className="text-slate-500">Provider-reported travel-time loss</p><p className="font-medium">{detail.reviewWarning.delayMinutes} minutes</p></div>}
                </div>
                {warningDescriptions.length > 0 && <section><p className="text-slate-500">Reported traffic information</p><div className="mt-1"><StringList values={warningDescriptions} empty="No provider traffic information was supplied." /></div></section>}
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">Historical replay</Badge>
              </>}
              {detail.aiAssessmentAvailable && detail.vehicle && <div className="flex justify-end border-t border-slate-200 pt-4"><Button onClick={analyze} disabled={busy}>{busy ? "Analyzing…" : "Analyze with AI"}</Button></div>}
            </CardContent>
          </Card>

          {assessment?.outcome === "EXCLUDED" && <Alert className="border-slate-300 bg-slate-100"><AlertTitle>Assessment excluded</AlertTitle><AlertDescription>Python was not called because: {assessment.exclusionReasons.join(", ")}.</AlertDescription></Alert>}

          {assessment?.outcome === "ASSESSED" && <Card>
            <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Potential disruption — needs review</CardTitle><CardDescription>AI explanation over NestJS-provided evidence.</CardDescription></div><Badge className="bg-sky-100 text-sky-800">Human review required</Badge></div></CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm leading-7 text-slate-800">{assessment.assessment.operatorMessage}</p>
              <section><h3 className="text-sm font-semibold">Uncertainty</h3><div className="mt-2"><StringList values={assessment.assessment.uncertainty} empty="No additional uncertainty reported." /></div></section>
              <section><h3 className="text-sm font-semibold">Recommended human-review actions</h3><div className="mt-2 space-y-2">{assessment.assessment.recommendedActions.map((action) => <div key={action.action} className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 p-3"><Badge variant="secondary" className="bg-sky-100 text-sky-800">{action.action}</Badge><p className="flex-1 text-sm leading-6 text-slate-700">{action.rationale}</p></div>)}</div></section>
              <Alert className="border-sky-300 bg-sky-50"><AlertTitle>Human review required</AlertTitle><AlertDescription>AI provides an explanation and recommendations only. It does not change the shipment or execute an operational action.</AlertDescription></Alert>
              <details className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-medium">Evidence &amp; limitations</summary><div className="mt-4 grid gap-5 text-sm"><section><h3 className="font-semibold">Supporting evidence</h3><div className="mt-2"><StringList values={assessment.assessment.supportingEvidence.map((item) => item.explanation)} empty="No supporting evidence returned." /></div></section><section><h3 className="font-semibold">Missing evidence</h3><div className="mt-2"><StringList values={assessment.assessment.missingEvidence} empty="No missing evidence reported." /></div></section><section><h3 className="font-semibold">Possible consequences</h3><div className="mt-2"><StringList values={assessment.assessment.possibleConsequences} empty="No possible consequences reported." /></div></section><p className="text-xs text-slate-500">Assessment ID: {assessment.assessment.assessmentId}</p></div></details>
            </CardContent>
          </Card>}
        </>}
      </div>
    </main></>
  );
}
