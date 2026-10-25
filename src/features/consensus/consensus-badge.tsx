import type { ConsensusState } from "@/lib/consensus";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { en } from "@/messages/en";

const TONE: Record<ConsensusState, BadgeTone> = {
  A_consensus: "positive",
  B_moderate: "warning",
  C_high: "negative",
  D_insufficient: "muted",
};

/** The Consensus Engine's verdict for a round. */
export function ConsensusBadge({ state, size }: { state: ConsensusState; size?: "md" | "sm" }) {
  return (
    <Badge tone={TONE[state]} size={size}>
      {en.consensus.states[state]}
    </Badge>
  );
}
