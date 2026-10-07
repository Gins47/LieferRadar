import { proxyDemo } from "@/lib/demo-api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyDemo(`/demo/shipments/${encodeURIComponent(id)}/assessment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
