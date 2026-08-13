import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { Bubble, Burst, Halftone } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { EVENT, POOKALAM } from "~/lib/event-content";
import { getMe, signOutAction } from "~/server/auth/actions";
import { getGames } from "~/server/games/actions";

/** Each day gets its own pop colour so the week reads as a strip of panels. */
const DAY_POPS = ["pop-yellow", "pop-teal", "pop-pink", "pop-blue", "pop-purple", "pop-red"];

const statusSticker: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-teal)" },
  tester: { label: "Tester access", pop: "var(--pop-purple)" },
  upcoming: { label: "Locked", pop: "var(--paper-3)" },
  closed: { label: "Ended", pop: "var(--paper-3)" },
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
        <Confetti seed="hero" count={14} animate />
        <div class="art-over space-y-4">
          <p class="wordmark text-4xl sm:text-6xl" data-text="FOSS ONAM">
            FOSS ONAM
          </p>
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
          <div>
            <p class="text-lg font-extrabold">Next game unlocks in</p>
            <p class="comment">
              day {nextGame()!.day} — {nextGame()!.hint ?? "no hints"}
            </p>
          </div>
          <Countdown target={new Date(nextGame()!.releaseAt!)} />
        </div>
      </Show>

      {/* ---------------------------------------------------- signed-in bar */}
      <Show when={me()}>
        <div class="card card-plain flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-lg font-extrabold">Hi, {me()!.name}</p>
            <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
              Streak {me()!.streakCount} · Best {me()!.bestStreak}
              {me()!.role === "admin" ? " · Admin" : ""}
            </p>
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
            <button type="button" class="btn-ghost" onClick={() => signOutAction()}>
              Sign out
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

        <div class="grid gap-4 sm:grid-cols-2">
          <For each={games()}>
            {(game, index) => {
              const sticker = statusSticker[game.status] ?? statusSticker.upcoming;
              const locked = game.status === "upcoming";
              return (
                <article class={`card ${DAY_POPS[index() % DAY_POPS.length]} space-y-3`}>
                  <div class="flex items-start justify-between gap-2">
                    <span
                      class="text-xs font-extrabold uppercase tracking-widest"
                      style={{ "font-family": "var(--font-stack-display)" }}
                    >
                      Day {game.day}
                    </span>
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

                  <div class="flex flex-wrap gap-2">
                    <span class="badge">{game.difficulty}</span>
                    <span class="badge">
                      {game.maxAttempts > 1 ? `${game.maxAttempts} runs` : "one shot"}
                    </span>
                    <span class="badge">
                      {game.metric === "score" ? "highest wins" : "fastest wins"}
                    </span>
                  </div>

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
          class="relative overflow-hidden rounded-lg p-5"
          style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-pink)" }}
        >
          <Halftone opacity={0.14} />
          <div class="art-over space-y-4">
            <h3 class="text-2xl">{POOKALAM.title}</h3>
            <p class="font-extrabold" style={{ "font-family": "var(--font-stack-display)" }}>
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

            <a href="/code-a-pookalam" class="btn-ghost">
              Rules & judging →
            </a>
            <p class="comment">{POOKALAM.aside}</p>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- prizes */}
      <Section title="Prizes">
        <div class="grid gap-3 sm:grid-cols-2">
          <For each={EVENT.prizes}>
            {(prize, index) => (
              <div class={`card ${DAY_POPS[index() % DAY_POPS.length]}`}>
                <p class="font-extrabold">{prize.rank}</p>
                <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {prize.detail}
                </p>
              </div>
            )}
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
          <Confetti seed="cta" count={8} />
          <div class="art-over space-y-3">
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
