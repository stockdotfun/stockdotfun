import { fetchRecentGraduations } from "@/lib/integrations/flap/graduations";

export const revalidate = 60;

/** Recent graduated Flap tokens (source of truth: Portal LaunchedToDEX logs). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "24"), 1), 50);
  const verify = url.searchParams.get("verify") === "true";
  try {
    const graduations = await fetchRecentGraduations(limit, verify);
    return Response.json({ graduations, count: graduations.length });
  } catch {
    return Response.json({ error: "failed to read graduations" }, { status: 502 });
  }
}
