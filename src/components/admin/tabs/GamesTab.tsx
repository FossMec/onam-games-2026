import { Clock, Edit2, Plus, Trash2, X } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { createGame, deleteGame, updateGame } from "~/server/admin/actions";

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
                        <div class="text-[10px] uppercase font-bold opacity-60 mt-0.5">
                          {g.difficulty}
                        </div>
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

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-extrabold mb-1">Game Engine Type</label>
                  <select
                    value={formType()}
                    onChange={(e) => setFormType(e.currentTarget.value)}
                    class="input w-full font-mono"
                  >
                    <option value="tinder">tinder (Open Source Tinder)</option>
                    <option value="jigsaw">jigsaw (Pookalam Jigsaw)</option>
                    <option value="wend">wend (Malayalam Wordle)</option>
                    <option value="vallam">vallam (Escape the Vallam)</option>
                    <option value="jump">jump (Maveli Jump)</option>
                    <option value="hunt">hunt (FOSS Treasure Hunt)</option>
                    <option value="pookalam_vote">pookalam_vote (Code-a-Pookalam Vote)</option>
                  </select>
                </div>

                <div>
                  <label class="block font-extrabold mb-1">Difficulty</label>
                  <select
                    value={formDiff()}
                    onChange={(e) => setFormDiff(e.currentTarget.value)}
                    class="input w-full"
                  >
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block font-extrabold mb-1">Teaser Hint</label>
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
    </div>
  );
}
