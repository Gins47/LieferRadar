const shipmentId = "SHP-002";

function backendUrl(path: string): URL {
  const configured = process.env.LIEFERRADAR_API_URL ?? "http://127.0.0.1:3000";
  const base = new URL(configured);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    throw new Error("invalid LieferRadar API URL");
  }
  return new URL(path, base);
}

export function isDemoShipment(id: string) {
  return id === shipmentId;
}

export async function proxyDemo(path: string, init?: RequestInit): Promise<Response> {
  try {
    const upstream = await fetch(backendUrl(path), { ...init, cache: "no-store" });
    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") ?? "application/json");
    return new Response(await upstream.text(), { status: upstream.status, headers });
  } catch {
    return Response.json({ message: "The LieferRadar API is unavailable." }, { status: 502 });
  }
}
