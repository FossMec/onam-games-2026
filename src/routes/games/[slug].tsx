import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";
import { SITE_URL } from "~/lib/site";

const GameArenaView = clientOnly(() =>
  import("~/components/games/GameArenaView").then((m) => ({ default: m.GameArenaView })),
);

export default function GameArenaPage() {
  return (
    <>
      <Title>Daily Challenge - Onam Games</Title>
      <Meta name="description" content="Play daily mini-games on Onam Games by FOSSMEC." />
      <Meta property="og:title" content="Daily Challenge - Onam Games" />
      <Meta property="og:description" content="Play daily mini-games on Onam Games by FOSSMEC." />
      <Meta property="og:image" content={`${SITE_URL}/images/games-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:title" content="Daily Challenge - Onam Games" />
      <Meta name="twitter:description" content="Play daily mini-games on Onam Games by FOSSMEC." />
      <Meta name="twitter:image" content={`${SITE_URL}/images/games-og.webp`} />

      <GameArenaView fallback={<LoadingScreen message="Inking daily challenge…" />} />
    </>
  );
}
