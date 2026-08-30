import { A, createAsync } from "@solidjs/router";
import { ChevronLeft, ChevronRight, Gavel, RefreshCw, Timer, Trophy } from "lucide-solid";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { LoadingScreen } from "~/components/LoadingScreen";
import { POOKALAM } from "~/lib/event-content";
import { branchShort } from "~/lib/profile";
import { shell } from "~/lib/queries";
import { getArenaBoards } from "~/server/pookalam/actions";
import type { VoterStanding } from "~/server/pookalam/service";

type Boards = NonNullable<Awaited<ReturnType<typeof getArenaBoards>>>;

const MEDAL = ["var(--pop-yellow)", "var(--paper-3)", "var(--pop-red)"];
const PAGE_SIZE = 20;

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export interface PookalamBoardsProps {
  viewMode?: "main" | "tester";
}

export function PookalamBoards(props: PookalamBoardsProps = {}) {
  const s = createAsync(() => shell());
  const me = () => s()?.me ?? null;

  const [boards, setBoards] = createSignal<Boards | null>(null);
  const [loaded, setLoaded] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [tab, setTab] = createSignal<"pookalams" | "judges">("pookalams");
  const [judgePage, setJudgePage] = createSignal(1);

  const load = async () => {
    setBusy(true);
    try {
      const res = await getArenaBoards(props.viewMode ?? "main");
      if (res) {
        setBoards(res);
      }
    } catch {
      // Keep stale on failure
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  createEffect(() => {
    const _mode = props.viewMode ?? "main";
    void load();
  });

  // Voters calculations
  const allVoters = createMemo(() => boards()?.voters.rows ?? []);
  const topJudgeWinner = createMemo(() => {
    const list = allVoters();
    return list.find((v) => v.qualified) ?? list[0] ?? null;
  });

  const totalJudgePages = createMemo(() => Math.max(1, Math.ceil(allVoters().length / PAGE_SIZE)));
  const paginatedVoters = createMemo(() => {
    const start = (judgePage() - 1) * PAGE_SIZE;
    return allVoters().slice(start, start + PAGE_SIZE);
  });

  const myJudgeStanding = createMemo(() => {
    const myId = me()?.id;
    if (!myId) return null;
    return allVoters().find((v) => v.userId === myId) ?? null;
  });

  const isMyJudgeOnCurrentPage = createMemo(() => {
    const myId = me()?.id;
    if (!myId) return false;
    return paginatedVoters().some((v) => v.userId === myId);
  });

  return (
    <Show when={loaded()} fallback={<LoadingScreen compact message="Inking pookalam standings…" />}>
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
        <div class="space-y-4">
          <Show when={boards()!.votingOpen}>
            <div class="card card-plain pop-teal flex flex-wrap items-center justify-between gap-3 p-3">
              <p class="font-black text-sm m-0">The arena is live — every vote counts.</p>
              <A href="/code-a-pookalam/vote" class="btn-brand text-xs px-4 py-2">
                Go vote
              </A>
            </div>
          </Show>

          {/* Navigation Tabs + Refresh Button */}
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="inline-flex rounded-md border-2 border-[var(--ink)] p-0.5 bg-[var(--paper)]">
              <button
                type="button"
                onClick={() => setTab("pookalams")}
                class={`px-3 py-1 text-[11px] font-black rounded-[4px] cursor-pointer transition-colors ${
                  tab() === "pookalams"
                    ? "bg-[var(--pop-yellow)] text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                Pookalams
              </button>
              <button
                type="button"
                onClick={() => setTab("judges")}
                class={`px-3 py-1 text-[11px] font-black rounded-[4px] cursor-pointer transition-colors ${
                  tab() === "judges"
                    ? "bg-[var(--pop-teal)] text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                Best judges
              </button>
            </div>

            <button
              type="button"
              class="btn-ghost text-xs inline-flex items-center gap-1.5"
              disabled={busy()}
              onClick={() => void load()}
            >
              <RefreshCw size={13} strokeWidth={2.5} class={busy() ? "animate-spin" : ""} />
              <span>{busy() ? "Refreshing…" : "Refresh"}</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: POOKALAMS STANDINGS */}
          {/* ========================================================================= */}
          <Show when={tab() === "pookalams"}>
            <section class="space-y-3">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <Trophy size={18} />
                  <h2 class="rule m-0">
                    {boards()!.resultsPublic ? "Final standings" : "The pookalams"}
                  </h2>
                </div>
                <span class="badge text-[10px]" style={{ "--pop": "var(--paper-3)" }}>
                  <Timer size={11} class="inline mr-1" />
                  computed {clockTime(boards()!.entrants.computedAt)}
                </span>
              </div>

              <Show
                when={boards()!.resultsPublic && boards()!.results}
                fallback={
                  <Show
                    when={boards()!.entrants.rows.length > 0}
                    fallback={<p class="font-semibold text-sm">No entries shortlisted yet.</p>}
                  >
                    <p class="comment text-xs m-0">
                      live ranking. artworks stay hidden until voting closes — so you can see who
                      leads, not which one to vote for.
                    </p>

                    <div class="card card-plain p-0 overflow-hidden">
                      <div
                        class="bg-[var(--paper-2)] px-4 py-2.5 border-b-2 border-[var(--ink)] flex items-center justify-between text-xs font-extrabold uppercase tracking-wider"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        <span>Rank & Entrant</span>
                        <span class="text-right">Bradley-Terry Elo</span>
                      </div>

                      <div class="divide-y divide-[var(--ink-soft)]/20">
                        <For each={boards()!.entrants.rows}>
                          {(entrant) => (
                            <div class="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--paper-2)] transition-colors">
                              <div class="flex items-center gap-3 min-w-0">
                                <span
                                  class="w-7 h-7 sm:w-8 sm:h-8 rounded-full grid place-items-center font-black text-xs shrink-0 select-none border-2 border-[var(--ink)]"
                                  style={{
                                    background: MEDAL[entrant.rank - 1] ?? "var(--paper-3)",
                                  }}
                                >
                                  #{entrant.rank}
                                </span>

                                <Show
                                  when={entrant.avatarUrl}
                                  fallback={
                                    <SpriteIcon
                                      name="tux-king"
                                      size={36}
                                      class="shrink-0 select-none block"
                                      alt=""
                                    />
                                  }
                                >
                                  <img
                                    src={entrant.avatarUrl!}
                                    alt={entrant.name}
                                    class="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 select-none block"
                                    style={{ border: "2px solid var(--ink)" }}
                                  />
                                </Show>

                                <div class="min-w-0">
                                  <p class="font-black text-sm sm:text-base truncate m-0">
                                    {entrant.name}
                                  </p>
                                  <p
                                    class="text-xs font-semibold m-0 truncate"
                                    style={{ color: "var(--ink-soft)" }}
                                  >
                                    “{entrant.title}”
                                  </p>
                                </div>
                              </div>

                              <div class="shrink-0 text-right">
                                <p class="font-mono font-black tabular-nums m-0 text-base sm:text-lg">
                                  {entrant.rating}
                                </p>
                                <p class="text-[10px] font-extrabold uppercase tracking-wider m-0 text-muted">
                                  elo
                                </p>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                }
              >
                {/* Final Revealed Podium & Results */}
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
          </Show>

          {/* ========================================================================= */}
          {/* TAB 2: BEST JUDGES (VOTERS BOARD) */}
          {/* ========================================================================= */}
          <Show when={tab() === "judges"}>
            <section class="space-y-3">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <Gavel size={18} />
                  <h2 class="rule m-0">Best judges</h2>
                </div>
                <span class="badge text-[10px]" style={{ "--pop": "var(--paper-3)" }}>
                  <Timer size={11} class="inline mr-1" />
                  computed {clockTime(boards()!.voters.computedAt)}
                </span>
              </div>

              <p class="comment text-xs m-0">
                ranked by agreement with the final community consensus. A vote on a close pair
                barely moves your score; picking the consensus favorite earns accuracy points.
              </p>

              {/* Top #1 Judge Callout Winner Banner */}
              <Show when={topJudgeWinner()}>
                {(() => {
                  const winner = topJudgeWinner()!;
                  return (
                    <div class="relative overflow-hidden card card-plain p-4 bg-[var(--pop-yellow)] flex items-center justify-between gap-4">
                      <Confetti seed="judge-winner-callout" count={6} animate />
                      <div class="art-over flex items-center gap-3 min-w-0">
                        <Show
                          when={winner.avatarUrl}
                          fallback={
                            <SpriteIcon
                              name="tux-king"
                              size={36}
                              animate="wobble"
                              class="shrink-0 select-none block"
                            />
                          }
                        >
                          <img
                            src={winner.avatarUrl!}
                            alt={winner.name}
                            class="w-10 h-10 rounded-full object-cover shrink-0 select-none block"
                            style={{ border: "2px solid var(--ink)" }}
                          />
                        </Show>
                        <div class="min-w-0">
                          <div class="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
                            <Trophy size={12} strokeWidth={3} />
                            <span>Top Judge Leader · ₹200 Cash Prize</span>
                          </div>
                          <p class="font-black text-base sm:text-lg mt-1 truncate">{winner.name}</p>
                        </div>
                      </div>
                      <div class="art-over text-right font-mono font-black text-sm sm:text-base shrink-0">
                        <p class="m-0 text-base">{winner.accuracy}%</p>
                        <p class="m-0 text-[10px] text-muted uppercase tracking-wider">
                          {winner.votes} votes
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </Show>

              {/* JUDGES TABLE (CARD LIST MATCHING DAILY LEADERBOARD) */}
              <Show
                when={allVoters().length > 0}
                fallback={<p class="font-semibold text-sm">Nobody has voted yet.</p>}
              >
                <div class="card card-plain p-0 overflow-hidden">
                  <div
                    class="bg-[var(--paper-2)] px-4 py-2.5 border-b-2 border-[var(--ink)] flex items-center justify-between text-xs font-extrabold uppercase tracking-wider"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    <span>Rank & Judge</span>
                    <span class="text-right">Accuracy & Votes</span>
                  </div>

                  <div class="divide-y divide-[var(--ink-soft)]/20">
                    <For each={paginatedVoters()}>
                      {(entry: VoterStanding) => {
                        const isMe = () => entry.userId === me()?.id;
                        return (
                          <div
                            class={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
                              isMe() ? "bg-[var(--pop-yellow)]/60" : "hover:bg-[var(--paper-2)]"
                            }`}
                            style={{ opacity: entry.qualified ? 1 : 0.65 }}
                          >
                            <div class="flex items-center gap-3 min-w-0">
                              <span
                                class="w-7 h-7 sm:w-8 sm:h-8 rounded-full grid place-items-center font-black text-xs shrink-0 select-none border-2 border-[var(--ink)]"
                                style={{
                                  background: MEDAL[entry.rank - 1] ?? "var(--paper-3)",
                                }}
                              >
                                #{entry.rank}
                              </span>

                              <Show
                                when={entry.avatarUrl}
                                fallback={
                                  <SpriteIcon
                                    name="tux-king"
                                    size={36}
                                    class="shrink-0 select-none block"
                                    alt=""
                                  />
                                }
                              >
                                <img
                                  src={entry.avatarUrl!}
                                  alt={entry.name}
                                  class="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 select-none block"
                                  style={{ border: "2px solid var(--ink)" }}
                                />
                              </Show>

                              <div class="min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                  <span class="font-black text-sm sm:text-base truncate">
                                    {entry.name}
                                  </span>
                                  <Show when={isMe()}>
                                    <span class="badge text-[9px] py-0 px-1 font-bold bg-[var(--ink)] text-[var(--paper)]">
                                      YOU
                                    </span>
                                  </Show>
                                  <Show when={entry.isTester}>
                                    <span class="badge text-[9px] py-0 px-1 bg-[var(--pop-teal)] uppercase">
                                      Tester
                                    </span>
                                  </Show>
                                  <Show when={!entry.qualified}>
                                    <span
                                      class="badge text-[10px]"
                                      style={{ "--pop": "var(--paper-3)" }}
                                      title="Needs ~21 votes to qualify"
                                    >
                                      in progress
                                    </span>
                                  </Show>
                                </div>
                                <p
                                  class="text-xs font-semibold m-0 truncate"
                                  style={{ color: "var(--ink-soft)" }}
                                >
                                  {entry.college === "mec" ? "MEC" : entry.college || "Participant"}
                                  {entry.branch ? ` · ${branchShort(entry.branch)}` : ""}
                                  {entry.batch && entry.batch !== "na" ? ` '${entry.batch}` : ""}
                                </p>
                              </div>
                            </div>

                            <div class="shrink-0 text-right">
                              <p class="font-mono font-black tabular-nums m-0 text-sm sm:text-base">
                                {entry.accuracy}%
                              </p>
                              <p class="text-[10px] font-extrabold uppercase tracking-wider m-0 text-muted">
                                {entry.votes} {entry.votes === 1 ? "vote" : "votes"}
                              </p>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>

                  {/* Pagination Controls Footer */}
                  <div class="p-3 bg-[var(--paper-2)] border-t-2 border-[var(--ink)] flex items-center justify-between gap-2 text-xs font-bold">
                    <span class="text-muted text-[11px]">
                      Showing {(judgePage() - 1) * PAGE_SIZE + 1}–
                      {Math.min(judgePage() * PAGE_SIZE, allVoters().length)} of{" "}
                      {allVoters().length} judges
                    </span>

                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        class="btn-ghost text-xs px-2.5 py-1 disabled:opacity-35 cursor-pointer flex items-center gap-0.5"
                        disabled={judgePage() <= 1}
                        onClick={() => setJudgePage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={13} strokeWidth={2.5} />
                        <span>Prev</span>
                      </button>

                      <span class="px-2 py-0.5 rounded bg-[var(--paper)] border border-[var(--ink)] text-[11px] font-mono">
                        {judgePage()} / {totalJudgePages()}
                      </span>

                      <button
                        type="button"
                        class="btn-ghost text-xs px-2.5 py-1 disabled:opacity-35 cursor-pointer flex items-center gap-0.5"
                        disabled={judgePage() >= totalJudgePages()}
                        onClick={() => setJudgePage((p) => Math.min(totalJudgePages(), p + 1))}
                      >
                        <span>Next</span>
                        <ChevronRight size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pinned User Standing Bar if user is not on current page */}
                <Show when={myJudgeStanding() && !isMyJudgeOnCurrentPage()}>
                  <div class="card pop-yellow p-3.5 flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                      <SpriteIcon name="foss-mec-badge" size={24} />
                      <p class="font-extrabold text-sm m-0">
                        Your Rank: #{myJudgeStanding()!.rank} of {allVoters().length} judges
                      </p>
                    </div>
                    <p class="font-mono font-black text-sm m-0">
                      {myJudgeStanding()!.accuracy}% ({myJudgeStanding()!.votes} votes)
                    </p>
                  </div>
                </Show>
              </Show>
            </section>
          </Show>
        </div>
      </Show>
    </Show>
  );
}
