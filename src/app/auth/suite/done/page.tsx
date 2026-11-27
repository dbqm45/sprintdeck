"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { rememberName } from "@/features/room/use-room";
import { en } from "@/messages/en";

const t = en.suite;

/** The suite sign-in's last step: the session from the fragment goes into the Supabase client, then back. */
export default function SuiteDone() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Once per page load: React runs effects twice in development, and the second run would see the fragment gone.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, "", window.location.pathname);
    const refused = params.get("error");
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    const next = params.get("next") ?? "/";
    void Promise.resolve()
      .then(async () => {
        if (refused || !access || !refresh) {
          setError(t.refused[refused ?? "failed"] ?? t.refused.failed);
          return;
        }
        const { error: sessionError } = await getBrowserClient().auth.setSession({ access_token: access, refresh_token: refresh });
        if (sessionError) throw sessionError;
        const name = params.get("name");
        if (name) rememberName(name);
        router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
      })
      .catch(() => setError(t.refused.failed));
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center gap-4 px-4">
      <p role={error ? "alert" : "status"}>{error ?? t.signingIn}</p>
      {error ? (
        <a className="underline" href="/auth/suite/login">
          {t.signIn}
        </a>
      ) : null}
    </main>
  );
}
