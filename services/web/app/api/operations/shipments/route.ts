import { proxyOperations } from "@/lib/operations-api";

export const dynamic = "force-dynamic";

export function GET() {
  return proxyOperations("/operations/shipments");
}
