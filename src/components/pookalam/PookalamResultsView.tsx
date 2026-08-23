import { Link, Meta, Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { Crown, Gavel } from "lucide-solid";
import { For, Show } from "solid-js";
import { Bubble } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { POOKALAM } from "~/lib/event-content";
import { pookalamResults } from "~/lib/queries";
import { SITE_URL } from "~/lib/site";

/**
 * Final standings, and the only place a pookalam is ever shown next to its
 * author's name. Everything before this point is anonymous on purpose.
 *
 * Hidden until the results phase opens; admins always see it, which is how you
 * check a contest before announcing it.
 *
 * The winner gets the whole top of the page rather than being row one of a
 * table. Somebody spent a week on that and beat the field in a public vote -
 * the layout should say so.
 */

const MEDAL = ["var(--pop-yellow)", "var(--paper-3)", "var(--pop-red)"];
const PLACE = ["Winner", "Runner-up", "Third"];

export function PookalamResultsView() {
  const data = createAsync(() => pookalamResults());
  const winner = () => data()?.results[0] ?? null;
  const rest = () => data()?.results.slice(1) ?? [];

  return (
    <main class="container space-y-8 py-6">
      <Title>Results - {POOKALAM.title}</Title>
      <Meta
        name="description"
        content={`Final winners and standings for ${POOKALAM.title} at Onam Games by FOSSMEC.`}
      />
      <Meta property="og:title" content={`Results - ${POOKALAM.title}`} />
      <Meta
        property="og:description"
        content={`Final winners and standings for ${POOKALAM.title} at Onam Games by FOSSMEC.`}
      />
      <Meta property="og:url" content={`${SITE_URL}/code-a-pookalam/results`} />
      <Meta property="og:image" content={`${SITE_URL}/images/code-a-pookalam-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta name="twitter:title" content={`Results - ${POOKALAM.title}`} />
      <Meta
        name="twitter:description"
        content={`Final winners and standings for ${POOKALAM.title} at Onam Games by FOSSMEC.`}
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/code-a-pookalam-og.webp`} />
      <Link rel="canonical" href={`${SITE_URL}/code-a-pookalam/results`} />

      <a
        href="/code-a-pookalam"
        class="inline-block text-sm font-extrabold underline decoration-2 underline-offset-4"
      >
        ← Back
      </a>

      <Show
        when={data()}
        fallback={
          <>
            <section
              class="relative overflow-hidden rounded-lg p-6 text-center"
              style={{
                border: "var(--ink-w-bold) solid var(--ink)",
                background: "var(--pop-yellow)",
              }}
            >
              <Confetti seed="pookalam-results" count={14} animate />
              <div class="art-over space-y-2">
                <h1>The pookalams</h1>
                <p class="font-extrabold">Ranked by every head-to-head you all voted on.</p>
              </div>
            </section>
            <Bubble color="var(--paper-3)">
              <p class="font-semibold">
                Results aren't out yet. They go up once voting closes on {POOKALAM.votingOn}.
              </p>
            </Bubble>
          </>
        }
      >
        <Show
          when={winner()}
          fallback={<p class="font-semibold">No entries made it through to the vote.</p>}
        >
          {/* ------------------------------------------------------- winner */}
          <section
            class="relative overflow-hidden rounded-lg p-5 sm:p-8"
            style={{
              border: "var(--ink-w-bold) solid var(--ink)",
              background: "var(--pop-yellow)",
            }}
          >
            <Confetti seed="pookalam-winner" count={16} animate />
            <div class="art-over space-y-4">
              <div class="flex items-center justify-center gap-2">
                <SpriteIcon name="tux-king" size={30} animate="wobble" interactive />
                <p
                  class="wordmark m-0"
                  data-text="CHAMPION"
                  style={{ "font-size": "clamp(1.3rem, 5vw, 2.4rem)" }}
                >
                  CHAMPION
                </p>
                <SpriteIcon name="concentric-pookalam" size={30} animate="float" interactive />
              </div>

              <div class="flex flex-col sm:flex-row items-center gap-5 max-w-3xl mx-auto">
                <img
                  src={winner()!.imageUrl}
                  alt={winner()!.title}
                  class="w-full sm:w-64 shrink-0"
                  style={{
                    "aspect-ratio": "1 / 1",
                    "object-fit": "contain",
                    background: "var(--paper-2)",
                    border: "var(--ink-w-bold) solid var(--ink)",
                    "border-radius": "var(--radius)",
                  }}
                />
                <div class="space-y-2 text-center sm:text-left">
                  <p class="text-2xl sm:text-3xl font-black m-0">{winner()!.title}</p>
                  <p class="text-lg font-extrabold m-0 inline-flex items-center gap-2">
                    <Crown size={18} />
                    {winner()!.authorName}
                  </p>
                  <p class="text-sm font-semibold m-0">
                    won {winner()!.wins} of {winner()!.matches} head-to-heads · {winner()!.rating}{" "}
                    Elo
                  </p>
                  <Show when={winner()!.notes}>
                    <p class="text-sm font-semibold m-0" style={{ opacity: 0.85 }}>
                      {winner()!.notes}
                    </p>
                  </Show>
                  <a
                    href={winner()!.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    class="btn-brand inline-block"
                  >
                    Read the code
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- the field */}
          <Show when={rest().length > 0}>
            <section class="space-y-4">
              <h2 class="rule">The rest of the field</h2>
              <For each={rest()}>
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
                          <Show when={PLACE[entry.rank - 1]}> · {PLACE[entry.rank - 1]}</Show>
                        </span>
                        <p class="text-lg font-extrabold m-0">{entry.title}</p>
                      </div>
                      <p class="font-semibold m-0">{entry.authorName}</p>
                      <p class="text-sm font-semibold m-0" style={{ color: "var(--ink-soft)" }}>
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
            </section>
          </Show>

          {/* --------------------------------------------------- the voters */}
          <Show when={data()!.voters.rows.length > 0}>
            <section class="space-y-3">
              <div class="flex items-center gap-2">
                <Gavel size={20} />
                <h2 class="rule m-0">Best judges</h2>
              </div>
              <p class="comment">
                whose calls matched where the crowd landed. weighted, so nobody wins this by tapping
                fast.
              </p>
              <div class="card card-plain overflow-x-auto">
                <table class="w-full text-sm" style={{ "border-collapse": "collapse" }}>
                  <thead>
                    <tr class="text-left">
                      <th class="p-2 font-black">#</th>
                      <th class="p-2 font-black">Voter</th>
                      <th class="p-2 font-black text-right">Called right</th>
                      <th class="p-2 font-black text-right">Votes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={data()!.voters.rows}>
                      {(row) => (
                        <tr
                          style={{
                            "border-top": "2px solid var(--ink)",
                            opacity: row.qualified ? 1 : 0.55,
                          }}
                        >
                          <td class="p-2 font-extrabold tabular-nums">{row.rank}</td>
                          <td class="p-2">
                            <span class="inline-flex items-center gap-2">
                              <Show when={row.avatarUrl}>
                                <img
                                  src={row.avatarUrl!}
                                  alt=""
                                  class="w-6 h-6 rounded-full"
                                  style={{ border: "2px solid var(--ink)" }}
                                />
                              </Show>
                              <span class="font-bold">{row.name}</span>
                              <Show when={!row.qualified}>
                                <span
                                  class="badge text-[10px]"
                                  style={{ "--pop": "var(--paper-3)" }}
                                >
                                  not qualified
                                </span>
                              </Show>
                            </span>
                          </td>
                          <td class="p-2 text-right font-extrabold tabular-nums">
                            {row.accuracy}%
                          </td>
                          <td class="p-2 text-right tabular-nums">{row.votes}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </section>
          </Show>
        </Show>
      </Show>
    </main>
  );
}
