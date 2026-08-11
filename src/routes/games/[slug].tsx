import { Title } from "@solidjs/meta";
import { createAsync, useParams } from "@solidjs/router";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { getMe } from "~/server/auth/actions";
import { getGame } from "~/server/games/actions";
import { clearAttempt, getStoredAttempt, storeAttempt } from "~/lib/game-session";

export default function GamePage() {
  const params = useParams();
  const slug = () => params.slug ?? "";
  const game = createAsync(() => getGame(slug()));
  const me = createAsync(() => getMe());

  const [attemptToken, setAttemptToken] = createSignal<string | null>(null);
  const [startedAt, setStartedAt] = createSignal<number | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [busy, setBusy] = createSignal(false);
  const [result, setResult] = createSignal<{
    valid: boolean;
    durationMs: number;
    afterDeadline: boolean;
  } | null>(null);
  const [error, setError] = createSignal("");

  createEffect(() => {
    const stored = getStoredAttempt(slug());
    if (stored && !result()) {
      setAttemptToken(stored.attemptToken);
      setStartedAt(new Date(stored.startedAt).getTime());
    }
  });

  createEffect(() => {
    if (startedAt() === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  const elapsed = () => (startedAt() === null ? 0 : Math.floor((now() - startedAt()!) / 1000));

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/game/${slug()}/start`, { method: "POST" });
      const data = (await res.json()) as {
        attemptToken?: string;
        startedAt?: string;
        error?: string;
      };
      if (!res.ok || !data.attemptToken || !data.startedAt) {
        setError(data.error ?? "Failed to start");
        return;
      }
      storeAttempt(slug(), { attemptToken: data.attemptToken, startedAt: data.startedAt });
      setAttemptToken(data.attemptToken);
      setStartedAt(new Date(data.startedAt).getTime());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    const token = attemptToken();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/game/${slug()}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptToken: token,
          submittedState: isBraindead() ? { pressed: true } : { placeholder: true },
          movesCount: isBraindead() ? 1 : 0,
        }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        durationMs?: number;
        afterDeadline?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to submit");
        return;
      }
      clearAttempt(slug());
      setResult({
        valid: data.valid ?? false,
        durationMs: data.durationMs ?? 0,
        afterDeadline: data.afterDeadline ?? false,
      });
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const playable = () => game() && (game()!.status === "live" || game()!.status === "tester");
  const isBraindead = () => game()?.gameType === "braindead";

  return (
    <main>
      <Title>{game()?.title ?? "Game"} — FOSS Onam Games</Title>

      <Show when={!game()}>
        <p>Game not found.</p>
      </Show>

      <Show when={game()}>
        <h1>{game()!.title}</h1>
        <p>
          Day {game()!.day} · {game()!.difficulty}
        </p>

        <Show when={game()!.status === "upcoming"}>
          <p>Hint: {game()!.hint ?? "A mystery awaits…"}</p>
          <Show when={game()!.releaseAt}>
            <p>
              Releases in <Countdown target={new Date(game()!.releaseAt!)} />
            </p>
          </Show>
        </Show>

        <Show when={game()!.status === "tester"}>
          <p>Tester early access is open.</p>
          <Show when={game()!.releaseAt}>
            <p>
              Public release in <Countdown target={new Date(game()!.releaseAt!)} />
            </p>
          </Show>
        </Show>

        <Show when={game()!.status === "closed"}>
          <p>This game has ended. Results are on the leaderboard.</p>
        </Show>

        <Show when={playable()}>
          <Show when={!me()}>
            <p>
              <a href="/auth/signin">Sign in to play</a>
            </p>
          </Show>

          <Show when={me() && !me()!.onboardingCompleted}>
            <p>
              <a href="/onboarding">Complete your profile to play</a>
            </p>
          </Show>

          <Show when={me()?.onboardingCompleted && !attemptToken() && !result()}>
            <button
              type="button"
              onClick={start}
              disabled={busy()}
              class={isBraindead() ? "btn btn-brand" : undefined}
            >
              {busy() ? "Starting…" : isBraindead() ? "START THE POINTLESS RITUAL" : "Start game"}
            </button>
            <p>
              {isBraindead()
                ? "There is no strategy. There is no skill. There is only the button. Timer starts now."
                : "Only one attempt per game. The timer starts when you press start."}
            </p>
          </Show>

          <Show when={me()?.onboardingCompleted && attemptToken() && !result()}>
            <p>
              Timer: {Math.floor(elapsed() / 60)}m {elapsed() % 60}s
            </p>
            <Show
              when={isBraindead()}
              fallback={<p>Timer is server-side; refreshing does not reset it.</p>}
            >
              <p>Your mission, should you choose to accept it: press the button.</p>
              <button
                type="button"
                onClick={finish}
                disabled={busy()}
                class="btn btn-brand"
                style={isBraindead() ? "font-size: 1.4rem; padding: 1.5rem 3rem" : undefined}
              >
                {busy() ? "Submitting…" : "THE BUTTON"}
              </button>
            </Show>
          </Show>

          <Show when={result()}>
            <p>
              {result()!.valid
                ? result()!.afterDeadline
                  ? "Completed after the deadline — counts for global only."
                  : isBraindead()
                    ? `Wow. Incredible. You pressed a button in ${(result()!.durationMs / 1000).toFixed(1)}s. You are a legend among legends.`
                    : "Completed! Your time: " + (result()!.durationMs / 1000).toFixed(1) + "s"
                : isBraindead()
                  ? "You failed to press the button. Even the button is disappointed."
                  : "Submission rejected."}
            </p>
          </Show>

          <Show when={error()}>
            <p>{error()}</p>
          </Show>
        </Show>
      </Show>
    </main>
  );
}
