"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow, Panel, PanelSection } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { Wordmark } from "@/components/ui/wordmark";
import type { RoomPreview } from "@/lib/supabase/rooms";
import { en } from "@/messages/en";
import { Avatar } from "./avatar";
import { rememberedName } from "./use-room";

const t = en.room.join;

type JoinRole = "voter" | "observer";

export function JoinScreen({
  preview,
  error,
  pending,
  onJoin,
}: {
  preview: RoomPreview;
  error: string | null;
  pending: boolean;
  onJoin: (name: string, role: JoinRole) => Promise<boolean>;
}) {
  const [name, setName] = useState(rememberedName);
  const [role, setRole] = useState<JoinRole>("voter");
  const names = preview.participants.map((p) => p.display_name);
  const current = preview.current_item;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onJoin(name, role);
  };

  return (
    <main className="flex min-h-full flex-1 flex-col px-4 sm:px-6">
      <nav className="flex h-16 items-center justify-between">
        <Link href="/">
          <Wordmark />
        </Link>
        <span className="text-label font-normal text-ink-muted">{t.noAccount}</span>
      </nav>
      <div className="grid flex-1 place-items-center py-6">
        <Panel className="w-full max-w-[440px]">
          <PanelSection className="px-8 pt-8 pb-6">
            <Eyebrow className="text-label font-normal">{t.invitedTo}</Eyebrow>
            <h1 className="m-0 mt-1 text-[24px] leading-[30px] font-semibold tracking-[-0.01em]">{preview.title}</h1>
            <div className="mt-4 flex items-center gap-3">
              {names.length > 0 && (
                <div className="flex">
                  {names.slice(0, 3).map((n, i) => (
                    <Avatar key={`${n}-${i}`} name={n} className="-ml-2 border-2 border-surface first:ml-0" />
                  ))}
                  {preview.participant_count > 3 && (
                    <Avatar label={`+${preview.participant_count - 3}`} className="-ml-2 border-2 border-surface" />
                  )}
                </div>
              )}
              <span className="text-label font-normal text-ink-muted">{t.here(names, preview.participant_count)}</span>
            </div>
            {current && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2.5 text-label font-normal">
                {current.round_status && (
                  <Badge tone={current.round_status === "voting" ? "positive" : "muted"} size="sm">
                    {current.round_status === "voting" ? t.voting : t.revealed}
                  </Badge>
                )}
                <span className="min-w-0 truncate">{t.current(current.title, current.position, current.item_count)}</span>
              </div>
            )}
          </PanelSection>
          <PanelSection className="px-8 pt-6 pb-8">
            <form onSubmit={submit} className="flex flex-col gap-5">
              <TextField
                label={t.yourName}
                hint={t.nameHint}
                error={error ?? undefined}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={32}
                autoFocus
                required
                autoComplete="nickname"
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-label">{t.joinAs}</span>
                <SegmentedControl
                  label={t.joinAs}
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: "voter", label: t.voter },
                    { value: "observer", label: t.observer },
                  ]}
                />
                <p className="m-0 text-caption text-ink-muted">{t.observerHint}</p>
              </div>
              <Button type="submit" variant="accent" block disabled={pending || !name.trim()}>
                {pending ? t.joining : t.submit}
              </Button>
            </form>
          </PanelSection>
        </Panel>
      </div>
      <p className="m-0 pb-6 text-center text-caption text-ink-muted">{t.retention}</p>
    </main>
  );
}
