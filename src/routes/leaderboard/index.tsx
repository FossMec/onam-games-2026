import { Meta, Title } from "@solidjs/meta";
import { LeaderboardView } from "~/components/leaderboard/LeaderboardView";
import { SITE_URL } from "~/lib/site";

export default function Leaderboard() {
  return (
    <>
      <Title>Daily Leaderboard - Onam Games</Title>
      <Meta
        name="description"
        content="Live daily leaderboard for Onam Games by FOSSMEC. Rank in each of the six daily mini-games, beat the crowd, and win daily ₹200 cash prizes all festival week."
      />
      <Meta property="og:title" content="Daily Leaderboard - Onam Games" />
      <Meta
        property="og:description"
        content="Live daily leaderboard for Onam Games by FOSSMEC. Rank in each of the six daily mini-games, beat the crowd, and win daily ₹200 cash prizes all festival week."
      />
      <Meta property="og:url" content={`${SITE_URL}/leaderboard`} />
      <Meta property="og:image" content={`${SITE_URL}/images/lb-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:title" content="Daily Leaderboard - Onam Games" />
      <Meta
        name="twitter:description"
        content="Live daily leaderboard for Onam Games by FOSSMEC. Rank in each of the six daily mini-games, beat the crowd, and win daily ₹200 cash prizes all festival week."
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/lb-og.webp`} />

      <LeaderboardView />
    </>
  );
}
