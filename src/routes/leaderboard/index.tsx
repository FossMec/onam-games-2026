import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";
import { SITE_URL } from "~/lib/site";

const LeaderboardView = clientOnly(() =>
  import("~/components/leaderboard/LeaderboardView").then((m) => ({ default: m.LeaderboardView })),
);

export default function Leaderboard() {
  return (
    <>
      <Title>All-Time & Daily Standings - Onam Games</Title>
      <Meta
        name="description"
        content="Live verified leaderboard for Onam Games by FOSSMEC. Track top scores, speed records, and department rankings across 7 daily challenges."
      />
      <Meta property="og:title" content="All-Time & Daily Standings - Onam Games" />
      <Meta
        property="og:description"
        content="Live verified leaderboard for Onam Games by FOSSMEC. Track top scores, speed records, and department rankings across 7 daily challenges."
      />
      <Meta property="og:url" content={`${SITE_URL}/leaderboard`} />
      <Meta property="og:image" content={`${SITE_URL}/images/leaderboard-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:title" content="All-Time & Daily Standings - Onam Games" />
      <Meta
        name="twitter:description"
        content="Live verified leaderboard for Onam Games by FOSSMEC. Track top scores, speed records, and department rankings across 7 daily challenges."
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/leaderboard-og.webp`} />

      <LeaderboardView fallback={<LoadingScreen message="Loading standings & rankings…" />} />
    </>
  );
}
