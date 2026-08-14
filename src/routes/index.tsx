import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { Bubble, Burst, Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SpriteScatter } from "~/components/art/SpriteScatter";
import { EVENT, POOKALAM } from "~/lib/event-content";
import { getMe } from "~/server/auth/actions";
import { signOutAndReload } from "~/lib/sign-out";
import { getGames } from "~/server/games/actions";

/** Each day gets its own pop colour so the week reads as a strip of panels. */
const DAY_POPS = ["pop-yellow", "pop-teal", "pop-pink", "pop-blue", "pop-purple", "pop-red"];

const GAME_IMAGES: Record<string, string> = {
  "open-source-tinder": "/images/games/open-source-tinder.jpeg",
  "pookalam-jigsaw": "/images/games/pookalam-jigsaw.jpeg",
  wend: "/images/games/wend.jpeg",
  "escape-the-vallam": "/images/games/escape-the-vallam.jpeg",
  "maveli-jump": "/images/games/maveli-jump.jpeg",
  "treasure-hunt": "/images/games/treasure-hunt.jpeg",
};

const statusSticker: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-teal)" },
  tester: { label: "Tester access", pop: "var(--pop-purple)" },
  upcoming: { label: "Locked", pop: "var(--paper-3)" },
  // Not "Ended": a past day is still playable, just no longer ranked.
  closed: { label: "Catch up", pop: "var(--pop-blue)" },
};

function Section(props: { title: string; children: unknown; id?: string }) {
  return (
    <section id={props.id} class="space-y-5">
      <h2 class="rule">{props.title}</h2>
      {props.children as never}
    </section>
  );
}

