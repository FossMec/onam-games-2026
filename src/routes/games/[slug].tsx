import { Title } from "@solidjs/meta";
import { createAsync, useParams, useSearchParams } from "@solidjs/router";
import { ChevronLeft, Lock } from "lucide-solid";
import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { Countdown } from "~/components/Countdown";

const GAME_IMAGES: Record<string, string> = {
  "open-source-tinder": "/images/games/open-source-tinder.webp",
  "pookalam-jigsaw": "/images/games/pookalam-jigsaw.webp",
  wend: "/images/games/wend.webp",
  "escape-the-vallam": "/images/games/escape-the-vallam.webp",
  "maveli-jump": "/images/games/maveli-jump.webp",
  "treasure-hunt": "/images/games/treasure-hunt.webp",
  "the-hunt": "/images/games/treasure-hunt.webp",
  "code-a-pookalam": "/images/games/code-a-pookalam.webp",
  "code-a-pookalam-vote": "/images/games/code-a-pookalam.webp",
};

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
import { ShareCard, ShareCardModal } from "~/components/games/ShareCard";
import { WinModal } from "~/components/games/WinModal";
import { VallamGame, type VallamMove, type VallamViewData } from "~/components/games/VallamGame";
import { WendGame, type Cell as WendCell, type WendViewData } from "~/components/games/WendGame";
import { getMe, getMyBanState } from "~/server/auth/actions";
import { getGame, getMyAttempt, getMyRecap } from "~/server/games/actions";
import { getMyStanding, type MyStanding } from "~/server/leaderboard/actions";
import { collegeLabel } from "~/lib/profile";
import type { ShareCardData } from "~/lib/share-card";
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
  /** True from the instant a run lands until the player dismisses the fanfare. */
  const [celebrating, setCelebrating] = createSignal(false);
  const [huntToken, setHuntToken] = createSignal("");
  /**
   * The rules screen, in one of two modes.
   *
   *   "start"  on the way into a run — ends with the button that starts it
   *   "read"   reference only, for a player already mid-run
   */
  const [howTo, setHowTo] = createSignal<"start" | "read" | null>(null);
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
    setHowTo("start");
  };

  /**
   * The rules on their own. Opens read-only whenever a run is already under
   * way, so nothing on that screen can be mistaken for restarting it.
   */
  const openRules = () => setHowTo(attemptToken() ? "read" : "start");

  const confirmStart = async () => {
    await start();
    setHowTo(null);
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
      // The celebration is for the moment it happened, so it is armed here and
      // nowhere else — a reload restores the result but not the fireworks.
      setCelebrating(true);
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

  /** Testers, admins, and closed games play without a run limit for fun. */
  const unlimited = () => result()?.unlimited ?? attempt()?.unlimited ?? isCatchUp() ?? false;
  const attemptsLeft = () => result()?.attemptsRemaining ?? attempt()?.attemptsRemaining ?? 0;
  const isRetryGame = () => (game()?.maxAttempts ?? 1) > 1;

  /**
   * Done for good.
   *
   * Testing a *submitted* attempt alone was not enough — an expired or void run
   * left a Start button the server then refused with a 409, so the player got
   * an error where they should have got their board. Runs remaining is the
   * honest question and covers every terminal status.
   *
   * The `attempt()` guard is load-bearing and was missing: with no attempt row
   * — signed out, or the query still in flight — `attemptsLeft()` falls back to
   * zero, and a first-time visitor was told "you're done with this one, every
   * run has been used" before they had ever played it. No attempt record means
   * nothing is known, which is not the same as nothing is left.
   */
  const finished = () => {
    if (attemptToken() || unlimited()) return false;
    const landed = result();
    if (landed) return landed.attemptsRemaining <= 0;
    const a = attempt();
    if (!a) return false;
    return a.attemptsRemaining <= 0 || (!isRetryGame() && a.status === "submitted");
  };

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
   * The run to describe under the board — this tab's fresh result if there is
   * one, otherwise whatever the server remembers. One value, so the ending is
   * one panel rather than a fresh card stacked on top of a historical one
   * repeating the same number.
   */
  const settledResult = () => result() ?? historyResult();

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

  /**
   * The finished jigsaw, as board state.
   *
   * What was submitted is a *layout* — `{ id, gx, gy }` in whole grid cells —
   * and what the board renders is *progress*, `{ pieces, moveLog }`. Those are
   * different shapes, and handing the first to the component expecting the
   * second crashed it on `pieces.length` of undefined. A cast was papering over
   * exactly that, so nothing complained until the finished board started being
   * shown on every revisit.
   *
   * The layout is anchored wherever the player happened to assemble it, so it
   * is normalised back to the origin; every piece shares one group because a
   * finished puzzle is, by definition, one lump.
   */
  const jigsawFinishedProgress = (): JigsawProgress | null => {
    const submission = finishedBoard()?.submission as {
      layout?: { id: number; gx: number; gy: number }[];
      moveLog?: { p: number; t: number }[];
    } | null;
    const layout = submission?.layout;
    if (!Array.isArray(layout) || layout.length === 0) return null;

    const minX = Math.min(...layout.map((p) => p.gx));
    const minY = Math.min(...layout.map((p) => p.gy));
    return {
      pieces: layout.map((p) => ({ id: p.id, groupId: 0, x: p.gx - minX, y: p.gy - minY })),
      moveLog: submission?.moveLog ?? [],
    };
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
  const attemptKey = () =>
    `${slug()}-${settledResult()?.durationMs ?? 0}-${settledResult()?.score ?? 0}`;

  const resultMood = () =>
    moodForResult({
      valid: settledResult()?.valid ?? false,
      afterDeadline: settledResult()?.afterDeadline ?? false,
      isPersonalBest: settledResult()?.isPersonalBest ?? false,
    });

  /* --------------------------------------------------------------- sharing */

  /**
   * Where this run currently sits on the day's board.
   *
   * Fetched only once a run has actually landed, because it is only ever used
   * by the share card — the rank on the card is the whole reason anyone else
   * clicks the link. A failure here is not worth surfacing: the card falls back
   * to a "just for fun" badge and still shares.
   */
  const [standing, setStanding] = createSignal<MyStanding | null>(null);
  const [sharing, setSharing] = createSignal(false);

  createEffect(() => {
    const g = game();
    const landed = settledResult();
    if (!g || !landed?.valid) return;
    void getMyStanding(g.id)
      .then(setStanding)
      .catch(() => setStanding(null));
  });

  /**
   * Everything the card needs, or null when there is nothing to brag about.
   *
   * Invalid runs never get here — a rejected submission is not a score, and a
   * card announcing one would be a strange thing to post.
   */
  const shareData = createMemo<ShareCardData | null>(() => {
    const g = game();
    const landed = settledResult();
    const user = me();
    if (!g || !user || !landed?.valid) return null;
    return {
      playerName: user.name,
      college: collegeLabel(user.college, user.collegeOther),
      instagram: user.instagramHandle,
      gameTitle: g.title,
      gameSlug: slug(),
      day: g.day,
      metric: landed.metric,
      durationMs: landed.durationMs,
      score: landed.score,
      rank: standing()?.rank ?? null,
      fieldSize: standing()?.fieldSize ?? null,
      afterDeadline: landed.afterDeadline,
      origin: typeof window === "undefined" ? "" : window.location.origin,
      seed: attemptKey(),
    };
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
          <a href="/#games-arena" class="btn-ghost mt-2 inline-block">
            Back to the schedule
          </a>
        </div>
      </Show>

      <Show when={game()}>
        {/*
          One line, always. While a run is open it carries the title and the
          clock and nothing else, because everything below it is the board —
          this page had grown four stacked panels above the game, which on a
          phone meant scrolling past the whole preamble to reach the thing you
          came to play. The preamble now lives inside the start panel, and the
          start panel is gone the moment you are playing.
        */}
        <GameBar
          day={game()!.day}
          title={game()!.title}
          status={game()!.status}
          elapsed={attemptToken() ? elapsed() : null}
          onHowTo={(game()!.howTo?.length ?? 0) > 0 ? openRules : undefined}
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
          <div class="card pop-yellow mx-auto max-w-md space-y-4 p-6 text-center">
            <div
              class="relative mx-auto w-full max-w-[240px] overflow-hidden rounded-xl bg-[var(--paper-3)]"
              style={{
                border: "var(--ink-w-bold) solid var(--ink)",
                "box-shadow": "3px 3px 0 var(--ink)",
              }}
            >
              <img
                src={GAME_IMAGES[slug()] ?? `/images/games/${slug()}.webp`}
                alt="Classified preview"
                class="aspect-square w-full object-cover blur-md opacity-40 grayscale"
              />
              <div class="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                <span
                  class="sticker inline-flex items-center gap-1 font-bold"
                  style={{ "--pop": "var(--pop-red)" }}
                >
                  <Lock size={14} strokeWidth={2.5} />
                  <span>Classified</span>
                </span>
              </div>
            </div>
            <h1 class="text-3xl">{game()!.title}</h1>
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

        {/*
          ---------------------------------------------------------- preview
          The reveal, a day before the release. The same panel a player will
          start the run from, minus the start button — and the rules panel
          below it, which is the part worth reading early.
        */}
        <Show when={game()!.status === "preview"}>
          <StartPanel
            slug={slug()}
            title={game()!.title}
            tagline={game()!.tagline}
            metric={game()!.metric}
            unlimited={false}
            attemptsLeft={game()!.maxAttempts}
            isRetryGame={(game()!.maxAttempts ?? 1) > 1}
            isCatchUp={false}
            isTesterWindow={false}
            preview
            releaseAt={game()!.releaseAt}
            busy={false}
            startLabel=""
            onStart={() => undefined}
            signedIn={!!me()}
            onboarded={!!me()?.onboardingCompleted}
            next={`/games/${slug()}`}
          />
          <Show when={(game()!.howTo?.length ?? 0) > 0}>
            <HowToPlayPanel gameType={game()!.gameType} steps={game()!.howTo} />
          </Show>
        </Show>

        <Show when={playable() && !banState()?.blocksPlay}>
          {/* ------------------------------------------------------ idle */}
          {/*
            The whole pre-game screen, in one panel: what it is, how it ranks,
            what the day's caveat is, and the one button that applies — sign in,
            finish your profile, or start. Those used to be three separate cards
            stacked above a fourth, which meant a signed-out visitor scrolled
            past two boxes before learning what the game even was.

            Suppressed once a run has landed: the result card carries its own
            "Go again", and two start buttons on one screen is a question rather
            than an invitation.
          */}
          <Show when={!attemptToken() && !finished() && !result()}>
            <StartPanel
              slug={slug()}
              title={game()!.title}
              tagline={game()!.tagline}
              metric={game()!.metric}
              unlimited={unlimited()}
              attemptsLeft={attemptsLeft()}
              isRetryGame={isRetryGame()}
              isCatchUp={isCatchUp()}
              isTesterWindow={game()!.status === "tester"}
              releaseAt={game()!.releaseAt}
              busy={busy()}
              startLabel={startLabel()}
              onStart={openHowTo}
              signedIn={!!me()}
              onboarded={!!me()?.onboardingCompleted}
              next={`/games/${slug()}`}
            />
          </Show>

          {/* --------------------------------------------------- in play */}
          {/* No card, no chrome, no preamble. The board is the page. */}
          <Show when={me()?.onboardingCompleted && attemptToken()}>
            <div class="space-y-3 text-center">
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

          {/* ------------------------------------------- the finished board */}
          {/*
            One panel for the whole ending: what you built, then what it cost.

            This used to be three stacked cards — a result card with the shout,
            a quieter duplicate of it for revisits, and the board underneath —
            which meant the thing the player actually made was the last item on
            the page, below two boxes repeating the same number. The shout has
            moved to a modal at the moment of finishing, where a celebration
            belongs, and shrinks to a sticker here. The time sits under the
            board, which is the order you want to read it in: the pookalam, then
            how long it took.
          */}
          <Show when={hasFinishedBoard() || settledResult()}>
            <div class="card card-plain space-y-3">
              <div class="flex items-start justify-between gap-3">
                <p class="rule flex-1">{hasFinishedBoard() ? "Your board" : "Your run"}</p>
                {/*
                  The shout keeps its own treatment here — burst, comic face,
                  ink stroke — at a smaller size. It was briefly a plain badge,
                  which threw away the entire design to save a few pixels.
                */}
                <Show when={settledResult()?.valid}>
                  <ShoutBurst
                    text={shout(resultMood(), attemptKey())}
                    color={SHOUT_COLOR[resultMood()]}
                    seed={attemptKey()}
                    compact
                    class="-my-2 shrink-0"
                  />
                </Show>
              </div>

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
                  initialProgress={jigsawFinishedProgress()}
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

              {/* The numbers, under the thing they describe. */}
              <Show when={settledResult()}>
                <div
                  class="space-y-2 pt-1 text-center"
                  style={{ "border-top": "var(--ink-w) dashed var(--ink)" }}
                >
                  <ResultFigures result={settledResult()!} />
                  <Show when={!settledResult()!.valid}>
                    <p class="font-semibold" style={{ color: "var(--pop-red)" }}>
                      {settledResult()!.reason ?? "This run was not accepted."}
                    </p>
                  </Show>
                  <Show when={settledResult()!.afterDeadline}>
                    <p class="comment">Played for fun · this day’s leaderboard is closed.</p>
                  </Show>
                  <Show
                    when={isRetryGame() && settledResult()!.attemptsRemaining > 0 && !unlimited()}
                  >
                    <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
                      {settledResult()!.attemptsRemaining} run
                      {settledResult()!.attemptsRemaining === 1 ? "" : "s"} left today
                    </span>
                  </Show>
                  <div class="flex flex-wrap justify-center gap-2">
                    {/* The card again, for anyone who dismissed the fanfare. */}
                    <Show when={shareData()}>
                      <button type="button" class="btn-accent" onClick={() => setSharing(true)}>
                        Share my card
                      </button>
                    </Show>
                    <a href="/leaderboard" class="btn-ghost">
                      View leaderboard
                    </a>
                  </div>
                </div>
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

          {/*
            The rules, kept for afterwards. Before a run they live in the modal
            the start button opens, so they cost nothing at the top of the page;
            here they are for anyone re-reading what they just played.
          */}
          <Show
            when={!attemptToken() && (game()!.howTo?.length ?? 0) > 0 && (result() || finished())}
          >
            <HowToPlayPanel gameType={game()!.gameType} steps={game()!.howTo} />
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

      <Show when={howTo() && game()}>
        <HowToPlayModal
          gameType={game()!.gameType}
          title={game()!.title}
          steps={game()!.howTo}
          startLabel={howTo() === "start" ? startLabel() : undefined}
          busy={busy()}
          onStart={howTo() === "start" ? () => void confirmStart() : undefined}
          onClose={() => setHowTo(null)}
        />
      </Show>

      {/* The fanfare, for the moment it happened and no longer. */}
      <Show when={celebrating() && result()}>
        <WinModal
          shout={shout(resultMood(), attemptKey())}
          shoutColor={SHOUT_COLOR[resultMood()]}
          seed={attemptKey()}
          valid={result()!.valid}
          reason={result()!.reason}
          figures={<ResultFigures result={result()!} />}
          share={shareData() ? <ShareCard data={shareData()!} compact /> : undefined}
          afterDeadline={result()!.afterDeadline}
          isPersonalBest={result()!.isPersonalBest}
          runsLeft={unlimited() ? 0 : isRetryGame() ? result()!.attemptsRemaining : 0}
          onGoAgain={
            unlimited() || (isRetryGame() && attemptsLeft() > 0)
              ? () => {
                  setCelebrating(false);
                  openHowTo();
                }
              : undefined
          }
          onClose={() => setCelebrating(false)}
        />
      </Show>

      <Show when={sharing() && shareData()}>
        <ShareCardModal data={shareData()!} onClose={() => setSharing(false)} />
      </Show>
    </main>
  );
}

/* ----------------------------------------------------------------- header */

const STATUS_CHIP: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-teal)" },
  tester: { label: "Tester access", pop: "var(--pop-purple)" },
  preview: { label: "Opens soon", pop: "var(--pop-yellow)" },
  upcoming: { label: "Locked", pop: "var(--paper-3)" },
  closed: { label: "Catch up", pop: "var(--pop-blue)" },
};

