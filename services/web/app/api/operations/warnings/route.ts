import { proxyOperations } from "@/lib/operations-api";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const page = query.get("page") ?? "1";
  const limit = query.get("limit") ?? "20";
  return proxyOperations(`/operations/warnings?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`);
}
