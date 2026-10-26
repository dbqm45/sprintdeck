"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureSession, getBrowserClient, type SprintdeckClient } from "@/lib/supabase/client";
import { roomChannel, type ParticipantRole, type RoomPreview, type RoomState } from "@/lib/supabase/rooms";
import { errorCode, errorMessage } from "./errors";

export type RoomPhase =
  | { kind: "loading" }
  | { kind: "config_error" }
  | { kind: "not_found" }
  | { kind: "join"; preview: RoomPreview }
  | { kind: "room"; state: RoomState };

const NAME_KEY = "sprintdeck:name";

/** The name used last time, to prefill join and create forms. */
export function rememberedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // storage unavailable (private mode): nothing to remember
  }
}

/** `#host=<secret>` in the room link hands the host role to whoever opens it. */
function hostSecretFromHash(): string | null {
  const match = /(?:^#|&)host=([\w-]+)/.exec(window.location.hash);
  return match ? match[1] : null;
}

function clearHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Everything a room screen needs: the snapshot from `get_room_state`, who is
 * online, and the actions. Every realtime event (and coming back to the tab)
 * triggers a fresh snapshot, so refresh, reconnect and missed events all take
 * the same path.
 */
export function useRoom(slug: string) {
  const [phase, setPhase] = useState<RoomPhase>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState<ReadonlySet<string>>(new Set());
  const clientRef = useRef<SprintdeckClient | null>(null);
  const hostSecretRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    const { data, error: stateError } = await client.rpc("get_room_state", { p_slug: slug });
    if (!stateError) {
      setPhase({ kind: "room", state: data as unknown as RoomState });
      return;
    }
    const code = errorCode(stateError);
    if (code === "not_a_member") {
      const preview = await client.rpc("get_room_preview", { p_slug: slug });
      if (preview.error) {
        setError(errorMessage(preview.error));
      } else {
        setPhase(preview.data ? { kind: "join", preview: preview.data as unknown as RoomPreview } : { kind: "not_found" });
      }
    } else if (code === "room_not_found") {
      setPhase({ kind: "not_found" });
    } else {
      setError(errorMessage(stateError));
    }
  }, [slug]);

  // Sign in (anonymously, once per browser) and load the room.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      let client: SprintdeckClient;
      try {
        client = getBrowserClient();
      } catch {
        if (!cancelled) setPhase({ kind: "config_error" });
        return;
      }
      hostSecretRef.current = hostSecretFromHash();
      await ensureSession(client);
      await client.realtime.setAuth();
      clientRef.current = client;
      if (!cancelled) await load();
    }
    start().catch((startError: unknown) => {
      if (!cancelled) setError(errorMessage(startError));
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const roomId = phase.kind === "room" ? phase.state.room.id : null;
  const meId = phase.kind === "room" ? phase.state.me.participant_id : null;
  const myRole = phase.kind === "room" ? phase.state.me.role : null;

  // Realtime: events → refetch the snapshot; presence → who is online.
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !roomId || !meId) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 80);
    };

    const channel = client.channel(roomChannel(roomId), {
      config: { private: true, presence: { key: meId } },
    });
    channel
      .on("broadcast", { event: "*" }, refetch)
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ online_at: new Date().toISOString() });
          refetch(); // catch up on anything missed while (re)connecting
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void client.removeChannel(channel);
    };
  }, [roomId, meId, load]);

  const run = useCallback(
    async (operation: (client: SprintdeckClient) => PromiseLike<{ error: unknown }>): Promise<boolean> => {
      const client = clientRef.current;
      if (!client) return false;
      setPending(true);
      const { error: operationError } = await operation(client);
      setPending(false);
      if (operationError) {
        setError(errorMessage(operationError));
        return false;
      }
      setError(null);
      await load();
      return true;
    },
    [load],
  );

  // A host link (#host=…) reclaims the host role once the visitor is in the room.
  useEffect(() => {
    const secret = hostSecretRef.current;
    if (!secret || !myRole) return;
    hostSecretRef.current = null;
    clearHash();
    if (myRole !== "host") {
      void run((client) => client.rpc("claim_host", { p_slug: slug, p_host_secret: secret }));
    }
  }, [myRole, run, slug]);

  const actions = useMemo(
    () => ({
      join: (name: string, role: Exclude<ParticipantRole, "host">) => {
        rememberName(name);
        return run((c) => c.rpc("join_room", { p_slug: slug, p_display_name: name, p_role: role }));
      },
      addItem: (title: string) =>
        roomId ? run((c) => c.rpc("add_item", { p_room_id: roomId, p_title: title })) : Promise.resolve(false),
      setCurrentItem: (itemId: string) => run((c) => c.rpc("set_current_item", { p_item_id: itemId })),
      startRound: (itemId: string) => run((c) => c.rpc("start_round", { p_item_id: itemId })),
      castVote: (roundId: string, value: string) =>
        run((c) => c.rpc("cast_vote", { p_round_id: roundId, p_value: value })),
      clearVote: (roundId: string) => run((c) => c.rpc("clear_vote", { p_round_id: roundId })),
      reveal: (roundId: string) => run((c) => c.rpc("reveal_round", { p_round_id: roundId })),
      finalize: (itemId: string, estimate: string, note: string) =>
        run((c) => c.rpc("finalize_item", { p_item_id: itemId, p_estimate: estimate, p_note: note })),
      skip: (itemId: string) => run((c) => c.rpc("skip_item", { p_item_id: itemId })),
      setRole: (participantId: string, role: ParticipantRole) =>
        run((c) => c.rpc("set_participant_role", { p_participant_id: participantId, p_role: role })),
      closeRoom: () =>
        roomId ? run((c) => c.rpc("close_room", { p_room_id: roomId })) : Promise.resolve(false),
      dismissError: () => setError(null),
    }),
    [roomId, run, slug],
  );

  return { phase, error, pending, online, actions };
}

export type RoomActions = ReturnType<typeof useRoom>["actions"];
