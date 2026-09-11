import { clearSelfCookieHeader } from "@/lib/auth/session";
import { json, originAllowed } from "@/lib/public/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!originAllowed(request)) return json({ error: "Cross-site request refused." }, { status: 403 });
  return json({ ok: true }, { headers: { "set-cookie": clearSelfCookieHeader() } });
}