const METRIC_CHIP: Record<string, string> = {
  time: "Fastest wins",
  score: "Highest score wins",
  fcfs: "First correct wins",
};

/**
 * One line above the game. That is the entire budget.
 *
 * While a run is open it is the only thing between the top of the page and the
 * board, and it carries the clock — which is the one piece of chrome a player
 * mid-run actually looks at. Idle, it drops the title (the start panel below is
 * already shouting it) and is just a way back.
 */
function GameBar(props: {
  day: number;
  title: string;
  status: string;
  /** Seconds elapsed, or null when no run is open. */
  elapsed: number | null;
  /** Opens the rules. Always available — see the note on the button. */
  onHowTo?: () => void;
}) {
  const chip = () => STATUS_CHIP[props.status] ?? STATUS_CHIP.upcoming;
  const playing = () => props.elapsed !== null;

  return (
    <div class="flex items-center gap-2.5">
      <a
        href="/#games-arena"
        class="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-75 active:translate-y-0.5"
        style={{ background: "var(--paper-2)", border: "var(--ink-w) solid var(--ink)" }}
        aria-label="Back to games"
      >
        <ChevronLeft size={20} />
      </a>

      <Show
        when={playing()}
        fallback={
          <span class="text-xs font-extrabold uppercase tracking-widest text-muted">
            Day {props.day} · All games
          </span>
        }
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-[0.65rem] font-extrabold uppercase tracking-widest text-muted">
            Day {props.day}
          </p>
          <p
            class="truncate leading-tight"
            style={{ "font-family": "var(--font-stack-display)", "font-weight": 800 }}
          >
            {props.title}
          </p>
        </div>
        <span
          class="shrink-0 rounded px-2.5 py-1 tabular-nums text-lg font-bold"
          style={{
            background: "var(--paper-2)",
            border: "var(--ink-w) solid var(--ink)",
            "font-family": "var(--font-stack-mono)",
          }}
          aria-label="Time elapsed"
        >
          {String(Math.floor(props.elapsed! / 60)).padStart(2, "0")}:
          {String(props.elapsed! % 60).padStart(2, "0")}
        </span>
      </Show>

      <Show when={!playing()}>
        <span class="badge ml-auto shrink-0" style={{ "--pop": chip().pop }}>
          {chip().label}
        </span>
      </Show>

      {/*
        The rules, from anywhere, at any point.

        They used to be reachable only through the start button, which meant
        that the moment a run began — or was resumed the next day — there was no
        way back to them at all. On a jigsaw you picked up hours later that is
        precisely when you want them. Mid-run it opens read-only, with no button
        that could be mistaken for restarting the attempt.
      */}
      <Show when={props.onHowTo}>
        <button
          type="button"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-75 active:translate-y-0.5"
          style={{
            background: "var(--pop-yellow)",
            border: "var(--ink-w) solid var(--ink)",
            "font-family": "var(--font-stack-display)",
            "font-weight": 800,
          }}
          onClick={props.onHowTo}
          aria-label="How to play"
          title="How to play"
        >
          ?
        </button>
      </Show>
    </div>
  );
}

