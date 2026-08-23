import { Link, Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";
import { POOKALAM } from "~/lib/event-content";
import { SITE_URL } from "~/lib/site";

const PookalamResultsView = clientOnly(() =>
  import("~/components/pookalam/PookalamResultsView").then((m) => ({
    default: m.PookalamResultsView,
  })),
);

export default function PookalamResults() {
  return (
    <>
      <Title>Results - {POOKALAM.title}</Title>
      <Meta
        name="description"
        content={`Final winners and standings for ${POOKALAM.title} at Onam Games by FOSSMEC.`}
      />
      <Meta property="og:title" content={`Results - ${POOKALAM.title}`} />
      <Meta
        property="og:description"
        content={`Final winners and standings for ${POOKALAM.title} at Onam Games by FOSSMEC.`}
      />
      <Meta property="og:url" content={`${SITE_URL}/code-a-pookalam/results`} />
      <Meta property="og:image" content={`${SITE_URL}/images/code-a-pookalam-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:title" content={`Results - ${POOKALAM.title}`} />
      <Meta
        name="twitter:description"
        content={`Final winners and standings for ${POOKALAM.title} at Onam Games by FOSSMEC.`}
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/code-a-pookalam-og.webp`} />
      <Link rel="canonical" href={`${SITE_URL}/code-a-pookalam/results`} />

      <PookalamResultsView fallback={<LoadingScreen message="Tallying final results…" />} />
    </>
  );
}
