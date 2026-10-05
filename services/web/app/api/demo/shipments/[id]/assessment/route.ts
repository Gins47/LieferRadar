import { isDemoShipment, proxyDemo } from "@/lib/demo-api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isDemoShipment(id)) {
    return Response.json({ message: "Demo shipment not found." }, { status: 404 });
  }
  return proxyDemo(`/demo/shipments/${id}/assessment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
