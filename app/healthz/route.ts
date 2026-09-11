import { getHealth } from "@/lib/services/system";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const health = await getHealth();
  return Response.json(health, {
    status: health.database.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
