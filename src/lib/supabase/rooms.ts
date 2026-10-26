/**
 * Shapes of the JSON returned by the room RPCs (supabase/migrations/*_rooms.sql).
 * The generated types only say `Json` for these, so they are spelled out here.
 */

import type { DeckId } from "@/lib/deck";

export type RoomStatus = "open" | "closed";
export type ParticipantRole = "host" | "voter" | "observer";
export type ItemStatus = "pending" | "estimating" | "estimated" | "skipped";
export type RoundStatus = "voting" | "revealed";

export interface CreatedRoom {
  room_id: string;
  slug: string;
  participant_id: string;
  /** Shown once to the host; lets them reclaim the role from another device. */
  host_secret: string;
}

export interface JoinedRoom {
  room_id: string;
  participant_id: string;
  role: ParticipantRole;
}

export interface RoomPreview {
  title: string;
  status: RoomStatus;
  deck: DeckId;
  participant_count: number;
  /** Up to five, host first. */
  participants: { display_name: string; role: ParticipantRole }[];
  current_item: {
    title: string;
    position: number;
    item_count: number;
    round_status: RoundStatus | null;
  } | null;
}

export interface RoomState {
  room: {
    id: string;
    slug: string;
    title: string;
    status: RoomStatus;
    deck: DeckId;
    current_item_id: string | null;
    version: number;
    created_at: string;
    last_activity_at: string;
  };
  me: { participant_id: string; role: ParticipantRole };
  participants: { id: string; display_name: string; role: ParticipantRole; joined_at: string }[];
  items: {
    id: string;
    title: string;
    description: string | null;
    position: number;
    status: ItemStatus;
    final_estimate: string | null;
    finalized_at: string | null;
    notes: { id: string; author_id: string | null; content: string; created_at: string }[];
  }[];
  rounds: {
    id: string;
    item_id: string;
    number: number;
    status: RoundStatus;
    started_at: string;
    revealed_at: string | null;
    /** `value` is present only once the round is revealed. */
    votes: { participant_id: string; value?: string }[];
    my_vote: string | null;
  }[];
}

/** Events broadcast on the private channel `room:<room_id>`; payloads never carry vote values. */
export type RoomEvent =
  | "participant_joined"
  | "participant_updated"
  | "participants_changed"
  | "item_changed"
  | "items_reordered"
  | "current_item_changed"
  | "round_started"
  | "vote_status_changed"
  | "round_revealed"
  | "item_finalized"
  | "room_closed";

export interface RoomEventPayload {
  room_id: string;
  /** Room version after the change — a gap means an event was missed: refetch the snapshot. */
  version: number;
  [key: string]: unknown;
}

/** Error codes raised by the RPCs (the error message is the code). */
export type RoomErrorCode =
  | "not_authenticated"
  | "room_not_found"
  | "not_a_member"
  | "not_host"
  | "room_closed"
  | "rate_limited"
  | "invalid_deck"
  | "invalid_title"
  | "invalid_display_name"
  | "invalid_description"
  | "invalid_note"
  | "invalid_role"
  | "invalid_host_secret"
  | "invalid_item_order"
  | "invalid_card"
  | "invalid_estimate"
  | "host_required"
  | "participant_not_found"
  | "item_not_found"
  | "item_already_estimated"
  | "too_many_items"
  | "round_not_found"
  | "round_not_voting"
  | "round_in_progress"
  | "observers_cannot_vote"
  | "room_full";

export const roomChannel = (roomId: string) => `room:${roomId}`;
