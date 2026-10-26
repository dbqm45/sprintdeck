"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { DECKS, type DeckId } from "@/lib/deck";
import { ensureSession, getBrowserClient } from "@/lib/supabase/client";
import type { CreatedRoom } from "@/lib/supabase/rooms";
import { en } from "@/messages/en";
import { errorMessage } from "./errors";
import { stashHostSecret } from "./room-view";
import { rememberName, rememberedName } from "./use-room";

const t = en.landing.start;

const DECK_OPTIONS = (Object.keys(DECKS) as DeckId[]).map((id) => ({ value: id, label: DECKS[id].name }));

/** A room slug from a pasted link (…/r/<slug>) or the bare 12-character code. */
export function slugFromLink(input: string): string | null {
  const match = /(?:^|\/r\/)([0-9A-Za-z]{12})(?:[/?#].*)?$/.exec(input.trim());
  return match ? match[1] : null;
}

export function CreateRoomForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [name, setName] = useState(rememberedName);
  const [deck, setDeck] = useState<DeckId>("fibonacci");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const client = getBrowserClient();
      await ensureSession(client);
      const { data, error: rpcError } = await client.rpc("create_room", {
        p_title: title,
        p_display_name: name,
        p_deck: deck,
      });
      if (rpcError) throw rpcError;
      const room = data as unknown as CreatedRoom;
      rememberName(name);
      stashHostSecret(room.slug, room.host_secret);
      router.push(`/r/${room.slug}`);
    } catch (createError) {
      setError(createError instanceof Error && /NEXT_PUBLIC_SUPABASE/.test(createError.message)
        ? en.room.configError
        : errorMessage(createError));
      setPending(false);
    }
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    const slug = slugFromLink(link);
    if (!slug) {
      setLinkError(t.invalidLink);
      return;
    }
    router.push(`/r/${slug}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-title">{t.title}</h2>
        <p className="m-0 mt-1 text-body text-ink-muted">{t.body}</p>
      </div>
      <form onSubmit={(event) => void create(event)} className="flex flex-col gap-5">
        <TextField
          label={t.roomTitle}
          placeholder={t.roomTitlePlaceholder}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
        />
        <TextField
          label={t.yourName}
          hint={t.hostHint}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={32}
          required
          autoComplete="nickname"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-label">{t.deck}</span>
          <SegmentedControl label={t.deck} options={DECK_OPTIONS} value={deck} onChange={setDeck} />
          <p className="m-0 text-caption text-ink-muted">{en.simulator.deckHint[deck]}</p>
        </div>
        {error && (
          <p role="alert" className="m-0 text-caption text-negative">
            {error}
          </p>
        )}
        <Button type="submit" variant="accent" block disabled={pending || !title.trim() || !name.trim()}>
          {pending ? t.creating : t.create}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-caption text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        {t.or}
      </div>
      <form onSubmit={join} className="flex items-start gap-2">
        <div className="flex-1">
          <TextField
            label={t.join}
            hideLabel
            placeholder={t.linkPlaceholder}
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              setLinkError(null);
            }}
            error={linkError ?? undefined}
            mono
          />
        </div>
        <Button type="submit" variant="outline" size="lg" disabled={!link.trim()}>
          {t.join}
        </Button>
      </form>
    </div>
  );
}
