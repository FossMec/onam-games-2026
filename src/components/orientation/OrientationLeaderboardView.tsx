import { A } from "@solidjs/router";
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { Flower2, Gamepad2, RefreshCw, Sparkles, Trophy, Users } from "lucide-solid";
import {
  getOrientationConfig,
  getOrientationLeaderboardAction,
} from "~/server/orientation/actions";
import { ORIENTATION_BATCHES } from "~/lib/orientation";
import { formatAdaptiveDuration } from "~/lib/time";
import { Halftone } from "~/components/art/Burst";
import { SpriteIcon } from "~/components/art/SpriteIcon";

type BoardData = Awaited<ReturnType<typeof getOrientationLeaderboardAction>>;

export function OrientationLeaderboardView() {
  const [config, setConfig] = createSignal<Awaited<ReturnType<typeof getOrientationConfig>> | null>(
    null,
  );
  const [selectedBatch, setSelectedBatch] = createSignal<string>("CS A");
  const [board, setBoard] = createSignal<BoardData | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [initialized, setInitialized] = createSignal(false);

  // Load initial config
  const loadConfig = async () => {
    try {
      const cfg = await getOrientationConfig();
      setConfig(cfg);
      if (!initialized()) {
        const defaultBatch =
          cfg?.settings?.currentBatch &&
          ORIENTATION_BATCHES.includes(cfg.settings.currentBatch as any)
            ? cfg.settings.currentBatch
            : "CS A";
        setSelectedBatch(defaultBatch);
        setInitialized(true);
      }
    } catch {
      // best-effort
    }
  };

  const fetchBoard = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const b = await getOrientationLeaderboardAction(selectedBatch(), 1, 100);
      setBoard(b);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  onMount(() => {
    void loadConfig().then(() => fetchBoard());

    // Auto-poll leaderboard every 10 seconds for live projector/audience display
    const timer = setInterval(() => {
      void fetchBoard(true);
    }, 10_000);

    onCleanup(() => clearInterval(timer));
  });

  // When selectedBatch changes, fetch its board
  createEffect(() => {
    const b = selectedBatch();
    if (initialized() && b) {
      void fetchBoard(false);
    }
  });

  const gameCard = () => config()?.gameCard ?? null;
  const entries = () => board()?.entries ?? [];
  const metric = () => board()?.metric ?? "time";

  const formatScore = (entry: { durationMs: number | null; score: number | null }) => {
    if (metric() === "score") {
      return `${entry.score ?? 0} pts`;
    }
    return formatAdaptiveDuration(entry.durationMs ?? 0);
  };

  return (
    <main class="container space-y-5 py-4 sm:space-y-7 sm:py-6">
      {/* Page Header */}
      <div class="relative overflow-hidden rounded-xl sm:rounded-2xl border-2 border-[var(--ink)] bg-[var(--paper-2)] p-5 sm:p-6 text-center space-y-2">
        <Halftone opacity={0.06} class="absolute inset-0 pointer-events-none" />
        <div class="relative z-10 space-y-1">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--ink)] bg-[var(--pop-yellow)] text-xs font-black uppercase tracking-wider">
            <Trophy size={14} strokeWidth={2.5} />
            <span>Orientation Leaderboard</span>
          </div>
          <h1
            class="text-2xl sm:text-3xl font-black m-0 text-[var(--ink)] tracking-tight"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Class Standings
          </h1>
          <p
            class="text-xs sm:text-sm font-semibold max-w-lg mx-auto"
            style={{ color: "var(--ink-soft)" }}
          >
            Real-time rankings for the first-year orientation challenge. Every student gets one
            official attempt.
          </p>
          <Show when={gameCard()}>
            <div class="pt-1 flex items-center justify-center gap-2 text-xs font-black">
              <span class="opacity-70">Active Challenge:</span>
              <span class="underline decoration-2 underline-offset-2">{gameCard()!.title}</span>
            </div>
          </Show>
        </div>
      </div>

      {/* Batch Tabs (Selector) */}
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2 px-1">
          <span
            class="text-xs font-black uppercase tracking-wider"
            style={{ "font-family": "var(--font-stack-display)", color: "var(--ink-soft)" }}
          >
            Select Class
          </span>
          <button
            type="button"
            onClick={() => fetchBoard(true)}
            disabled={refreshing()}
            class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border border-[var(--ink)] bg-[var(--paper-2)] hover:bg-[var(--pop-yellow)] cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh leaderboard"
          >
            <RefreshCw size={12} strokeWidth={2.5} class={refreshing() ? "animate-spin" : ""} />
            <span>{refreshing() ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>

        {/* 10 Class Pills */}
        <div class="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none">
          <For each={ORIENTATION_BATCHES}>
            {(batchName) => {
              const isSelected = () => selectedBatch() === batchName;
              return (
                <button
                  type="button"
                  onClick={() => setSelectedBatch(batchName)}
                  class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black border-2 border-[var(--ink)] transition-all cursor-pointer select-none"
                  style={{
                    "font-family": "var(--font-stack-display)",
                    background: isSelected() ? "var(--pop-teal)" : "var(--paper-2)",
                    color: isSelected() ? "var(--ink)" : "var(--ink)",
                    transform: isSelected() ? "translateY(-1px)" : "none",
                  }}
                >
                  {batchName}
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <div class="card card-plain p-4 sm:p-5 border-2 border-[var(--ink)] space-y-4">
        <div class="flex items-center justify-between gap-3 border-b-2 border-[var(--ink)] pb-3">
          <div class="flex items-center gap-2">
            <Users size={18} strokeWidth={2.5} />
            <h2 class="text-base sm:text-lg font-black m-0">{selectedBatch()} Class Board</h2>
          </div>
          <span class="badge text-[11px] font-black bg-[var(--paper-2)] border border-[var(--ink)]">
            {entries().length} {entries().length === 1 ? "player" : "players"}
          </span>
        </div>

        {/* Loading State */}
        <Show when={loading()}>
          <div class="py-12 text-center space-y-2">
            <RefreshCw
              size={24}
              strokeWidth={2.5}
              class="animate-spin mx-auto text-[var(--ink-soft)]"
            />
            <p class="text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
              Loading standings for {selectedBatch()}...
            </p>
          </div>
        </Show>

        {/* Empty State */}
        <Show when={!loading() && entries().length === 0}>
          <div class="py-12 text-center space-y-3 bg-[var(--paper-2)] rounded-xl border border-[var(--ink-soft)]/30 p-6">
            <SpriteIcon
              name="maveli-laptop"
              size={48}
              animate="wobble"
              interactive
              class="mx-auto"
            />
            <p class="font-black text-sm text-[var(--ink)]">
              No runs recorded for {selectedBatch()} yet
            </p>
            <p class="text-xs font-semibold max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
              The board is waiting for the first contender from {selectedBatch()} to claim the
              crown.
            </p>
            <A
              href="/orientation"
              class="inline-flex items-center gap-1.5 btn-brand px-4 py-2 text-xs font-black rounded-lg cursor-pointer"
            >
              <Gamepad2 size={14} strokeWidth={2.5} />
              <span>Take the Challenge</span>
            </A>
          </div>
        </Show>

        {/* Standings List */}
        <Show when={!loading() && entries().length > 0}>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr
                  class="border-b-2 border-[var(--ink)] text-[11px] font-black uppercase tracking-wider"
                  style={{ color: "var(--ink-soft)" }}
                >
                  <th class="py-2.5 px-3 w-14 text-center">Rank</th>
                  <th class="py-2.5 px-3">Player</th>
                  <th class="py-2.5 px-3 w-24">Class</th>
                  <th class="py-2.5 px-3 text-right w-28">
                    {metric() === "score" ? "Score" : "Duration"}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--ink-soft)]/20 text-xs sm:text-sm font-semibold">
                <For each={entries()}>
                  {(entry) => {
                    const isTop1 = entry.rank === 1;
                    const isTop2 = entry.rank === 2;
                    const isTop3 = entry.rank === 3;
                    const isPodium = isTop1 || isTop2 || isTop3;

                    return (
                      <tr
                        class={`transition-colors ${
                          entry.isMe
                            ? "bg-[var(--pop-yellow)]/30 font-bold border-l-4 border-l-[var(--pop-yellow)]"
                            : isPodium
                              ? "bg-[var(--paper-2)]/50"
                              : "hover:bg-[var(--paper-2)]/30"
                        }`}
                      >
                        {/* Rank */}
                        <td class="py-3 px-3 text-center font-black">
                          <span
                            class={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-black border ${
                              isTop1
                                ? "bg-[var(--pop-yellow)] border-[var(--ink)] text-[var(--ink)]"
                                : isTop2
                                  ? "bg-[var(--pop-teal)] border-[var(--ink)] text-[var(--ink)]"
                                  : isTop3
                                    ? "bg-[var(--pop-pink)] border-[var(--ink)] text-white"
                                    : "bg-[var(--paper-2)] border-transparent"
                            }`}
                          >
                            {entry.rank}
                          </span>
                        </td>

                        {/* Name */}
                        <td class="py-3 px-3">
                          <div class="flex items-center gap-2">
                            <span class="font-extrabold text-[var(--ink)] truncate max-w-[200px] sm:max-w-xs">
                              {entry.name}
                            </span>
                            <Show when={entry.isMe}>
                              <span class="badge text-[9px] font-black bg-[var(--pop-yellow)] border border-[var(--ink)]">
                                YOU
                              </span>
                            </Show>
                          </div>
                        </td>

                        {/* Class */}
                        <td
                          class="py-3 px-3 font-mono font-bold text-xs"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          {entry.batch}
                        </td>

                        {/* Metric (Score / Duration) */}
                        <td class="py-3 px-3 text-right font-mono font-black text-[var(--ink)]">
                          {formatScore(entry)}
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

      {/* Community Pookalam Invitation Card */}
      <div
        class="relative overflow-hidden rounded-xl border-2 border-[var(--ink)] p-5 sm:p-6 text-center space-y-3"
        style={{ background: "var(--pop-blue)" }}
      >
        <Halftone opacity={0.08} class="absolute inset-0 pointer-events-none" />
        <div class="relative z-10 space-y-2 max-w-xl mx-auto">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--ink)] bg-[var(--paper)] text-xs font-black">
            <Flower2 size={14} strokeWidth={2.5} class="text-[var(--pop-pink)]" />
            <span>Community Collaboration</span>
          </div>
          <h3
            class="text-xl sm:text-2xl font-black m-0 tracking-tight text-[var(--ink)]"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Create a Pookalam with the FOSS Community
          </h3>
          <p class="text-xs sm:text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Open source is all about building together. Drop your flower petals onto our massive
            live collaborative canvas alongside fellow students and seniors!
          </p>
          <div class="pt-1 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/#community-pookalam"
              class="btn-brand px-5 py-2.5 text-xs sm:text-sm font-black rounded-lg cursor-pointer inline-flex items-center gap-2"
            >
              <Sparkles size={14} strokeWidth={2.5} />
              <span>Join Community Pookalam</span>
            </a>
            <A
              href="/orientation"
              class="btn-ghost px-5 py-2.5 text-xs sm:text-sm font-black rounded-lg cursor-pointer inline-flex items-center gap-2 bg-[var(--paper)] border-2 border-[var(--ink)]"
            >
              <Gamepad2 size={14} strokeWidth={2.5} />
              <span>Back to Challenge</span>
            </A>
          </div>
        </div>
      </div>
    </main>
  );
}
