import { Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";
import { POOKALAM } from "~/lib/event-content";

const PookalamVoteView = clientOnly(() =>
  import("~/components/pookalam/PookalamVoteView").then((m) => ({
    default: m.PookalamVoteView,
  })),
);

export default function VotePookalam() {
  return (
    <>
      <Title>Vote - {POOKALAM.title}</Title>
      <PookalamVoteView fallback={<LoadingScreen message="Finding pairs to judge…" />} />
    </>
  );
}
