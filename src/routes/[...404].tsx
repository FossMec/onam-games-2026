import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { ShoutBurst } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SpriteScatter } from "~/components/art/SpriteScatter";
import { SHOUT_COLOR } from "~/lib/shouts";

export default function NotFound() {
  return (
    <main class="container flex min-h-[60vh] items-center justify-center py-10">
      <Title>Nothing here - Onam Games</Title>
      <HttpStatusCode code={404} />

      <div
        class="relative w-full max-w-md overflow-hidden rounded-lg p-8 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <Confetti seed="404" count={6} animate />
        <SpriteScatter
          seed="404-spr"
          count={4}
          pool={["bird-mascot", "kite-memphis", "burst-heart", "floppy-onam"]}
          minSize={30}
          maxSize={44}
          opacity={0.7}
          animate
        />
        <div class="art-over space-y-4">
          <div class="flex justify-center">
            <SpriteIcon name="papad-face" size={68} animate="float" interactive />
          </div>
          <ShoutBurst text="ENTHUVA!" color={SHOUT_COLOR.confused} seed="404" />
          <h1 class="text-2xl">There's nothing here</h1>
          <p class="font-semibold">
            This page doesn't exist. If a clue sent you here, the clue was lying - or you're early.
          </p>
          <p class="comment">not every 404 is a treasure hunt stage. this one isn't.</p>
          <A href="/" class="btn-brand">
            Go home
          </A>
        </div>
      </div>
    </main>
  );
}
