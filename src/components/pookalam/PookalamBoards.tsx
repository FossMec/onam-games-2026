import { Gavel, RefreshCw, Timer, Trophy } from "lucide-solid";
import { For, Show, createSignal, onMount } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { POOKALAM } from "~/lib/event-content";
import { getArenaBoards } from "~/server/pookalam/actions";

/**
 * Day 7's boards, rendered inside the normal leaderboard.
 *
 *   in the running   who entered — names only, no ratings, no order
 *   the voters       who judged well, which is not who judged most
 *
 * This lives in the day-7 slot of `/leaderboard` rather than on a page of its
 * own. Day 7 is a day of the festival like any other, and a separate URL split
 * "the leaderboard" into two things a player had to know to go and look for.
 *
 * THE RANKING IS LIVE; THE ARTWORK IS NOT
 *
 * Ranks, Elo and names are all public during voting. The artwork is not, and
 * that single omission is what keeps the round honest: the bandwagon to avoid
 * is a voter recognising one of the two pictures in front of them as the
 * current leader, and that needs a rank-to-image mapping. Without the images
 * there is nothing to match against, so "someone leads on 1340" is interesting
 * to read and useless to vote on.
 *
 * The trade, stated plainly: rank is tied to a person, so anyone who already
 * knows whose pookalam is whose can vote them up. Narrower than publishing the
 * images, and the price of having a live board at all.
 *
 * The voters' board is safe to show live — it says nothing about which pookalam
 * is winning — but it is still served from the lagged cache because it is an
 * aggregate over every vote ever cast and day 7 is the day everyone refreshes.
 *
 * REFRESHED BY HAND, NOT ON A TIMER
 *
 * This is a leaderboard, not a ticker. A background poll on day 7 means every
 * open tab hammers an aggregate query all day for numbers nobody is watching
 * change second to second — so the button is the refresh, and the timestamp
 * says plainly how old what you are reading is.
 */

type Boards = NonNullable<Awaited<ReturnType<typeof getArenaBoards>>>;

const MEDAL = ["var(--pop-yellow)", "var(--paper-3)", "var(--pop-red)"];

