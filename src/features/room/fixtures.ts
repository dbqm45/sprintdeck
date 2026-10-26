import type { RoomState } from "@/lib/supabase/rooms";

type Overrides = Partial<Omit<RoomState, "room">> & { room?: Partial<RoomState["room"]> };

/** A small room snapshot for tests: Anna hosts, Ben votes, Cleo observes. */
export function roomState(overrides: Overrides = {}): RoomState {
  const { room, ...rest } = overrides;
  return {
    room: {
      id: "room-1",
      slug: "AbCdEf123456",
      title: "Sprint 42 refinement",
      status: "open",
      deck: "fibonacci",
      current_item_id: "item-1",
      version: 7,
      created_at: "2026-10-26T10:00:00Z",
      last_activity_at: "2026-10-26T10:30:00Z",
      ...room,
    },
    me: { participant_id: "p-anna", role: "host" },
    participants: [
      { id: "p-anna", display_name: "Anna", role: "host", joined_at: "2026-10-26T10:00:00Z" },
      { id: "p-ben", display_name: "Ben", role: "voter", joined_at: "2026-10-26T10:01:00Z" },
      { id: "p-cleo", display_name: "Cleo", role: "observer", joined_at: "2026-10-26T10:02:00Z" },
    ],
    items: [],
    rounds: [],
    ...rest,
  };
}

export function item(id: string, position: number, overrides: Partial<RoomState["items"][number]> = {}) {
  return {
    id,
    title: `Item ${position}`,
    description: null,
    position,
    status: "pending" as const,
    final_estimate: null,
    finalized_at: null,
    notes: [],
    ...overrides,
  };
}

export function revealed(id: string, itemId: string, number: number, values: Record<string, string>) {
  return {
    id,
    item_id: itemId,
    number,
    status: "revealed" as const,
    started_at: `2026-10-26T10:1${number}:00Z`,
    revealed_at: `2026-10-26T10:1${number}:30Z`,
    votes: Object.entries(values).map(([participant_id, value]) => ({ participant_id, value })),
    my_vote: values["p-anna"] ?? null,
  };
}
