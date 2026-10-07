import { proxyOperations } from "@/lib/operations-api";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyOperations(`/operations/shipments/${encodeURIComponent(id)}`);
}
