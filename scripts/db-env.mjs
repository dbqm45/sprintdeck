// Writes .env.local with the URL and publishable key of the local Supabase stack
// (`npm run db:start` first). Used by developers and by the e2e job in CI.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
);
if (!status.API_URL || !status.PUBLISHABLE_KEY) {
  console.error("Local Supabase is not running — start it with `npm run db:start`.");
  process.exit(1);
}
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}\n`,
);
console.log("Wrote .env.local for", status.API_URL);
