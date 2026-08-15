import { AlertTriangle, Ban, CheckCircle2, Search, XCircle } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { voidAttemptAction } from "~/server/admin/actions";

export interface AttemptRow {
  id: string;
  gameId: string;
  gameTitle: string;
  gameSlug: string;
  gameDay: number;
  userId: string;
  userName: string;
  userEmail: string;
  attemptNumber: number;
  status: string;
  durationMs: number | null;
  score: number | null;
  movesCount: number | null;
  serverValid: boolean;
  isAnomalous: boolean;
  afterDeadline: boolean;
  ip: string | null;
  deviceHash: string | null;
  startedAt: Date | string;
  submittedAt: Date | string | null;
  createdAt: Date | string;
}

interface AttemptsTabProps {
  attempts: AttemptRow[];
  onReload: () => void;
  onNotify: (msg: string) => void;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function AttemptsTab(props: AttemptsTabProps) {
  const [search, setSearch] = createSignal("");
  const [gameFilter, setGameFilter] = createSignal<string>("all");
  const [statusFilter, setStatusFilter] = createSignal<string>("all");
  const [anomalousOnly, setAnomalousOnly] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  const filteredAttempts = createMemo(() => {
    const q = search().toLowerCase().trim();
    const game = gameFilter();
    const status = statusFilter();
    const anomaly = anomalousOnly();

    return props.attempts.filter((a) => {
      if (q) {
        const matchUser = a.userName.toLowerCase().includes(q);
        const matchEmail = a.userEmail.toLowerCase().includes(q);
        const matchGame = a.gameTitle.toLowerCase().includes(q);
        const matchIp = (a.ip ?? "").toLowerCase().includes(q);
        if (!matchUser && !matchEmail && !matchGame && !matchIp) return false;
      }

      if (game !== "all" && String(a.gameDay) !== game) {
        return false;
      }

      if (status !== "all" && a.status !== status) {
        return false;
      }

      if (anomaly && !a.isAnomalous) {
        return false;
      }

      return true;
    });
  });

  const handleVoid = async (attempt: AttemptRow) => {
    if (
      !confirm(
        `Void Attempt #${attempt.attemptNumber} by "${attempt.userName}" on Day ${attempt.gameDay} (${attempt.gameTitle})?\n\nThis will invalidate this attempt and remove it from leaderboard rankings.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await voidAttemptAction(attempt.id);
      props.onNotify(`Attempt voided and leaderboard updated`);
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to void attempt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-xl font-black">Game Attempts & Score Moderation</h2>
          <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            Inspect player game submissions, detect anomalous fast completions, and void fraudulent
            runs.
          </p>
        </div>

        <div class="font-mono text-xs font-black px-2.5 py-1 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
          {filteredAttempts().length} / {props.attempts.length} Attempts
        </div>
      </div>

      {/* Filter Toolbar */}
      <div class="card card-plain p-3 bg-[var(--paper-2)] space-y-3">
        <div class="grid sm:grid-cols-12 gap-2.5">
          {/* Search */}
          <div class="sm:col-span-5 relative">
            <Search
              size={15}
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
            />
            <input
              type="text"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search player, game, IP..."
              class="input w-full pl-8 text-xs font-semibold"
            />
          </div>

          {/* Game Day Filter */}
          <div class="sm:col-span-2">
            <select
              value={gameFilter()}
              onChange={(e) => setGameFilter(e.currentTarget.value)}
              class="input w-full text-xs font-bold"
            >
              <option value="all">All Days (1–7)</option>
              <option value="1">Day 1</option>
              <option value="2">Day 2</option>
              <option value="3">Day 3</option>
              <option value="4">Day 4</option>
              <option value="5">Day 5</option>
              <option value="6">Day 6</option>
              <option value="7">Day 7</option>
            </select>
          </div>

          {/* Status Filter */}
          <div class="sm:col-span-2">
            <select
              value={statusFilter()}
              onChange={(e) => setStatusFilter(e.currentTarget.value)}
              class="input w-full text-xs font-bold"
            >
              <option value="all">All Status</option>
              <option value="submitted">submitted</option>
              <option value="in_progress">in_progress</option>
              <option value="expired">expired</option>
              <option value="void">void</option>
            </select>
          </div>

          {/* Anomalous Toggle */}
          <div class="sm:col-span-3 flex items-center justify-end">
            <label class="inline-flex items-center gap-2 cursor-pointer text-xs font-extrabold select-none bg-[var(--paper)] px-3 py-2 rounded border border-[var(--ink-soft)]/50 hover:border-[var(--ink)]">
              <input
                type="checkbox"
                checked={anomalousOnly()}
                onChange={(e) => setAnomalousOnly(e.currentTarget.checked)}
                class="rounded"
              />
              <span class="text-red-700 flex items-center gap-1">
                <AlertTriangle size={14} />
                Speed Anomalies Only
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Attempts Table */}
      <div class="card card-plain p-0 overflow-hidden bg-[var(--paper)]">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-[var(--paper-2)] border-b-2 border-[var(--ink)] font-black uppercase text-[var(--ink)]">
              <tr>
                <th class="p-3">Player</th>
                <th class="p-3">Game & Day</th>
                <th class="p-3">Run Result</th>
                <th class="p-3">Verification</th>
                <th class="p-3">Client / IP</th>
                <th class="p-3">Submitted At</th>
                <th class="p-3 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--ink-soft)]/20 font-semibold">
              <For
                each={filteredAttempts()}
                fallback={
                  <tr>
                    <td colspan={7} class="p-8 text-center text-sm font-bold opacity-75">
                      No game attempts found matching criteria.
                    </td>
                  </tr>
                }
              >
                {(a) => {
                  const isVoid = () => a.status === "void";
                  return (
                    <tr
                      class={`hover:bg-[var(--paper-2)] transition-colors ${
                        a.isAnomalous
                          ? "bg-red-50"
                          : isVoid()
                            ? "bg-gray-100 opacity-60 line-through"
                            : ""
                      }`}
                    >
                      {/* Player */}
                      <td class="p-3">
                        <div class="font-extrabold text-sm text-[var(--ink)]">{a.userName}</div>
                        <div class="font-mono text-[11px] opacity-75">{a.userEmail}</div>
                      </td>

                      {/* Game */}
                      <td class="p-3">
                        <div class="flex items-center gap-1.5">
                          <span class="font-mono font-black px-1.5 py-0.2 rounded bg-[var(--pop-yellow)] border border-[var(--ink)] text-[10px]">
                            Day {a.gameDay}
                          </span>
                          <span class="font-bold">{a.gameTitle}</span>
                        </div>
                        <div class="text-[10px] opacity-70 font-mono mt-0.5">
                          Run #{a.attemptNumber} · {a.status}
                        </div>
                      </td>

                      {/* Result */}
                      <td class="p-3 font-mono">
                        <Show
                          when={a.score != null}
                          fallback={
                            <div class="font-black text-sm">{formatDuration(a.durationMs)}</div>
                          }
                        >
                          <div class="font-black text-sm">
                            {(a.score ?? 0).toLocaleString("en-IN")} pts
                          </div>
                          <div class="text-[10px] opacity-70">
                            Time: {formatDuration(a.durationMs)}
                          </div>
                        </Show>
                        <Show when={a.movesCount != null}>
                          <div class="text-[10px] opacity-60">Moves: {a.movesCount}</div>
                        </Show>
                      </td>

                      {/* Verification Status */}
                      <td class="p-3">
                        <div class="space-y-1">
                          <Show
                            when={a.serverValid}
                            fallback={
                              <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-600">
                                <XCircle size={12} />
                                Invalid Replay
                              </span>
                            }
                          >
                            <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-700">
                              <CheckCircle2 size={12} />
                              Server Valid
                            </span>
                          </Show>

                          <Show when={a.isAnomalous}>
                            <div>
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-red-600 text-white font-black text-[9px] uppercase">
                                <AlertTriangle size={10} />
                                Speed Anomaly
                              </span>
                            </div>
                          </Show>

                          <Show when={a.afterDeadline}>
                            <div class="text-[10px] text-amber-700 font-bold">Late Submission</div>
                          </Show>
                        </div>
                      </td>

                      {/* IP & Device */}
                      <td class="p-3 font-mono text-[11px]">
                        <div>IP: {a.ip ?? "—"}</div>
                        <Show when={a.deviceHash}>
                          <div class="text-[10px] opacity-60 truncate max-w-[120px]">
                            Dev: {a.deviceHash}
                          </div>
                        </Show>
                      </td>

                      {/* Timestamp */}
                      <td class="p-3 text-[11px] font-mono opacity-80">
                        {a.submittedAt
                          ? new Date(a.submittedAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "In progress"}
                      </td>

                      {/* Actions */}
                      <td class="p-3 text-right">
                        <Show when={!isVoid()}>
                          <button
                            type="button"
                            onClick={() => handleVoid(a)}
                            disabled={busy()}
                            class="px-2.5 py-1 rounded bg-[var(--paper-3)] border border-[var(--ink-soft)]/50 hover:bg-[var(--pop-red)] hover:text-white font-extrabold text-[11px] cursor-pointer text-red-600 inline-flex items-center gap-1"
                          >
                            <Ban size={12} />
                            <span>Void Run</span>
                          </button>
                        </Show>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
