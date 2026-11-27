import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyAgenda } from "./pdi-agenda";

const SECRET = "pdi-sprintdeck-test";
const NOW = 1_795_000_000;

function link(payload: unknown, secret = SECRET) {
  const d = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { d, s: createHmac("sha256", secret).update(d).digest("hex") };
}

const agenda = (extra: Record<string, unknown> = {}) => ({
  v: 1,
  title: "Discuss with team — 2026-11-26",
  exp: NOW + 600,
  items: [
    { title: "Prośba o bramkę B2 dla CHG-2", description: "CHG-2 · B2\nWhy now: the run is paused", ref: "evt-2" },
    { title: "Plan CHG-1" },
  ],
  ...extra,
});

describe("an agenda from DI Decision (pdi), signed with the shared secret", () => {
  it("gives the title and the items of a signed, fresh link", () => {
    const { d, s } = link(agenda());
    expect(verifyAgenda(SECRET, d, s, NOW)).toEqual({
      ok: true,
      title: "Discuss with team — 2026-11-26",
      items: [
        { title: "Prośba o bramkę B2 dla CHG-2", description: "CHG-2 · B2\nWhy now: the run is paused", ref: "evt-2" },
        { title: "Plan CHG-1", description: null, ref: null },
      ],
    });
  });

  it("refuses another signature, an expired link and a malformed agenda", () => {
    const { d } = link(agenda());
    expect(verifyAgenda(SECRET, d, link(agenda(), "other").s, NOW)).toEqual({ ok: false, reason: "signature" });
    const old = link(agenda({ exp: NOW - 1 }));
    expect(verifyAgenda(SECRET, old.d, old.s, NOW)).toEqual({ ok: false, reason: "expired" });
    const far = link(agenda({ exp: NOW + 2 * 3600 }));
    expect(verifyAgenda(SECRET, far.d, far.s, NOW)).toEqual({ ok: false, reason: "expired" });
    for (const bad of [agenda({ items: [] }), agenda({ v: 2 }), agenda({ title: "" }), agenda({ items: [{ title: "x".repeat(201) }] }),
      agenda({ items: Array.from({ length: 31 }, () => ({ title: "x" })) }), agenda({ items: [{ title: "x", ref: "evt 1" }] })]) {
      const l = link(bad);
      expect(verifyAgenda(SECRET, l.d, l.s, NOW)).toEqual({ ok: false, reason: "malformed" });
    }
    expect(verifyAgenda(SECRET, "%%%", "00", NOW)).toEqual({ ok: false, reason: "signature" });
    expect(verifyAgenda("", d, link(agenda()).s, NOW)).toEqual({ ok: false, reason: "off" });
  });
});
