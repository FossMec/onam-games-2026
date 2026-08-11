import { Title } from "@solidjs/meta";
import { createAsync, useParams } from "@solidjs/router";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { getMe } from "~/server/auth/actions";
import { getGame, getMyAttempt } from "~/server/games/actions";
import { clearAttempt, getStoredAttempt, storeAttempt } from "~/lib/game-session";

export default function GamePage() {
  const params = useParams();
  const slug = () => params.slug ?? "";
  const game = createAsync(() => getGame(slug()));
  const me = createAsync(() => getMe());
  const myAttempt = createAsync(() => getMyAttempt(slug()));

  const [attemptToken, setAttemptToken] = createSignal<string | null>(null);
  const [startedAt, setStartedAt] = createSignal<number | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [finished, setFinished] = createSignal(false);
  const [result, setResult] = createSignal<{
    valid: boolean;
    durationMs: number;
    afterDeadline: boolean;
  } | null>(null);

  createEffect(() => {
    const stored = getStoredAttempt(slug());
    if (stored && !finished()) {
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
      storeAttempt(slug(), {
        attemptToken: data.attemptToken,
        startedAt: data.startedAt,
      });
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
      setAttemptToken(null);
      setFinished(true);
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

  // Score/details from server state so they survive refresh/revisit.
  const attempt = () => myAttempt();
  const submitted = () => finished() || attempt()?.status === "submitted";
  const score = () =>
    result() ??
    (attempt()?.status === "submitted"
      ? {
          valid: attempt()!.valid,
          durationMs: attempt()!.durationMs ?? 0,
          afterDeadline: attempt()!.afterDeadline,
        }
      : null);

  const playable = () => game() && (game()!.status === "live" || game()!.status === "tester");
  const isBraindead = () => game()?.gameType === "braindead";

  return (
    <main class="container space-y-6 py-8">
      <Title>{game()?.title ?? "Game"} — FOSS Onam Games</Title>

      <Show when={!game()}>
        <p class="text-muted">Game not found.</p>
      </Show>

      <Show when={game()}>
        <a href="/" class="text-sm text-muted hover:text-brand">
          ← Back to home
        </a>

        <section class="space-y-1">
          <p class="text-xs font-medium uppercase tracking-widest text-muted">
            Day {game()!.day} · {game()!.difficulty}
          </p>
          <h1 class="text-3xl font-bold tracking-tight">{game()!.title}</h1>
        </section>

        <Show when={game()!.status === "upcoming"}>
          <div class="card space-y-3">
            <p class="text-muted">Hint: {game()!.hint ?? "A mystery awaits…"}</p>
            <Show when={game()!.releaseAt}>
              <p>
                <span class="text-muted">Releases in </span>
                <span class="font-mono tabular-nums">
                  <Countdown target={new Date(game()!.releaseAt!)} />
                </span>
              </p>
            </Show>
          </div>
        </Show>

        <Show when={game()!.status === "tester"}>
          <div class="card space-y-3">
            <p class="font-semibold text-warn">Tester early access is open.</p>
            <Show when={game()!.releaseAt}>
              <p>
                <span class="text-muted">Public release in </span>
                <span class="font-mono tabular-nums">
                  <Countdown target={new Date(game()!.releaseAt!)} />
                </span>
              </p>
            </Show>
          </div>
        </Show>

        <Show when={game()!.status === "closed"}>
          <div class="card">
            <p class="text-muted">This game has ended. Results are on the leaderboard.</p>
            <a href="/leaderboard" class="btn-ghost mt-4">
              View leaderboard
            </a>
          </div>
        </Show>

        <Show when={playable()}>
          <Show when={!me()}>
            <div class="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-muted">Sign in to play this game.</p>
              <a
                href={`/auth/signin?next=${encodeURIComponent(`/games/${slug()}`)}`}
                class="btn-brand"
              >
                Sign in with Google
              </a>
            </div>
          </Show>

          <Show when={me() && !me()!.onboardingCompleted}>
            <div class="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-muted">Complete your profile before playing.</p>
              <a
                href={`/onboarding?next=${encodeURIComponent(`/games/${slug()}`)}`}
                class="btn-ghost"
              >
                Complete profile
              </a>
            </div>
          </Show>

          <Show when={me()?.onboardingCompleted && !submitted() && !attemptToken()}>
            <div class="card space-y-4 text-center">
              <Show
                when={attempt()?.status !== "in_progress"}
                fallback={<p class="text-muted">You have an attempt in progress.</p>}
              >
                <p class="text-muted">
                  {isBraindead()
                    ? "There is no strategy. There is no skill. There is only the button."
                    : "Only one attempt per game. The timer starts when you press start."}
                </p>
              </Show>
              <button
                type="button"
                onClick={start}
                disabled={busy()}
                class="btn-brand px-8 py-3 text-lg"
              >
                {busy()
                  ? "Starting…"
                  : attempt()?.status === "in_progress"
                    ? "Resume"
                    : isBraindead()
                      ? "START THE POINTLESS RITUAL"
                      : "Start game"}
              </button>
            </div>
          </Show>

          <Show when={me()?.onboardingCompleted && attemptToken() && !submitted()}>
            <div class="card space-y-4 text-center">
              <p class="text-3xl font-bold tabular-nums">
                {Math.floor(elapsed() / 60)}m {elapsed() % 60}s
              </p>
              <p class="text-xs text-muted">Timer is server-side; refreshing does not reset it.</p>
              <Show
                when={!isBraindead()}
                fallback={
                  <button
                    type="button"
                    onClick={finish}
                    disabled={busy()}
                    class="btn-brand px-12 py-6 text-2xl"
                  >
                    {busy() ? "Submitting…" : "THE BUTTON"}
                  </button>
                }
              >
                <button
                  type="button"
                  onClick={finish}
                  disabled={busy()}
                  class="btn-brand px-8 py-3 text-lg"
                >
                  {busy() ? "Submitting…" : "Finish"}
                </button>
              </Show>
            </div>
          </Show>

          <Show when={submitted() && score()}>
            <div class="card space-y-2 text-center">
              <p class="text-xl font-semibold">
                {score()!.valid
                  ? score()!.afterDeadline
                    ? "Completed after the deadline"
                    : "Completed!"
                  : "Submission rejected."}
              </p>
              <Show when={score()!.valid}>
                <p class="text-2xl font-bold tabular-nums text-brand">
                  {(score()!.durationMs / 1000).toFixed(1)}s
                </p>
              </Show>
              <Show when={score()!.afterDeadline}>
                <p class="text-sm text-muted">Counts for the global board only.</p>
              </Show>
              <a href="/leaderboard" class="btn-ghost">
                View leaderboard
              </a>
            </div>
          </Show>

          <Show when={error()}>
            <p class="text-danger">{error()}</p>
          </Show>
        </Show>
      </Show>
    </main>
  );
}
