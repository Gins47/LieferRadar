"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TopNavigation } from "@/components/top-navigation";

const shipmentId = "SHP-002";

type ProviderTimestamp = { kind: "omitted" | "explicit-null" } | { kind: "value"; value: string };
type Check = { id: string; state: string; distanceMetres?: number | null; toleranceMetres?: number | null };
type Evidence = {
  checks: { geographic: Check; direction: Check; routePosition: Check; timing: Check };
  limitations: { id: string; description: string }[];
};

type Scenario = {
  shipment: {
    id: string;
    pickupLocation: { city: string };
    destination: { city: string };
    status: string;
    pickupAt: string;
    plannedDeliveryAt: string;
  };
  vehicle: {
    vehicleId: string;
    elapsedSeconds: number;
    position: [number, number];
    simulatedAt: string;
    revision: number;
  };
  route: { provenance: { attribution: string; profile: string } };
  warning: {
    queriedRoad: string;
    title: string;
    subtitle: string | null;
    descriptions: string[];
    startTimestamp: ProviderTimestamp;
    ingestionMode: "LIVE" | "REPLAY";
  };
  operatorReview: {
    state: string;
    reason: string;
    needsAttention: boolean;
    evidence: Evidence;
  };
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
  | { outcome: "ASSESSED"; evidence: Evidence; assessment: Assessment }
  | { outcome: "EXCLUDED"; evidence: Evidence; exclusionReasons: string[] };

type ErrorResponse = { message?: string; evidence?: Evidence; assessmentUnavailable?: boolean };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function timestampValue(timestamp: ProviderTimestamp) {
  return timestamp.kind === "value" ? formatDate(timestamp.value) : "No provider end time available";
}

function messageFrom(response: ErrorResponse, fallback: string) {
  return response.message ?? fallback;
}

function EvidenceChecks({ evidence }: { evidence: Evidence }) {
  const checks = [
    ["Geographic", evidence.checks.geographic],
    ["Direction", evidence.checks.direction],
    ["Route position", evidence.checks.routePosition],
    ["Timing", evidence.checks.timing],
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {checks.map(([label, check]) => (
        <div key={check.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{check.state}</p>
          {check.distanceMetres !== null && check.distanceMetres !== undefined && (
            <p className="mt-1 text-xs text-slate-600">
              {check.distanceMetres.toFixed(2)} m against {check.toleranceMetres} m tolerance
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function StringList({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm leading-6 text-slate-700">
      {values.map((value, index) => <li key={`${value}-${index}`}>• {value}</li>)}
    </ul>
  );
}

export default function DemoPage() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [errorEvidence, setErrorEvidence] = useState<Evidence | null>(null);
  const [assessmentUnavailable, setAssessmentUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"assessment" | null>(null);

  const refreshScenario = useCallback(async () => {
    const response = await fetch(`/api/demo/shipments/${shipmentId}`, { cache: "no-store" });
    const body = (await response.json()) as Scenario | ErrorResponse;
    if (!response.ok) throw new Error(messageFrom(body as ErrorResponse, "Unable to load the demo scenario."));
    setScenario(body as Scenario);
  }, []);

  useEffect(() => {
    refreshScenario().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the demo scenario.");
    });
  }, [refreshScenario]);

  async function analyze() {
    if (!scenario) return;
    setBusy("assessment");
    setError(null);
    setErrorEvidence(null);
    setAssessmentUnavailable(false);
    setAssessment(null);
    try {
      const response = await fetch(`/api/demo/shipments/${shipmentId}/assessment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: scenario.vehicle.revision }),
      });
      const body = (await response.json()) as AssessmentResponse | ErrorResponse;
      if (!response.ok) {
        const failed = body as ErrorResponse;
        setErrorEvidence(failed.evidence ?? null);
        setAssessmentUnavailable(Boolean(failed.assessmentUnavailable));
        throw new Error(messageFrom(failed, "The assessment is unavailable."));
      }
      setAssessment(body as AssessmentResponse);
    } catch (assessmentError) {
      setError(assessmentError instanceof Error ? assessmentError.message : "The assessment is unavailable.");
    } finally {
      setBusy(null);
    }
  }

  const displayedEvidence = assessment?.evidence ?? errorEvidence ?? scenario?.operatorReview.evidence;

  return (
    <><TopNavigation /><main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">LieferRadar</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Shipment review</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">SHP-002 with a fictional vehicle and recorded historical A1 warning.</p>
          </div>
          <Badge variant="secondary" className="w-fit bg-sky-100 text-sky-800">Local demonstration</Badge>
        </header>

        {error && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTitle>{assessmentUnavailable ? "AI assessment unavailable" : "Demo action could not be completed"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!scenario && !error && <p className="text-sm text-slate-600">Loading the prepared SHP-002 scenario…</p>}

        {scenario && <>
          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{scenario.shipment.id}: {scenario.shipment.pickupLocation.city} → {scenario.shipment.destination.city}</CardTitle>
                    <CardDescription>Saved A1 shipment scenario</CardDescription>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800">{scenario.shipment.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-slate-500">Pickup</p><p className="font-medium">{formatDate(scenario.shipment.pickupAt)} UTC</p></div>
                <div><p className="text-slate-500">Planned delivery</p><p className="font-medium">{formatDate(scenario.shipment.plannedDeliveryAt)} UTC</p></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle>{scenario.vehicle.vehicleId}</CardTitle><CardDescription>Fictional, simulated vehicle state</CardDescription></div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-900">Simulated</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-slate-500">Simulated time</p><p className="font-medium">{formatDate(scenario.vehicle.simulatedAt)} UTC</p></div>
                <p className="text-xs text-slate-500 sm:col-span-2">Revision {scenario.vehicle.revision} · Vehicle position is backend-owned fictional demonstration data.</p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader><CardTitle>Route visualization</CardTitle><CardDescription>Illustrative only; NestJS remains authoritative for route and disruption calculations.</CardDescription></CardHeader>
            <CardContent>
              <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-3 py-7 text-sm font-semibold text-slate-700">
                <span>Lübeck</span>
                <div className="relative h-1 rounded bg-slate-200">
                  <span className="absolute -top-3 left-1/2 text-xl" aria-label="Simulated vehicle">🚚</span>
                  <span className="absolute -bottom-7 left-[70%] text-sm" aria-label="Historical A1 warning">⚠</span>
                  <span className="absolute -bottom-12 left-[68%] text-xs font-normal text-slate-500">A1 warning</span>
                </div>
                <span>Hamburg</span>
              </div>
              <p className="mt-6 text-xs text-slate-500">Route attribution: {scenario.route.provenance.attribution} · profile: {scenario.route.provenance.profile}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3"><div><CardTitle>Historical disruption</CardTitle><CardDescription>{scenario.warning.title}</CardDescription></div><Badge variant="secondary" className="bg-amber-100 text-amber-900">Historical Replay · {scenario.warning.ingestionMode}</Badge></div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><span className="font-medium">Direction:</span> {scenario.warning.subtitle ?? "Not supplied"}</p>
              <p><span className="font-medium">Warning time:</span> {timestampValue(scenario.warning.startTimestamp)} UTC</p>
              <p className="leading-6 text-slate-700">{scenario.warning.descriptions.find((description) => description.trim()) ?? "No provider description supplied."}</p>
              <p className="text-xs text-slate-500">Recorded historical provider evidence, not current live traffic.</p>
            </CardContent>
          </Card>

          {displayedEvidence && <Card>
            <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Deterministic evidence</CardTitle><CardDescription>{scenario.operatorReview.reason}</CardDescription></div><Badge className="bg-amber-100 text-amber-900">{scenario.operatorReview.state.replaceAll("_", " ")}</Badge></div></CardHeader>
            <CardContent className="space-y-5"><EvidenceChecks evidence={displayedEvidence} /><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Prepared by NestJS; these are facts and limitations, not an AI conclusion.</p><Button onClick={analyze} disabled={busy !== null}>{busy === "assessment" ? "Analyzing…" : "Analyze with AI"}</Button></div></CardContent>
          </Card>}

          {assessment?.outcome === "EXCLUDED" && <Alert className="border-slate-300 bg-slate-100"><AlertTitle>Assessment excluded</AlertTitle><AlertDescription>Python was not called because: {assessment.exclusionReasons.join(", ")}.</AlertDescription></Alert>}

          {assessment?.outcome === "ASSESSED" && <Card>
            <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Potential disruption — needs review</CardTitle><CardDescription>AI explanation over NestJS-provided evidence.</CardDescription></div><Badge className="bg-sky-100 text-sky-800">Human review required</Badge></div></CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm leading-7 text-slate-800">{assessment.assessment.operatorMessage}</p>
              <section><h3 className="text-sm font-semibold">Uncertainty</h3><div className="mt-2"><StringList values={assessment.assessment.uncertainty} empty="No additional uncertainty reported." /></div></section>
              <section><h3 className="text-sm font-semibold">Recommended human-review actions</h3><div className="mt-2 space-y-2">{assessment.assessment.recommendedActions.map((action) => <div key={action.action} className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 p-3"><Badge variant="secondary" className="bg-sky-100 text-sky-800">{action.action}</Badge><p className="flex-1 text-sm leading-6 text-slate-700">{action.rationale}</p></div>)}</div></section>
              <Alert className="border-sky-300 bg-sky-50"><AlertTitle>Human review required</AlertTitle><AlertDescription>AI provides an explanation and recommendations only. It does not change the shipment or execute an operational action.</AlertDescription></Alert>
              <details className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-medium">Evidence &amp; limitations</summary><div className="mt-4 grid gap-5 text-sm"><section><h3 className="font-semibold">Supporting evidence</h3><div className="mt-2"><StringList values={assessment.assessment.supportingEvidence.map((item) => item.explanation)} empty="No supporting evidence returned." /></div></section><section><h3 className="font-semibold">Missing evidence</h3><div className="mt-2"><StringList values={assessment.assessment.missingEvidence} empty="No missing evidence reported." /></div></section><section><h3 className="font-semibold">Limitations</h3><div className="mt-2"><StringList values={assessment.evidence.limitations.map((item) => item.description)} empty="No limitations supplied." /></div></section><section><h3 className="font-semibold">Possible consequences</h3><div className="mt-2"><StringList values={assessment.assessment.possibleConsequences} empty="No possible consequences reported." /></div></section><p className="text-xs text-slate-500">Assessment ID: {assessment.assessment.assessmentId}</p></div></details>
            </CardContent>
          </Card>}
        </>}
      </div>
    </main></>
  );
}
