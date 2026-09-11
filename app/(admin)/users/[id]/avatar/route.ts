import { getAdminSession } from "@/lib/auth/session";
import { getUserImage } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/** Proxies the user's primary image so the browser never needs the API key. */
export async function GET(request: Request, ctx: RouteContext<"/users/[id]/avatar">): Promise<Response> {
  if (!(await getAdminSession())) return new Response("unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const tag = new URL(request.url).searchParams.get("tag") ?? undefined;
  const upstream = await getUserImage(id, tag);
  if (!upstream) return new Response(null, { status: 404 });
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "private, max-age=300",
    },
  });
}
