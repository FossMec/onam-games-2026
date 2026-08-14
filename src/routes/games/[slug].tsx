import { Title } from "@solidjs/meta";
import { createAsync, useParams, useSearchParams } from "@solidjs/router";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { ShoutBurst } from "~/components/art/Burst";
import {
  JigsawGame,
  type JigsawProgress,
  type JigsawViewData,
} from "~/components/games/JigsawGame";
import { JumpGame, type JumpViewData } from "~/components/games/JumpGame";
import {
  TinderGame,
  type TinderCardView,
  type TinderProgress,
} from "~/components/games/TinderGame";
import { VallamGame, type VallamMove, type VallamViewData } from "~/components/games/VallamGame";
import { WendGame, type Cell as WendCell, type WendViewData } from "~/components/games/WendGame";
import { ackWarningAction, getMe, getMyBanState } from "~/server/auth/actions";
import { getGame, getMyAttempt } from "~/server/games/actions";
import {
  clearAttempt,
  clearProgress,
  getFinished,
  getProgress,
  getStoredAttempt,
  saveFinished,
  saveProgress,
  storeAttempt,
} from "~/lib/game-session";
import { SHOUT_COLOR, moodForResult, shout } from "~/lib/shouts";

/**
 * The client-visible half of a generated instance. Discriminated by `kind` so
 * each game board can narrow to its own shape; the solution half never ships.
 */
type GameView =
  | { kind: "tinder"; cards: TinderCardView[] }
  | JigsawViewData
  | WendViewData
  | VallamViewData
  | JumpViewData
  | { kind: "hunt"; prompt: string }
  | { kind: string; [key: string]: unknown };

type WendFound = { word: string; cells: WendCell[] };

interface FinishPayload {
  valid: boolean;
  durationMs: number;
  score: number | null;
  metric: "time" | "score" | "fcfs";
  afterDeadline: boolean;
  attemptsRemaining: number;
  isPersonalBest: boolean;
  reason?: string;
}

