import { Title } from "@solidjs/meta";
import { clientOnly } from "@solidjs/start";
import { LoadingScreen } from "~/components/LoadingScreen";

const PookalamSubmitView = clientOnly(() =>
  import("~/components/pookalam/PookalamSubmitView").then((m) => ({
    default: m.PookalamSubmitView,
  })),
);

export default function SubmitPookalam() {
  return (
    <>
      <Title>Submit your Pookalam - Code-a-Pookalam</Title>
      <PookalamSubmitView fallback={<LoadingScreen message="Inking the submission ledger…" />} />
    </>
  );
}
