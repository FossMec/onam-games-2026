import { For, createSignal } from "solid-js";
import { resetUserAttemptsAction } from "~/server/admin/actions";

export function UserAttemptReset(props: {
  userId: string;
  userName: string;
  games: { id: string; title: string; day: number }[];
  onReload: () => void;
  onNotify: (message: string) => void;
}) {
  const [gameId, setGameId] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const clear = async () => {
    const label = gameId() ? "this game's" : "all game";
    if (!confirm(`Delete ${label} attempts for ${props.userName}?`)) return;
    setBusy(true);
    try {
      const count = await resetUserAttemptsAction(props.userId, gameId() || undefined);
      props.onNotify(`Cleared ${count} attempt${count === 1 ? "" : "s"} for ${props.userName}`);
      props.onReload();
    } catch (error) {
      props.onNotify(error instanceof Error ? error.message : "Failed to clear user attempts");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="mt-2 flex flex-wrap justify-end gap-1.5">
      <select
        class="input py-1 px-1.5 text-[11px]"
        value={gameId()}
        onChange={(e) => setGameId(e.currentTarget.value)}
      >
        <option value="">All games</option>
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
        class="btn-ghost px-2 py-1 text-[11px]"
        disabled={busy()}
        onClick={clear}
      >
        Clear {gameId() ? "game" : "all"} data
      </button>
    </div>
  );
}
