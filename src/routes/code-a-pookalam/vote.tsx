import { Title } from "@solidjs/meta";
import { ChartColumnBig } from "lucide-solid";
import { For, Show, createSignal, onMount } from "solid-js";
import { Bubble } from "~/components/art/Burst";
import { ShoutBurst } from "~/components/art/Burst";
import { Countdown } from "~/components/Countdown";
import { POOKALAM } from "~/lib/event-content";
import { SHOUT_COLOR, shout } from "~/lib/shouts";
import { getNextPair, getPookalamState, votePookalam } from "~/server/pookalam/actions";

/**
 * Day 7 - head-to-head pookalam voting.
 *
 * Two entries, no names, pick one. Elo does the rest.
 *
 * Nothing about who made these reaches the browser: the pairing query does not
 * select the author or the source link, and the page does not render the entry
 * *title* either. A title is a free identity leak - "Recursive Thumba by the
 * one guy who talks about recursion" - and it also invites judging the caption
 * instead of the picture, which is the one thing this round exists to stop.
 *
 * Laid out in the same 2xl column as a game page, so a pookalam sits at about
 * 300px rather than filling the viewport. Two images have to be comparable at a
 * glance, and comparing them is the entire task; if you have to scroll between
 * them the format has already failed.
 *
 * The pair is fetched imperatively rather than through `createAsync` because
 * each vote must pull the *next* pair, and a resource keyed on nothing would
 * either cache the old pair or refetch on every unrelated render.
 *
 * WHY THERE IS A TARGET AND NOT A TOTAL
 *
 * The server picks pairs by how undecided the crowd is about them, so a correct
 * ranking falls out of roughly n·log₂n votes rather than all n(n−1)/2 of them.
 * The progress bar counts toward that target - the number that makes you count
 * as having done a full shift - and every remaining pair stays available to
 * anyone who wants to keep going. Showing "20 of 45" instead would make a
 * finished voter feel like a quitter.
 */

interface PairEntry {
  id: string;
  title: string;
  imageUrl: string;
}

interface Pair {
  left: PairEntry;
  right: PairEntry;
  pairKey: string;
  progress: { votes: number; target: number; remaining: number };
}

const HOW_TO = [
  "Two pookalams, side by side. Both are anonymous - no names, no repos, no titles.",
  "Pick the one you think is better. There is no draw and no skip; a considered guess beats a blank.",
  "The next pair is chosen by where the crowd is most undecided, so your vote goes where it counts most.",
  "Finish your shift to land on the voters' board. It ranks how well you called it, not how fast you tapped.",
];

export default function VotePookalam() {
  const [gateOpen, setGateOpen] = createSignal<boolean | null>(null);
  const [opensAt, setOpensAt] = createSignal<Date | null>(null);
  const [signedIn, setSignedIn] = createSignal(true);
  const [pair, setPair] = createSignal<Pair | null>(null);
  const [count, setCount] = createSignal(0);
  const [target, setTarget] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [error, setError] = createSignal("");

  const advance = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await getNextPair();
      setPair(next);
      if (next) {
        setCount(next.progress.votes);
        setTarget(next.progress.target);
      }
      // A null pair with voting open means this voter has judged everything
      // available to them - a finish line, not a failure.
      if (!next) setDone(true);
    } catch {
      setError("Could not load the next pair.");
    } finally {
      setBusy(false);
    }
  };

  onMount(async () => {
    const state = await getPookalamState();
    setSignedIn(state.signedIn);
    setGateOpen(state.phases.voting.open);
    setOpensAt(state.phases.voting.opensAt ? new Date(state.phases.voting.opensAt) : null);
    setCount(state.votesCast);
    if (state.phases.voting.open && state.signedIn) await advance();
  });

  const pick = async (winner: PairEntry, loser: PairEntry) => {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      const result = await votePookalam(winner.id, loser.id);
      if (!result.ok) {
        setError(result.reason ?? "That vote did not count.");
      } else {
        setCount(count() + 1);
      }
    } catch {
      setError("Could not record that vote.");
    } finally {
      setBusy(false);
    }
    await advance();
  };

  const pct = () => (target() > 0 ? Math.min(100, Math.round((count() / target()) * 100)) : 0);
  const qualified = () => target() > 0 && count() >= target();

  return (
    <main class="container relative space-y-4 py-6 max-w-2xl mx-auto">
      <Title>Vote - {POOKALAM.title}</Title>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <a
          href="/code-a-pookalam"
          class="text-sm font-extrabold underline decoration-2 underline-offset-4"
        >
          ← Back
        </a>
        <a href="/leaderboard" class="btn-ghost text-xs inline-flex items-center gap-1.5">
          <ChartColumnBig size={14} />
          <span>Standings</span>
        </a>
      </div>

      <header class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="m-0">Which one?</h1>
        <span
          class="badge"
          style={{ "--pop": qualified() ? "var(--pop-teal)" : "var(--pop-yellow)" }}
        >
          {count()} judged
        </span>
      </header>

      {/* Progress toward a full shift. Overshooting is allowed and encouraged. */}
      <Show when={target() > 0}>
        <div class="space-y-1">
          <div
            class="h-2.5 w-full overflow-hidden"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
              "border-radius": "var(--radius)",
            }}
          >
            <div
              class="h-full transition-all"
              style={{
                width: `${pct()}%`,
                background: qualified() ? "var(--pop-teal)" : "var(--pop-yellow)",
              }}
            />
          </div>
          <p class="comment text-xs">
            <Show
              when={qualified()}
              fallback={`${Math.max(0, target() - count())} more to qualify for the voters' board.`}
            >
              you're on the board. keep going if you like - more votes sharpen the ranking.
            </Show>
          </p>
        </div>
      </Show>

      <Show when={gateOpen() !== null} fallback={<p class="font-semibold">Loading…</p>}>
        <Show
          when={signedIn()}
          fallback={
            <div class="card pop-yellow space-y-3">
              <p class="font-extrabold">Sign in to vote.</p>
              <a href="/auth/signin" class="btn-brand">
                Sign in
              </a>
            </div>
          }
        >
          <Show
            when={gateOpen()}
            fallback={
              <Show
                when={opensAt() && opensAt()!.getTime() > Date.now()}
                fallback={
                  <Bubble color="var(--paper-3)">
                    <p class="font-semibold">Voting isn't open. It runs on {POOKALAM.votingOn}.</p>
                  </Bubble>
                }
              >
                <div class="card pop-yellow space-y-3 text-center">
                  <p class="font-extrabold m-0">The arena opens in</p>
                  <Countdown target={opensAt()!} doneLabel="Voting is open - refresh!" />
                </div>
              </Show>
            }
          >
            <HowToVote />

            <Show
              when={pair()}
              fallback={
                <Show when={done()} fallback={<p class="font-semibold">Finding a pair…</p>}>
                  <div class="card pop-teal space-y-3 text-center">
                    <ShoutBurst
                      text={shout("triumph", "pookalam-done")}
                      color={SHOUT_COLOR.triumph}
                      seed="pookalam-done"
                    />
                    <p class="font-extrabold">
                      That's every pair you can judge. {count()} votes in.
                    </p>
                    <p class="comment">
                      results go up once voting closes. no, we won't tell you who's winning.
                    </p>
                    <a href="/leaderboard" class="btn-brand">
                      See the standings
                    </a>
                  </div>
                </Show>
              }
            >
              {/*
                Stacked on phones and side by side from `sm` up. Stacking is not
                a compromise: on a narrow screen two half-width images are too
                small to judge, and judging is the entire task.
              */}
              <div class="grid gap-3 sm:grid-cols-2">
                <Choice
                  entry={pair()!.left}
                  other={pair()!.right}
                  label="Left pookalam"
                  pop="var(--pop-blue)"
                  disabled={busy()}
                  onPick={pick}
                />
                <Choice
                  entry={pair()!.right}
                  other={pair()!.left}
                  label="Right pookalam"
                  pop="var(--pop-pink)"
                  disabled={busy()}
                  onPick={pick}
                />
              </div>
            </Show>
          </Show>
        </Show>

        <Show when={error()}>
          <p class="font-extrabold" style={{ color: "var(--pop-red)" }}>
            {error()}
          </p>
        </Show>
      </Show>
    </main>
  );
}

