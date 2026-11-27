/**
 * An agenda from DI Decision (pdi, "Discuss with team"; dbqm45/pdi docs/plan-pokoj-sprintdeck.md): the link carries
 * the items in its fragment (`#d=<base64url JSON>&s=<hex HMAC-SHA256(PDI_SPRINTDECK_SECRET, d)>`), so no server logs
 * see them. Only this server knows the secret: the page posts `d` and `s` to `/api/pdi-agenda`, which checks them here.
 * Valid for at most an hour; the person who opens it (signed in through the suite) becomes the room's host.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_ITEMS = 30;
const MAX_AGE_SECONDS = 3600;

export interface AgendaItem {
  title: string;
  description: string | null;
  /** The pdi inbox item it came from, so the room's results can go back to it. */
  ref: string | null;
}

export type AgendaCheck =
  | { ok: true; title: string; items: AgendaItem[] }
  | { ok: false; reason: "off" | "signature" | "expired" | "malformed" };

const text = (v: unknown, max: number) => typeof v === "string" && v.trim() !== "" && v.length <= max;

export function verifyAgenda(secret: string, d: string, s: string, nowSeconds: number): AgendaCheck {
  if (!secret) return { ok: false, reason: "off" };
  if (!/^[A-Za-z0-9_-]{1,20000}$/.test(d) || !/^[0-9a-f]{64}$/.test(s)) return { ok: false, reason: "signature" };
  const expected = createHmac("sha256", secret).update(d).digest();
  if (!timingSafeEqual(expected, Buffer.from(s, "hex"))) return { ok: false, reason: "signature" };
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(Buffer.from(d, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof p.exp !== "number" || p.exp < nowSeconds || p.exp > nowSeconds + MAX_AGE_SECONDS) return { ok: false, reason: "expired" };
  if (p.v !== 1 || !text(p.title, 120) || !Array.isArray(p.items) || p.items.length === 0 || p.items.length > MAX_ITEMS) {
    return { ok: false, reason: "malformed" };
  }
  const items: AgendaItem[] = [];
  for (const raw of p.items as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object" || !text(raw.title, 200)) return { ok: false, reason: "malformed" };
    if (raw.description !== undefined && raw.description !== null && !text(raw.description, 2000)) return { ok: false, reason: "malformed" };
    if (raw.ref !== undefined && (typeof raw.ref !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(raw.ref))) return { ok: false, reason: "malformed" };
    items.push({
      title: (raw.title as string).trim(),
      description: typeof raw.description === "string" ? raw.description : null,
      ref: typeof raw.ref === "string" ? raw.ref : null,
    });
  }
  return { ok: true, title: (p.title as string).trim(), items };
}
