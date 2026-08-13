import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { ShoutBurst } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SHOUT_COLOR } from "~/lib/shouts";

export default function NotFound() {
  return (
    <main class="container flex min-h-[60vh] items-center justify-center py-10">
      <Title>Nothing here — FOSS Onam Games</Title>
      <HttpStatusCode code={404} />

      <div
        class="relative w-full max-w-md overflow-hidden rounded-lg p-8 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <Confetti seed="404" count={9} animate />
        <div class="art-over space-y-4">
          <ShoutBurst text="ENTHUVA!" color={SHOUT_COLOR.confused} seed="404" />
          <h1 class="text-2xl">There's nothing here</h1>
          <p class="font-semibold">
            This page doesn't exist. If a clue sent you here, the clue was lying — or you're early.
          </p>
          <p class="comment">not every 404 is a treasure hunt stage. this one isn't.</p>
          <a href="/" class="btn-brand">
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