/**
 * The same collapsed rules panel the game pages use.
 *
 * Its own small component rather than `HowToPlayPanel` because that one is
 * built around a game type: it renders an animated demo and a playable trial,
 * and neither exists for "look at two pictures". Same shell, same numbered
 * steps, no tabs to a trial that would be blank.
 */
function HowToVote() {
  const [open, setOpen] = createSignal(false);
  return (
    <section class="card card-plain space-y-3">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open()}
      >
        <span class="rule flex-1">How voting works</span>
        <span
          class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
          style={{
            background: "var(--paper-3)",
            border: "2px solid var(--ink)",
            "font-family": "var(--font-stack-display)",
            "font-weight": 800,
          }}
        >
          {open() ? "−" : "+"}
        </span>
      </button>

      <Show when={open()}>
        <ol class="space-y-2.5">
          <For each={HOW_TO}>
            {(step, i) => (
              <li class="flex gap-3">
                <span
                  class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs tabular-nums"
                  style={{
                    background: "var(--pop-yellow)",
                    border: "2px solid var(--ink)",
                    "font-family": "var(--font-stack-display)",
                    "font-weight": 800,
                  }}
                >
                  {i() + 1}
                </span>
                <span class="text-sm font-semibold leading-snug">{step}</span>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </section>
  );
}

function Choice(props: {
  entry: PairEntry;
  other: PairEntry;
  label: string;
  pop: string;
  disabled?: boolean;
  onPick: (winner: PairEntry, loser: PairEntry) => void;
}) {
  return (
    <button
      type="button"
      class="card block w-full space-y-2.5 p-2.5 text-left"
      style={{ "--pop": props.pop, cursor: props.disabled ? "wait" : "pointer" }}
      disabled={props.disabled}
      aria-label={`Pick the ${props.label.toLowerCase()}`}
      onClick={() => props.onPick(props.entry, props.other)}
    >
      {/*
        Empty alt, and no caption. The title is deliberately not rendered - see
        the note at the top of this file. Screen readers get the button's own
        label, which says left or right and nothing about whose work it is.
      */}
      <img
        src={props.entry.imageUrl}
        alt=""
        loading="lazy"
        style={{
          width: "100%",
          "aspect-ratio": "1 / 1",
          "object-fit": "contain",
          background: "var(--paper-2)",
          border: "var(--ink-w) solid var(--ink)",
          "border-radius": "var(--radius)",
        }}
      />
      <p
        class="text-center font-extrabold m-0"
        style={{ "font-family": "var(--font-stack-display)" }}
      >
        THIS ONE
      </p>
    </button>
  );
}
