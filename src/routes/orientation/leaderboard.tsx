import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";
import { SITE_URL } from "~/lib/site";

const OrientationLeaderboardView = clientOnly(() =>
  import("~/components/orientation/OrientationLeaderboardView").then((m) => ({
    default: m.OrientationLeaderboardView,
  })),
);

export default function OrientationLeaderboardPage() {
  return (
    <>
      <Title>Orientation Leaderboard - FOSS MEC</Title>
      <Meta
        name="description"
        content="Orientation class leaderboard and standings for first-year students at MEC."
      />
      <Meta property="og:title" content="Orientation Leaderboard - FOSS MEC" />
      <Meta property="og:description" content="Orientation class leaderboard and standings." />
      <Meta property="og:url" content={`${SITE_URL}/orientation/leaderboard`} />
      <Meta property="og:image" content={`${SITE_URL}/images/games-og.webp`} />
      <OrientationLeaderboardView fallback={<LoadingScreen message="Loading leaderboard..." />} />
    </>
  );
}
