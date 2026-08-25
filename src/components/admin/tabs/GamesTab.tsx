import { Clock, Edit2, ExternalLink, Plus, Trash2, Trophy, X } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import {
  createGame,
  deleteGame,
  getGameWinnerAction,
  resetGameAttemptsAction,
  updateGame,
} from "~/server/admin/actions";
import { ShareCard } from "~/components/games/ShareCard";
import type { ShareCardData } from "~/lib/share-card";
import { collegeLabel } from "~/lib/profile";
import type { DailyEntry } from "~/server/leaderboard/service";

interface WinnerInfo {
  game: GameRow;
  winner: DailyEntry;
  profile: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    instagramHandle: string | null;
    whatsappNumber: string | null;
    occupation: string | null;
    college: string | null;
    collegeOther: string | null;
    branch: string | null;
    branchOther: string | null;
    batch: string | null;
    div: string | null;
    trustScore: number;
  } | null;
  metric: string;
  fieldSize: number;
  shareData: ShareCardData;
}

export interface GameRow {
  id: string;
  slug: string;
  day: number;
  title: string;
  hint: string | null;
  gameType: string;
  difficulty: string;
  releaseAt: string | Date | null;
  endAt: string | Date | null;
  previewAt: string | Date | null;
  testerEarlyHours: number;
  status: string;
  published: boolean;
}

interface GamesTabProps {
  games: GameRow[];
  onReload: () => void;
  onNotify: (msg: string) => void;
}