export default function GamePage() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const slug = () => params.slug ?? "";
  const game = createAsync(() => getGame(slug()));
  const me = createAsync(() => getMe());
  const myAttempt = createAsync(() => getMyAttempt(slug()));
  const banState = createAsync(() => getMyBanState());

  const [attemptToken, setAttemptToken] = createSignal<string | null>(null);
  const [startedAt, setStartedAt] = createSignal<number | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [warningDismissed, setWarningDismissed] = createSignal(false);
  const [result, setResult] = createSignal<FinishPayload | null>(null);
  const [huntToken, setHuntToken] = createSignal("");
  /** The playable board from the server. Never contains the solution. */
  const [view, setView] = createSignal<GameView | null>(null);
  const [rehydrated, setRehydrated] = createSignal(false);
  /** Board state restored from a previous visit, handed to the board on mount. */
  const [restored, setRestored] = createSignal<unknown>(null);
  /**
   * The finished board, so a player can still look at what they did after a
   * reload. Read once on mount; the server owns the result, this owns the
   * picture of it.
   */
  const [finishedBoard, setFinishedBoard] = createSignal<{
    view: GameView;
    submission: unknown;
  } | null>(null);

  /**
   * Board progress is written on every move, which for the jigsaw is a lot of
   * writes. `saveProgress` is a synchronous localStorage call, so it is kept
   * off the move path itself and batched to the next idle frame.
   */
  const persist = (progress: unknown) => {
    const token = attemptToken();
    if (!token) return;
    queueMicrotask(() => saveProgress(token, progress));
  };

  /*
   * A refresh loses the board, so an attempt found in local storage is
   * rehydrated by calling `/start` again. That endpoint is idempotent — it
   * returns the *existing* attempt with the same seed and the same original
   * `startedAt`, so resuming never re-rolls the puzzle or resets the clock.
   */
  createEffect(() => {
    if (rehydrated() || result()) return;
    setRehydrated(true);

    // A finished board outlives the attempt, so it is restored first and
    // independently — a player who comes back tomorrow still gets to see it.
    const done = getFinished(slug());
    if (done) {
      setFinishedBoard({ view: done.view as GameView, submission: done.submission });
    }

    const stored = getStoredAttempt(slug());
    if (!stored) return;
    setAttemptToken(stored.attemptToken);
    setStartedAt(new Date(stored.startedAt).getTime());
    setRestored(getProgress(stored.attemptToken));
    void start();
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
        view?: GameView;
        error?: string;
      };
      if (!res.ok || !data.attemptToken || !data.startedAt) {
        setError(data.error ?? "Failed to start");
        return;
      }
      storeAttempt(slug(), { attemptToken: data.attemptToken, startedAt: data.startedAt });
      setAttemptToken(data.attemptToken);
      setStartedAt(new Date(data.startedAt).getTime());
      setView(data.view ?? null);
      setResult(null);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const finish = async (submittedState: unknown) => {
    const token = attemptToken();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/game/${slug()}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptToken: token, submittedState }),
      });
      const data = (await res.json()) as Partial<FinishPayload> & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to submit");
        return;
      }
      // Keep the board before dropping the attempt, so the player can look at
      // what they submitted instead of it vanishing into a result card.
      const board = view();
      if (board) {
        saveFinished(slug(), {
          view: board,
          submission: submittedState,
          finishedAt: new Date().toISOString(),
        });
        setFinishedBoard({ view: board, submission: submittedState });
      }
      clearProgress(token);
      clearAttempt(slug());
      setAttemptToken(null);
      setStartedAt(null);
      setResult({
        valid: data.valid ?? false,
        durationMs: data.durationMs ?? 0,
        score: data.score ?? null,
        metric: data.metric ?? "time",
        afterDeadline: data.afterDeadline ?? false,
        attemptsRemaining: data.attemptsRemaining ?? 0,
        isPersonalBest: data.isPersonalBest ?? false,
        reason: data.reason,
      });
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const attempt = () => myAttempt();
  const isHunt = () => game()?.gameType === "hunt";
  const isTinder = () => game()?.gameType === "tinder";

  const isJigsaw = () => game()?.gameType === "jigsaw";

  const tinderCards = (): TinderCardView[] | null => {
    const current = view();
    return current && current.kind === "tinder" ? (current.cards as TinderCardView[]) : null;
  };

  const jigsawView = (): JigsawViewData | null => {
    const current = view();
    return current && current.kind === "jigsaw" ? (current as JigsawViewData) : null;
  };

  const isWend = () => game()?.gameType === "wend";
  const wendView = (): WendViewData | null => {
    const current = view();
    return current && current.kind === "wend" ? (current as WendViewData) : null;
  };
  const isVallam = () => game()?.gameType === "unblock";
  const vallamView = (): VallamViewData | null => {
    const current = view();
    return current && current.kind === "vallam" ? (current as VallamViewData) : null;
  };
  const isJump = () => game()?.gameType === "jump";
  const jumpView = (): JumpViewData | null => {
    const current = view();
    return current && current.kind === "jump" ? (current as JumpViewData) : null;
  };
  /*
   * Closed games stay playable — every past day is open forever so a latecomer
   * can catch up. The run counts towards the overall table at the completion
   * floor and never touches that day's board; the server decides that from its
   * own clock, this is only what to render.
   */
  const isCatchUp = () => game()?.status === "closed";
  const playable = () =>
    game() && (game()!.status === "live" || game()!.status === "tester" || isCatchUp());

  const attemptsLeft = () => result()?.attemptsRemaining ?? attempt()?.attemptsRemaining ?? 0;
  const isRetryGame = () => (game()?.maxAttempts ?? 1) > 1;

  /** One-shot games are done for good; retry games are done only once runs run out. */
  const finished = () =>
    isRetryGame()
      ? attemptsLeft() <= 0 && !attemptToken()
      : (result() !== null || attempt()?.status === "submitted") && !attemptToken();

  /**
   * The final hunt clue hands the token over as a URL parameter, so a scanned
   * QR lands straight on a resolved submission. The value is stripped from the
   * address bar once read — it is the answer, and it should not sit in history
   * or get pasted into a group chat along with the page link.
   */
  createEffect(() => {
    if (!isHunt()) return;
    const fromUrl = searchParams.token;
    const value = Array.isArray(fromUrl) ? fromUrl[0] : fromUrl;
    if (!value) return;
    setHuntToken(value);
    setSearchParams({ token: undefined }, { replace: true });
  });

  // Auto-submit a URL-delivered token the moment there is an attempt to put it on.
  createEffect(() => {
    if (!isHunt() || busy() || result()) return;
    if (huntToken() && attemptToken()) {
      void finish({ token: huntToken() });
    }
  });

  const showWarning = () => banState()?.level === 1 && banState()!.needsAck && !warningDismissed();

  /** Stable per-result so the shout and burst don't reshuffle on re-render. */
  const attemptKey = () => `${slug()}-${result()?.durationMs ?? 0}-${result()?.score ?? 0}`;

  const resultMood = () =>
    moodForResult({
      valid: result()?.valid ?? false,
      afterDeadline: result()?.afterDeadline ?? false,
      isPersonalBest: result()?.isPersonalBest ?? false,
    });

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
          <Show when={game()!.tagline}>
            <p class="text-muted">{game()!.tagline}</p>
          </Show>
        </section>

        {/* Level-1 warning: acknowledge before anything else on the page works. */}
        <Show when={showWarning()}>
          <div class="card space-y-3 border-warn/40 bg-warn/10">
            <p class="font-semibold text-warn">Heads up</p>
            <p class="text-sm">{banState()!.message}</p>
            <button
              type="button"
              class="btn-ghost"
              onClick={() => {
                setWarningDismissed(true);
                void ackWarningAction();
              }}
            >
              OK, understood
            </button>
          </div>
        </Show>

        <Show when={banState()?.blocksPlay}>
          <div class="card border-danger/40 bg-danger/10">
            <p class="text-sm text-danger">{banState()!.message}</p>
            <a href="/leaderboard" class="btn-ghost mt-3">
              View leaderboard
            </a>
          </div>
        </Show>

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

        <Show when={isCatchUp()}>
          <div class="card pop-blue space-y-2">
            <p class="font-extrabold">This day is over, but you can still play it.</p>
            <p class="font-semibold">
              It counts towards the overall board — but not this day's leaderboard, and not for a
              rank. That field already settled.
            </p>
            <p class="comment">no clock to beat. just you and the puzzle. finally.</p>
            <a href="/leaderboard" class="btn-ghost mt-2 inline-block">
              View leaderboard
            </a>
          </div>
        </Show>

        <Show when={playable() && !banState()?.blocksPlay && !showWarning()}>
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

          {/* ------------------------------------------------------ idle */}
          <Show when={me()?.onboardingCompleted && !attemptToken() && !finished()}>
            <div class="card space-y-4 text-center">
              <p class="text-muted">
                {isRetryGame()
                  ? `Your best run of the day is the one that counts. ${attemptsLeft()} run${attemptsLeft() === 1 ? "" : "s"} left.`
                  : "Only one attempt per game. The timer starts when you press start."}
              </p>
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
                    : isRetryGame() && (attempt()?.attemptsUsed ?? 0) > 0
                      ? "Go again"
                      : "Start game"}
              </button>
            </div>
          </Show>

          {/* --------------------------------------------------- in play */}
          <Show when={me()?.onboardingCompleted && attemptToken()}>
            <div class="card space-y-4 text-center">
              <p class="text-3xl font-bold tabular-nums">
                {Math.floor(elapsed() / 60)}m {elapsed() % 60}s
              </p>
              <p class="text-xs text-muted">Refreshing won't reset the clock — finish the run.</p>

              <Show when={isHunt()}>
                <div class="space-y-3">
                  <input
                    value={huntToken()}
                    onInput={(e) => setHuntToken(e.currentTarget.value)}
                    placeholder="Paste the final token"
                    class="input text-center font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => finish({ token: huntToken() })}
                    disabled={busy() || !huntToken().trim()}
                    class="btn-brand px-8 py-3 text-lg"
                  >
                    {busy() ? "Checking…" : "Submit token"}
                  </button>
                </div>
              </Show>

              <Show when={isTinder()}>
                <Show
                  when={tinderCards()}
                  fallback={<p class="font-semibold">Dealing the deck…</p>}
                >
                  <TinderGame
                    slug={slug()}
                    attemptToken={attemptToken()!}
                    cards={tinderCards()!}
                    disabled={busy()}
                    initialProgress={restored() as TinderProgress | null}
                    onProgress={persist}
                    onFinish={(submission) => finish(submission)}
                  />
                </Show>
              </Show>

              <Show when={isJigsaw()}>
                <Show
                  when={jigsawView()}
                  fallback={<p class="font-semibold">Cutting the pookalam…</p>}
                >
                  <JigsawGame
                    view={jigsawView()!}
                    startedAt={startedAt() ?? Date.now()}
                    disabled={busy()}
                    initialProgress={restored() as JigsawProgress | null}
                    onProgress={persist}
                    onFinish={(submission) => finish(submission)}
                  />
                </Show>
              </Show>

              <Show when={isWend()}>
                <Show when={wendView()} fallback={<p class="font-semibold">Shuffling letters…</p>}>
                  <WendGame
                    view={wendView()!}
                    disabled={busy()}
                    initialFound={(restored() as { found?: WendFound[] } | null)?.found}
                    onProgress={(found) => persist({ found })}
                    onFinish={(submission) => finish(submission)}
                  />
                </Show>
              </Show>

              <Show when={isVallam()}>
                <Show when={vallamView()} fallback={<p class="font-semibold">Launching boats…</p>}>
                  <VallamGame
                    view={vallamView()!}
                    disabled={busy()}
                    initialMoves={(restored() as { moves?: VallamMove[] } | null)?.moves}
                    onProgress={(moves) => persist({ moves })}
                    onFinish={(submission) => finish(submission)}
                  />
                </Show>
              </Show>

              <Show when={isJump()}>
                {/*
                  `keyed` matters here: this is the one game with retries, and
                  the canvas holds a whole simulation in local state. Without it
                  "Go again" would reuse the component and carry the dead run's
                  physics into the new attempt.
                */}
                <Show
                  when={jumpView()}
                  keyed
                  fallback={<p class="font-semibold">Waking Maveli…</p>}
                >
                  {(current) => (
                    <JumpGame
                      view={current}
                      disabled={busy()}
                      onFinish={(submission) => finish(submission)}
                    />
                  )}
                </Show>
              </Show>

              <Show
                when={
                  !isHunt() && !isTinder() && !isJigsaw() && !isWend() && !isVallam() && !isJump()
                }
              >
                <p class="text-sm text-muted">
                  This game's board is not wired up yet — it will render here.
                </p>
              </Show>
            </div>
          </Show>

          {/* -------------------------------------------- the finished board */}
          {/*
            Shown once the attempt is over and kept across reloads. Finishing a
            puzzle and having it vanish into a result card is a bad ending —
            people want to look at the thing they solved. Every board is
            `disabled`, so this is a picture, not a second go.
          */}
          <Show when={!attemptToken() && finishedBoard()}>
            <div class="card card-plain space-y-3">
              <p class="rule">Your board</p>
              <Show when={(finishedBoard()!.view as GameView).kind === "wend"}>
                <WendGame
                  view={finishedBoard()!.view as WendViewData}
                  disabled
                  initialFound={
                    (finishedBoard()!.submission as { found?: WendFound[] } | null)?.found
                  }
                  onFinish={() => undefined}
                />
              </Show>
              <Show when={(finishedBoard()!.view as GameView).kind === "vallam"}>
                <VallamGame
                  view={finishedBoard()!.view as VallamViewData}
                  disabled
                  initialMoves={
                    (finishedBoard()!.submission as { moves?: VallamMove[] } | null)?.moves
                  }
                  onFinish={() => undefined}
                />
              </Show>
              <Show when={(finishedBoard()!.view as GameView).kind === "jigsaw"}>
                <JigsawGame
                  view={finishedBoard()!.view as JigsawViewData}
                  startedAt={0}
                  disabled
                  initialProgress={finishedBoard()!.submission as JigsawProgress | null}
                  onFinish={() => undefined}
                />
              </Show>
            </div>
          </Show>

          {/* ----------------------------------------------------- result */}
          <Show when={result()}>
            <div class="card pop-yellow space-y-3 text-center">
              {/*
                The shout carries the verdict — it is the loudest moment on the
                site and the payoff for the whole run. Keyed on the attempt so a
                refresh shows the same word instead of reshuffling.
              */}
              <ShoutBurst
                text={shout(resultMood(), attemptKey())}
                color={SHOUT_COLOR[resultMood()]}
                seed={attemptKey()}
              />

              <Show when={result()!.valid && result()!.metric === "score"}>
                <p class="text-3xl font-bold tabular-nums">
                  {(result()!.score ?? 0).toLocaleString("en-IN")}
                  <span class="text-base"> m above Paathalam</span>
                </p>
              </Show>
              <Show when={result()!.valid && result()!.metric !== "score"}>
                <p class="text-3xl font-bold tabular-nums">
                  {(result()!.durationMs / 1000).toFixed(1)}s
                </p>
              </Show>

              <Show when={!result()!.valid && result()!.reason}>
                <p class="font-semibold" style={{ color: "var(--pop-red)" }}>
                  {result()!.reason}
                </p>
              </Show>
              <Show when={result()!.afterDeadline}>
                <p class="comment">
                  counts for the overall board, not this day's. you got there eventually.
                </p>
              </Show>
              <Show when={isRetryGame() && result()!.attemptsRemaining > 0}>
                <span class="badge" style={{ "--pop": "var(--paper-2)" }}>
                  {result()!.attemptsRemaining} run
                  {result()!.attemptsRemaining === 1 ? "" : "s"} left today
                </span>
              </Show>

              <div>
                <a href="/leaderboard" class="btn-ghost">
                  View leaderboard
                </a>
              </div>
            </div>
          </Show>

          {/* Retry games keep the start button available until runs run out. */}
          <Show when={isRetryGame() && result() && result()!.attemptsRemaining > 0}>
            <div class="text-center">
              <button
                type="button"
                onClick={start}
                disabled={busy()}
                class="btn-brand px-8 py-3 text-lg"
              >
                {busy() ? "Starting…" : "Go again"}
              </button>
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
