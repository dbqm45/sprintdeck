"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { CreatedRoom } from "@/lib/supabase/rooms";
import type { AgendaCheck } from "@/lib/pdi-agenda";
import { errorMessage } from "@/features/room/errors";
import { stashHostSecret } from "@/features/room/room-view";
import { rememberedName } from "@/features/room/use-room";
import { en } from "@/messages/en";

const t = en.fromPdi;
const PENDING = "sd_pdi_agenda";
const OPENED = (s: string) => `sd_pdi_room_${s.slice(0, 16)}`;

/**
 * A room from the pdi agenda (dbqm45/pdi docs/plan-pokoj-sprintdeck.md). The agenda is in the fragment; it survives
 * the suite sign-in in sessionStorage. The same link opened twice in this browser goes back to the same room.
 */
export default function FromPdi() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "sign-in" | "error">("working");
  const [message, setMessage] = useState<string>(t.creating);

  // Once per page load: React runs effects twice in development, and the second run would see the fragment gone.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let fragment = window.location.hash.slice(1);
    try {
      if (fragment) sessionStorage.setItem(PENDING, fragment);
      else fragment = sessionStorage.getItem(PENDING) ?? "";
    } catch {
      // storage unavailable: the fragment still works without a sign-in round trip
    }
    window.history.replaceState(null, "", window.location.pathname);
    const params = new URLSearchParams(fragment);
    const d = params.get("d") ?? "";
    const s = params.get("s") ?? "";
    const fail = (text: string) => {
      setState("error");
      setMessage(text);
    };
    void (async () => {
      const client = getBrowserClient();
      const { data } = await client.auth.getUser();
      if (!data.user || data.user.is_anonymous || data.user.app_metadata?.provider !== "keycloak") {
        setState("sign-in");
        setMessage(t.signInFirst);
        return;
      }
      try {
        const opened = localStorage.getItem(OPENED(s));
        if (opened) {
          sessionStorage.removeItem(PENDING);
          router.replace(`/r/${opened}`);
          return;
        }
      } catch {
        // storage unavailable: a second visit opens another room
      }
      const res = await fetch("/api/pdi-agenda", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ d, s }) });
      const check = (await res.json().catch(() => ({ ok: false, reason: "malformed" }))) as AgendaCheck;
      if (!check.ok) return fail(t.refused[check.reason] ?? t.refused.malformed);
      const name = String(data.user.user_metadata?.name ?? rememberedName() ?? "Host").slice(0, 32) || "Host";
      const { data: created, error } = await client.rpc("create_room", { p_title: check.title, p_display_name: name, p_deck: "risk" });
      if (error) return fail(errorMessage(error));
      const room = created as unknown as CreatedRoom;
      for (const item of check.items) {
        const added = await client.rpc("add_item", { p_room_id: room.room_id, p_title: item.title, p_description: item.description ?? undefined });
        if (added.error) return fail(errorMessage(added.error));
        if (item.ref) {
          // The pdi item it came from: the room's results go back to it ("Send results to DI Decision").
          const marked = await client.rpc("set_item_ref", { p_item_id: added.data as unknown as string, p_ref: item.ref });
          if (marked.error) return fail(errorMessage(marked.error));
        }
      }
      stashHostSecret(room.slug, room.host_secret);
      try {
        localStorage.setItem(OPENED(s), room.slug);
        sessionStorage.removeItem(PENDING);
      } catch {
        // storage unavailable: nothing to remember
      }
      router.replace(`/r/${room.slug}`);
    })().catch((e: unknown) => fail(errorMessage(e)));
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center gap-4 px-4">
      <h1 className="m-0 text-xl font-semibold">{t.title}</h1>
      <p className="m-0">{t.lead}</p>
      <p role={state === "error" ? "alert" : "status"}>{message}</p>
      {state === "sign-in" ? (
        <a className="underline" href="/auth/suite/login?next=/from-pdi">
          {en.suite.signIn}
        </a>
      ) : null}
    </main>
  );
}
