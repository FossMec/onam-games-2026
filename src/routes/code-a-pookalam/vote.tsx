import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { ChartColumnBig } from "lucide-solid";
import { For, Show, createSignal, onMount } from "solid-js";
import { Bubble } from "~/components/art/Burst";
import { ShoutBurst } from "~/components/art/Burst";
import { Countdown } from "~/components/Countdown";
import { POOKALAM } from "~/lib/event-content";
import { SHOUT_COLOR, shout } from "~/lib/shouts";
import { PookalamVoteMath } from "~/components/pookalam/PookalamVoteMath";
import { getNextPairs, votePookalam } from "~/server/pookalam/actions";
import { pookalamState } from "~/lib/queries";

/**
 * Day 7 - head-to-head pookalam voting.
 *
 * Two entries, no names, pick one. Elo does the rest.
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
  "Two pookalams, side by side. Both are anonymous — no names, no repos, no titles.",
  "Pick the one you think is better. There is no draw and no skip; a considered guess beats a blank.",
  "Fair head-to-head pairing ensures every artwork and matchup gets balanced attention across the community.",
  "Finish your shift to land on the voters' board. It ranks how well you called it, not how fast you tapped.",
  "Entries are ranked by Elo (K=32) — everyone starts at 1200, winners climb, losers drop. Highest Elo when voting closes wins.",
  "Voters are ranked by agreement with the final consensus ranking (need about 21 votes for 10 entries to qualify).",
];

export default function VotePookalam() {
  const [gateOpen, setGateOpen] = createSignal<boolean | null>(null);
  const [opensAt, setOpensAt] = createSignal<Date | null>(null);
  const [signedIn, setSignedIn] = createSignal(true);
  const [queue, setQueue] = createSignal<Pair[]>([]);
  const [count, setCount] = createSignal(0);
  const [target, setTarget] = createSignal(0);
  const [fetching, setFetching] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [error, setError] = createSignal("");

  const [leftLoaded, setLeftLoaded] = createSignal(false);
  const [rightLoaded, setRightLoaded] = createSignal(false);
  const bothLoaded = () => leftLoaded() && rightLoaded();

  const pair = () => queue()[0] ?? null;

  const prefetchImages = (pairs: Pair[]) => {
    if (typeof window === "undefined") return;
    for (const p of pairs) {
      const img1 = new Image();
      img1.src = p.left.imageUrl;
      const img2 = new Image();
      img2.src = p.right.imageUrl;
    }
  };

  const refillQueue = async (requestedCount = 25) => {
    if (fetching() || done()) return;
    setFetching(true);
    try {
      const batch = (await getNextPairs(requestedCount)) as Pair[];
      if (batch.length === 0) {
        if (queue().length === 0) {
          setDone(true);
        }
      } else {
        const existingKeys = new Set(queue().map((p) => p.pairKey));
        const fresh = batch.filter((p) => !existingKeys.has(p.pairKey));
        if (fresh.length > 0) {
          setQueue((prev) => [...prev, ...fresh]);
          prefetchImages(fresh);
          const first = fresh[0];
          if (first) {
            setCount(first.progress.votes);
            setTarget(first.progress.target);
          }
        } else if (queue().length === 0) {
          // If no fresh pairs were returned and queue is empty, voter has judged all
          setDone(true);
        }
      }
    } catch {
      setError("Could not load pairs.");
    } finally {
      setFetching(false);
    }
  };

  onMount(async () => {
    const state = await pookalamState();
    setSignedIn(state.signedIn);
    setGateOpen(state.phases.voting.open);
    setOpensAt(state.phases.voting.opensAt ? new Date(state.phases.voting.opensAt) : null);
    setCount(state.votesCast);
    if (state.phases.voting.open && state.signedIn) {
      await refillQueue(25);
    }
  });

  const pick = async (winner: PairEntry, loser: PairEntry) => {
    if (!bothLoaded()) return;
    const curQueue = queue();
    if (curQueue.length === 0) return;

    // Instant local advance
    const remaining = curQueue.slice(1);
    setQueue(remaining);
    setCount((c) => c + 1);
    setLeftLoaded(false);
    setRightLoaded(false);

    // If buffer is running low, eagerly fetch next batch
    if (remaining.length <= 5) {
      void refillQueue(25);
    }

    // Fire vote asynchronously in background
    try {
      const result = await votePookalam(winner.id, loser.id);
      if (!result.ok) {
        setError(result.reason ?? "That vote did not count.");
      }
    } catch {
      setError("Could not record that vote.");
    }
  };

  const pct = () => (target() > 0 ? Math.min(100, Math.round((count() / target()) * 100)) : 0);
  const qualified = () => target() > 0 && count() >= target();

  return (
    <main class="container relative space-y-4 py-6 max-w-2xl mx-auto">
      <Title>Vote - {POOKALAM.title}</Title>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <A
          href="/code-a-pookalam"
          class="text-sm font-extrabold underline decoration-2 underline-offset-4"
        >
          ← Back
        </A>
        <A href="/leaderboard" class="btn-ghost text-xs inline-flex items-center gap-1.5">
          <ChartColumnBig size={14} />
          <span>Standings</span>
        </A>
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
              <A href="/auth/signin" class="btn-brand">
                Sign in
              </A>
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
                    <A href="/leaderboard" class="btn-brand">
                      See the standings
                    </A>
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
                  loaded={leftLoaded()}
                  bothLoaded={bothLoaded()}
                  onLoaded={() => setLeftLoaded(true)}
                  onPick={pick}
                />
                <Choice
                  entry={pair()!.right}
                  other={pair()!.left}
                  label="Right pookalam"
                  pop="var(--pop-pink)"
                  loaded={rightLoaded()}
                  bothLoaded={bothLoaded()}
                  onLoaded={() => setRightLoaded(true)}
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
  const [showMath, setShowMath] = createSignal(false);
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
        <button
          type="button"
          class="text-xs font-black underline decoration-2 underline-offset-4"
          onClick={() => setShowMath((v) => !v)}
        >
          {showMath() ? "Hide math ↑" : "Show me the math →"}
        </button>
        <Show when={showMath()}>
          <PookalamVoteMath />
        </Show>
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
  loaded: boolean;
  bothLoaded: boolean;
  onLoaded: () => void;
  onPick: (winner: PairEntry, loser: PairEntry) => void;
}) {
  return (
    <button
      type="button"
      class="card block w-full space-y-2.5 p-2.5 text-left transition-transform active:scale-[0.99]"
      style={{
        "--pop": props.pop,
        cursor: props.disabled || !props.bothLoaded ? "wait" : "pointer",
        opacity: props.bothLoaded ? "1" : "0.85",
      }}
      disabled={props.disabled || !props.bothLoaded}
      aria-label={`Pick the ${props.label.toLowerCase()}`}
      onClick={() => props.onPick(props.entry, props.other)}
    >
      <div class="relative w-full aspect-square overflow-hidden bg-[var(--paper-2)] border-[var(--ink-w)] border-[var(--ink)] rounded-[var(--radius)]">
        {/* Skeleton Shimmer Placeholder */}
        <Show when={!props.loaded}>
          <div class="absolute inset-0 grid place-items-center bg-[var(--paper-3)] animate-pulse">
            <span class="text-xs font-black text-[var(--ink-soft)] uppercase tracking-wider">
              Loading artwork…
            </span>
          </div>
        </Show>

        <img
          src={props.entry.imageUrl}
          alt=""
          loading="eager"
          decoding="async"
          onLoad={() => props.onLoaded()}
          class={`w-full h-full object-contain transition-opacity duration-150 ${
            props.loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <p
        class="text-center font-extrabold m-0"
        style={{ "font-family": "var(--font-stack-display)" }}
      >
        {props.bothLoaded ? "THIS ONE" : "LOADING…"}
      </p>
    </button>
  );
}
