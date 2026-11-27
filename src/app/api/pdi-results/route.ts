import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import type { RoomState } from "@/lib/supabase/rooms";
import { buildResults, signResults, type ItemRef } from "@/lib/pdi-results";

/**
 * "Send results to DI Decision" (dbqm45/pdi docs/plan-wyniki-sprintdecka.md): the host's own token reads the room,
 * the results of the items that came from pdi are signed here, and the answer is the link back to pdi. Nothing from
 * the browser is signed: only the slug comes from it. Never logs the token.
 */
export async function POST(request: Request) {
  await connection();
  const secret = process.env.PDI_SPRINTDECK_SECRET?.trim();
  const pdi = process.env.NEXT_PUBLIC_PDI_URL?.trim().replace(/\/+$/, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secret || !pdi || !url || !key) return Response.json({ error: "off" }, { status: 404 });
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer [\w.-]+$/.test(auth)) return Response.json({ error: "sign_in" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { slug?: unknown };
  const slug = typeof body.slug === "string" && /^[0-9A-Za-z]{12}$/.test(body.slug) ? body.slug : null;
  if (!slug) return Response.json({ error: "room_not_found" }, { status: 400 });

  const client = createClient<Database>(url, key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const [room, refs] = await Promise.all([client.rpc("get_room_state", { p_slug: slug }), client.rpc("get_item_refs", { p_slug: slug })]);
  if (room.error || refs.error) return Response.json({ error: "room_not_found" }, { status: 404 });
  const state = room.data as unknown as RoomState;
  if (state.me.role !== "host") return Response.json({ error: "not_host" }, { status: 403 });
  const linked = refs.data as unknown as ItemRef[];
  if (linked.length === 0) return Response.json({ error: "no_linked_items" }, { status: 409 });

  const origin = process.env.SPRINTDECK_PUBLIC_URL?.trim().replace(/\/+$/, "") || new URL(request.url).origin;
  const results = buildResults(state, linked, { roomUrl: `${origin}/r/${slug}`, now: Math.floor(Date.now() / 1000) });
  const { d, s } = signResults(secret, results);
  return Response.json({ url: `${pdi}/discuss/results?${new URLSearchParams({ d, s })}` }, { headers: { "cache-control": "no-store" } });
}
