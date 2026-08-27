import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { ChartColumnBig } from "lucide-solid";
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { Bubble } from "~/components/art/Burst";
import { ShoutBurst } from "~/components/art/Burst";
import { Countdown } from "~/components/Countdown";
import { POOKALAM } from "~/lib/event-content";
import { SHOUT_COLOR, shout } from "~/lib/shouts";
import { PookalamVoteMath } from "~/components/pookalam/PookalamVoteMath";
import { FeedbackForm } from "~/components/feedback/FeedbackForm";
import { getNextPairs } from "~/server/pookalam/actions";
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

/**
 * Voting only needs ~320px (cards are ~160px on phone, ~300px desktop).
 * 320 is ~1/10 the pixels of 1024. Original 1024 webp is still correct but
 * heavy; ideal is Supabase render transform, but free plan may 404.
 * For now return original URL to avoid 404 hang after 3-4 images; browser
 * scales down via CSS. Re-enable render transform when bucket has it.
 */
function thumbUrl(url: string, _w = 320): string {
  return url;
}

const HOW_TO = [
  "Two pookalams, side by side. Both are anonymous — no names, no repos, no titles.",
  "Pick the one you think is better. There is no draw and no skip; a considered guess beats a blank.",
  "Fair head-to-head pairing ensures every artwork and matchup gets balanced attention across the community.",
  "Finish your shift to land on the voters' board. It ranks how well you called it, not how fast you tapped.",
  "Entries are ranked by Elo (K=32) — everyone starts at 1200, winners climb, losers drop. Highest Elo when voting closes wins.",
  "Voters are ranked by agreement with the final consensus ranking (need about 21 votes for 10 entries to qualify).",
];

