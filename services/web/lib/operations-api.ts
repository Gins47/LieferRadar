export type ReviewState =
  | "NEEDS_REVIEW"
  | "WARNING_NOT_YET_OBSERVED"
  | "NOT_EVALUATED"
  | "INCOMPLETE_EVIDENCE"
  | "EXCLUDED"
  | "SCENARIO_UNAVAILABLE";

export type ShipmentReadModel = {
  shipment: {
    id: string;
    pickupLocation: { city: string };
    destination: { city: string };
    plannedRoute: string[];
    status: string;
  };
  review: {
    state: ReviewState;
    reason: string;
    needsAttention: boolean;
  };
};

export type OperationsShipments = {
  totalShipments: number;
  needsAttentionCount: number;
  relevantLiveWarningCount: number;
  shipmentsRequiringAttention: ShipmentReadModel[];
  otherShipments: ShipmentReadModel[];
};

export type ProviderTimestamp =
  | { kind: "omitted" | "explicit-null" }
  | { kind: "value"; value: string };

export type LiveWarning = {
  id: string;
  road: string;
  title: string;
  descriptions: unknown[];
  direction: string | null;
  startTimestamp: ProviderTimestamp;
  lastLiveSeenAt: string | null;
  source: string;
  ingestionMode: "LIVE";
};

export type OperationsWarnings = {
  items: LiveWarning[];
  page: number;
  limit: number;
  total: number;
};

function backendUrl(path: string): URL {
  const configured = process.env.LIEFERRADAR_API_URL ?? "http://127.0.0.1:3000";
  const base = new URL(configured);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error("invalid LieferRadar API URL");
  }
  return new URL(path, base);
}

export async function proxyOperations(path: string): Promise<Response> {
  try {
    const upstream = await fetch(backendUrl(path), { cache: "no-store" });
    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") ?? "application/json");
    return new Response(await upstream.text(), { status: upstream.status, headers });
  } catch {
    return Response.json({ message: "The LieferRadar API is unavailable." }, { status: 502 });
  }
}
