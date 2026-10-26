import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIBONACCI_DECK } from "./deck";

// The database validates votes against its own copy of the deck (private.deck_cards).
describe("deck in SQL", () => {
  it("matches src/lib/deck.ts", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const sql = readdirSync(dir)
      .sort()
      .map((file) => readFileSync(join(dir, file), "utf8"))
      .join("\n");
    const match = /when 'fibonacci' then array\[([^\]]+)\]/.exec(sql);
    expect(match).not.toBeNull();
    const sqlCards = [...match![1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(sqlCards).toEqual(FIBONACCI_DECK.cards.map((card) => card.value));
  });
});
