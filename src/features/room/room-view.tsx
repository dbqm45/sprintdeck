"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelSection } from "@/components/ui/panel";
import { Wordmark } from "@/components/ui/wordmark";
import type { RoomState } from "@/lib/supabase/rooms";
import { en } from "@/messages/en";
import { AgendaPanel } from "./agenda-panel";
import { isHost } from "./derive";
import { Stage } from "./stage";
import { SummaryView } from "./summary-view";
import { TeamPanel } from "./team-panel";
import type { useRoom } from "./use-room";

const t = en.room;

const HOST_SECRET_KEY = (slug: string) => `sprintdeck:host-secret:${slug}`;

/** Stored by the create form so the room can show the host link once. */
export function stashHostSecret(slug: string, secret: string) {
  try {
    sessionStorage.setItem(HOST_SECRET_KEY(slug), secret);
  } catch {
    // storage unavailable: the host simply doesn't get the reminder
  }
}

function readHostSecret(slug: string): string | null {
  try {
    return sessionStorage.getItem(HOST_SECRET_KEY(slug));
  } catch {
    return null;
  }
}

function roomUrl(slug: string) {
  return `${window.location.origin}/r/${slug}`;
}

export function RoomView({
  slug,
  state,
  room,
}: {
  slug: string;
  state: RoomState;
  room: ReturnType<typeof useRoom>;
}) {
  const { actions, error, pending, online } = room;
  const [showSummary, setShowSummary] = useState(false);
  const [hostSecret, setHostSecret] = useState(() => readHostSecret(slug));
  const [copied, setCopied] = useState(false);
  const closed = state.room.status === "closed";

  const copyInvite = async () => {
    await navigator.clipboard.writeText(roomUrl(slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dismissHostSecret = () => {
    try {
      sessionStorage.removeItem(HOST_SECRET_KEY(slug));
    } catch {
      // nothing stored
    }
    setHostSecret(null);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <nav className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden min-w-0 truncate text-label font-normal text-ink-muted sm:block">
            {state.room.title}
          </span>
          {!closed && (
            <Button variant="ghost" onClick={() => setShowSummary((value) => !value)}>
              {showSummary ? t.nav.backToRoom : t.nav.summary}
            </Button>
          )}
          <Button variant="outline" onClick={() => void copyInvite()} aria-live="polite">
            {copied ? t.nav.copied : t.nav.invite}
          </Button>
        </div>
      </nav>

      {hostSecret && isHost(state) && (
        <Panel className="mb-6">
          <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-heading">{t.hostLink.title}</div>
              <p className="m-0 mt-0.5 text-caption text-ink-muted">{t.hostLink.body}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(`${roomUrl(slug)}#host=${hostSecret}`)}
              >
                {t.hostLink.copy}
              </Button>
              <Button variant="ghost" onClick={dismissHostSecret}>
                {t.hostLink.dismiss}
              </Button>
            </div>
          </PanelSection>
        </Panel>
      )}

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-3 rounded-md bg-negative-tint px-4 py-3 text-label font-normal text-negative"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={actions.dismissError} aria-label="Dismiss">
            ×
          </Button>
        </div>
      )}

      {closed || showSummary ? (
        <SummaryView state={state} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Stage state={state} actions={actions} pending={pending} />
          <div className="flex flex-col gap-6">
            <TeamPanel state={state} online={online} actions={actions} />
            <AgendaPanel state={state} actions={actions} pending={pending} />
          </div>
        </div>
      )}
    </main>
  );
}
