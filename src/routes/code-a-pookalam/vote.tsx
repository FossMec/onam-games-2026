import { Title } from "@solidjs/meta";
import { Show, createSignal, onMount } from "solid-js";
import { Bubble } from "~/components/art/Burst";
import { ShoutBurst } from "~/components/art/Burst";
import { POOKALAM } from "~/lib/event-content";
import { SHOUT_COLOR, shout } from "~/lib/shouts";
import { getNextPair, getPookalamState, votePookalam } from "~/server/pookalam/actions";

/**
 * Day 7 — head-to-head pookalam voting.
 *
 * Two entries, no names, pick one. Elo does the rest.
 *
 * Nothing about who made these reaches the browser: the pairing query does not
 * select the author or the source link. That is the entire reason the contest
 * is judged this way — a public gallery with names on it measures friend count,
 * not pookalams.
 *
 * The pair is fetched imperatively rather than through `createAsync` because
 * each vote must pull the *next* pair, and a resource keyed on nothing would
 * either cache the old pair or refetch on every unrelated render.
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
}

export default function VotePookalam() {
  const [gateOpen, setGateOpen] = createSignal<boolean | null>(null);
  const [signedIn, setSignedIn] = createSignal(true);
  const [pair, setPair] = createSignal<Pair | null>(null);
  const [count, setCount] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [error, setError] = createSignal("");

  const advance = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await getNextPair();
      setPair(next);
      // A null pair with voting open means this voter has judged everything
      // available to them — a finish line, not a failure.
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
    setGateOpen(state.gates.votingOpen);
    setCount(state.votesCast);
    if (state.gates.votingOpen && state.signedIn) await advance();
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

  return (
    <main class="container space-y-6 py-6">
      <Title>Vote — {POOKALAM.title}</Title>

      <a
        href="/code-a-pookalam"
        class="inline-block text-sm font-extrabold underline decoration-2 underline-offset-4"
      >
        ← Back
      </a>

      <header class="flex flex-wrap items-center justify-between gap-2">
        <h1>Which one?</h1>
        <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
          {count()} judged
        </span>
      </header>

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
              <Bubble color="var(--paper-3)">
                <p class="font-semibold">Voting isn't open yet. It runs on {POOKALAM.votingOn}.</p>
              </Bubble>
            }
          >
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
                  </div>
                </Show>
              }
            >
              <p class="comment">
                no names, no repos, no hints. just the two pookalams. pick the better one.
              </p>

              {/*
                Stacked on phones and side by side from `sm` up. Stacking is not
                a compromise: on a narrow screen two half-width images are too
                small to judge, and judging is the entire task.
              */}
              <div class="grid gap-4 sm:grid-cols-2">
                <Choice
                  entry={pair()!.left}
                  other={pair()!.right}
                  pop="var(--pop-blue)"
                  disabled={busy()}
                  onPick={pick}
                />
                <Choice
                  entry={pair()!.right}
                  other={pair()!.left}
                  pop="var(--pop-pink)"
                  disabled={busy()}
                  onPick={pick}
                />
              </div>

              <div class="text-center">
                <button
                  type="button"
                  class="btn-ghost"
                  disabled={busy()}
                  onClick={() => void advance()}
                >
                  Can't decide — show me another pair
                </button>
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

function Choice(props: {
  entry: PairEntry;
  other: PairEntry;
  pop: string;
  disabled?: boolean;
  onPick: (winner: PairEntry, loser: PairEntry) => void;
}) {
  return (
    <button
      type="button"
      class="card block w-full space-y-3 text-left"
      style={{ "--pop": props.pop, cursor: props.disabled ? "wait" : "pointer" }}
      disabled={props.disabled}
      onClick={() => props.onPick(props.entry, props.other)}
    >
      <img
        src={props.entry.imageUrl}
        alt={props.entry.title}
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
      <p class="text-center font-extrabold">{props.entry.title}</p>
      <p class="text-center font-extrabold" style={{ "font-family": "var(--font-stack-display)" }}>
        THIS ONE
      </p>
    </button>
  );
}
