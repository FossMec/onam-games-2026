import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";
import { SITE_URL } from "~/lib/site";

const GamesHubView = clientOnly(() =>
  import("~/components/games/GamesHubView").then((m) => ({ default: m.GamesHubView })),
);

export default function GamesPage() {
  return (
    <>
      <Title>Daily Mini-Games Arena - Onam Games</Title>
      <Meta
        name="description"
        content="Play a fun new mini-game every evening at Onam Games by FOSSMEC — six daily puzzle challenges across the festival week, with ₹200 daily bounties and a ₹5K+ prize pool."
      />
      <Meta property="og:title" content="Daily Mini-Games Arena - Onam Games" />
      <Meta
        property="og:description"
        content="Play a fun new mini-game every evening at Onam Games by FOSSMEC — six daily puzzle challenges across the festival week, with ₹200 daily bounties and a ₹5K+ prize pool."
      />
      <Meta property="og:url" content={`${SITE_URL}/games`} />
      <Meta property="og:image" content={`${SITE_URL}/images/games-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:title" content="Daily Mini-Games Arena - Onam Games" />
      <Meta
        name="twitter:description"
        content="Play a fun new mini-game every evening at Onam Games by FOSSMEC — six daily puzzle challenges across the festival week, with ₹200 daily bounties and a ₹5K+ prize pool."
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/games-og.webp`} />

      <GamesHubView fallback={<LoadingScreen message="Loading games arena…" />} />
    </>
  );
}