/**
 * Absolute clock time, not "3m ago".
 *
 * Nothing re-renders this between refreshes, and a frozen "12s ago" would be a
 * lie the moment you looked away. "computed 19:04" stays true forever.
 */
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function PookalamBoards() {
  const [boards, setBoards] = createSignal<Boards | null>(null);
  const [loaded, setLoaded] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  const load = async () => {
    setBusy(true);
    try {
      setBoards(await getArenaBoards());
    } catch {
      // A failed refresh keeps the last good board on screen. Blanking a
      // leaderboard because one fetch timed out is worse than showing it stale.
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  onMount(() => void load());

  return (
    <Show when={loaded()} fallback={<p class="font-semibold">Loading…</p>}>
      <Show
        when={boards()}
        fallback={
          <div class="card card-plain pop-yellow text-center p-8 space-y-2">
            <SpriteIcon name="concentric-pookalam" size={44} animate="float" class="mx-auto" />
            <p class="font-black text-lg">The pookalam arena hasn't opened yet.</p>
            <p class="comment text-xs">voting runs on {POOKALAM.votingOn.toLowerCase()}.</p>
          </div>
        }
      >
        <div class="space-y-5">
          <Show when={boards()!.votingOpen}>
            <div class="card card-plain pop-teal flex flex-wrap items-center justify-between gap-3 p-3">
              <p class="font-black text-sm m-0">The arena is live — every vote counts.</p>
              <a href="/code-a-pookalam/vote" class="btn-brand text-xs px-4 py-2">
                Go vote
              </a>
            </div>
          </Show>

          <div class="flex justify-end">
            <button
              type="button"
              class="btn-ghost text-xs inline-flex items-center gap-1.5"
              disabled={busy()}
              onClick={() => void load()}
            >
              <RefreshCw size={13} strokeWidth={2.5} />
              <span>{busy() ? "Refreshing…" : "Refresh"}</span>
            </button>
          </div>

          {/* ------------------------------- in the running / final ranking */}
          <section class="space-y-2.5">
            <div class="flex items-center gap-2">
              <Trophy size={18} />
              <h2 class="rule m-0">
                {boards()!.resultsPublic ? "Final standings" : "The pookalams"}
              </h2>
            </div>

            <Show
              when={boards()!.resultsPublic && boards()!.results}
              fallback={
                /*
                  Ranked, with Elo — but no artwork. Reading "#1, 1340" tells
                  you nothing about which of the two pookalams on the voting
                  page is theirs, which is the mapping the bandwagon needs.
                */
                <Show
                  when={boards()!.entrants.rows.length > 0}
                  fallback={<p class="font-semibold text-sm">No entries shortlisted yet.</p>}
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="comment text-xs m-0">
                      live ranking. the pookalams stay hidden until voting closes — so you can see
                      who leads, not which one to vote for.
                    </p>
                    <span class="badge text-[10px]" style={{ "--pop": "var(--paper-3)" }}>
                      <Timer size={11} class="inline mr-1" />
                      computed {clockTime(boards()!.entrants.computedAt)}
                    </span>
                  </div>

                  <div class="space-y-2">
                    <For each={boards()!.entrants.rows}>
                      {(entrant) => (
                        <article
                          class="card flex items-center gap-3 p-2.5"
                          style={{ "--pop": MEDAL[entrant.rank - 1] ?? "var(--pop-blue)" }}
                        >
                          <span
                            class="badge shrink-0"
                            style={{ "--pop": MEDAL[entrant.rank - 1] ?? "var(--paper-3)" }}
                          >
                            #{entrant.rank}
                          </span>

                          <Show
                            when={entrant.avatarUrl}
                            fallback={
                              <SpriteIcon name="tux-king" size={36} class="shrink-0" alt="" />
                            }
                          >
                            <img
                              src={entrant.avatarUrl!}
                              alt=""
                              class="w-9 h-9 rounded-full object-cover shrink-0"
                              style={{ border: "2px solid var(--ink)" }}
                            />
                          </Show>

                          <div class="min-w-0 flex-1">
                            <p class="font-black truncate m-0 text-sm">{entrant.name}</p>
                            <p
                              class="text-[11px] font-semibold m-0 truncate"
                              style={{ color: "var(--ink-soft)" }}
                            >
                              “{entrant.title}”
                            </p>
                          </div>

                          {/*
                            The rating and nothing else. A win count next to it
                            invites arithmetic about who has been shown more,
                            which is noise — the pairing deliberately gives
                            under-exposed entries more matches, so a low total
                            means "seen less", not "doing worse".
                          */}
                          <div class="shrink-0 text-right">
                            <p class="font-mono font-black tabular-nums m-0 text-base">
                              {entrant.rating}
                            </p>
                            <p
                              class="text-[10px] font-extrabold uppercase tracking-wider m-0"
                              style={{ color: "var(--ink-soft)" }}
                            >
                              elo
                            </p>
                          </div>
                        </article>
                      )}
                    </For>
                  </div>
                </Show>
              }
            >
              <div class="grid gap-2.5 sm:grid-cols-2">
                <For each={boards()!.results!}>
                  {(row) => (
                    <article
                      class="card flex items-center gap-3 p-2.5"
                      style={{ "--pop": MEDAL[row.rank - 1] ?? "var(--pop-blue)" }}
                    >
                      <span
                        class="badge shrink-0"
                        style={{ "--pop": MEDAL[row.rank - 1] ?? "var(--paper-3)" }}
                      >
                        #{row.rank}
                      </span>
                      <img
                        src={row.imageUrl}
                        alt=""
                        loading="lazy"
                        class="w-14 shrink-0"
                        style={{
                          "aspect-ratio": "1 / 1",
                          "object-fit": "contain",
                          background: "var(--paper-2)",
                          border: "var(--ink-w) solid var(--ink)",
                          "border-radius": "var(--radius)",
                        }}
                      />
                      <div class="min-w-0">
                        <p class="font-extrabold truncate m-0 text-sm">{row.title}</p>
                        <p class="text-[11px] font-bold m-0 truncate">{row.authorName}</p>
                        <p
                          class="text-[11px] font-semibold m-0 tabular-nums"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          won {row.wins} of {row.matches}
                        </p>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </section>

          {/* ------------------------------------------------------- voters */}
          <section class="space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Gavel size={18} />
                <h2 class="rule m-0">Best judges</h2>
              </div>
              <span class="badge text-[10px]" style={{ "--pop": "var(--paper-3)" }}>
                <Timer size={11} class="inline mr-1" />
                computed {clockTime(boards()!.voters.computedAt)}
              </span>
            </div>

            <p class="comment text-xs">
              ranked by how well you called it, not how much you tapped. a vote on a close pair
              barely counts either way; missing an obvious one costs you.
            </p>

            <Show
              when={boards()!.voters.rows.length > 0}
              fallback={<p class="font-semibold text-sm">Nobody has voted yet.</p>}
            >
              <div class="card card-plain overflow-x-auto p-0">
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
                    <For each={boards()!.voters.rows}>
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
                                  class="w-6 h-6 rounded-full object-cover"
                                  style={{ border: "2px solid var(--ink)" }}
                                />
                              </Show>
                              <span class="font-bold">{row.name}</span>
                              <Show when={!row.qualified}>
                                <span
                                  class="badge text-[10px]"
                                  style={{ "--pop": "var(--paper-3)" }}
                                  title="Hasn't judged enough pairs to qualify yet"
                                >
                                  in progress
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
            </Show>
          </section>
        </div>
      </Show>
    </Show>
  );
}
