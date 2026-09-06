import { Meta, Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";
import { SITE_URL } from "~/lib/site";

const OrientationView = clientOnly(() =>
  import("~/components/orientation/OrientationView").then((m) => ({ default: m.OrientationView })),
);

export default function OrientationPage() {
  return (
    <>
      <Title>Orientation - Onam Games</Title>
      <Meta
        name="description"
        content="Orientation play for first-year students - single game per batch, one attempt."
      />
      <Meta property="og:title" content="Orientation - Onam Games" />
      <Meta property="og:description" content="Orientation play for first-year students." />
      <Meta property="og:url" content={`${SITE_URL}/orientation`} />
      <Meta property="og:image" content={`${SITE_URL}/images/games-og.webp`} />
      <OrientationView fallback={<LoadingScreen message="Loading orientation…" />} />
    </>
  );
}
