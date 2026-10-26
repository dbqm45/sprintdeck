import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECKS } from "./deck";

// The database validates votes against its own copy of the decks (private.deck_cards).
// Later migrations redefine the function, so the last definition of each deck wins.
function sqlDecks(): Map<string, string[]> {
  const dir = join(process.cwd(), "supabase/migrations");
  const sql = readdirSync(dir)
    .sort()
    .map((file) => readFileSync(join(dir, file), "utf8"))
    .join("\n");
  const decks = new Map<string, string[]>();
  for (const match of sql.matchAll(/when '([a-z_]+)' then array\[([^\]]+)\]/g)) {
    decks.set(match[1], [...match[2].matchAll(/'([^']*)'/g)].map((m) => m[1]));
  }
  return decks;
}

describe("decks in SQL", () => {
  const decks = sqlDecks();

  it("define the same decks as src/lib/deck.ts", () => {
    expect([...decks.keys()].sort()).toEqual(Object.keys(DECKS).sort());
  });

  it.each(Object.values(DECKS))("$id has the same cards", (deck) => {
    expect(decks.get(deck.id)).toEqual(deck.cards.map((card) => card.value));
  });
});