function toDateTimeLocal(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  // Format as YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function GamesTab(props: GamesTabProps) {
  const [editingGame, setEditingGame] = createSignal<GameRow | null>(null);
  const [isCreating, setIsCreating] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [resetGameId, setResetGameId] = createSignal("");

  const resetGameAttempts = async () => {
    const allGames = resetGameId() === "__all__";
    const game = props.games.find((item) => item.id === resetGameId());
    if (!game && !allGames) return;
    if (
      !confirm(
        allGames
          ? "Permanently delete tester attempts and leaderboard rows for every game?"
          : `Permanently delete tester attempts and leaderboard rows for Day ${game!.day}: ${game!.title}?`,
      )
    )
      return;
    setBusy(true);
    try {
      const count = await resetGameAttemptsAction(
        allGames ? props.games.map((item) => item.id) : [game!.id],
      );
      props.onNotify(
        `Cleared ${count} tester attempt${count === 1 ? "" : "s"}${allGames ? " across all games" : ` for ${game!.title}`}`,
      );
      setResetGameId("");
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to reset game attempts");
    } finally {
      setBusy(false);
    }
  };

  const [downloadingWinnerId, setDownloadingWinnerId] = createSignal<string | null>(null);
  const [winnerInfo, setWinnerInfo] = createSignal<WinnerInfo | null>(null);

  const formatWinnerScore = (
    metric: string,
    durationMs: number | null,
    score: number | null,
  ): string => {
    if (metric === "score") return `${score ?? 0} pts`;
    if (durationMs !== null && durationMs !== undefined) {
      const s = durationMs / 1000;
      return `${s.toFixed(2)}s`;
    }
    return "—";
  };

  const handleDownloadWinnerCard = async (game: GameRow) => {
    setDownloadingWinnerId(game.id);
    try {
      const res = await getGameWinnerAction(game.id);
      if (!res || !res.winner) {
        props.onNotify(`No submissions found yet for Day ${game.day}: ${game.title}`);
        return;
      }
      const w = res.winner;
      const p = res.profile;
      const shareData: ShareCardData = {
        playerName: p?.name || w.name,
        avatarUrl: p?.avatarUrl || w.avatarUrl,
        college: collegeLabel(p?.college || w.college, p?.collegeOther),
        branch: p?.branch || w.branch,
        batch: p?.batch || w.batch,
        instagram: p?.instagramHandle || null,
        occupation: p?.occupation || null,
        gameTitle: game.title,
        gameSlug: game.slug,
        gameType: game.gameType,
        day: game.day,
        metric: res.metric,
        durationMs: w.durationMs,
        score: w.score,
        rank: 1,
        fieldSize: res.fieldSize,
        afterDeadline: false,
        origin: typeof window !== "undefined" ? window.location.origin : "",
        seed: `winner-${game.slug}-${w.userId}`,
        isWinner: true,
        options: {
          hideMeme: true,
        },
      };

      setWinnerInfo({
        game,
        winner: w,
        profile: p,
        metric: res.metric,
        fieldSize: res.fieldSize,
        shareData,
      });
      props.onNotify(`Viewing winner studio for ${w.name} (Day ${game.day})`);
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to load winner details");
    } finally {
      setDownloadingWinnerId(null);
    }
  };

  // Form states
  const [formDay, setFormDay] = createSignal(1);
  const [formSlug, setFormSlug] = createSignal("");
  const [formTitle, setFormTitle] = createSignal("");
  const [formType, setFormType] = createSignal("tinder");
  const [formDiff, setFormDiff] = createSignal("normal");
  const [formHint, setFormHint] = createSignal("");
  const [formReleaseAt, setFormReleaseAt] = createSignal("");
  const [formEndAt, setFormEndAt] = createSignal("");
  const [formPreviewAt, setFormPreviewAt] = createSignal("");
  const [formEarlyHours, setFormEarlyHours] = createSignal(24);
  const [formPublished, setFormPublished] = createSignal(false);

  const openCreate = () => {
    setEditingGame(null);
    setFormDay(props.games.length + 1);
    setFormSlug("");
    setFormTitle("");
    setFormType("tinder");
    setFormDiff("normal");
    setFormHint("");
    setFormReleaseAt("");
    setFormEndAt("");
    setFormPreviewAt("");
    setFormEarlyHours(24);
    setFormPublished(false);
    setIsCreating(true);
  };

  const openEdit = (game: GameRow) => {
    setIsCreating(false);
    setEditingGame(game);
    setFormDay(game.day);
    setFormSlug(game.slug);
    setFormTitle(game.title);
    setFormType(game.gameType);
    setFormDiff(game.difficulty ?? "normal");
    setFormHint(game.hint ?? "");
    setFormReleaseAt(toDateTimeLocal(game.releaseAt));
    setFormEndAt(toDateTimeLocal(game.endAt));
    setFormPreviewAt(toDateTimeLocal(game.previewAt));
    setFormEarlyHours(game.testerEarlyHours ?? 24);
    setFormPublished(game.published ?? false);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isCreating()) {
        await createGame({
          day: formDay(),
          slug: formSlug().trim().toLowerCase(),
          title: formTitle().trim(),
          gameType: formType().trim(),
          difficulty: formDiff(),
          hint: formHint().trim() || undefined,
          releaseAt: formReleaseAt() ? new Date(formReleaseAt()).toISOString() : null,
          endAt: formEndAt() ? new Date(formEndAt()).toISOString() : null,
          previewAt: formPreviewAt() ? new Date(formPreviewAt()).toISOString() : null,
          testerEarlyHours: formEarlyHours(),
          published: formPublished(),
        });
        props.onNotify(`Game "${formTitle()}" created successfully`);
      } else if (editingGame()) {
        await updateGame(editingGame()!.id, {
          day: formDay(),
          slug: formSlug().trim().toLowerCase(),
          title: formTitle().trim(),
          gameType: formType().trim(),
          difficulty: formDiff(),
          hint: formHint().trim() || null,
          releaseAt: formReleaseAt() ? new Date(formReleaseAt()).toISOString() : null,
          endAt: formEndAt() ? new Date(formEndAt()).toISOString() : null,
          previewAt: formPreviewAt() ? new Date(formPreviewAt()).toISOString() : null,
          testerEarlyHours: formEarlyHours(),
          published: formPublished(),
        });
        props.onNotify(`Game "${formTitle()}" updated successfully`);
      }
      setIsCreating(false);
      setEditingGame(null);
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to save game");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (game: GameRow) => {
    if (!confirm(`Are you sure you want to delete Day ${game.day}: "${game.title}"?`)) return;
    setBusy(true);
    try {
      await deleteGame(game.id);
      props.onNotify(`Game "${game.title}" deleted`);
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to delete game");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="space-y-4">
      <div class="card card-plain p-4 space-y-2 bg-[var(--pop-yellow)]/30">
        <h3 class="font-black">Reset Game Data</h3>
        <p class="text-xs font-semibold opacity-80">
          Permanently deletes tester/admin test attempts and leaderboard rows. Normal player data is
          never touched.
        </p>
        <div class="flex flex-wrap gap-2">
          <select
            class="input text-xs font-bold"
            value={resetGameId()}
            onChange={(e) => setResetGameId(e.currentTarget.value)}
          >
            <option value="">Select a game</option>
            <option value="__all__">All games</option>
            <For each={props.games}>
              {(game) => (
                <option value={game.id}>
                  Day {game.day}: {game.title}
                </option>
              )}
            </For>
          </select>
          <button
            type="button"
            class="btn-ghost text-xs"
            disabled={busy() || !resetGameId()}
            onClick={resetGameAttempts}
          >
            Clear tester/admin attempts
          </button>
        </div>
      </div>
      {/* Header bar */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-xl font-black">Games & Schedule Management</h2>
          <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            Configure individual start and end times, difficulty, hints, and release states for all
            7 event days.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          class="btn-brand text-xs sm:text-sm px-3.5 py-2 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add New Game</span>
        </button>
      </div>

      {/* Games Table Card */}
      <div class="card card-plain p-0 overflow-hidden bg-[var(--paper)]">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-[var(--paper-2)] border-b-2 border-[var(--ink)] font-black uppercase text-[var(--ink)]">
              <tr>
                <th class="p-3">Day</th>
                <th class="p-3">Game Title & Slug</th>
                <th class="p-3">Engine</th>
                <th class="p-3">Schedule / Timing</th>
                <th class="p-3">Status</th>
                <th class="p-3">Publish</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--ink-soft)]/20 font-semibold">
              <For each={props.games}>
                {(g) => {
                  const hasCustomTime = () => !!g.releaseAt;
                  return (
                    <tr class="hover:bg-[var(--paper-2)] transition-colors">
                      <td class="p-3 font-mono font-black text-sm">
                        <span class="px-2 py-0.5 rounded bg-[var(--pop-yellow)] border border-[var(--ink)]">
                          Day {g.day}
                        </span>
                      </td>

                      <td class="p-3">
                        <div class="font-extrabold text-sm text-[var(--ink)]">{g.title}</div>
                        <div class="font-mono text-[11px] opacity-70">/{g.slug}</div>
                        <Show when={g.hint}>
                          <div class="text-[10px] italic opacity-80 mt-0.5 truncate max-w-xs">
                            Hint: {g.hint}
                          </div>
                        </Show>
                      </td>

                      <td class="p-3">
                        <span class="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--ink-soft)]/50">
                          {g.gameType}
                        </span>
                      </td>

                      <td class="p-3">
                        <Show
                          when={hasCustomTime()}
                          fallback={
                            <span class="inline-flex items-center gap-1 text-[11px] text-[var(--ink-soft)] font-medium">
                              <Clock size={12} />
                              Uses Global Schedule
                            </span>
                          }
                        >
                          <div class="text-[11px] font-mono">
                            <div>
                              Start:{" "}
                              {new Date(g.releaseAt!).toLocaleString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </div>
                            <Show when={g.endAt}>
                              <div class="opacity-75">
                                End:{" "}
                                {new Date(g.endAt!).toLocaleString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </div>
                            </Show>
                          </div>
                        </Show>
                      </td>

                      <td class="p-3">
                        <span
                          class={`badge text-[10px] py-0.5 px-2 uppercase font-black ${
                            g.status === "live"
                              ? "bg-[var(--pop-yellow)]"
                              : g.status === "tester"
                                ? "bg-[var(--pop-teal)]"
                                : g.status === "closed"
                                  ? "bg-[var(--paper-3)]"
                                  : "bg-[var(--pop-pink)]"
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>

                      <td class="p-3">
                        <span
                          class={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                            g.published
                              ? "bg-green-100 text-green-800 border-green-400"
                              : "bg-gray-100 text-gray-600 border-gray-300"
                          }`}
                        >
                          {g.published ? "Published" : "Draft"}
                        </span>
                      </td>

                      <td class="p-3 text-right">
                        <div class="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDownloadWinnerCard(g)}
                            disabled={downloadingWinnerId() === g.id}
                            class="p-1.5 rounded hover:bg-[var(--pop-yellow)] border border-transparent hover:border-[var(--ink)] cursor-pointer text-[var(--ink)] disabled:opacity-40"
                            title="Download Winner Card"
                          >
                            <Trophy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(g)}
                            class="p-1.5 rounded hover:bg-[var(--paper-3)] border border-transparent hover:border-[var(--ink)] cursor-pointer"
                            title="Edit Game"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(g)}
                            class="p-1.5 rounded hover:bg-[var(--pop-red)] hover:text-white border border-transparent hover:border-[var(--ink)] cursor-pointer text-red-600"
                            title="Delete Game"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Create / Edit */}
      <Show when={isCreating() || editingGame()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div class="relative w-full max-w-xl max-h-[90vh] overflow-y-auto card p-6 bg-[var(--paper-2)] border-2 border-[var(--ink)] shadow-xl space-y-4">
            <div class="flex items-center justify-between pb-2 border-b-2 border-[var(--ink)]">
              <h3 class="text-lg font-black">
                {isCreating() ? "Add New Festival Game" : `Edit Game (Day ${formDay()})`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingGame(null);
                }}
                class="btn-ghost p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} class="space-y-3.5 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-extrabold mb-1">Festival Day (1–7)</label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={formDay()}
                    onInput={(e) => setFormDay(Number(e.currentTarget.value))}
                    class="input w-full"
                    required
                  />
                </div>

                <div>
                  <label class="block font-extrabold mb-1">Slug (URL Path)</label>
                  <input
                    type="text"
                    value={formSlug()}
                    onInput={(e) => setFormSlug(e.currentTarget.value)}
                    placeholder="e.g. open-source-tinder"
                    class="input w-full font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label class="block font-extrabold mb-1">Display Title</label>
                <input
                  type="text"
                  value={formTitle()}
                  onInput={(e) => setFormTitle(e.currentTarget.value)}
                  placeholder="e.g. Open Source Tinder"
                  class="input w-full font-bold"
                  required
                />
              </div>

              <div>
                <label class="block font-extrabold mb-1">Game Engine Type</label>
                <select
                  value={formType()}
                  onChange={(e) => setFormType(e.currentTarget.value)}
                  class="input w-full font-mono"
                >
                  <option value="tinder">tinder (Open Source Tinder)</option>
                  <option value="jigsaw">jigsaw (Pookalam Jigsaw)</option>
                  <option value="wend">wend (sudoWend)</option>
                  <option value="unblock">unblock (BoatLock)</option>
                  <option value="jump">jump (Maveli Jump)</option>
                  <option value="hunt">hunt (FOSS Treasure Hunt)</option>
                  <option value="pookalam_vote">pookalam_vote (Code-a-Pookalam Vote)</option>
                </select>
              </div>

              <div>
                <label class="block font-extrabold mb-1">Teaser (Hint before game unlocks)</label>
                <input
                  type="text"
                  value={formHint()}
                  onInput={(e) => setFormHint(e.currentTarget.value)}
                  placeholder="A one-liner teaser hint before game unlocks"
                  class="input w-full"
                />
              </div>

              {/* Independent Timing Controls */}
              <div class="p-3 rounded-md bg-[var(--paper)] border border-[var(--ink-soft)]/40 space-y-2">
                <div class="font-black text-[11px] uppercase tracking-wider text-[var(--ink)]">
                  Independent Start & End Times (Optional)
                </div>
                <p class="text-[11px] text-[var(--ink-soft)] font-semibold">
                  Leave blank to automatically use global schedule (Event Start Date + Release Time
                  + Duration).
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label class="block font-bold text-[11px] mb-0.5">Custom Start Time</label>
                    <input
                      type="datetime-local"
                      value={formReleaseAt()}
                      onInput={(e) => setFormReleaseAt(e.currentTarget.value)}
                      class="input w-full text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label class="block font-bold text-[11px] mb-0.5">Custom End Time</label>
                    <input
                      type="datetime-local"
                      value={formEndAt()}
                      onInput={(e) => setFormEndAt(e.currentTarget.value)}
                      class="input w-full text-xs font-mono"
                    />
                  </div>

                  <div class="sm:col-span-2">
                    <label class="block font-bold text-[11px] mb-0.5">Custom Preview Time</label>
                    <input
                      type="datetime-local"
                      value={formPreviewAt()}
                      onInput={(e) => setFormPreviewAt(e.currentTarget.value)}
                      class="input w-full text-xs font-mono"
                    />
                    <p class="text-[10px] text-[var(--ink-soft)] font-semibold pt-0.5">
                      When the title, art and rules become visible while the game stays locked.
                      Blank uses the global preview window.
                    </p>
                  </div>
                </div>

                <div class="pt-1 flex items-center justify-between">
                  <span class="text-[11px] font-bold">Tester Early Access Hours:</span>
                  <input
                    type="number"
                    min={0}
                    max={168}
                    value={formEarlyHours()}
                    onInput={(e) => setFormEarlyHours(Number(e.currentTarget.value))}
                    class="input w-20 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Published switch */}
              <div class="flex items-center justify-between p-2 rounded bg-[var(--paper-3)] border border-[var(--ink)]">
                <div>
                  <span class="font-black">Published to Players</span>
                  <p class="text-[10px] opacity-75">When unchecked, game is hidden in draft mode</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPublished()}
                    onChange={(e) => setFormPublished(e.currentTarget.checked)}
                    class="sr-only peer"
                  />
                  <div class="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--ink)]"></div>
                </label>
              </div>

              {/* Action Buttons */}
              <div class="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingGame(null);
                  }}
                  class="btn-ghost px-4 py-2"
                >
                  Cancel
                </button>
                <button type="submit" disabled={busy()} class="btn-brand px-5 py-2 font-black">
                  {busy() ? "Saving..." : isCreating() ? "Create Game" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Winner Details & Card Studio Modal */}
      <Show when={winnerInfo()}>
        {(() => {
          const info = winnerInfo()!;
          const p = info.profile;
          const w = info.winner;
          const g = info.game;

          return (
            <div
              class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-3 sm:p-6"
              style={{ background: "rgb(34 32 43 / 0.82)" }}
              role="dialog"
              aria-modal="true"
              aria-label="Day Winner Details & Card Studio"
              onClick={(e) => {
                if (e.target === e.currentTarget) setWinnerInfo(null);
              }}
            >
              <div class="card anim-sheet-in pop-yellow my-auto w-full max-w-5xl space-y-4 max-h-[94vh] overflow-y-auto p-4 sm:p-6 relative text-[var(--ink)]">
                {/* Close Button */}
                <button
                  type="button"
                  class="absolute top-3.5 right-3.5 grid place-items-center rounded-full cursor-pointer bg-[var(--paper-2)] border-2 border-[var(--ink)] w-9 h-9 hover:bg-[var(--paper-3)]"
                  onClick={() => setWinnerInfo(null)}
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>

                {/* Top Banner */}
                <div class="space-y-1 pr-10">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="badge py-0.5 px-2 bg-[var(--pop-teal)] uppercase font-black text-xs">
                      Day {g.day} Champion
                    </span>
                    <span class="badge py-0.5 px-2 bg-[var(--paper-3)] uppercase font-mono text-xs">
                      {g.title}
                    </span>
                  </div>
                  <h2 class="font-display font-black text-2xl sm:text-3xl m-0 flex items-center gap-2">
                    <Trophy size={24} class="text-[var(--pop-red)] shrink-0" />
                    <span>{w.name}</span>
                  </h2>
                </div>

                {/* 2-Column Responsive Layout */}
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Full Winner Contact & Verification Details (Admin Only) */}
                  <div class="lg:col-span-5 space-y-3.5 bg-[var(--paper)] p-4 rounded-xl border-2 border-[var(--ink)] text-xs font-semibold">
                    <div class="flex items-center gap-2.5 pb-2.5 border-b-2 border-[var(--ink)]">
                      <Show
                        when={p?.avatarUrl || w.avatarUrl}
                        fallback={
                          <div class="w-12 h-12 rounded-full border-2 border-[var(--ink)] bg-[var(--pop-yellow)] grid place-items-center font-black text-base shrink-0">
                            {w.name.slice(0, 1).toUpperCase()}
                          </div>
                        }
                      >
                        <img
                          src={(p?.avatarUrl || w.avatarUrl)!}
                          alt={w.name}
                          class="w-12 h-12 rounded-full border-2 border-[var(--ink)] object-cover shrink-0"
                        />
                      </Show>
                      <div class="min-w-0">
                        <h4 class="font-extrabold text-base truncate text-[var(--ink)]">
                          {w.name}
                        </h4>
                        <div class="flex items-center gap-1.5 text-[11px] font-mono text-[var(--ink-soft)]">
                          <span>Rank 1 of {info.fieldSize}</span>
                          <span>·</span>
                          <span class="font-bold text-green-700">Winner</span>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-2.5">
                      <h5 class="font-black uppercase tracking-wider text-[10px] text-[var(--ink-soft)]">
                        Contact & Social Identity
                      </h5>

                      {/* Instagram */}
                      <div class="p-2.5 rounded-lg bg-[var(--paper-2)] border border-[var(--ink)]/40 flex items-center justify-between gap-2">
                        <div>
                          <span class="text-[10px] font-black uppercase text-[var(--ink-soft)] block">
                            Instagram Handle
                          </span>
                          <Show
                            when={p?.instagramHandle}
                            fallback={<span class="font-mono text-gray-500">Not provided</span>}
                          >
                            <a
                              href={`https://instagram.com/${p!.instagramHandle!.replace(/^@+/, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              class="font-black text-sm text-[var(--pop-red)] hover:underline inline-flex items-center gap-1"
                            >
                              <span>@{p!.instagramHandle!.replace(/^@+/, "")}</span>
                              <ExternalLink size={12} />
                            </a>
                          </Show>
                        </div>
                      </div>

                      {/* WhatsApp / Phone */}
                      <div class="p-2.5 rounded-lg bg-[var(--paper-2)] border border-[var(--ink)]/40 flex items-center justify-between gap-2">
                        <div>
                          <span class="text-[10px] font-black uppercase text-[var(--ink-soft)] block">
                            WhatsApp / Phone
                          </span>
                          <Show
                            when={p?.whatsappNumber}
                            fallback={<span class="font-mono text-gray-500">Not provided</span>}
                          >
                            <div class="flex items-center gap-2 mt-0.5">
                              <span class="font-mono font-bold text-sm text-[var(--ink)]">
                                {p!.whatsappNumber}
                              </span>
                              <a
                                href={`https://wa.me/91${p!.whatsappNumber!.replace(/\D/g, "").slice(-10)}`}
                                target="_blank"
                                rel="noreferrer"
                                class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-400 hover:bg-green-200"
                              >
                                WhatsApp ↗
                              </a>
                            </div>
                          </Show>
                        </div>
                      </div>

                      {/* Email */}
                      <div class="p-2.5 rounded-lg bg-[var(--paper-2)] border border-[var(--ink)]/40">
                        <span class="text-[10px] font-black uppercase text-[var(--ink-soft)] block">
                          Google / Email
                        </span>
                        <a
                          href={`mailto:${p?.email || ""}`}
                          class="font-mono text-xs font-bold text-[var(--ink)] hover:underline truncate block"
                        >
                          {p?.email || "—"}
                        </a>
                      </div>

                      <h5 class="font-black uppercase tracking-wider text-[10px] text-[var(--ink-soft)] pt-1">
                        Academic / Profile
                      </h5>

                      <div class="p-2.5 rounded-lg bg-[var(--paper-2)] border border-[var(--ink)]/40 space-y-1.5">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-bold opacity-75">College:</span>
                          <span class="font-extrabold uppercase">
                            {collegeLabel(p?.college, p?.collegeOther) ?? p?.college ?? "—"}
                          </span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-bold opacity-75">Branch & Batch:</span>
                          <span class="font-extrabold uppercase">
                            {p?.branch?.toUpperCase() ?? "—"}
                            {p?.branchOther ? ` (${p?.branchOther})` : ""} · Batch {p?.batch ?? "—"}
                          </span>
                        </div>
                        <Show when={p?.div && p.div !== "none"}>
                          <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold opacity-75">Division:</span>
                            <span class="font-mono font-bold">Div {p!.div?.toUpperCase()}</span>
                          </div>
                        </Show>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-bold opacity-75">Occupation:</span>
                          <span class="font-bold capitalize">
                            {p?.occupation?.replace(/_/g, " ") ?? "Student"}
                          </span>
                        </div>
                      </div>

                      <h5 class="font-black uppercase tracking-wider text-[10px] text-[var(--ink-soft)] pt-1">
                        Run Metrics
                      </h5>
                      <div class="p-2.5 rounded-lg bg-[var(--paper-2)] border border-[var(--ink)]/40 space-y-1 text-xs">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-bold opacity-75">Winning Result:</span>
                          <span class="font-mono font-black text-sm text-[var(--ink)]">
                            {formatWinnerScore(info.metric, w.durationMs, w.score)}
                          </span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-bold opacity-75">Finished Timestamp:</span>
                          <span class="font-mono text-[11px]">
                            {new Date(w.submittedAt).toLocaleTimeString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}{" "}
                            IST
                          </span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-bold opacity-75">Trust Score:</span>
                          <span class="font-mono font-bold text-green-700">
                            {p?.trustScore ?? 100} / 100
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Full ShareCard Studio with Photo Upload & Detail Toggles */}
                  <div class="lg:col-span-7 bg-[var(--paper)] p-4 rounded-xl border-2 border-[var(--ink)] space-y-2.5">
                    <h4 class="font-display font-black text-lg m-0 text-center">
                      Official Winner Card Studio
                    </h4>
                    <p class="text-xs font-semibold text-center opacity-75 m-0 pb-1">
                      Upload winner's photo from gallery, toggle fields, preview live and download.
                    </p>
                    <ShareCard data={info.shareData} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Show>
    </div>
  );
}
