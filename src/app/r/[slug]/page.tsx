import type { Metadata } from "next";
import { Suspense } from "react";
import { RoomRoute } from "@/features/room/room-route";
import { RoomMessage } from "@/features/room/room-message";
import { en } from "@/messages/en";

export const metadata: Metadata = {
  title: en.app.name,
};

// The slug is only known at request time, and everything below it runs in the
// browser (anonymous session, realtime), so the shell only shows a loading state.
export default function RoomPage({ params }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<RoomMessage text={en.room.loading} />}>
      <RoomRoute params={params} />
    </Suspense>
  );
}