export function PookalamVoteView() {
  const [gateOpen, setGateOpen] = createSignal<boolean | null>(null);
  const [opensAt, setOpensAt] = createSignal<Date | null>(null);
  const [signedIn, setSignedIn] = createSignal(true);
  const [queue, setQueue] = createSignal<Pair[]>([]);
  const [count, setCount] = createSignal(0);
  const [target, setTarget] = createSignal(0);
  const [fetching, setFetching] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");
  const [showFeedbackPrompt, setShowFeedbackPrompt] = createSignal(false);

  const [leftLoaded, setLeftLoaded] = createSignal(false);
  const [rightLoaded, setRightLoaded] = createSignal(false);
  const bothLoaded = () => leftLoaded() && rightLoaded();

  const pair = () => queue()[0] ?? null;

  const prefetchImages = (pairs: Pair[]) => {
    if (typeof window === "undefined") return;
    // Only prefetch next 2 pairs (4 images) as small 320 webp thumbs — prefetching
    // 25 pairs (50× 1024 webp) saturated bandwidth and caused hang after 3-4 votes.
    for (const p of pairs.slice(0, 2)) {
      const img1 = new Image();
      img1.src = thumbUrl(p.left.imageUrl, 320);
      const img2 = new Image();
      img2.src = thumbUrl(p.right.imageUrl, 320);
    }
  };

  const refillQueue = async (requestedCount = 45) => {
    if (fetching() || done() || isSubmitting()) return;
    // Don't refetch while votes are in-flight — server still thinks those pairs are unjudged
    // and would resend duplicates (you saw 36 → 4 refetched → 2 duplicates).
    if (pendingVotes.length > 0) return;
    setFetching(true);
    try {
      // Fetch all remaining pairs at once (max 10 pookalams => 45 pairs). One round-trip
      // is far cheaper than sequential 25-pair fetches that each do 5 DB queries.
      const batch = (await getNextPairs(requestedCount)) as Pair[];
      if (batch.length === 0) {
        if (queue().length === 0 && pendingVotes.length === 0) {
          setDone(true);
        }
      } else {
        const existingKeys = new Set(queue().map((p) => p.pairKey));
        const pendingKeys = new Set(
          pendingVotes.map((v) => [v.winnerId, v.loserId].sort().join(":")),
        );
        const fresh = batch.filter(
          (p) => !existingKeys.has(p.pairKey) && !pendingKeys.has(p.pairKey),
        );
        if (fresh.length > 0) {
          setQueue((prev) => [...prev, ...fresh]);
          prefetchImages(fresh);
          const first = fresh[0];
          if (first) {
            setCount(first.progress.votes);
            setTarget(first.progress.target);
          }
        } else if (queue().length === 0 && pendingVotes.length === 0) {
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
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem("onam_feedback_dismissed_voting");
      const completed = localStorage.getItem("onam_feedback_completed");
      if (!dismissed && !completed) {
        setShowFeedbackPrompt(true);
      }
    }
    const state = await pookalamState();
    setSignedIn(state.signedIn);
    setGateOpen(state.phases.voting.open);
    setOpensAt(state.phases.voting.opensAt ? new Date(state.phases.voting.opensAt) : null);
    setCount(state.votesCast);
    if (state.phases.voting.open && state.signedIn) {
      await refillQueue(45);
    }
  });

  // Auto-refill if queue ever runs dry and not done (fetch all at once)
  createEffect(() => {
    if (gateOpen() && signedIn() && queue().length === 0 && !done() && !fetching()) {
      void refillQueue(45);
    }
  });

  // Reset load states per pair, but fall back if already complete
  createEffect(() => {
    const p = pair();
    if (!p) return;
    setLeftLoaded(false);
    setRightLoaded(false);
  });

  const [pendingCount, setPendingCount] = createSignal(0);
  let pendingVotes: Array<{ winnerId: string; loserId: string }> = [];
  let batchTimer: number | undefined;

  const flushBatch = async () => {
    if (pendingVotes.length === 0) return;
    const batch = pendingVotes.splice(0, pendingVotes.length);
    setPendingCount(pendingVotes.length);
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = undefined;
    }
    setIsSubmitting(true);
    try {
      // Use lightweight API route instead of _server RPC — avoids seroval/query serde overhead (~5ms CPU)
      const res = await fetch("/api/pookalam/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch.length === 1 ? batch[0] : { votes: batch }),
      });
      const r = (await res.json()) as { ok: boolean; reason?: string; errors?: string[] };
      if (!r.ok) console.warn("[vote] rejected:", r.reason ?? r.errors);
    } catch (err) {
      console.error("[vote] failed:", err);
    } finally {
      setIsSubmitting(false);
      setPendingCount(pendingVotes.length);
      // If we just emptied the queue but had pending, verify truly done only after all flushed
      if (queue().length === 0 && pendingVotes.length === 0 && !done()) {
        await refillQueue(45);
      }
    }
  };

  const scheduleBatch = () => {
    if (batchTimer) clearTimeout(batchTimer);
    // Debounced: fast votes coalesce into fewer POSTs (fewer 30ms CPU hits),
    // continuous votes still flush at least every 800ms.
    batchTimer = window.setTimeout(() => {
      void flushBatch();
    }, 800);
  };

  // Ensure pending votes not lost on tab hide/close
  onMount(() => {
    const onHide = () => {
      if (pendingVotes.length > 0) void flushBatch();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    onCleanup(() => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
    });
  });

  const pick = async (winner: PairEntry, loser: PairEntry) => {
    const curQueue = queue();
    if (curQueue.length === 0) return;

    // Instant local advance — never wait for network
    const remaining = curQueue.slice(1);
    setQueue(remaining);
    setCount((c) => c + 1);
    setLeftLoaded(false);
    setRightLoaded(false);

    // Prefetch next pair's images only (not 50 at once)
    if (remaining.length > 0) prefetchImages(remaining.slice(0, 2));

    // Debounced batch: fast votes hit fewer POSTs (e.g., 36 fast votes → ~4×800ms flushes),
    // continuous slow votes still flush promptly. No loss — pending flushed on hide/unload.
    // Flush immediately only if batch is large to bound payload.
    pendingVotes.push({ winnerId: winner.id, loserId: loser.id });
    setPendingCount(pendingVotes.length);
    if (pendingVotes.length >= 10) {
      void flushBatch();
    } else {
      scheduleBatch();
    }

    // Only refill if we truly ran out AND no pending votes (otherwise server would resend same 4 you just voted)
    if (remaining.length === 0 && !done() && pendingVotes.length === 0 && !isSubmitting()) {
      void refillQueue(45);
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
            <Show
              when={showFeedbackPrompt()}
              fallback={
                <>
                  <HowToVote />

                  <Show
                    when={pair()}
                    fallback={
                      <Show
                        when={isSubmitting() || pendingCount() > 0}
                        fallback={
                          <Show
                            when={done()}
                            fallback={
                              <Show when={fetching()} fallback={<VoteSkeleton />}>
                                <VoteSkeleton />
                              </Show>
                            }
                          >
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
                                results go up once voting closes. no, we won't tell you who's
                                winning.
                              </p>
                              <A href="/leaderboard" class="btn-brand">
                                See the standings
                              </A>
                            </div>
                          </Show>
                        }
                      >
                        <div class="card pop-yellow space-y-3 text-center p-6">
                          <div class="flex justify-center">
                            <span class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--ink)] border-t-transparent" />
                          </div>
                          <p class="font-extrabold">Verifying your votes…</p>
                          <p class="comment text-sm">
                            {pendingCount() > 0
                              ? `${pendingCount()} vote${pendingCount() === 1 ? "" : "s"} still sending — please wait`
                              : "Finishing up — checking what's left"}
                          </p>
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
                        disabled={!bothLoaded()}
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
                        disabled={!bothLoaded()}
                      />
                    </div>
                  </Show>
                </>
              }
            >
              <div class="space-y-4">
                <FeedbackForm
                  onSaved={() => {
                    setShowFeedbackPrompt(false);
                    try {
                      sessionStorage.setItem("onam_feedback_dismissed_voting", "true");
                    } catch {}
                  }}
                  onDismiss={() => {
                    setShowFeedbackPrompt(false);
                    try {
                      sessionStorage.setItem("onam_feedback_dismissed_voting", "true");
                    } catch {}
                  }}
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
 * neither of which applies to a binary choice.
 */
function HowToVote() {
  const [open, setOpen] = createSignal(false);
  const [showMath, setShowMath] = createSignal(false);

  return (
    <section class="card card-plain space-y-2 p-3">
      <button
        type="button"
        class="flex w-full items-center justify-between font-extrabold text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <span>How voting works</span>
        <span>{open() ? "−" : "+"}</span>
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

function VoteSkeleton() {
  return (
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="card block w-full space-y-2.5 p-2.5">
        <div
          class="relative w-full aspect-square overflow-hidden bg-[var(--paper-3)] animate-pulse rounded-[var(--radius)]"
          style={{ border: "var(--ink-w) solid var(--ink)" }}
        />
        <div class="h-4 w-24 mx-auto bg-[var(--paper-3)] animate-pulse rounded" />
      </div>
      <div class="card block w-full space-y-2.5 p-2.5">
        <div
          class="relative w-full aspect-square overflow-hidden bg-[var(--paper-3)] animate-pulse rounded-[var(--radius)]"
          style={{ border: "var(--ink-w) solid var(--ink)" }}
        />
        <div class="h-4 w-24 mx-auto bg-[var(--paper-3)] animate-pulse rounded" />
      </div>
    </div>
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
  let imgRef: HTMLImageElement | undefined;
  let fallbackTimer: number | undefined;

  // Fix hang when same image repeats: if src unchanged, onLoad won't fire
  // but imgRef.complete is true — check via microtask + loaded tracking.
  createEffect(() => {
    // Track loaded to re-run after parent reset (even when same URL repeats, e.g., A vs B then A vs C)
    void props.loaded;
    const _url = props.entry.imageUrl;
    // Defer to after DOM updates so imgRef.src has settled
    queueMicrotask(() => {
      if (imgRef && imgRef.complete && imgRef.naturalWidth > 0) {
        props.onLoaded();
        return;
      }
      // Check again after a frame — cached images may become complete after layout
      requestAnimationFrame(() => {
        if (imgRef && imgRef.complete && imgRef.naturalWidth > 0) {
          props.onLoaded();
        }
      });
    });
    if (fallbackTimer) clearTimeout(fallbackTimer);
    // Stuck artwork check — was 4s, now 1.5s (512 webp loads <500ms even on 3G)
    fallbackTimer = window.setTimeout(() => {
      if (!props.loaded) {
        console.warn("[vote] image load timeout, unblocking:", _url);
        props.onLoaded();
      }
    }, 1500);
    onCleanup(() => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
    });
  });

  return (
    <button
      type="button"
      class="card block w-full space-y-2.5 p-2.5 text-left transition-transform active:scale-[0.99]"
      style={{
        "--pop": props.pop,
        cursor: props.disabled ? "wait" : "pointer",
        opacity: props.bothLoaded ? "1" : "0.9",
      }}
      disabled={props.disabled}
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
          ref={(el) => {
            imgRef = el;
            if (el.complete) props.onLoaded();
          }}
          src={thumbUrl(props.entry.imageUrl, 320)}
          alt=""
          loading="eager"
          decoding="async"
          onLoad={() => props.onLoaded()}
          onError={() => {
            // If thumb transform 404 (free plan without transforms), fall back to original
            if (imgRef && imgRef.src !== props.entry.imageUrl) {
              imgRef.src = props.entry.imageUrl;
            } else {
              props.onLoaded();
            }
          }}
          class={`w-full h-full object-contain transition-opacity duration-150 ${
            props.loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <p
        class="text-center font-extrabold m-0"
        style={{ "font-family": "var(--font-stack-display)" }}
      >
        THIS ONE
      </p>
    </button>
  );
}
