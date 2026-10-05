import { isDemoShipment, proxyDemo } from "@/lib/demo-api";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isDemoShipment(id)) {
    return Response.json({ message: "Demo shipment not found." }, { status: 404 });
  }
  return proxyDemo(`/demo/shipments/${id}`);
}
