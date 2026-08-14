import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Bubble } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { POOKALAM } from "~/lib/event-content";
import { getPookalamResults } from "~/server/pookalam/actions";

/**
 * Final standings, and the only place a pookalam is ever shown next to its
 * author's name. Everything before this point is anonymous on purpose.
 *
 * Hidden behind `pookalam.results_public` for players; admins always see it,
 * which is how you check a contest before announcing it.
 */

const MEDAL = ["var(--pop-yellow)", "var(--paper-3)", "var(--pop-red)"];

export default function PookalamResults() {
  const results = createAsync(() => getPookalamResults());

  return (
    <main class="container space-y-8 py-6">
      <Title>Results — {POOKALAM.title}</Title>

      <a
        href="/code-a-pookalam"
        class="inline-block text-sm font-extrabold underline decoration-2 underline-offset-4"
      >
        ← Back
      </a>

      <section
        class="relative overflow-hidden rounded-lg p-6 text-center"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--pop-yellow)" }}
      >
        <Confetti seed="pookalam-results" count={14} animate />
        <div class="art-over space-y-2">
          <h1>The pookalams</h1>
          <p class="font-extrabold">Ranked by every head-to-head you all voted on.</p>
        </div>
      </section>

      <Show
        when={results()}
        fallback={
          <Bubble color="var(--paper-3)">
            <p class="font-semibold">
              Results aren't out yet. They go up once voting closes on {POOKALAM.votingOn}.
            </p>
          </Bubble>
        }
      >
        <Show
          when={results()!.length > 0}
          fallback={<p class="font-semibold">No entries made it through review.</p>}
        >
          <div class="space-y-4">
            <For each={results()!}>
              {(entry) => (
                <article
                  class="card space-y-3 sm:flex sm:items-start sm:gap-4 sm:space-y-0"
                  style={{ "--pop": MEDAL[entry.rank - 1] ?? "var(--pop-blue)" }}
                >
                  <img
                    src={entry.imageUrl}
                    alt={entry.title}
                    loading="lazy"
                    class="w-full sm:w-48 sm:shrink-0"
                    style={{
                      "aspect-ratio": "1 / 1",
                      "object-fit": "contain",
                      background: "var(--paper-2)",
                      border: "var(--ink-w) solid var(--ink)",
                      "border-radius": "var(--radius)",
                    }}
                  />
                  <div class="space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        class="badge"
                        style={{ "--pop": MEDAL[entry.rank - 1] ?? "var(--paper-3)" }}
                      >
                        #{entry.rank}
                      </span>
                      <p class="text-lg font-extrabold">{entry.title}</p>
                    </div>
                    <p class="font-semibold">{entry.authorName}</p>
                    <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                      {/*
                        Wins out of matches, not the Elo number. The rating is
                        how the ordering was computed, but "won 31 of 44" is
                        what actually means something to a person reading this.
                      */}
                      won {entry.wins} of {entry.matches} head-to-heads
                    </p>
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      class="btn-ghost inline-block"
                    >
                      Read the code
                    </a>
                  </div>
                </article>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </main>
  );
}