export default function Home() {
  const games = createAsync(() => getGames());
  const me = createAsync(() => getMe());
  const [signingOut, setSigningOut] = createSignal(false);

  const liveGame = () => games()?.find((g) => g.status === "live" || g.status === "tester");
  const nextGame = () => games()?.find((g) => g.status === "upcoming" && g.releaseAt);

  return (
    <main class="container space-y-14 py-6">
      <Title>{EVENT.name}</Title>

      {/* ------------------------------------------------------------- hero */}
      <section
        class="relative overflow-hidden rounded-lg px-5 py-10 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <Confetti seed="hero" count={10} animate />
        <SpriteScatter
          seed="hero-sprites"
          count={7}
          pool={[
            "maveli-laptop",
            "tux-king",
            "sadya-leaf",
            "octocat-garland",
            "arch-crown",
            "docker-pookalam",
            "ferris-crab",
            "gopher-king",
            "foss-mec-badge",
          ]}
          minSize={36}
          maxSize={54}
          opacity={0.9}
          animate
        />
        <div class="art-over space-y-4">
          <div class="flex items-center justify-center gap-2 sm:gap-4">
            <SpriteIcon
              name="maveli-laptop"
              size={54}
              animate="float"
              interactive
              class="hidden sm:inline-flex"
            />
            <p class="wordmark text-4xl sm:text-6xl" data-text="FOSS ONAM">
              FOSS ONAM
            </p>
            <SpriteIcon
              name="tux-king"
              size={54}
              animate="float"
              delay={1.2}
              interactive
              class="hidden sm:inline-flex"
            />
          </div>
          <p
            class="mx-auto max-w-lg text-lg font-extrabold"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            {EVENT.tagline}
          </p>
          <p class="mx-auto max-w-xl font-semibold">{EVENT.blurb}</p>

          <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Show
              when={me()}
              fallback={
                <a href="/auth/signin" class="btn-brand">
                  Sign in & play
                </a>
              }
            >
              <Show
                when={liveGame()}
                fallback={
                  <a href="/leaderboard" class="btn-brand">
                    See the board
                  </a>
                }
              >
                <a href={`/games/${liveGame()!.slug}`} class="btn-brand">
                  Play today's game
                </a>
              </Show>
            </Show>
            <a href="#pookalam" class="btn-accent">
              Code-a-Pookalam
            </a>
          </div>

          <Show when={!me()}>
            <p class="comment">{EVENT.registerNote}</p>
          </Show>
        </div>
      </section>

      {/* --------------------------------------------------- next unlock */}
      <Show when={nextGame()}>
        <div class="card pop-blue flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <div class="flex items-center gap-3">
            <SpriteIcon name="terminal-star" size={38} animate="pulse" />
            <div>
              <p class="text-lg font-extrabold">Next game unlocks in</p>
              <p class="comment">
                day {nextGame()!.day} — {nextGame()!.hint ?? "no hints"}
              </p>
            </div>
          </div>
          <Countdown target={new Date(nextGame()!.releaseAt!)} />
        </div>
      </Show>

      {/* ---------------------------------------------------- signed-in bar */}
      <Show when={me()}>
        <div class="card card-plain flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <SpriteIcon name="foss-mec-badge" size={40} animate="wobble" interactive />
            <div>
              <p class="text-lg font-extrabold">Hi, {me()!.name}</p>
              <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                Streak {me()!.streakCount} · Best {me()!.bestStreak}
                {me()!.role === "admin" ? " · Admin" : ""}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Show when={!me()!.onboardingCompleted}>
              <a href="/onboarding" class="btn-accent">
                Finish profile
              </a>
            </Show>
            <a href="/leaderboard" class="btn-ghost">
              Leaderboard
            </a>
            <button
              type="button"
              class="btn-ghost"
              disabled={signingOut()}
              onClick={() => {
                setSigningOut(true);
                void signOutAndReload();
              }}
            >
              {signingOut() ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </Show>

      {/* ------------------------------------------------------- the week */}
      <Section title="The week">
        <Show when={!games()}>
          <p class="font-semibold">Loading the schedule…</p>
        </Show>
        <Show when={games()?.length === 0}>
          <p class="font-semibold">Nothing scheduled yet. Suspicious.</p>
        </Show>

        <div class="grid gap-5 sm:grid-cols-2">
          <For each={games()}>
            {(game, index) => {
              const sticker = statusSticker[game.status] ?? statusSticker.upcoming;
              const locked = game.status === "upcoming";
              const dayIcons = [
                "tux-king",
                "sadya-leaf",
                "octocat-garland",
                "docker-pookalam",
                "ferris-crab",
                "gopher-king",
                "arch-crown",
              ] as const;
              const dayIcon = dayIcons[(game.day - 1) % dayIcons.length];

              return (
                <article
                  class={`card ${DAY_POPS[index() % DAY_POPS.length]} flex flex-col justify-between gap-4 relative overflow-hidden`}
                >
                  <div class="flex flex-col sm:flex-row gap-4 items-start">
                    {/* 1:1 Square Game Artwork */}
                    <Show when={GAME_IMAGES[game.slug]}>
                      <div
                        class="relative overflow-hidden rounded-md aspect-square w-full sm:w-36 md:w-40 shrink-0 bg-[var(--paper-3)]"
                        style={{ border: "var(--ink-w) solid var(--ink)" }}
                      >
                        <img
                          src={GAME_IMAGES[game.slug]}
                          alt={game.title}
                          loading="lazy"
                          class="h-full w-full object-cover aspect-square"
                        />
                      </div>
                    </Show>

                    <div class="space-y-2.5 flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2">
                          <SpriteIcon name={dayIcon} size={24} animate="wobble" interactive />
                          <span
                            class="text-xs font-extrabold uppercase tracking-widest"
                            style={{ "font-family": "var(--font-stack-display)" }}
                          >
                            Day {game.day}
                          </span>
                        </div>
                        <span class="sticker" style={{ "--pop": sticker.pop }}>
                          {sticker.label}
                        </span>
                      </div>

                      <h3 class="text-xl">
                        <Show when={!locked} fallback={<span>{game.title}</span>}>
                          <a
                            href={`/games/${game.slug}`}
                            class="underline decoration-2 underline-offset-4"
                          >
                            {game.title}
                          </a>
                        </Show>
                      </h3>

                      {/* tagline / howTo come straight from the game registry. */}
                      <Show when={game.tagline}>
                        <p class="text-sm font-semibold">{game.tagline}</p>
                      </Show>

                      <div class="flex flex-wrap gap-1.5 pt-1">
                        <span class="badge text-xs">{game.difficulty}</span>
                        <span class="badge text-xs">
                          {game.maxAttempts > 1 ? `${game.maxAttempts} runs` : "one shot"}
                        </span>
                        <span class="badge text-xs">
                          {game.metric === "score" ? "highest wins" : "fastest wins"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="space-y-2 pt-1">
                    <Show when={locked && game.releaseAt}>
                      <div class="space-y-1">
                        <p class="comment">{game.hint ?? "no hints. suffer."}</p>
                        <Countdown target={new Date(game.releaseAt!)} compact />
                      </div>
                    </Show>

                    <Show when={game.status === "live" || game.status === "tester"}>
                      <a href={`/games/${game.slug}`} class="btn-brand w-full">
                        Play now
                      </a>
                    </Show>

                    {/*
                      Past days stay open so someone who joined late is not locked
                      out of two thirds of the event. Ghost rather than brand, so
                      it never competes with today's game for attention.
                    */}
                    <Show when={game.status === "closed"}>
                      <a href={`/games/${game.slug}`} class="btn-ghost w-full">
                        Play it anyway
                      </a>
                    </Show>
                  </div>
                </article>
              );
            }}
          </For>
        </div>
      </Section>

      {/* ---------------------------------------------------- how it works */}
      <Section title="How it works">
        <div class="grid gap-4 sm:grid-cols-2">
          <For each={EVENT.howItWorks}>
            {(step, index) => (
              <div class="card card-plain flex gap-3">
                <div class="relative h-12 w-12 shrink-0">
                  <Burst color="var(--pop-yellow)" seed={`how-${index()}`} spikes={10} />
                  <span
                    class="absolute inset-0 grid place-items-center text-lg font-extrabold"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    {index() + 1}
                  </span>
                </div>
                <div>
                  <p class="font-extrabold">{step.title}</p>
                  <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                    {step.body}
                  </p>
                </div>
              </div>
            )}
          </For>
        </div>
      </Section>

      {/* --------------------------------------------------------- scoring */}
      <Section title={EVENT.scoring.title}>
        <Bubble color="var(--pop-teal)">
          <p class="font-semibold">{EVENT.scoring.body}</p>
        </Bubble>
        <p class="comment">{EVENT.scoring.aside}</p>
      </Section>

      {/* -------------------------------------------------------- pookalam */}
      <Section title="Code-a-Pookalam" id="pookalam">
        <div
          class="relative overflow-hidden rounded-lg p-5 sm:p-7"
          style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-pink)" }}
        >
          <Halftone opacity={0.14} />
          <SpriteScatter
            seed="pookalam-art"
            count={4}
            pool={["pookalam-flower", "concentric-pookalam", "docker-pookalam", "ferris-crab"]}
            minSize={32}
            maxSize={48}
            opacity={0.8}
            animate
          />
          <div class="art-over grid gap-6 md:grid-cols-5 items-center">
            <div class="space-y-4 md:col-span-3">
              <div class="flex items-center gap-3">
                <SpriteIcon name="pookalam-flower" size={44} animate="float" interactive />
                <h3 class="text-2xl sm:text-3xl">{POOKALAM.title}</h3>
              </div>
              <p
                class="font-extrabold text-lg"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                {POOKALAM.tagline}
              </p>
              <p class="font-semibold">{POOKALAM.blurb}</p>

              <div class="flex flex-wrap gap-2">
                <span class="badge" style={{ "--pop": "var(--paper-2)" }}>
                  Submit by {POOKALAM.submitBy}
                </span>
                <span class="badge" style={{ "--pop": "var(--paper-2)" }}>
                  Voting {POOKALAM.votingOn}
                </span>
              </div>

              <div class="pt-2">
                <a href="/code-a-pookalam" class="btn-ghost">
                  Rules & judging →
                </a>
              </div>
              <p class="comment">{POOKALAM.aside}</p>
            </div>

            <div class="md:col-span-2">
              <div
                class="relative overflow-hidden rounded-lg aspect-square shadow-none max-w-xs mx-auto"
                style={{
                  border: "var(--ink-w-bold) solid var(--ink)",
                  background: "var(--paper-2)",
                }}
              >
                <img
                  src="/images/games/code-a-pookalam.jpeg"
                  alt="Code-a-Pookalam Artwork"
                  loading="lazy"
                  class="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- prizes */}
      <Section title="Prizes">
        <div class="grid gap-3 sm:grid-cols-2">
          <For each={EVENT.prizes}>
            {(prize, index) => {
              const prizeIcons = [
                "tux-king",
                "gopher-king",
                "nilavilakku",
                "burst-yellow",
              ] as const;
              const pIcon = prizeIcons[index() % prizeIcons.length];
              return (
                <div class={`card ${DAY_POPS[index() % DAY_POPS.length]} flex items-start gap-3`}>
                  <SpriteIcon name={pIcon} size={36} animate="wobble" interactive class="mt-0.5" />
                  <div>
                    <p class="font-extrabold">{prize.rank}</p>
                    <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                      {prize.detail}
                    </p>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Section>

      {/* ----------------------------------------------------------- rules */}
      <Section title="Fair play">
        <ul class="card card-plain space-y-2">
          <For each={EVENT.rules}>
            {(rule) => (
              <li class="flex gap-2 font-semibold">
                <span style={{ color: "var(--pop-red)" }}>▸</span>
                <span>{rule}</span>
              </li>
            )}
          </For>
        </ul>
      </Section>

      {/* ------------------------------------------------------------- faq */}
      <Section title="Questions">
        <div class="space-y-3">
          <For each={EVENT.faq}>
            {(item) => (
              <details class="card card-plain">
                <summary
                  class="cursor-pointer text-lg font-extrabold"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  {item.q}
                </summary>
                <p class="pt-2 font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {item.a}
                </p>
              </details>
            )}
          </For>
        </div>
      </Section>

      {/* -------------------------------------------------------- last CTA */}
      <Show when={!me()}>
        <section
          class="relative overflow-hidden rounded-lg p-8 text-center"
          style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-yellow)" }}
        >
          <Confetti seed="cta" count={6} />
          <SpriteScatter
            seed="cta-spr"
            count={5}
            pool={["linus-torvalds", "gnu-garland", "bird-mascot", "foss-mec-badge", "sadya-leaf"]}
            minSize={36}
            maxSize={52}
            opacity={0.88}
            animate
          />
          <div class="art-over space-y-3">
            <div class="flex justify-center">
              <SpriteIcon name="foss-mec-badge" size={60} animate="float" interactive />
            </div>
            <h2 class="text-3xl">Still reading?</h2>
            <p class="font-semibold">The leaderboard isn't going to lose to you on its own.</p>
            <a href="/auth/signin" class="btn-ghost">
              Sign in with Google
            </a>
          </div>
        </section>
      </Show>
    </main>
  );
}
