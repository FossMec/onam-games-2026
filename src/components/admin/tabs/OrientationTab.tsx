import { For, Show, createSignal, createEffect } from "solid-js";
import { createAsync, revalidate } from "@solidjs/router";
import {
  getOrientationConfig,
  getOrientationLeaderboardAction,
  updateOrientationBatchAction,
  updateOrientationEnabledAction,
  updateOrientationGameAction,
} from "~/server/orientation/actions";
import { clearOrientationBatchAction } from "~/server/admin/actions";
import { ORIENTATION_BATCHES, ORIENTATION_GAME_OPTIONS } from "~/lib/orientation";

export function OrientationTab(props: { onNotify: (msg: string) => void }) {
  const config = createAsync(() => getOrientationConfig());
  const [initialized, setInitialized] = createSignal(false);
  const [clearBatch, setClearBatch] = createSignal<string>("CS A");
  const [clearBusy, setClearBusy] = createSignal(false);
  const [gameType, setGameType] = createSignal("");
  const [currentBatch, setCurrentBatch] = createSignal<string>("CS A");
  const [enabled, setEnabled] = createSignal(false);
  const [saving, setSaving] = createSignal<string | null>(null);
  const [boardRev, setBoardRev] = createSignal(0);

  // initialize pickers from config when loaded (once)
  createEffect(() => {
    const c = config();
    if (c && !initialized()) {
      setGameType(c.settings.gameType || "");
      setCurrentBatch(c.settings.currentBatch || "CS A");
      setEnabled(Boolean(c.settings.enabled));
      setClearBatch(c.settings.currentBatch || "CS A");
      setInitialized(true);
    }
  });

  const doSaveGameType = async () => {
    setSaving("game");
    try {
      await updateOrientationGameAction(gameType());
      props.onNotify(`Orientation game set to ${gameType() || "none"}`);
      await revalidate("orientation-config" as any);
      await revalidate("admin-settings" as any);
    } catch (e: any) {
      props.onNotify(e.message ?? "Failed to save game");
    } finally {
      setSaving(null);
    }
  };

  const doSaveBatch = async () => {
    setSaving("batch");
    try {
      await updateOrientationBatchAction(currentBatch());
      props.onNotify(`Active batch set to ${currentBatch()}`);
      await revalidate("orientation-config" as any);
      await revalidate("admin-settings" as any);
    } catch (e: any) {
      props.onNotify(e.message ?? "Failed to save batch");
    } finally {
      setSaving(null);
    }
  };

  const doToggleEnabled = async () => {
    const next = !enabled();
    setSaving("enabled");
    try {
      await updateOrientationEnabledAction(next);
      setEnabled(next);
      props.onNotify(
        next
          ? "Orientation STARTED — players can now play"
          : "Orientation PAUSED — start requests blocked",
      );
      await revalidate("orientation-config" as any);
      await revalidate("admin-settings" as any);
    } catch (e: any) {
      props.onNotify(e.message ?? "Failed to update play status");
    } finally {
      setSaving(null);
    }
  };

  const doClear = async () => {
    if (
      !confirm(
        `Clear leaderboard for batch ${clearBatch()}? This deletes all attempts for that batch.`,
      )
    )
      return;
    setClearBusy(true);
    try {
      const n = await clearOrientationBatchAction(clearBatch());
      props.onNotify(`Cleared ${n} attempts for batch ${clearBatch()}`);
      setBoardRev((r) => r + 1);
      await revalidate("orientation-config" as any);
      await revalidate("orientation-board" as any);
    } catch (e: any) {
      props.onNotify(e.message ?? "Failed");
    } finally {
      setClearBusy(false);
    }
  };

  const board = createAsync(async () => {
    const b = clearBatch();
    boardRev();
    return getOrientationLeaderboardAction(b, 1, 20);
  });

  return (
    <div class="space-y-5">
      <div>
        <h2 class="text-xl font-black">Orientation Control</h2>
        <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
          Single game for orientation · 10 batch leaderboards · current batch gate · clear per
          batch.
        </p>
      </div>

      <div class="card pop-yellow p-4 flex items-center justify-between gap-4 border-2 border-[var(--ink)]">
        <div>
          <p class="font-black text-sm">Play Status</p>
          <p class="text-xs" style={{ color: "var(--ink-soft)" }}>
            {enabled() ? "LIVE — start requests allowed" : "PAUSED — start requests are rejected"}
          </p>
          <p class="text-[11px] font-mono">
            Current: {config()?.settings.enabled ? "enabled" : "disabled"}
          </p>
        </div>
        <button
          type="button"
          onClick={doToggleEnabled}
          disabled={!!saving()}
          class={`px-5 py-2.5 rounded-lg font-black text-sm border-2 border-[var(--ink)] cursor-pointer transition-colors ${enabled() ? "bg-[var(--pop-teal)]" : "bg-[var(--pop-red)] text-white"}`}
        >
          {saving() === "enabled" ? "Saving…" : enabled() ? "PAUSE" : "START"}
        </button>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div class="card card-plain p-4 space-y-3 border-2 border-[var(--ink)]">
          <h3 class="font-black text-sm">Orientation Game</h3>
          <p class="text-xs" style={{ color: "var(--ink-soft)" }}>
            Only the selected game is shown and playable on /orientation.
          </p>
          <select
            value={gameType()}
            onChange={(e) => setGameType(e.currentTarget.value)}
            class="input w-full text-sm"
          >
            <option value="">— not set —</option>
            <For each={ORIENTATION_GAME_OPTIONS}>
              {(g) => (
                <option value={g.gameType}>
                  {g.title} ({g.gameType})
                </option>
              )}
            </For>
          </select>
          <button
            type="button"
            onClick={doSaveGameType}
            disabled={!!saving()}
            class="btn-brand text-xs px-3 py-1.5 cursor-pointer"
          >
            {saving() === "game" ? "Saving…" : "Save game"}
          </button>
          <Show when={config()?.gameCard}>
            <div class="text-xs bg-[var(--paper-2)] p-2 rounded border">
              Active: <span class="font-black">{config()!.gameCard!.title}</span> ·{" "}
              {(config()!.gameCard as any).gameType}
            </div>
          </Show>
        </div>

        <div class="card card-plain p-4 space-y-3 border-2 border-[var(--ink)]">
          <h3 class="font-black text-sm">Current Batch Gate</h3>
          <p class="text-xs" style={{ color: "var(--ink-soft)" }}>
            Only students in this batch can start the game when LIVE.
          </p>
          <select
            value={currentBatch()}
            onChange={(e) => setCurrentBatch(e.currentTarget.value)}
            class="input w-full text-sm"
          >
            <For each={ORIENTATION_BATCHES}>{(b) => <option value={b}>Class {b}</option>}</For>
          </select>
          <button
            type="button"
            onClick={doSaveBatch}
            disabled={!!saving()}
            class="btn-brand text-xs px-3 py-1.5 cursor-pointer"
          >
            {saving() === "batch" ? "Saving…" : "Save batch"}
          </button>
          <p class="text-xs font-mono">Current: {config()?.settings.currentBatch ?? "-"}</p>
        </div>
      </div>

      <div class="card card-plain p-4 space-y-3 border-2 border-[var(--ink)]">
        <h3 class="font-black text-sm">Clear Batch Leaderboard</h3>
        <div class="flex items-center gap-2 flex-wrap">
          <select
            value={clearBatch()}
            onChange={(e) => setClearBatch(e.currentTarget.value)}
            class="input w-36 text-sm"
          >
            <For each={ORIENTATION_BATCHES}>{(b) => <option value={b}>Class {b}</option>}</For>
          </select>
          <button
            type="button"
            onClick={doClear}
            disabled={clearBusy()}
            class="btn-ghost bg-red-100 text-xs px-3 py-1.5 border border-red-300 cursor-pointer"
          >
            {clearBusy() ? "Clearing…" : `Clear class ${clearBatch()} leaderboard`}
          </button>
        </div>
        <Show when={board()}>
          <div class="text-xs font-semibold">
            Preview (class {clearBatch()}): {board()!.total} entries
          </div>
          <div class="divide-y text-xs">
            <For each={board()!.entries.slice(0, 8)}>
              {(e) => (
                <div class="py-1 flex justify-between">
                  <span>
                    #{e.rank} {e.name}
                  </span>
                  <span>{e.metric === "score" ? e.score : e.durationMs}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="p-3 bg-[var(--paper-2)] rounded-lg border border-[var(--ink)] flex items-center justify-between gap-3 text-xs font-bold">
        <span>Quick Links:</span>
        <div class="flex items-center gap-3">
          <a
            href="/orientation"
            target="_blank"
            rel="noopener noreferrer"
            class="underline decoration-2 hover:text-[var(--pop-teal)]"
          >
            Open Orientation Page ↗
          </a>
          <a
            href="/orientation/leaderboard"
            target="_blank"
            rel="noopener noreferrer"
            class="underline decoration-2 hover:text-[var(--pop-teal)]"
          >
            Open Orientation Leaderboard ↗
          </a>
        </div>
      </div>
    </div>
  );
}
