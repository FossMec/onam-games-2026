import { Title } from "@solidjs/meta";
import { createAsync, useParams, useSearchParams } from "@solidjs/router";
import { ChevronLeft } from "lucide-solid";
import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { Countdown } from "~/components/Countdown";
import { ShoutBurst } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { HowToPlayModal, HowToPlayPanel } from "~/components/games/HowToPlay";
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
import { TinderRecap } from "~/components/games/TinderRecap";
import { VallamGame, type VallamMove, type VallamViewData } from "~/components/games/VallamGame";
import { WendGame, type Cell as WendCell, type WendViewData } from "~/components/games/WendGame";
import { getMe, getMyBanState } from "~/server/auth/actions";
import { getGame, getMyAttempt, getMyRecap } from "~/server/games/actions";
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
type TinderSubmission = { passes: { id: string; open: boolean }[][] };

interface FinishPayload {
  valid: boolean;
  durationMs: number;
  rawDurationMs: number;
  penaltyMs: number;
  score: number | null;
  metric: "time" | "score" | "fcfs";
  afterDeadline: boolean;
  attemptsRemaining: number;
  unlimited: boolean;
  isPersonalBest: boolean;
  reason?: string;
}

/**
 * Server errors, rewritten for a human mid-game.
 *
 * The raw strings are correct but they read like a status code — "You have
 * already played this game" lands as a rejection when what actually happened is
 * that the player finished it and their board is sitting right below the
 * message. Anything unrecognised falls through unchanged rather than being
 * flattened into a generic apology, because an unknown error the player can
 * quote is worth more than a polite one they cannot.
 */
const FRIENDLY_ERRORS: Record<string, string> = {
  "You have already played this game":
    "You have already played this one — it was one run only. Your board and your time are below.",
  "You are out of runs for today":
    "That was your last run of the day. Your best one is the one that counts.",
  "This game is not available yet": "Not open yet. The countdown above is the honest answer.",
  "Attempt not found": "That run has gone stale. Reload the page and start a fresh one.",
  "This attempt has already been submitted":
    "That run is already in. Reload the page to see how it went.",
  "Too many requests": "Easy — too many requests too fast. Give it a few seconds.",
  Forbidden: "That run belongs to a different account.",
  "Game not found": "There is no game at this address.",
  "Submission too large": "That submission was too big to accept. Reload and play the run again.",
  "Internal error": "Something broke on our end, not yours. Try again in a moment.",
};

