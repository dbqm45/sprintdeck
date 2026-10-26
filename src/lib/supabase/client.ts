import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type SprintdeckClient = SupabaseClient<Database>;

let browserClient: SprintdeckClient | undefined;

/**
 * Browser client. The anonymous session is kept in localStorage, so a refresh
 * keeps the same `auth.uid()` and `join_room` returns the same participant.
 */
export function getBrowserClient(): SprintdeckClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)");
    }
    browserClient = createClient<Database>(url, key);
  }
  return browserClient;
}

/** Signs in anonymously unless this browser already has a session. */
export async function ensureSession(client: SprintdeckClient): Promise<void> {
  const { data } = await client.auth.getSession();
  if (data.session) return;
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
}
