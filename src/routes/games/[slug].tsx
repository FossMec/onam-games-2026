import { clientOnly } from "@solidjs/start";
import { Link, Meta, Title } from "@solidjs/meta";
import { A, createAsync, useNavigate, useParams, revalidate } from "@solidjs/router";
import { ChevronLeft } from "lucide-solid";
import { SITE_URL } from "~/lib/site";
import { formatAdaptiveClock, formatAdaptiveDuration } from "~/lib/time";
import { Show, Suspense, createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import { ShoutBurst } from "~/components/art/Burst";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { LoadingScreen } from "~/components/LoadingScreen";
import { HowToPlayModal } from "~/components/games/HowToPlay";
import { PookalamNudgeModal } from "~/components/games/PookalamNudgeModal";
import type { JigsawProgress, JigsawViewData } from "~/components/games/JigsawGame";
import type { JumpViewData } from "~/components/games/JumpGame";
import type { TinderCardView, TinderProgress } from "~/components/games/TinderGame";
import { TinderRecap } from "~/components/games/TinderRecap";
import { ShareCard, ShareCardModal } from "~/components/games/ShareCard";
import { WinModal } from "~/components/games/WinModal";
import { CommunityGroupCard } from "~/components/CommunityGroupCard";
import type { VallamMove, VallamViewData } from "~/components/games/VallamGame";
import type { Cell as WendCell, WendViewData } from "~/components/games/WendGame";

// Each game engine runs strictly in the browser on the client (CSR)
const JigsawGame = clientOnly(() =>
  import("~/components/games/JigsawGame").then((m) => ({ default: m.JigsawGame })),
);
const JumpGame = clientOnly(() =>
  import("~/components/games/JumpGame").then((m) => ({ default: m.JumpGame })),
);
const TinderGame = clientOnly(() =>
  import("~/components/games/TinderGame").then((m) => ({ default: m.TinderGame })),
);
const VallamGame = clientOnly(() =>
  import("~/components/games/VallamGame").then((m) => ({ default: m.VallamGame })),
);
const WendGame = clientOnly(() =>
  import("~/components/games/WendGame").then((m) => ({ default: m.WendGame })),
);
const TreasureHuntGame = clientOnly(() =>
  import("~/components/games/TreasureHuntGame").then((m) => ({ default: m.TreasureHuntGame })),
);
import { getMyRecap } from "~/server/games/actions";
import {
  gameBySlug,
  myAttempt as myAttemptQuery,
  viewer,
  banState as banStateQuery,
} from "~/lib/queries";
import { getMyStanding, type MyStanding } from "~/server/leaderboard/actions";
import { collegeLabel } from "~/lib/profile";
import type { ShareCardData } from "~/lib/share-card";
import { jumpSprite } from "~/lib/img";
import {
  clearAttempt,
  clearProgress,
  getFinished,
  getProgress,
  getStoredAttempt,
  saveFinished,
  saveProgress,
  storeAttempt,
  type StoredAttempt,
} from "~/lib/game-session";
import { SHOUT_COLOR, moodForResult, shout } from "~/lib/shouts";

/**
 * Fully CSR: SSR bails early (see GameArenaPage window guard below).
 * Preload is intentionally removed — it would run gameBySlug/myAttempt on the
 * server and burn 10-15ms CPU per hit. Data loads client-side via query cache
 * after hydration, which keeps SSR to a ~1ms shell.
 * Warm the game chunk as soon as the slug is known instead.
 */

function warmChunkForGameType(type: string) {
  switch (type) {
    case "tinder":
      return import("~/components/games/TinderGame");
    case "jigsaw":
      return import("~/components/games/JigsawGame");
    case "wend":
      return import("~/components/games/WendGame");
    case "unblock":
      return import("~/components/games/VallamGame");
    case "jump":
      return import("~/components/games/JumpGame");
    case "hunt":
      return import("~/components/games/TreasureHuntGame");
    default:
      return Promise.resolve();
  }
}

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

const FRIENDLY_ERRORS: Record<string, string> = {
  "You have already played this game":
    "You have already played this one. Your board and your time are below.",
  "You are out of runs for today":
    "That was your last run of the day. Your best one is the one that counts.",
  "This game is not available yet": "Not open yet.",
  "Attempt not found": "That run has gone stale. Return to the hub to start fresh.",
  "This attempt has already been submitted":
    "That run is already in. Return to the hub to view results.",
  "Too many requests": "Too many requests too fast. Give it a few seconds.",
  Forbidden: "That run belongs to a different account.",
  "Game not found": "There is no game at this address.",
  "Submission too large": "That submission was too big to accept.",
  "Internal error": "Something broke on our end. Try again in a moment.",
};

const friendly = (raw: string) => FRIENDLY_ERRORS[raw] ?? raw;

export default function GameArenaPage() {
  // SSR bail: render a cheap shell on the server, do zero DB/CPU.
  // Matches admin/index.tsx pattern; Cloudflare Pages free has 10ms CPU budget.
  if (typeof window === "undefined") {
    return (
      <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--paper)]">
        <LoadingScreen compact message="Inking daily challenge…" />
      </div>
    );
  }
  const params = useParams();
  const navigate = useNavigate();
  const slug = () => params.slug ?? "";
  // Use initialValue to avoid suspending the outer <Suspense> (app.tsx) on
  // reload — the page was stuck at "Compiling festival shaders…" because
  // createAsync without initialValue suspends the FileRoutes boundary until
  // game/me/attempt resolve. With initialValue the page renders immediately
  // with its own inner loading UI (Inking daily challenge…).
  const game = createAsync(() => gameBySlug(slug()), { initialValue: undefined as any });
  const me = createAsync(() => viewer(), { initialValue: null as any });
  const myAttempt = createAsync(() => myAttemptQuery(slug()), { initialValue: undefined as any });
  const banState = createAsync(() => banStateQuery(), { initialValue: null as any });

  // Direct access to /games/[slug] is now allowed. The previous
  // auto-redirect to /games?game=slug on every non-hub entry made
  // hard reloads on /games/treasure-hunt bounce to the hub and, combined
  // with the outer Suspense, left the page stuck at “Compiling festival
  // shaders…”. The hub still sets enteredArenaFromHub for the happy path,
  // but the arena no longer forces a redirect — it self-starts via
  // fetchAttemptView if no stored attempt exists.
  // (No navigation here; see GamesHubView for the hub-owned start flow.)

  const [attemptToken, setAttemptToken] = createSignal<string | null>(null);
  const [startedAt, setStartedAt] = createSignal<number | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [result, setResult] = createSignal<FinishPayload | null>(null);
  const [celebrating, setCelebrating] = createSignal(false);
  const [showHowTo, setShowHowTo] = createSignal(false);
  const [showNudge, setShowNudge] = createSignal(false);
  const [view, setView] = createSignal<GameView | null>(null);
  const [restored, setRestored] = createSignal<unknown>(null);
  const [jumpScore, setJumpScore] = createSignal(0);
  const [finishedBoard, setFinishedBoard] = createSignal<{
    view: GameView;
    submission: unknown;
  } | null>(null);

  const persist = (progress: unknown) => {
    const token = attemptToken();
    if (!token) return;
    queueMicrotask(() => saveProgress(token, progress));
  };

  // Dedupe concurrent fetchAttemptView calls (hub->arena double POST race)
  let fetchInflight: Promise<void> | null = null;

  createEffect((prevSlug?: string) => {
    const currentSlug = slug();
    if (!currentSlug) return currentSlug;

    if (prevSlug !== currentSlug) {
      setAttemptToken(null);
      setStartedAt(null);
      setError("");
      setResult(null);
      setView(null);
      setRestored(null);
      setJumpScore(0);
      setFinishedBoard(null);
      setCelebrating(false);
      setShowHowTo(false);
      setShowNudge(false);
      setStanding(null);

      const done = getFinished(currentSlug);
      if (done) {
        setFinishedBoard({
          view: done.view as GameView,
          submission: done.submission,
        });
      }

      const stored = getStoredAttempt(currentSlug) as (StoredAttempt & { view?: GameView }) | null;
      // Hunt progress is server-owned. Wait for the server attempt summary
      // before hydrating a cached token, otherwise a reset/submitted hunt can
      // be resurrected by stale localStorage.
      const serverAttempt = currentSlug === "treasure-hunt" ? myAttempt() : null;
      if (currentSlug === "treasure-hunt" && serverAttempt === undefined) {
        return prevSlug;
      }
      if (
        currentSlug === "treasure-hunt" &&
        stored?.attemptToken &&
        serverAttempt &&
        serverAttempt.status !== "in_progress"
      ) {
        clearProgress(stored.attemptToken);
        clearAttempt(currentSlug);
      }
      const usableStored =
        currentSlug === "treasure-hunt" && serverAttempt?.status !== "in_progress" ? null : stored;
      // Fast path: Hub already stored the view with the token — hydrate instantly, zero extra POST.
      // This is the 2-request path (Hub POST start + eventual finish). Arena does NOT re-POST.
      if (usableStored?.attemptToken) {
        if (usableStored.view) {
          setView(usableStored.view as GameView);
          setAttemptToken(usableStored.attemptToken);
          setStartedAt(new Date(usableStored.startedAt).getTime());
          setNow(Date.now());
          setRestored(getProgress(usableStored.attemptToken));
          const g = game();
          if (g?.gameType) void warmChunkForGameType(g.gameType);
          else if ((usableStored.view as { kind?: string })?.kind)
            void warmChunkForGameType((usableStored.view as { kind?: string }).kind ?? "");
          return currentSlug;
        }
        // Stored token but no view (legacy or cleared) — fall through to fetch via game() gate below
        setAttemptToken(usableStored.attemptToken);
        setStartedAt(new Date(usableStored.startedAt).getTime());
        setNow(Date.now());
        setRestored(getProgress(usableStored.attemptToken));
        const g = game();
        if (g?.gameType) void warmChunkForGameType(g.gameType);
        // Trigger fetch reactively once game() is defined (see gate below)
      }
    }

    return currentSlug;
  });

  // Gate: when game() becomes defined and we have a stored token but no view yet,
  // fetch exactly once. Replaces the old 40×50ms polling anti-pattern with a
  // reactive Solid gate — zero timers, zero CPU burn on the 10ms Cloudflare path.
  createEffect(() => {
    const g = game();
    if (g === undefined) return;
    if (view() !== null) return;
    const stored = getStoredAttempt(slug()) as (StoredAttempt & { view?: GameView }) | null;
    if (stored?.view) {
      // Hub view might have arrived after initial effect — hydrate now
      setView(stored.view as GameView);
      if (!attemptToken()) {
        setAttemptToken(stored.attemptToken);
        setStartedAt(new Date(stored.startedAt).getTime());
        setNow(Date.now());
        setRestored(getProgress(stored.attemptToken));
      }
      return;
    }
    // No view yet — need to fetch. This is the deep-link / cleared-storage path
    // (the only case that legitimately does a POST from the arena).
    if (!g || g.status === "upcoming") return;
    if (busy()) return;
    if (hasFinishedRun()) return;
    // For jump unlimited we still rely on start/finish pair; Hub path already short-circuited.
    // Only fetch if we don't have a token or we have token but no view and server says in_progress
    const attempt = myAttempt();
    if (attempt && attempt.status === "submitted" && !stored) return;
    void fetchAttemptView();
  });

  // Automatically restore in-progress attempt if localStorage was cleared or missing
  // (legacy guard — now covered by gate above, kept minimal)
  createEffect(() => {
    const attempt = myAttempt();
    const currentSlug = slug();
    if (!currentSlug || !attempt) return;
    if (attempt.status === "in_progress" && !attemptToken() && !busy() && !view()) {
      const stored = getStoredAttempt(currentSlug) as (StoredAttempt & { view?: GameView }) | null;
      if (stored?.view) {
        setView(stored.view as GameView);
        setAttemptToken(stored.attemptToken);
        setStartedAt(new Date(stored.startedAt).getTime());
        setNow(Date.now());
        setRestored(getProgress(stored.attemptToken));
        const g = game();
        if (g?.gameType) void warmChunkForGameType(g.gameType);
        return;
      }
      // Deep-link without stored token — gate will handle it once game() is ready
    }
  });

  const fetchAttemptView = async () => {
    if (fetchInflight) return fetchInflight;
    const g = game();
    // Reactive gate guarantees game() is defined; bail quietly if not (gate will retry when defined)
    if (g === undefined || g === null) return;
    if (g.status === "upcoming") return;
    // Ensure chunk is ready BEFORE starting the server clock — but hub already did this.
    // This await only runs on the deep-link path where hub prewarm didn't happen.
    if (g?.gameType) {
      try {
        await warmChunkForGameType(g.gameType);
      } catch {
        // Non-fatal — still start; rendering will Suspense on chunk
      }
    }
    setBusy(true);
    const task = (async () => {
      try {
        const res = await fetch(`/api/game/${slug()}/start`, { method: "POST" });
        const data = (await res.json()) as {
          attemptToken?: string;
          startedAt?: string;
          view?: GameView;
          error?: string;
        };
        if (!res.ok || !data.view) {
          setError(friendly(data.error ?? "Failed to start attempt"));
          return;
        }
        setView(data.view);
        if (data.attemptToken) {
          setAttemptToken(data.attemptToken);
          setRestored(getProgress(data.attemptToken));
          storeAttempt(slug(), {
            attemptToken: data.attemptToken,
            startedAt: data.startedAt || new Date().toISOString(),
            view: data.view,
          });
        }
        if (data.startedAt) setStartedAt(new Date(data.startedAt).getTime());
        setNow(Date.now());
      } catch {
        setError("Network hiccup - please check your connection and retry.");
      } finally {
        setBusy(false);
        fetchInflight = null;
      }
    })();
    fetchInflight = task;
    return task;
  };

  // As soon as we know today's gameType, warm its chunk — don't wait for view fetch.
  // `upcoming` stays masked (gameType=""), so future days' JS never loads.
  createEffect(() => {
    const g = game();
    if (!g?.gameType || g.status === "upcoming") return;
    void warmChunkForGameType(g.gameType);
  });

  createEffect(() => {
    if (startedAt() === null) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    onCleanup(() => clearInterval(timer));
  });

  const elapsed = () => (startedAt() === null ? 0 : Math.max(0, now() - startedAt()!));

  // Hunt is FCFS — rank by wall-clock since release, not since click. Show time since releaseAt.
  const huntElapsed = () => {
    const r = game()?.releaseAt;
    if (!r) return elapsed();
    return Math.max(0, now() - new Date(r).getTime());
  };

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
      // For jump (score-metric, unlimited retries): include the client's local
      // simulation score so the server can skip the expensive replay when this
      // run can't beat the player's existing best. The server ignores this value
      // for all other games and always re-derives the score from the simulation
      // when verification does run.
      const g = game();
      const body: Record<string, unknown> = { attemptToken: token, submittedState };
      if (g?.gameType === "jump") {
        body.claimedScore = jumpScore();
      }
      const res = await fetch(`/api/game/${slug()}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Partial<FinishPayload> & { error?: string };
      if (!res.ok) {
        setError(friendly(data.error ?? "Failed to submit"));
        return;
      }
      const board = view();
      if (board) {
        saveFinished(slug(), {
          view: board,
          submission: submittedState,
          finishedAt: new Date().toISOString(),
        });
        setFinishedBoard({ view: board, submission: submittedState });
      }
      setCelebrating(true);
      clearProgress(token);
      clearAttempt(slug());
      setAttemptToken(null);
      setStartedAt(null);
      void revalidate("my-attempt");
      void revalidate("games");
      const finalResult = {
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
      };
      setResult(finalResult);
      // Sync the live score badge with the server-verified score so the
      // GameBar and ResultFigures always show the same number.
      if (data.score != null) setJumpScore(data.score);
    } catch {
      setError("Network hiccup - submission did not land. Check connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Jump is unlimited — let players immediately start another climb from the end card.
  // Wrapped with Code-a-Pookalam nudge: the in-game Try Again now shows the same
  // popup that the Hub shows before Start, so every new run gets the ₹3,000 nudge.
  const doPlayAgain = async () => {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      await warmChunkForGameType("jump");
      const res = await fetch(`/api/game/${slug()}/start`, { method: "POST" });
      const data = (await res.json()) as {
        attemptToken?: string;
        startedAt?: string;
        view?: GameView;
        error?: string;
      };
      if (!res.ok || !data.attemptToken || !data.startedAt || !data.view) {
        setError(data.error ?? "Failed to start new run");
        return;
      }
      storeAttempt(slug(), {
        attemptToken: data.attemptToken,
        startedAt: data.startedAt,
        view: data.view,
      });
      setAttemptToken(data.attemptToken);
      setStartedAt(new Date(data.startedAt).getTime());
      setNow(Date.now());
      setView(data.view);
      setJumpScore(0);
      setResult(null);
      setCelebrating(false);
      setError("");
      void revalidate("my-attempt");
    } catch {
      setError("Network hiccup - could not start new run.");
    } finally {
      setBusy(false);
    }
  };

  const playAgain = () => {
    if (busy() || showNudge()) return;
    setShowNudge(true);
  };

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

  const isTester = () =>
    (me()?.role === "tester" || me()?.role === "admin") && (game()?.testerMode ?? true);

  const historyResult = createMemo<FinishPayload | null>(() => {
    const a = myAttempt();
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

  const settledResult = () => result() ?? historyResult();

  const recap = createAsync(
    async () => {
      if (!isTinder()) return null;
      if (myAttempt()?.status !== "submitted") return null;
      return getMyRecap(slug());
    },
    { initialValue: null as any },
  );

  const tinderFinishedCards = (): TinderCardView[] | null => {
    const board = finishedBoard()?.view as { kind?: string; cards?: TinderCardView[] } | undefined;
    if (board?.kind === "tinder" && board.cards) return board.cards;
    const revealed = recap()?.cards;
    return revealed
      ? revealed.map((c: { id: string; name: string; category: string }) => ({
          id: c.id,
          name: c.name,
          category: c.category,
        }))
      : null;
  };

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
      pieces: layout.map((p) => ({
        id: p.id,
        groupId: 0,
        x: p.gx - minX,
        y: p.gy - minY,
      })),
      moveLog: submission?.moveLog ?? [],
    };
  };

  const finishedKind = () => (finishedBoard()?.view as GameView | undefined)?.kind;
  const hasFinishedBoard = () =>
    !attemptToken() &&
    (["wend", "vallam", "jigsaw"].includes(finishedKind() ?? "")
      ? !!finishedBoard()
      : isTinder() && !!tinderFinishedCards());

  const hasFinishedRun = () =>
    !attemptToken() &&
    (hasFinishedBoard() ||
      settledResult() !== null ||
      myAttempt()?.status === "submitted" ||
      result() !== null);

  // A closed game the player never entered has no personal board to show.
  // Rather than silently bouncing back to the hub (the old behavior), we stay
  // put and render a "you didn't play this one" card. Testers can still start a
  // closed game, so they are excluded and keep the redirect-to-hub path.
  const hasNoAttempt = () =>
    game()?.status === "closed" &&
    !isTester() &&
    myAttempt()?.status === "none" &&
    !attemptToken() &&
    !hasFinishedRun();

  createEffect(() => {
    const g = game();
    const user = me();
    const attempt = myAttempt();
    if (g === undefined || user === undefined || attempt === undefined) return;

    if (!user || !user.onboardingCompleted) {
      navigate(`/games?day=${g?.day ?? 1}&game=${slug()}`, { replace: true });
      return;
    }

    if (hasNoAttempt()) return;

    if (!attemptToken() && !hasFinishedRun() && attempt?.status !== "in_progress" && !busy()) {
      navigate(`/games?day=${g?.day ?? 1}&game=${slug()}`, { replace: true });
    }
  });

  const attemptKey = () =>
    `${slug()}-${settledResult()?.durationMs ?? 0}-${settledResult()?.score ?? 0}`;

  const resultMood = () =>
    moodForResult({
      valid: settledResult()?.valid ?? false,
      afterDeadline: settledResult()?.afterDeadline ?? false,
      isPersonalBest: settledResult()?.isPersonalBest ?? false,
    });

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

  const shareData = createMemo<ShareCardData | null>(() => {
    const g = game();
    const landed = settledResult();
    const user = me();
    if (!g || !user || !landed?.valid) return null;
    // Jump is unlimited — share always shows the personal best, not the last climb.
    const bestAtt = myAttempt();
    const shareScore = g.gameType === "jump" ? (bestAtt?.bestScore ?? landed.score) : landed.score;
    const shareDuration =
      g.gameType === "jump" ? (bestAtt?.bestDurationMs ?? landed.durationMs) : landed.durationMs;
    return {
      playerName: user.name,
      avatarUrl: user.avatarUrl,
      college: collegeLabel(user.college, user.collegeOther),
      branch: user.branch,
      branchOther: user.branchOther,
      batch: user.batch,
      occupation: user.occupation,
      instagram: user.instagramHandle,
      gameTitle: g.title,
      gameSlug: slug(),
      gameType: g.gameType,
      day: g.day,
      metric: landed.metric,
      durationMs: shareDuration,
      score: shareScore,
      rank: standing()?.rank ?? null,
      fieldSize: standing()?.fieldSize ?? null,
      afterDeadline: landed.afterDeadline,
      origin: typeof window === "undefined" ? "" : window.location.origin,
      seed: attemptKey(),
    };
  });

  return (
    <div
      class="fixed inset-0 z-50 flex flex-col overflow-hidden select-none bg-[var(--paper)]"
      style={{ "touch-action": "manipulation" }}
    >
      <Title>
        {game()?.title ? `${game()!.title} - Onam Games` : "Play Mini-Game - Onam Games"}
      </Title>
      <Meta
        name="description"
        content={
          game()?.teaser || game()?.tagline || "Play daily mini-games on Onam Games by FOSSMEC."
        }
      />
      <Meta
        property="og:title"
        content={game()?.title ? `${game()!.title} - Onam Games` : "Play Mini-Game - Onam Games"}
      />
      <Meta
        property="og:description"
        content={
          game()?.teaser || game()?.tagline || "Play daily mini-games on Onam Games by FOSSMEC."
        }
      />
      <Meta property="og:url" content={`${SITE_URL}/games/${params.slug}`} />
      <Meta property="og:image" content={`${SITE_URL}/images/games-og.webp`} />
      <Meta property="og:image:type" content="image/webp" />
      <Meta property="og:image:width" content="1376" />
      <Meta property="og:image:height" content="768" />
      <Meta
        name="twitter:title"
        content={game()?.title ? `${game()!.title} - Onam Games` : "Play Mini-Game - Onam Games"}
      />
      <Meta
        name="twitter:description"
        content={
          game()?.teaser || game()?.tagline || "Play daily mini-games on Onam Games by FOSSMEC."
        }
      />
      <Meta name="twitter:image" content={`${SITE_URL}/images/games-og.webp`} />
      <Link rel="canonical" href={`${SITE_URL}/games/${params.slug}`} />

      <Show when={game() === undefined}>
        <div class="m-auto text-center">
          <LoadingScreen compact message="Inking daily challenge…" />
        </div>
      </Show>

      <Show when={game()}>
        <header class="w-full shrink-0 px-3 py-2.5 sm:px-6 z-10 border-b border-[var(--ink)] bg-[var(--paper)]">
          <div class="mx-auto max-w-2xl">
            <GameBar
              day={game()!.day}
              slug={slug()}
              title={game()!.title}
              status={game()!.status}
              isTester={isTester()}
              gameType={game()!.gameType}
              elapsed={
                attemptToken()
                  ? game()!.gameType === "hunt"
                    ? huntElapsed()
                    : elapsed()
                  : settledResult()?.durationMs != null
                    ? settledResult()!.durationMs
                    : myAttempt()?.durationMs != null
                      ? myAttempt()!.durationMs!
                      : null
              }
              liveScore={game()!.gameType === "jump" ? jumpScore() : null}
              scoreIsLive={game()!.gameType === "jump" && !!attemptToken()}
              onHowTo={(game()!.howTo?.length ?? 0) > 0 ? () => setShowHowTo(true) : undefined}
            />
          </div>
        </header>

        <main
          class={`flex-1 min-h-0 w-full px-2 py-2 sm:px-4 flex flex-col items-center ${hasFinishedRun() ? "justify-start" : "justify-center"} ${
            isHunt() ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden scrollbar-none"
          }`}
          style={{ "scrollbar-width": "none", "-ms-overflow-style": "none" }}
        >
          <div
            class={`w-full flex flex-col items-center gap-4 text-center ${hasFinishedRun() ? "justify-start py-4" : "my-auto justify-center"} ${
              isHunt() ? "max-w-5xl h-full flex-1 min-h-0" : "max-w-xl"
            }`}
          >
            <Show when={banState()?.blocksPlay}>
              <div class="card pop-red space-y-2 max-w-sm">
                <p class="font-extrabold">{banState()!.message}</p>
                <A href="/leaderboard" class="btn-ghost inline-block">
                  View leaderboard
                </A>
              </div>
            </Show>

            <Show when={!banState()?.blocksPlay && hasNoAttempt()}>
              <div class="card pop-yellow w-full max-w-sm space-y-4 pt-6">
                <SpriteIcon name="papad-face" size={56} animate="wobble" />
                <div class="space-y-1">
                  <p class="text-lg font-black">You didn't play this one</p>
                  <p class="comment text-sm">
                    Day {game()!.day} has closed and you never started a run, so there's no board or
                    score to show here.
                  </p>
                </div>
                <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <A href={`/games?day=${game()!.day}`} class="btn-ghost px-5 py-2.5 text-sm">
                    Back to Hub
                  </A>
                  <A href="/leaderboard" class="btn-ghost px-4 py-2.5 text-sm">
                    See how others did →
                  </A>
                </div>
              </div>
            </Show>

            <Show when={!banState()?.blocksPlay && attemptToken()}>
              <Show when={isHunt()}>
                <Suspense fallback={<p class="font-semibold">Unrolling treasure hunt maps…</p>}>
                  <TreasureHuntGame disabled={busy()} onComplete={() => setStartedAt(null)} />
                </Suspense>
              </Show>

              <Show when={isTinder()}>
                <Show
                  when={tinderCards()}
                  fallback={<p class="font-semibold">Dealing the deck…</p>}
                >
                  <Suspense fallback={<p class="font-semibold">Dealing the deck…</p>}>
                    <TinderGame
                      slug={slug()}
                      attemptToken={attemptToken()!}
                      cards={tinderCards()!}
                      disabled={busy()}
                      initialProgress={restored() as TinderProgress | null}
                      onProgress={persist}
                      onFinish={(submission) => finish(submission)}
                    />
                  </Suspense>
                </Show>
              </Show>

              <Show when={isJigsaw()}>
                <Show
                  when={jigsawView()}
                  fallback={<p class="font-semibold">Cutting the pookalam…</p>}
                >
                  <Suspense fallback={<p class="font-semibold">Cutting the pookalam…</p>}>
                    <JigsawGame
                      view={jigsawView()!}
                      startedAt={startedAt() ?? Date.now()}
                      disabled={busy()}
                      initialProgress={restored() as JigsawProgress | null}
                      onProgress={persist}
                      onFinish={(submission) => finish(submission)}
                    />
                  </Suspense>
                </Show>
              </Show>

              <Show when={isWend()}>
                <Show when={wendView()} fallback={<p class="font-semibold">Shuffling letters…</p>}>
                  <Suspense fallback={<p class="font-semibold">Shuffling letters…</p>}>
                    <WendGame
                      view={wendView()!}
                      disabled={busy()}
                      initialFound={(restored() as { found?: WendFound[] } | null)?.found}
                      onProgress={(found) => persist({ found })}
                      onTrace={traceWord}
                      onFinish={(submission) => finish(submission)}
                    />
                  </Suspense>
                </Show>
              </Show>

              <Show when={isVallam()}>
                <Show when={vallamView()} fallback={<p class="font-semibold">Launching boats…</p>}>
                  <Suspense fallback={<p class="font-semibold">Launching boats…</p>}>
                    <VallamGame
                      view={vallamView()!}
                      disabled={busy()}
                      initialMoves={(restored() as { moves?: VallamMove[] } | null)?.moves}
                      onProgress={(moves) => persist({ moves })}
                      onFinish={(submission) => finish(submission)}
                    />
                  </Suspense>
                </Show>
              </Show>

              <Show when={isJump()}>
                <Show
                  when={jumpView()}
                  keyed
                  fallback={<p class="font-semibold">Waking Maveli…</p>}
                >
                  {(current) => (
                    <Suspense fallback={<p class="font-semibold">Waking Maveli…</p>}>
                      <JumpGame
                        view={current}
                        disabled={busy()}
                        bestScore={myAttempt()?.bestScore ?? null}
                        onScore={setJumpScore}
                        onFinish={(submission) => finish(submission)}
                      />
                    </Suspense>
                  )}
                </Show>
              </Show>
            </Show>

            <Show when={!banState()?.blocksPlay && hasFinishedRun()}>
              <div class="w-full max-w-md mx-auto space-y-4 flex flex-col items-center justify-start py-4">
                <div class="flex items-center justify-between w-full gap-2 px-1">
                  <span class="text-xs font-extrabold uppercase tracking-wider text-muted">
                    {hasFinishedBoard() && (game()?.status === "closed" || isTester())
                      ? "Your result"
                      : "Your run"}
                  </span>
                  <Show when={settledResult()?.valid}>
                    <ShoutBurst
                      text={shout(resultMood(), attemptKey())}
                      color={SHOUT_COLOR[resultMood()]}
                      seed={attemptKey()}
                      compact
                      class="-my-1 shrink-0"
                    />
                  </Show>
                </div>

                <div class="w-full flex items-center justify-center">
                  <Show
                    when={isHunt() || game()?.status === "closed" || isTester()}
                    fallback={
                      <div class="card card-plain w-full max-w-sm mx-auto p-4 space-y-2 text-center">
                        <p class="font-extrabold text-sm sm:text-base">
                          🔒 Solution Submitted & Locked
                        </p>
                        <p class="comment text-xs sm:text-sm">
                          To keep competition fair for all players, completed boards and answer keys
                          will be revealed once today's challenge window closes.
                        </p>
                      </div>
                    }
                  >
                    <Show when={isHunt()}>
                      <Suspense fallback={<p class="font-semibold">Loading treasure map…</p>}>
                        <TreasureHuntGame disabled />
                      </Suspense>
                    </Show>
                    <Show when={finishedKind() === "wend"}>
                      <Suspense fallback={<p class="font-semibold">Loading board…</p>}>
                        <WendGame
                          view={finishedBoard()!.view as WendViewData}
                          disabled
                          initialFound={
                            (finishedBoard()!.submission as { found?: WendFound[] } | null)?.found
                          }
                          onFinish={() => undefined}
                        />
                      </Suspense>
                    </Show>
                    <Show when={finishedKind() === "vallam"}>
                      <Suspense fallback={<p class="font-semibold">Loading board…</p>}>
                        <VallamGame
                          view={finishedBoard()!.view as VallamViewData}
                          disabled
                          initialMoves={
                            (finishedBoard()!.submission as { moves?: VallamMove[] } | null)?.moves
                          }
                          onFinish={() => undefined}
                        />
                      </Suspense>
                    </Show>
                    <Show when={finishedKind() === "jigsaw"}>
                      <Suspense fallback={<p class="font-semibold">Loading board…</p>}>
                        <JigsawGame
                          view={finishedBoard()!.view as JigsawViewData}
                          startedAt={0}
                          disabled
                          initialProgress={jigsawFinishedProgress()}
                          onFinish={() => undefined}
                        />
                      </Suspense>
                    </Show>
                    <Show when={isTinder() && tinderFinishedCards()}>
                      <TinderRecap
                        cards={tinderFinishedCards()!}
                        passes={
                          (finishedBoard()?.submission as TinderSubmission | null)?.passes ?? []
                        }
                        reveal={recap()?.cards ?? null}
                      />
                    </Show>
                  </Show>
                </div>

                <Show when={settledResult()}>
                  <div
                    class="space-y-3 pt-2 text-center w-full"
                    style={{ "border-top": "var(--ink-w) dashed var(--ink)" }}
                  >
                    <Show when={isJump()}>
                      {(() => {
                        const isWin = () => {
                          const r = settledResult()!;
                          if (!r.valid || (r.score ?? 0) <= 0) return false;
                          // Personal best OR tied/beat current stored best (covers afterDeadline where isPersonalBest is false)
                          const storedBest = myAttempt()?.bestScore ?? 0;
                          const best = Math.max(storedBest, r.score ?? 0);
                          return (
                            (r.score ?? 0) >= best &&
                            (r.isPersonalBest || (r.score ?? 0) >= storedBest)
                          );
                        };
                        const win = isWin();
                        return (
                          <div class="flex flex-col items-center gap-1.5 pt-3 pb-1">
                            <div class="relative grid place-items-center">
                              <Show
                                when={win}
                                fallback={
                                  <img
                                    src={jumpSprite("maveli-tumble.webp")}
                                    alt="Maveli tumbles — try again"
                                    width="84"
                                    height="84"
                                    class="w-[84px] h-[84px] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)] opacity-95"
                                    style={{
                                      transform: "rotate(-12deg)",
                                      animation: "sprite-pulse 1.3s ease-in-out infinite",
                                    }}
                                    loading="eager"
                                  />
                                }
                              >
                                <div
                                  class="absolute -inset-3 rounded-full blur-[14px] -z-10"
                                  style={{ background: "var(--pop-yellow)", opacity: "0.5" }}
                                />
                                <span
                                  class="absolute -top-1.5 -right-3 text-[10px] font-black px-1.5 py-0.5 rounded-full rotate-[10deg] leading-none"
                                  style={{
                                    background: "var(--pop-yellow)",
                                    border: "1.5px solid var(--ink)",
                                  }}
                                >
                                  NEW BEST!
                                </span>
                                <img
                                  src={jumpSprite("maveli-balloon.webp")}
                                  alt="Maveli soaring — new best!"
                                  width="96"
                                  height="96"
                                  class="w-[96px] h-[96px] object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.28)] anim-sprite-float"
                                  style={
                                    {
                                      "--sprite-tilt": "2deg",
                                      "--anim-duration": "2.1s",
                                    } as unknown as Record<string, string>
                                  }
                                  loading="eager"
                                />
                              </Show>
                            </div>
                            <p
                              class="text-[11px] font-black uppercase tracking-widest"
                              style={{
                                color: win ? "var(--pop-teal)" : "var(--ink-soft)",
                              }}
                            >
                              {win
                                ? "Kerala calls — keep climbing!"
                                : "Ayyo — Paathalam pulls again"}
                            </p>
                          </div>
                        );
                      })()}
                    </Show>
                    <ResultFigures result={settledResult()!} gameType={game()?.gameType} />
                    <Show
                      when={
                        isJump() &&
                        (settledResult()!.isPersonalBest
                          ? (settledResult()!.score ?? 0)
                          : (myAttempt()?.bestScore ?? settledResult()!.score ?? 0)) > 0
                      }
                    >
                      <p class="text-sm font-extrabold">
                        Best:{" "}
                        {(
                          (settledResult()!.isPersonalBest
                            ? settledResult()!.score
                            : (myAttempt()?.bestScore ?? settledResult()!.score)) ?? 0
                        ).toLocaleString("en-IN")}{" "}
                        m
                        <Show when={settledResult()!.isPersonalBest}>
                          <span style={{ color: "var(--pop-teal)" }}> · New Best!</span>
                        </Show>
                      </p>
                    </Show>
                    <Show when={!settledResult()!.valid}>
                      <p class="font-semibold text-sm" style={{ color: "var(--pop-red)" }}>
                        {settledResult()!.reason ?? "This run was not accepted."}
                      </p>
                    </Show>
                    <Show when={settledResult()!.afterDeadline}>
                      <p class="comment text-xs">
                        Played for fun · this day’s leaderboard is closed.
                      </p>
                    </Show>

                    <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <Show when={isJump()}>
                        <button
                          type="button"
                          class="btn-brand px-5 py-2.5 text-sm font-black cursor-pointer"
                          disabled={busy()}
                          onClick={() => playAgain()}
                        >
                          {busy() ? "Starting…" : "Play Again →"}
                        </button>
                      </Show>
                      <Show when={shareData()}>
                        <button
                          type="button"
                          class="btn-accent px-5 py-2.5 text-sm font-black cursor-pointer"
                          onClick={() => setSharing(true)}
                        >
                          Share Card
                        </button>
                      </Show>
                      <A href={`/games?day=${game()!.day}`} class="btn-ghost px-5 py-2.5 text-sm">
                        Back to Hub
                      </A>
                      <A href="/leaderboard" class="btn-ghost px-4 py-2.5 text-sm">
                        Leaderboard →
                      </A>
                    </div>

                    {/* Community Group Link Card */}
                    <CommunityGroupCard class="w-full mt-3 text-left" />
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={error()}>
              <div class="card pop-red space-y-2 mt-3">
                <div class="flex items-start gap-3">
                  <SpriteIcon name="papad-face" size={34} animate="wobble" alt="" />
                  <p class="flex-1 font-semibold">{error()}</p>
                </div>
                <button type="button" class="btn-ghost" onClick={() => setError("")}>
                  Dismiss
                </button>
              </div>
            </Show>
          </div>
        </main>
      </Show>

      <Show when={showHowTo() && game()}>
        <HowToPlayModal
          gameType={game()!.gameType}
          title={game()!.title}
          steps={game()!.howTo}
          onClose={() => setShowHowTo(false)}
        />
      </Show>

      <Show when={showNudge() && game()}>
        <PookalamNudgeModal
          gameTitle={game()!.title}
          onContinue={() => {
            setShowNudge(false);
            void doPlayAgain();
          }}
          onClose={() => {
            setShowNudge(false);
            void doPlayAgain();
          }}
        />
      </Show>

      <Show when={celebrating() && result()}>
        <WinModal
          shout={shout(resultMood(), attemptKey())}
          shoutColor={SHOUT_COLOR[resultMood()]}
          seed={attemptKey()}
          valid={result()!.valid}
          reason={result()!.reason}
          figures={
            <div class="space-y-2">
              <Show when={isJump() && result()}>
                {(() => {
                  const r = result()!;
                  const best = myAttempt()?.bestScore ?? r.score ?? 0;
                  const win =
                    r.valid && (r.score ?? 0) > 0 && (r.isPersonalBest || (r.score ?? 0) >= best);
                  return (
                    <div class="flex justify-center">
                      <Show
                        when={win}
                        fallback={
                          <img
                            src={jumpSprite("maveli-tumble.webp")}
                            alt="Maveli tumbles"
                            width="72"
                            height="72"
                            class="w-[72px] h-[72px] object-contain opacity-90"
                            style={{ transform: "rotate(-10deg)" }}
                          />
                        }
                      >
                        <img
                          src={jumpSprite("maveli-balloon.webp")}
                          alt="Maveli soaring"
                          width="84"
                          height="84"
                          class="w-[84px] h-[84px] object-contain anim-sprite-float"
                          style={
                            {
                              "--sprite-tilt": "2deg",
                              "--anim-duration": "2s",
                            } as unknown as Record<string, string>
                          }
                        />
                      </Show>
                    </div>
                  );
                })()}
              </Show>
              <ResultFigures result={result()!} gameType={game()?.gameType} />
              <Show
                when={
                  isJump() &&
                  (result()!.isPersonalBest
                    ? (result()!.score ?? 0)
                    : (myAttempt()?.bestScore ?? result()!.score ?? 0)) > 0
                }
              >
                <p class="text-sm font-extrabold">
                  Best:{" "}
                  {(
                    (result()!.isPersonalBest
                      ? result()!.score
                      : (myAttempt()?.bestScore ?? result()!.score)) ?? 0
                  ).toLocaleString("en-IN")}{" "}
                  m
                  <Show when={result()!.isPersonalBest}>
                    <span style={{ color: "var(--pop-teal)" }}> · New Best!</span>
                  </Show>
                </p>
              </Show>
            </div>
          }
          share={shareData() ? <ShareCard data={shareData()!} compact /> : undefined}
          afterDeadline={result()!.afterDeadline}
          isPersonalBest={result()!.isPersonalBest}
          runsLeft={0}
          onClose={() => setCelebrating(false)}
        />
      </Show>

      <Show when={sharing() && shareData()}>
        <ShareCardModal data={shareData()!} onClose={() => setSharing(false)} />
      </Show>
    </div>
  );
}

const STATUS_CHIP: Record<string, { label: string; pop: string }> = {
  live: { label: "Live now", pop: "var(--pop-teal)" },
  tester: { label: "Tester access", pop: "var(--pop-purple)" },
  preview: { label: "Opens soon", pop: "var(--pop-yellow)" },
  upcoming: { label: "Locked", pop: "var(--paper-3)" },
  closed: { label: "Ended", pop: "var(--paper-3)" },
};

function GameBar(props: {
  day: number;
  slug: string;
  title: string;
  status: string;
  isTester?: boolean;
  elapsed: number | null;
  gameType?: string;
  /** The score to display for jump. */
  liveScore?: number | null;
  /** True while the attempt is still in-progress (score is live). False after game ends. */
  scoreIsLive?: boolean;
  onHowTo?: () => void;
}) {
  const chip = () =>
    props.status === "closed" && props.isTester
      ? { label: "Tester access", pop: "var(--pop-purple)" }
      : (STATUS_CHIP[props.status] ?? STATUS_CHIP.upcoming);
  const playing = () => props.elapsed !== null;

  return (
    <div class="flex items-center gap-2.5">
      <A
        href={`/games?day=${props.day}`}
        class="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-75 active:translate-y-0.5"
        style={{
          background: "var(--paper-2)",
          border: "var(--ink-w) solid var(--ink)",
        }}
        aria-label="Back to games hub"
      >
        <ChevronLeft size={20} />
      </A>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 text-[0.68rem] font-extrabold uppercase tracking-wider text-muted">
          <A href={`/games?day=${props.day}`} class="hover:underline hover:text-[var(--ink)]">
            Games Hub
          </A>
          <span>/</span>
          <span>Day {props.day} of 7</span>
        </div>
        <p
          class="truncate text-base sm:text-lg leading-tight font-black"
          style={{ "font-family": "var(--font-stack-display)" }}
        >
          {props.title}
        </p>
      </div>

      <Show
        when={playing()}
        fallback={
          <span
            class="hidden text-xs font-black uppercase tracking-wider px-2 py-1 rounded sm:inline-block"
            style={{
              background: chip().pop,
              border: "1px solid var(--ink)",
            }}
          >
            {chip().label}
          </span>
        }
      >
        <Show
          when={props.gameType === "jump"}
          fallback={
            <div
              class="flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-sm font-black tabular-nums"
              style={{
                background: "var(--paper-2)",
                border: "var(--ink-w) solid var(--ink)",
              }}
            >
              <span class="inline-block h-2 w-2 rounded-full bg-[var(--pop-teal)] animate-pulse" />
              <span>{formatAdaptiveClock(Math.floor(props.elapsed! / 1000))}</span>
            </div>
          }
        >
          <div
            class="flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-sm font-black tabular-nums"
            style={{
              background: "var(--pop-yellow)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <span
              class={`inline-block h-2 w-2 rounded-full bg-[var(--pop-yellow)] ${props.scoreIsLive ? "animate-pulse" : "opacity-60"}`}
            />
            <span>{(props.liveScore ?? 0).toLocaleString("en-IN")} m</span>
          </div>
        </Show>
      </Show>

      <Show when={props.onHowTo}>
        <button
          type="button"
          onClick={props.onHowTo}
          class="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-75 active:translate-y-0.5 font-black text-base cursor-pointer pop-yellow"
          style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
          aria-label="Rules"
          title="Rules & How to Play"
        >
          ?
        </button>
      </Show>
    </div>
  );
}

function ResultFigures(props: { result: FinishPayload; gameType?: string }) {
  const isTime = () => props.result.metric === "time" || props.result.metric === "fcfs";
  const isJump = () => props.gameType === "jump";

  return (
    <div class="space-y-1">
      <p class="font-mono text-4xl sm:text-5xl font-black tabular-nums tracking-tight">
        {isTime()
          ? formatAdaptiveDuration(props.result.durationMs)
          : isJump()
            ? `${props.result.score ?? 0} m`
            : `${props.result.score ?? 0} pts`}
      </p>
      <Show when={props.result.penaltyMs > 0}>
        <p class="text-xs text-muted font-semibold">
          Includes +{formatAdaptiveDuration(props.result.penaltyMs)} in penalty time
        </p>
      </Show>
    </div>
  );
}
