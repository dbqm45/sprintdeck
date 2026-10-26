"use client";

import { use } from "react";
import { HumanCheck } from "@/components/ui/human-check";
import { en } from "@/messages/en";
import { JoinScreen } from "./join-screen";
import { RoomMessage } from "./room-message";
import { RoomView } from "./room-view";
import { useRoom } from "./use-room";

const t = en.room;

export function RoomRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const room = useRoom(slug);
  const { phase } = room;

  switch (phase.kind) {
    case "loading":
      return <RoomMessage text={room.error ?? t.loading} />;
    case "config_error":
      return <RoomMessage text={t.configError} />;
    case "verify":
      return (
        <RoomMessage title={t.verify.title} text={room.error ?? t.verify.body}>
          <HumanCheck onToken={room.actions.verify} />
        </RoomMessage>
      );
    case "not_found":
      return <RoomMessage title={t.notFound.title} text={t.notFound.body} action={{ href: "/", label: t.notFound.back }} />;
    case "join":
      return <JoinScreen preview={phase.preview} error={room.error} pending={room.pending} onJoin={room.actions.join} />;
    case "room":
      return <RoomView slug={slug} state={phase.state} room={room} />;
  }
}
