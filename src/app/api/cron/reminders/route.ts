import { runReminderCron } from "@/lib/push/dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  if (secret) {
    const url = new URL(request.url);
    if (url.searchParams.get("secret") === secret) return true;
  }
  return request.headers.get("x-vercel-cron") === "1" && !secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runReminderCron();
  const status = result.reason === "no-admin" || result.reason === "no-vapid" ? 503 : 200;
  return Response.json(result, { status });
}
