import { Compass, CheckCircle2, HelpCircle, Trophy, User, Search, Key, Clock } from "lucide-solid";
import { For, Show, createSignal, createMemo } from "solid-js";
import type { AdminHuntOverview } from "~/server/admin/service";

interface HuntTabProps {
  data: AdminHuntOverview | null;
}

export function HuntTab(props: HuntTabProps) {
  const [search, setSearch] = createSignal("");
  const [filterQuestion, setFilterQuestion] = createSignal<string>("all");
  const [filterStatus, setFilterStatus] = createSignal<"all" | "in-progress" | "completed">("all");

  const questions = () => props.data?.questions ?? [];
  const players = () => props.data?.players ?? [];

  const filteredPlayers = createMemo(() => {
    const q = search().toLowerCase().trim();
    const fQ = filterQuestion();
    const fS = filterStatus();

    return players().filter((p) => {
      // Search filter
      if (q) {
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesEmail = p.email?.toLowerCase().includes(q);
        const matchesCollege = p.college?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesCollege) return false;
      }

      // Status filter
      if (fS === "completed" && !p.completed) return false;
      if (fS === "in-progress" && p.completed) return false;

      // Question filter
      if (fQ !== "all") {
        if (fQ === "completed") {
          if (!p.completed) return false;
        } else if (p.currentQuestionId !== fQ) {
          return false;
        }
      }

      return true;
    });
  });

  const difficultyColor = (diff: string) => {
    switch (diff) {
      case "first":
        return "bg-[var(--pop-teal)] text-[var(--ink)]";
      case "easy":
        return "bg-[var(--pop-yellow)] text-[var(--ink)]";
      case "medium":
        return "bg-[var(--pop-pink)] text-[var(--ink)]";
      case "hard":
        return "bg-[var(--pop-red)] text-[var(--paper)]";
      default:
        return "bg-[var(--paper-3)] text-[var(--ink)]";
    }
  };

  return (
    <div class="space-y-6">
      {/* ---------------------------------------------------- METRIC CARDS */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Explorers */}
        <div class="card p-4 bg-[var(--paper-2)] border-2 border-[var(--ink)] flex items-center justify-between">
          <div>
            <span class="text-[10px] font-black uppercase text-[var(--ink-soft)] tracking-wider block">
              Total Explorers
            </span>
            <span class="text-2xl font-black text-[var(--ink)] tabular-nums">
              {props.data?.totalParticipants ?? 0}
            </span>
          </div>
          <div class="w-10 h-10 rounded-lg bg-[var(--pop-yellow)] border-2 border-[var(--ink)] grid place-items-center">
            <Compass size={20} class="text-[var(--ink)]" />
          </div>
        </div>

        {/* In Progress */}
        <div class="card p-4 bg-[var(--paper-2)] border-2 border-[var(--ink)] flex items-center justify-between">
          <div>
            <span class="text-[10px] font-black uppercase text-[var(--ink-soft)] tracking-wider block">
              Currently Hunting
            </span>
            <span class="text-2xl font-black text-[var(--pop-purple)] tabular-nums">
              {props.data?.inProgressCount ?? 0}
            </span>
          </div>
          <div class="w-10 h-10 rounded-lg bg-[var(--pop-purple)]/20 border-2 border-[var(--ink)] grid place-items-center">
            <HelpCircle size={20} class="text-[var(--pop-purple)]" />
          </div>
        </div>

        {/* Finished / Completed */}
        <div class="card p-4 bg-[var(--paper-2)] border-2 border-[var(--ink)] flex items-center justify-between">
          <div>
            <span class="text-[10px] font-black uppercase text-[var(--ink-soft)] tracking-wider block">
              Completed 10/10
            </span>
            <span class="text-2xl font-black text-[var(--pop-teal)] tabular-nums">
              {props.data?.completedCount ?? 0}
            </span>
          </div>
          <div class="w-10 h-10 rounded-lg bg-[var(--pop-teal)] border-2 border-[var(--ink)] grid place-items-center">
            <Trophy size={20} class="text-[var(--ink)]" />
          </div>
        </div>

        {/* Total Questions */}
        <div class="card p-4 bg-[var(--paper-2)] border-2 border-[var(--ink)] flex items-center justify-between">
          <div>
            <span class="text-[10px] font-black uppercase text-[var(--ink-soft)] tracking-wider block">
              Active Questions
            </span>
            <span class="text-2xl font-black text-[var(--ink)] tabular-nums">
              {questions().length}
            </span>
          </div>
          <div class="w-10 h-10 rounded-lg bg-[var(--pop-pink)] border-2 border-[var(--ink)] grid place-items-center">
            <Key size={20} class="text-[var(--ink)]" />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- QUESTION DIVISION & BOTTLENECK ANALYSIS */}
      <div class="card p-5 bg-[var(--paper-2)] border-2 border-[var(--ink)] space-y-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-base sm:text-lg font-black text-[var(--ink)] m-0 flex items-center gap-2">
              <Compass size={18} strokeWidth={2.5} class="text-[var(--pop-pink)]" />
              <span>Treasure Hunt Clues & Player Bottlenecks</span>
            </h2>
            <p class="text-xs font-semibold text-[var(--ink-soft)] mt-0.5">
              Live distribution of players stuck on each question. Use this to gauge difficulty and
              post timely community hints.
            </p>
          </div>
          <span class="badge text-xs px-2.5 py-1 bg-[var(--pop-yellow)] font-black uppercase">
            {questions().length} Relic Nodes
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <For each={questions()}>
            {(q, idx) => {
              const total = props.data?.totalParticipants || 1;
              const stuckPct = Math.round((q.stuckPlayersCount / total) * 100);
              const isBottleneck =
                q.stuckPlayersCount > 0 && q.stuckPlayersCount >= Math.ceil(total * 0.2);

              return (
                <div
                  class={`p-3.5 rounded-lg border-2 transition-all ${
                    isBottleneck
                      ? "bg-[var(--pop-yellow)]/25 border-[var(--ink)] shadow-xs"
                      : "bg-[var(--paper)] border-[var(--ink)]"
                  }`}
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-6 h-6 rounded-full bg-[var(--ink)] text-[var(--paper)] text-xs font-black grid place-items-center shrink-0">
                        {idx() + 1}
                      </span>
                      <span class="font-extrabold text-xs sm:text-sm text-[var(--ink)] truncate">
                        {q.title}
                      </span>
                    </div>
                    <span
                      class={`badge text-[9px] uppercase font-black px-1.5 py-0.5 shrink-0 ${difficultyColor(q.difficulty)}`}
                    >
                      {q.difficulty}
                    </span>
                  </div>

                  {/* Hint HTML preview */}
                  <div class="mt-2 text-xs font-mono bg-[var(--paper-2)] p-2 rounded border border-[var(--ink-soft)]/30 text-[var(--ink)] break-all max-h-16 overflow-y-auto">
                    <span class="font-bold text-[10px] uppercase text-[var(--ink-soft)] block">
                      Hint Preview:
                    </span>
                    <div innerHTML={q.hintHtml} class="prose prose-xs max-w-none" />
                  </div>

                  {/* Token & Stats Bar */}
                  <div class="mt-2.5 flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-black uppercase text-[var(--ink-soft)]">
                        Secret Token:
                      </span>
                      <code class="px-1.5 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--ink-soft)]/40 font-mono font-bold text-[var(--pop-pink)]">
                        {q.answer}
                      </code>
                    </div>

                    <div class="flex items-center gap-2 font-black tabular-nums">
                      <span
                        class={`px-2 py-0.5 rounded border text-[11px] ${
                          q.stuckPlayersCount > 0
                            ? "bg-[var(--pop-pink)] text-[var(--ink)] border-[var(--ink)] font-black"
                            : "bg-[var(--paper-3)] text-[var(--ink-soft)] border-transparent"
                        }`}
                        title={`${q.stuckPlayersCount} player(s) currently stuck on this clue`}
                      >
                        {q.stuckPlayersCount} stuck ({stuckPct}%)
                      </span>
                      <span class="text-[11px] text-[var(--ink-soft)]">
                        {q.solvedPlayersCount} passed
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* ---------------------------------------------------- LIVE PLAYERS LIST */}
      <div class="card p-5 bg-[var(--paper-2)] border-2 border-[var(--ink)] space-y-4">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-base sm:text-lg font-black text-[var(--ink)] m-0 flex items-center gap-2">
              <User size={18} strokeWidth={2.5} class="text-[var(--pop-teal)]" />
              <span>Explorer Division & Live Positions</span>
            </h2>
            <p class="text-xs font-semibold text-[var(--ink-soft)] mt-0.5">
              Individual player tracker showing each user's current clue position and progress.
            </p>
          </div>

          {/* Search and Filters */}
          <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Search Input */}
            <div class="relative flex-1 sm:w-56">
              <Search
                size={14}
                class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
              />
              <input
                type="text"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder="Search player, email..."
                class="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--paper)] border-2 border-[var(--ink)] rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--pop-yellow)]"
              />
            </div>

            {/* Filter by Question */}
            <select
              value={filterQuestion()}
              onChange={(e) => setFilterQuestion(e.currentTarget.value)}
              class="px-2.5 py-1.5 text-xs bg-[var(--paper)] border-2 border-[var(--ink)] rounded-md font-bold text-[var(--ink)] cursor-pointer"
            >
              <option value="all">All Questions</option>
              <option value="completed">Completed (10/10)</option>
              <For each={questions()}>
                {(q, i) => (
                  <option value={q.id}>
                    Q{i() + 1}: {q.title.slice(0, 20)} ({q.stuckPlayersCount} stuck)
                  </option>
                )}
              </For>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus()}
              onChange={(e) => setFilterStatus(e.currentTarget.value as any)}
              class="px-2.5 py-1.5 text-xs bg-[var(--paper)] border-2 border-[var(--ink)] rounded-md font-bold text-[var(--ink)] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Players Table */}
        <div class="overflow-x-auto rounded-lg border-2 border-[var(--ink)]">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-[var(--paper-3)] border-b-2 border-[var(--ink)] text-[10px] font-black uppercase text-[var(--ink-soft)]">
                <th class="p-3">Player</th>
                <th class="p-3">College / Batch</th>
                <th class="p-3 text-center">Relics Found</th>
                <th class="p-3">Current Clue Node</th>
                <th class="p-3 text-right">Status / Completed</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--ink-soft)]/20 bg-[var(--paper)]">
              <Show
                when={filteredPlayers().length > 0}
                fallback={
                  <tr>
                    <td
                      colspan={5}
                      class="p-6 text-center text-xs font-bold text-[var(--ink-soft)]"
                    >
                      No treasure hunt players match your search/filter.
                    </td>
                  </tr>
                }
              >
                <For each={filteredPlayers()}>
                  {(player) => (
                    <tr class="hover:bg-[var(--paper-2)] transition-colors">
                      {/* Player Info */}
                      <td class="p-3">
                        <div class="flex items-center gap-2.5">
                          <Show
                            when={player.avatarUrl}
                            fallback={
                              <div class="w-7 h-7 rounded-full bg-[var(--pop-yellow)] border border-[var(--ink)] grid place-items-center text-[10px] font-black shrink-0">
                                {player.name.slice(0, 1).toUpperCase()}
                              </div>
                            }
                          >
                            <img
                              src={player.avatarUrl!}
                              alt={player.name}
                              class="w-7 h-7 rounded-full object-cover border border-[var(--ink)] shrink-0"
                            />
                          </Show>
                          <div class="min-w-0">
                            <div class="font-black text-xs text-[var(--ink)] truncate flex items-center gap-1.5">
                              <span>{player.name}</span>
                              <Show when={player.role === "tester" || player.role === "admin"}>
                                <span class="badge text-[8px] px-1 py-0 bg-[var(--pop-teal)] uppercase font-black">
                                  {player.role}
                                </span>
                              </Show>
                            </div>
                            <span class="text-[10px] font-semibold text-[var(--ink-soft)] truncate block">
                              {player.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* College / Batch */}
                      <td class="p-3">
                        <div class="text-xs font-extrabold text-[var(--ink)]">
                          {player.college?.toUpperCase() ?? "—"}
                        </div>
                        <div class="text-[10px] font-semibold text-[var(--ink-soft)]">
                          {player.branch ?? ""} {player.batch ? `'${player.batch}` : ""}
                        </div>
                      </td>

                      {/* Relics Progress */}
                      <td class="p-3 text-center">
                        <div class="inline-flex flex-col items-center gap-1">
                          <span class="font-mono font-black text-xs text-[var(--ink)]">
                            {player.solvedCount} / {questions().length}
                          </span>
                          <div class="w-16 h-1.5 rounded-full bg-[var(--paper-3)] border border-[var(--ink)] overflow-hidden">
                            <div
                              class={`h-full ${
                                player.completed ? "bg-[var(--pop-teal)]" : "bg-[var(--pop-pink)]"
                              }`}
                              style={{
                                width: `${Math.round((player.solvedCount / Math.max(1, questions().length)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Current Clue */}
                      <td class="p-3">
                        <Show
                          when={!player.completed}
                          fallback={
                            <span class="badge text-[10px] px-2 py-0.5 bg-[var(--pop-teal)] text-[var(--ink)] font-black uppercase">
                              All 10 Discovered 👑
                            </span>
                          }
                        >
                          <div class="font-extrabold text-xs text-[var(--ink)] flex items-center gap-1.5">
                            <span class="w-4 h-4 rounded bg-[var(--pop-yellow)] border border-[var(--ink)] text-[9px] font-black grid place-items-center shrink-0">
                              {(player.currentQuestionIndex ?? 0) + 1}
                            </span>
                            <span class="truncate max-w-[180px] sm:max-w-xs block">
                              {player.currentQuestionTitle}
                            </span>
                          </div>
                          <Show when={player.lastSubmittedAt}>
                            <span class="text-[9px] font-semibold text-[var(--ink-soft)] flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              Last try:{" "}
                              {new Date(player.lastSubmittedAt!).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </Show>
                        </Show>
                      </td>

                      {/* Status / Completed At */}
                      <td class="p-3 text-right">
                        <Show
                          when={player.completed}
                          fallback={
                            <span class="badge text-[9px] px-2 py-0.5 bg-[var(--paper-3)] text-[var(--ink-soft)] border border-[var(--ink-soft)]/50 font-bold uppercase">
                              In Progress
                            </span>
                          }
                        >
                          <div class="inline-flex flex-col items-end">
                            <span class="badge text-[9px] px-2 py-0.5 bg-[var(--pop-teal)] text-[var(--ink)] font-black uppercase inline-flex items-center gap-1">
                              <CheckCircle2 size={10} />
                              Finished
                            </span>
                            <span class="text-[9px] font-mono text-[var(--ink-soft)] mt-0.5">
                              {new Date(player.completedAt!).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </Show>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