/**
 * Everything a player needs before starting, in one panel.
 *
 * This replaces four stacked cards — title panel, tester notice, catch-up
 * notice, how-to accordion, start card — that between them pushed the actual
 * game a full screen down on a phone. They were all saying things worth
 * saying; they just did not each need their own box. The day's caveat is a
 * line here, and the rules are one tap away in the modal that the button opens
 * anyway.
 */
function StartPanel(props: {
  slug: string;
  title: string;
  tagline: string;
  metric: string;
  unlimited: boolean;
  attemptsLeft: number;
  isRetryGame: boolean;
  isCatchUp: boolean;
  isTesterWindow: boolean;
  /**
   * The reveal window: the same panel, with a countdown where the start button
   * goes. One panel rather than two so the game a player reads about today is
   * exactly the one they meet tomorrow.
   */
  preview?: boolean;
  releaseAt: string | null;
  busy: boolean;
  startLabel: string;
  onStart: () => void;
  signedIn: boolean;
  onboarded: boolean;
  /** Where to come back to after signing in or finishing a profile. */
  next: string;
}) {
  const runs = () =>
    props.unlimited
      ? "Unlimited runs · tester"
      : props.isRetryGame
        ? `${props.attemptsLeft} run${props.attemptsLeft === 1 ? "" : "s"} left today`
        : "One attempt";

  const imageSrc = () => GAME_IMAGES[props.slug] ?? `/images/games/${props.slug}.webp`;

  return (
    <section
      class="relative overflow-hidden rounded-xl p-5 text-center sm:p-8"
      style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <Confetti seed={`game-${props.title}`} count={6} animate />
      </div>

      <div class="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
        {/* Game Visual Tile Card (Matching landing page style) */}
        <div
          class="relative w-full max-w-[260px] overflow-hidden rounded-xl bg-[var(--paper-3)] sm:max-w-[300px]"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            "box-shadow": "4px 4px 0 var(--ink)",
          }}
        >
          <img
            src={imageSrc()}
            alt={props.title}
            class="aspect-square w-full object-cover"
            loading="eager"
          />
          <div class="absolute top-2.5 right-2.5 flex gap-1.5">
            <span class="badge shadow-sm" style={{ "--pop": "var(--pop-yellow)" }}>
              {METRIC_CHIP[props.metric] ?? "Ranked"}
            </span>
          </div>
        </div>

        <div class="w-full space-y-3">
          <h1 class="text-3xl sm:text-4xl">{props.title}</h1>
          <Show when={props.tagline}>
            <p class="mx-auto max-w-prose font-semibold text-muted">{props.tagline}</p>
          </Show>

          <div class="flex flex-wrap items-center justify-center gap-2">
            <span class="badge" style={{ "--pop": "var(--pop-yellow)" }}>
              {METRIC_CHIP[props.metric] ?? "Ranked"}
            </span>
            <span class="badge" style={{ "--pop": "var(--paper-3)" }}>
              {runs()}
            </span>
          </div>

          {/* The day's caveat, when there is one. A line, not a panel. */}
          <Show when={props.isCatchUp}>
            <p
              class="mx-auto max-w-prose text-sm font-semibold"
              style={{ color: "var(--pop-blue)" }}
            >
              This day has closed. You can still play just for fun — daily leaderboard rankings are
              closed for this day.
            </p>
          </Show>
          <Show when={props.isTesterWindow}>
            <p class="mx-auto max-w-prose text-sm font-semibold text-warn">
              Tester early access.
              <Show when={props.releaseAt}>
                {" "}
                Public release in{" "}
                <span class="font-mono tabular-nums">
                  <Countdown target={new Date(props.releaseAt!)} />
                </span>
                .
              </Show>
            </p>
          </Show>

          {/*
            Preview: everything above this line is real — the art, the title,
            the rules — and the only thing missing is the button. Showing the
            game a day early is the trailer; the clock is what decides when
            anybody may actually touch it.
          */}
          <Show when={props.preview}>
            <div
              class="mx-auto max-w-sm space-y-1 rounded-lg p-4"
              style={{ background: "var(--paper-3)", border: "var(--ink-w) solid var(--ink)" }}
            >
              <p class="font-display text-sm font-extrabold uppercase tracking-wide">Opens in</p>
              <p class="font-mono text-3xl font-black tabular-nums">
                <Show when={props.releaseAt} fallback="soon">
                  <Countdown target={new Date(props.releaseAt!)} />
                </Show>
              </p>
              <p class="text-sm font-semibold text-muted">
                Have a look around. Nobody plays until the countdown runs out.
              </p>
            </div>
            <p class="comment">read the rules now, save the seconds later.</p>
          </Show>

          {/* One call to action, whichever one actually applies. */}
          <div class="pt-1" classList={{ hidden: props.preview }}>
            <Show
              when={props.signedIn}
              fallback={
                <a
                  href={`/auth/signin?next=${encodeURIComponent(props.next)}`}
                  class="btn-brand inline-block px-10 py-3 text-lg"
                >
                  Sign in to play
                </a>
              }
            >
              <Show
                when={props.onboarded}
                fallback={
                  <a
                    href={`/onboarding?next=${encodeURIComponent(props.next)}`}
                    class="btn-accent inline-block px-10 py-3 text-lg"
                  >
                    Finish your profile
                  </a>
                }
              >
                <button
                  type="button"
                  onClick={props.onStart}
                  disabled={props.busy}
                  class="btn-brand px-10 py-3 text-lg"
                >
                  {props.busy ? "Starting…" : props.startLabel}
                </button>
              </Show>
            </Show>
          </div>
          <Show when={!props.preview}>
            <p class="comment">
              {props.signedIn && props.onboarded
                ? "rules first, then the clock. they're short."
                : "takes ten seconds. the clock doesn't start until you say so."}
            </p>
          </Show>
        </div>
      </div>
    </section>
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
