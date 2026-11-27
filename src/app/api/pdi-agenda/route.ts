import { verifyAgenda } from "@/lib/pdi-agenda";

/** Checks an agenda link from DI Decision (pdi) with the shared secret; the page then opens the room. */
export async function POST(request: Request) {
  let body: { d?: unknown; s?: unknown };
  try {
    body = (await request.json()) as { d?: unknown; s?: unknown };
  } catch {
    return Response.json({ ok: false, reason: "malformed" }, { status: 400 });
  }
  const check = verifyAgenda(
    process.env.PDI_SPRINTDECK_SECRET?.trim() ?? "",
    typeof body.d === "string" ? body.d : "",
    typeof body.s === "string" ? body.s : "",
    Math.floor(Date.now() / 1000),
  );
  return Response.json(check, { status: check.ok ? 200 : check.reason === "off" ? 404 : 400, headers: { "cache-control": "no-store" } });
}