const friendly = (raw: string) => FRIENDLY_ERRORS[raw] ?? raw;

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
  const [result, setResult] = createSignal<FinishPayload | null>(null);
  const [huntToken, setHuntToken] = createSignal("");
  const [howToOpen, setHowToOpen] = createSignal(false);
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
    setNow(Date.now());
    setRestored(getProgress(stored.attemptToken));
    void start();
  });

  createEffect(() => {
    if (startedAt() === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  /**
   * Elapsed seconds, floored at zero.
   *
   * Two things made this briefly show a negative time. `now` only ticks once a
   * second, so the first render after an attempt started was using a timestamp
   * from before the round trip; and `startedAt` is the *server's* clock, which
   * can legitimately sit a little ahead of the browser's. Together they showed
   * "-1m 3s" for a moment before the first tick corrected it.
   *
   * `now` is refreshed the instant an attempt starts, and the clamp handles the
   * clock skew that no amount of refreshing can fix. Elapsed time here is only
   * ever a display; the ranked duration is measured server-side.
   */
  const elapsed = () =>
    startedAt() === null ? 0 : Math.max(0, Math.floor((now() - startedAt()!) / 1000));

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
        setError(friendly(data.error ?? "Failed to start"));
        // A refused start means the stored attempt is gone or spent. Leaving it
        // behind would retry the same refusal on every reload.
        clearAttempt(slug());
        setAttemptToken(null);
        setStartedAt(null);
        return;
      }
      storeAttempt(slug(), { attemptToken: data.attemptToken, startedAt: data.startedAt });
      setAttemptToken(data.attemptToken);
      setStartedAt(new Date(data.startedAt).getTime());
      setNow(Date.now());
      setView(data.view ?? null);
      setResult(null);
    } catch {
      setError("Network hiccup — the run could not be started. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  /** Opens the rules first; the clock only starts from inside the modal. */
  const openHowTo = () => {
    setError("");
    setHowToOpen(true);
  };

  const confirmStart = async () => {
    await start();
    setHowToOpen(false);
  };

  /**
   * Asks the server whether a traced Wend path spells one of the hidden words.
   * The words never reach the browser, so this round trip is the only way the
   * board can lock a word in. See `routes/api/game/[slug]/trace.ts`.
   */
  const traceWord = async (cells: WendCell[]): Promise<string | null> => {
    const token = attemptToken();
    if (!token) return null;
    const res = await fetch(`/api/game/${slug()}/trace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptToken: token, cells }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { word?: string | null };
    return data.word ?? null;
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
        setError(friendly(data.error ?? "Failed to submit"));
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
        rawDurationMs: data.rawDurationMs ?? data.durationMs ?? 0,
        penaltyMs: data.penaltyMs ?? 0,
        score: data.score ?? null,
        metric: data.metric ?? "time",
        afterDeadline: data.afterDeadline ?? false,
        attemptsRemaining: data.attemptsRemaining ?? 0,
        unlimited: data.unlimited ?? false,
        isPersonalBest: data.isPersonalBest ?? false,
        reason: data.reason,
      });
    } catch {
      setError("Network hiccup — that submission did not land. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const attempt = () => myAttempt();
  const isHunt = () => game()?.gameType === "hunt";
  const isTinder = () => game()?.gameType === "tinder";
  const isJigsaw = () => game()?.gameType === "jigsaw";
  const isWend = () => game()?.gameType === "wend";
  const isVallam = () => game()?.gameType === "unblock";
  const isJump = () => game()?.gameType === "jump";

  const tinderCards = (): TinderCardView[] | null => {
    const current = view();
    return current && current.kind === "tinder" ? (current.cards as TinderCardView[]) : null;
  };
  const jigsawView = (): JigsawViewData | null => {
    const current = view();
    return current && current.kind === "jigsaw" ? (current as JigsawViewData) : null;
  };
  const wendView = (): WendViewData | null => {
    const current = view();
    return current && current.kind === "wend" ? (current as WendViewData) : null;
  };
  const vallamView = (): VallamViewData | null => {
    const current = view();
    return current && current.kind === "vallam" ? (current as VallamViewData) : null;
  };
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

  /** Testers and admins play without a run limit, so they are never "finished". */
  const unlimited = () => result()?.unlimited ?? attempt()?.unlimited ?? false;
  const attemptsLeft = () => result()?.attemptsRemaining ?? attempt()?.attemptsRemaining ?? 0;
  const isRetryGame = () => (game()?.maxAttempts ?? 1) > 1;

  /**
   * Done for good.
   *
   * This used to test only for a *submitted* attempt, which left an expired or
   * void run showing a Start button that the server then refused with a 409 —
   * the player got an error where they should have got their board. Runs
   * remaining is the honest question, and it covers every terminal status.
   */
  const finished = () =>
    !attemptToken() &&
    !unlimited() &&
    (attemptsLeft() <= 0 || (!isRetryGame() && attempt()?.status === "submitted"));

  /**
   * The last run, as the server remembers it.
   *
   * `result` only exists in the tab that finished the run. Coming back later —
   * a reload, a new device, the next morning — used to show an empty page with
   * a "Your board" heading and nothing under it. The attempt row has everything
   * needed to say what happened, so a revisit says it.
   */
  const historyResult = createMemo<FinishPayload | null>(() => {
    const a = attempt();
    if (!a || a.status !== "submitted" || result()) return null;
    return {
      valid: a.valid,
      durationMs: a.durationMs ?? 0,
      rawDurationMs: a.durationMs ?? 0,
      penaltyMs: 0,
      score: a.metric === "score" ? (a.bestScore ?? a.score) : a.score,
      metric: a.metric,
      afterDeadline: a.afterDeadline,
      attemptsRemaining: a.attemptsRemaining,
      unlimited: a.unlimited,
      isPersonalBest: false,
    };
  });

  /**
   * The answer key for a finished Tinder deck. Gated server-side on the
   * player's own submitted attempt, so asking for it early gets nothing.
   */
  const recap = createAsync(async () => {
    if (!isTinder()) return null;
    if (attempt()?.status !== "submitted") return null;
    return getMyRecap(slug());
  });

  /**
   * The deck to draw on a finished Tinder board.
   *
   * Normally the one the player actually swiped, kept in localStorage. On a
   * different browser there is no localStorage, so the server's reveal stands
   * in: it is the same deck, from the same seed, and it is the half of this
   * screen worth reading anyway. Without the fallback, playing on a phone and
   * looking back on a laptop showed nothing at all.
   */
  const tinderFinishedCards = (): TinderCardView[] | null => {
    const board = finishedBoard()?.view as { kind?: string; cards?: TinderCardView[] } | undefined;
    if (board?.kind === "tinder" && board.cards) return board.cards;
    const revealed = recap()?.cards;
    return revealed
      ? revealed.map((c) => ({ id: c.id, name: c.name, category: c.category }))
      : null;
  };

  /** Whether there is actually a board to draw. Stops an empty "Your board". */
  const finishedKind = () => (finishedBoard()?.view as GameView | undefined)?.kind;
  const hasFinishedBoard = () =>
    !attemptToken() &&
    (["wend", "vallam", "jigsaw"].includes(finishedKind() ?? "")
      ? !!finishedBoard()
      : isTinder() && !!tinderFinishedCards());

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

  /** Stable per-result so the shout and burst don't reshuffle on re-render. */
  const attemptKey = () => `${slug()}-${result()?.durationMs ?? 0}-${result()?.score ?? 0}`;

  const resultMood = () =>
    moodForResult({
      valid: result()?.valid ?? false,
      afterDeadline: result()?.afterDeadline ?? false,
      isPersonalBest: result()?.isPersonalBest ?? false,
    });

  const startLabel = () =>
    attempt()?.status === "in_progress"
      ? "Resume run"
      : (attempt()?.attemptsUsed ?? 0) > 0
        ? "Go again"
        : "Start the clock";

  return (
    <main class="container space-y-6 py-6">
      <Title>{game()?.title ?? "Game"} — FOSS Onam Games</Title>

      <Show when={!game()}>
        <div class="card pop-red space-y-2 text-center">
          <p class="font-extrabold">There is no game at this address.</p>
          <a href="/" class="btn-ghost mt-2 inline-block">
            Back to the schedule
          </a>
        </div>
      </Show>

      <Show when={game()}>
        {/* ------------------------------------------------------------ header */}
        <GameHeader
          day={game()!.day}
          difficulty={game()!.difficulty}
          title={game()!.title}
          tagline={game()!.tagline}
          status={game()!.status}
          metric={game()!.metric}
          maxAttempts={game()!.maxAttempts}
          unlimited={unlimited()}
        />

        {/*
          The warning modal and the benched banner both live in the app shell
          now, so they show on every page. All this page still does is refuse to
          hand out a board — which is the part that has to be here.
        */}
        <Show when={banState()?.blocksPlay}>
          <div class="card pop-red space-y-2">
            <p class="font-extrabold">{banState()!.message}</p>
            <a href="/leaderboard" class="btn-ghost inline-block">
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
          <div class="card pop-purple space-y-2">
            <p class="font-extrabold text-warn">Tester early access is open.</p>
            <Show when={game()!.releaseAt}>
              <p>
                <span class="text-muted">Public release in </span>
                <span class="font-mono tabular-nums">
                  <Countdown target={new Date(game()!.releaseAt!)} />
                </span>
              </p>
            </Show>
            <p class="comment">break it now so nobody else gets to.</p>
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

        {/* How to play stays on the page, for before and after. */}
        <Show when={(game()!.howTo?.length ?? 0) > 0 && !attemptToken()}>
          <HowToPlayPanel gameType={game()!.gameType} steps={game()!.howTo} />
        </Show>

        <Show when={playable() && !banState()?.blocksPlay}>
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
          {/*
            Suppressed once a run has just landed: the result card carries its
            own "Go again", and two start buttons on one screen is a question
            rather than an invitation.
          */}
          <Show when={me()?.onboardingCompleted && !attemptToken() && !finished() && !result()}>
            <div class="card pop-teal space-y-4 text-center">
              <p class="font-semibold">
                {unlimited()
                  ? "Tester access: play this as many times as you like. None of it touches the player board."
                  : isRetryGame()
                    ? `Your best run of the day is the one that counts. ${attemptsLeft()} run${attemptsLeft() === 1 ? "" : "s"} left.`
                    : "One attempt. The clock starts when you press the button, not before."}
              </p>
              <button
                type="button"
                onClick={openHowTo}
                disabled={busy()}
                class="btn-brand px-8 py-3 text-lg"
              >
                {busy() ? "Starting…" : startLabel()}
              </button>
              <p class="comment">the rules come up first. read them, they're short.</p>
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
                    onTrace={traceWord}
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
              <ResultFigures result={result()!} />

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
              <Show when={isRetryGame() && result()!.attemptsRemaining > 0 && !unlimited()}>
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

          {/*
            The quieter version, for a revisit. Same facts, no fanfare — the
            celebration belongs to the moment you finished, not to every reload
            after it.
          */}
          <Show when={historyResult()}>
            <div class="card pop-blue space-y-3 text-center">
              <p class="rule justify-center">Your run</p>
              <ResultFigures result={historyResult()!} />
              <Show when={!historyResult()!.valid}>
                <p class="font-semibold" style={{ color: "var(--pop-red)" }}>
                  This run was not accepted.
                </p>
              </Show>
              <Show when={historyResult()!.afterDeadline}>
                <p class="comment">counted for the overall board, not this day's.</p>
              </Show>
              <div>
                <a href="/leaderboard" class="btn-ghost">
                  View leaderboard
                </a>
              </div>
            </div>
          </Show>

          {/* -------------------------------------------- the finished board */}
          {/*
            Shown once the attempt is over and kept across reloads. Finishing a
            puzzle and having it vanish into a result card is a bad ending —
            people want to look at the thing they solved. Every board is
            `disabled`, so this is a picture, not a second go.
          */}
          <Show when={hasFinishedBoard()}>
            <div class="card card-plain space-y-3">
              <p class="rule">Your board</p>
              <Show when={finishedKind() === "wend"}>
                <WendGame
                  view={finishedBoard()!.view as WendViewData}
                  disabled
                  initialFound={
                    (finishedBoard()!.submission as { found?: WendFound[] } | null)?.found
                  }
                  onFinish={() => undefined}
                />
              </Show>
              <Show when={finishedKind() === "vallam"}>
                <VallamGame
                  view={finishedBoard()!.view as VallamViewData}
                  disabled
                  initialMoves={
                    (finishedBoard()!.submission as { moves?: VallamMove[] } | null)?.moves
                  }
                  onFinish={() => undefined}
                />
              </Show>
              <Show when={finishedKind() === "jigsaw"}>
                <JigsawGame
                  view={finishedBoard()!.view as JigsawViewData}
                  startedAt={0}
                  disabled
                  initialProgress={finishedBoard()!.submission as JigsawProgress | null}
                  onFinish={() => undefined}
                />
              </Show>
              <Show when={isTinder() && tinderFinishedCards()}>
                <TinderRecap
                  cards={tinderFinishedCards()!}
                  passes={(finishedBoard()?.submission as TinderSubmission | null)?.passes ?? []}
                  reveal={recap()?.cards ?? null}
                />
              </Show>
            </div>
          </Show>

          {/* Retry games keep the start button available until runs run out. */}
          <Show
            when={
              result() && !attemptToken() && (unlimited() || (isRetryGame() && attemptsLeft() > 0))
            }
          >
            <div class="text-center">
              <button
                type="button"
                onClick={openHowTo}
                disabled={busy()}
                class="btn-brand px-8 py-3 text-lg"
              >
                {busy() ? "Starting…" : "Go again"}
              </button>
            </div>
          </Show>

          {/* Out of runs, with nothing left to press. Say so kindly. */}
          <Show when={finished() && !result() && !historyResult()}>
            <div class="card space-y-2 text-center">
              <p class="font-extrabold">You're done with this one.</p>
              <p class="text-muted">
                Every run you had for this game has been used. The leaderboard has the rest.
              </p>
              <a href="/leaderboard" class="btn-ghost mt-1 inline-block">
                View leaderboard
              </a>
            </div>
          </Show>

          <Show when={error()}>
            <div class="card pop-red space-y-2">
              <div class="flex items-start gap-3">
                <SpriteIcon name="papad-face" size={34} animate="wobble" alt="" />
                <p class="flex-1 font-semibold">{error()}</p>
              </div>
              <button type="button" class="btn-ghost" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={howToOpen() && game()}>
        <HowToPlayModal
          gameType={game()!.gameType}
          title={game()!.title}
          steps={game()!.howTo}
          startLabel={startLabel()}
          busy={busy()}
          onStart={() => void confirmStart()}
          onClose={() => setHowToOpen(false)}
        />
      </Show>
    </main>
  );
}

/* ----------------------------------------------------------------- header */

const STATUS_CHIP: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-teal)" },
  tester: { label: "Tester access", pop: "var(--pop-purple)" },
  upcoming: { label: "Locked", pop: "var(--paper-3)" },
  closed: { label: "Catch up", pop: "var(--pop-blue)" },
};

const METRIC_CHIP: Record<string, string> = {
  time: "Fastest wins",
  score: "Highest score wins",
  fcfs: "First correct wins",
};

/**
 * The game's title panel.
 *
 * Previously a bare text link and an h1 floating on the page background, which
 * made the one screen a player stares at for ten minutes the least designed
 * screen on the site. It is a comic panel now, like everything else: inked box,
 * confetti, the day as a sticker, and the facts that decide how you play —
 * ranking metric and how many runs you get — as chips rather than as a
 * paragraph nobody reads.
 */
function GameHeader(props: {
  day: number;
  difficulty: string;
  title: string;
  tagline: string;
  status: string;
  metric: string;
  maxAttempts: number;
  unlimited: boolean;
}) {
  const chip = () => STATUS_CHIP[props.status] ?? STATUS_CHIP.upcoming;

  return (
    <div class="space-y-3">
      <a
        href="/"
        class="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-transform duration-75 active:translate-y-0.5"
        style={{
          background: "var(--paper-2)",
          border: "var(--ink-w) solid var(--ink)",
          "font-family": "var(--font-stack-display)",
          "font-weight": 800,
        }}
      >
        <ChevronLeft size={18} />
        All games
      </a>

      <section
        class="relative overflow-hidden rounded-lg px-4 py-5 sm:px-6"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Confetti seed={`game-${props.title}`} count={6} animate />
        </div>

        <div class="relative space-y-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="sticker" style={{ "--pop": "var(--pop-yellow)" }}>
              Day {props.day}
            </span>
            <span class="badge" style={{ "--pop": chip().pop }}>
              {chip().label}
            </span>
            <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
              {props.difficulty}
            </span>
          </div>

          <h1 class="text-3xl sm:text-4xl">{props.title}</h1>
          <Show when={props.tagline}>
            <p class="max-w-prose font-semibold text-muted">{props.tagline}</p>
          </Show>

          <div
            class="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs font-extrabold uppercase tracking-wider text-muted"
            style={{ "border-top": "var(--ink-w) dashed var(--ink)", "padding-top": "0.6rem" }}
          >
            <span>{METRIC_CHIP[props.metric] ?? "Ranked"}</span>
            <span>
              {props.unlimited
                ? "Unlimited runs (tester)"
                : props.maxAttempts === 1
                  ? "One attempt"
                  : `${props.maxAttempts} runs a day`}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- figures */

/** The numbers from a run: the score, or the clock and what it cost. */
function ResultFigures(props: { result: FinishPayload }) {
  return (
    <>
      <Show when={props.result.valid && props.result.metric === "score"}>
        <p class="text-3xl font-bold tabular-nums">
          {(props.result.score ?? 0).toLocaleString("en-IN")}
          <span class="text-base"> m above Paathalam</span>
        </p>
      </Show>
      <Show when={props.result.valid && props.result.metric !== "score"}>
        <div class="space-y-1">
          <p class="text-3xl font-bold tabular-nums">
            {(props.result.durationMs / 1000).toFixed(1)}s
          </p>
          {/*
            A ranked time with an invisible penalty baked into it reads as a
            mistake. Broken out, it reads as a rule.
          */}
          <Show when={props.result.penaltyMs > 0}>
            <p class="text-sm font-semibold text-muted tabular-nums">
              {(props.result.rawDurationMs / 1000).toFixed(1)}s on the clock ·{" "}
              <span style={{ color: "var(--pop-red)" }}>
                +{(props.result.penaltyMs / 1000).toFixed(0)}s in penalties
              </span>
            </p>
          </Show>
        </div>
      </Show>
    </>
  );
}
