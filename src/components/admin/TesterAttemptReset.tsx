import { For, createSignal } from "solid-js";
import { resetTesterAttemptsAction } from "~/server/admin/actions";

type ResetScope = "testers" | "games" | "both";

export function TesterAttemptReset(props: {
  users: { email: string; role: string | null }[];
  games: { id: string; title: string; day: number }[];
  onReload: () => void;
  onNotify: (message: string) => void;
}) {
  const [scope, setScope] = createSignal<ResetScope>("testers");
  const [selectedTesters, setSelectedTesters] = createSignal<string[]>([]);
  const [selectedGames, setSelectedGames] = createSignal<string[]>([]);
  const [busy, setBusy] = createSignal(false);
  const testers = () => props.users.filter((user) => user.role === "tester");

  const clearAll = () => reset({ allTesters: true });
  const reset = async (input: Parameters<typeof resetTesterAttemptsAction>[0]) => {
    if (!confirm("Permanently delete the selected tester attempts and leaderboard rows?")) return;
    setBusy(true);
    try {
      const count = await resetTesterAttemptsAction(input);
      props.onNotify(`Cleared ${count} tester attempt${count === 1 ? "" : "s"}`);
      props.onReload();
    } catch (error) {
      props.onNotify(error instanceof Error ? error.message : "Failed to clear tester attempts");
    } finally {
      setBusy(false);
    }
  };

  const resetSelected = () => {
    const emails = selectedTesters();
    const gameIds = selectedGames();
    if ((scope() === "testers" || scope() === "both") && emails.length === 0) {
      props.onNotify("Select at least one tester");
      return;
    }
    if ((scope() === "games" || scope() === "both") && gameIds.length === 0) {
      props.onNotify("Select at least one game");
      return;
    }
    void reset({
      allTesters: scope() === "games",
      testerEmails: scope() === "testers" || scope() === "both" ? emails : undefined,
      gameIds: scope() === "games" || scope() === "both" ? gameIds : undefined,
    });
  };

  return (
    <section class="card card-plain space-y-3 bg-[var(--pop-yellow)]/30">
      <div>
        <h3 class="font-black">Reset Tester Game Data</h3>
        <p class="text-xs font-semibold opacity-80">
          Only users with the tester role are affected. Normal players and admins are never deleted.
        </p>
      </div>
      <button type="button" class="btn-brand text-xs" disabled={busy()} onClick={clearAll}>
        Clear all tester attempts
      </button>
      <div class="grid gap-2 sm:grid-cols-3">
        <select
          class="input text-xs font-bold"
          value={scope()}
          onChange={(e) => setScope(e.currentTarget.value as ResetScope)}
        >
          <option value="testers">Selected testers · all games</option>
          <option value="games">All testers · selected games</option>
          <option value="both">Selected testers · selected games</option>
        </select>
        <select
          multiple
          class="input min-h-20 text-xs font-bold"
          disabled={scope() === "games"}
          onChange={(e) =>
            setSelectedTesters(
              Array.from(e.currentTarget.selectedOptions, (option) => option.value),
            )
          }
        >
          <For each={testers()}>{(user) => <option value={user.email}>{user.email}</option>}</For>
        </select>
        <select
          multiple
          class="input min-h-20 text-xs font-bold"
          disabled={scope() === "testers"}
          onChange={(e) =>
            setSelectedGames(Array.from(e.currentTarget.selectedOptions, (option) => option.value))
          }
        >
          <For each={props.games}>
            {(game) => (
              <option value={game.id}>
                Day {game.day}: {game.title}
              </option>
            )}
          </For>
        </select>
      </div>
      <button type="button" class="btn-ghost text-xs" disabled={busy()} onClick={resetSelected}>
        Clear selected tester data
      </button>
    </section>
  );
}
