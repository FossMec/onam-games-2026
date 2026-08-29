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

export function GameArenaView() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = () => params.slug ?? "";

  const game = createAsync(() => gameBySlug(slug()), { initialValue: undefined as any });
  const me = createAsync(() => viewer(), { initialValue: null as any });
  const myAttempt = createAsync(() => myAttemptQuery(slug()), { initialValue: undefined as any });
  const banState = createAsync(() => banStateQuery(), { initialValue: null as any });

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
      if (stored?.attemptToken) {
        if (stored.view) {
          setView(stored.view as GameView);
          setAttemptToken(stored.attemptToken);
          setStartedAt(new Date(stored.startedAt).getTime());
          setNow(Date.now());
          setRestored(getProgress(stored.attemptToken));
          const g = game();
          if (g?.gameType) void warmChunkForGameType(g.gameType);
          else if ((stored.view as { kind?: string })?.kind)
            void warmChunkForGameType((stored.view as { kind?: string }).kind ?? "");
          return currentSlug;
        }
        setAttemptToken(stored.attemptToken);
        setStartedAt(new Date(stored.startedAt).getTime());
        setNow(Date.now());
        setRestored(getProgress(stored.attemptToken));
        const g = game();
        if (g?.gameType) void warmChunkForGameType(g.gameType);
      }
    }

    return currentSlug;
  });

  // Server-authoritative status sync: when server attempt query resolves, if it's
  // no longer in_progress (e.g. submitted or reset), drop the cached client token.
  createEffect(() => {
    const attempt = myAttempt();
    const currentSlug = slug();
    if (!attempt || !currentSlug) return;
    if (attempt.status !== "in_progress" && attemptToken()) {
      const stored = getStoredAttempt(currentSlug);
      if (stored?.attemptToken) {
        clearProgress(stored.attemptToken);
        clearAttempt(currentSlug);
      }
      setAttemptToken(null);
    }
  });

  createEffect(() => {
    const g = game();
    if (g === undefined) return;
    if (view() !== null) return;
    const stored = getStoredAttempt(slug()) as (StoredAttempt & { view?: GameView }) | null;
    if (stored?.view) {
      setView(stored.view as GameView);
      if (!attemptToken()) {
        setAttemptToken(stored.attemptToken);
        setStartedAt(new Date(stored.startedAt).getTime());
        setNow(Date.now());
        setRestored(getProgress(stored.attemptToken));
      }
      return;
    }
    if (!g || g.status === "upcoming") return;
    if (busy()) return;
    if (hasFinishedRun()) return;
    const attempt = myAttempt();
    if (attempt && attempt.status === "submitted" && !stored) return;
    void fetchAttemptView();
  });

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
    }
  });

  const fetchAttemptView = async () => {
    if (fetchInflight) return fetchInflight;
    const g = game();
    if (g === undefined || g === null) return;
    if (g.status === "upcoming") return;
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

  createEffect(() => {
    const g = game();
    if (!g?.gameType || g.status === "upcoming") return;
    void warmChunkForGameType(g.gameType);
  });

  createEffect(() => {
    if (hasFinishedRun()) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    onCleanup(() => clearInterval(timer));
  });

  const currentElapsed = () => {
    if (hasFinishedRun()) {
      const landed = settledResult()?.durationMs ?? myAttempt()?.durationMs;
      if (landed != null && landed > 0) return landed;
      return null;
    }

    if (isHunt()) {
      const r = game()?.releaseAt;
      if (r) {
        return Math.max(0, now() - new Date(r).getTime());
      }
      if (startedAt() !== null) {
        return Math.max(0, now() - startedAt()!);
      }
      return 0;
    }

    if (startedAt() !== null) {
      return Math.max(0, now() - startedAt()!);
    }

    return null;
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
      if (data.score != null) setJumpScore(data.score);
    } catch {
      setError("Network hiccup - submission did not land. Check connection and try again.");
    } finally {
      setBusy(false);
    }
  };

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

  const hasNoAttempt = () =>
    game()?.status === "closed" &&
    !isTester() &&
    myAttempt()?.status === "none" &&
    !attemptToken() &&
    !hasFinishedRun();

  createEffect(() => {
    const currentSlug = slug();
    const g = game();
    const user = me();
    const attempt = myAttempt();

    if (g === null) {
      if (currentSlug === "treasure") {
        navigate("/games?day=6&game=treasure-hunt", { replace: true });
      } else {
        navigate("/games", { replace: true });
      }
      return;
    }

    if (g === undefined || user === undefined || attempt === undefined) return;

    if (!user || !user.onboardingCompleted) {
      navigate(`/games?day=${g?.day ?? 1}&game=${currentSlug}`, { replace: true });
      return;
    }

    if (hasNoAttempt()) return;

    if (!attemptToken() && !hasFinishedRun() && attempt?.status !== "in_progress" && !busy()) {
      navigate(`/games?day=${g?.day ?? 1}&game=${currentSlug}`, { replace: true });
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

      <Show when={game() === null}>
        <div class="m-auto text-center">
          <LoadingScreen compact message="Returning to games hub…" />
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
              elapsed={currentElapsed()}
              liveScore={game()!.gameType === "jump" ? jumpScore() : null}
              scoreIsLive={game()!.gameType === "jump" && !hasFinishedRun()}
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
                              class="text-xs font-black uppercase tracking-wide"
                              style={{ color: "var(--ink)" }}
                            >
                              {win ? "Maveli cleared the realm!" : "Maveli hit the ground"}
                            </p>
                          </div>
                        );
                      })()}
                    </Show>

                    <ResultFigures result={settledResult()!} gameType={game()?.gameType} />

                    <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <Show when={standing()?.rank}>
                        <span class="badge">
                          Rank #{standing()!.rank} of {standing()!.fieldSize}
                        </span>
                      </Show>
                      <Show when={settledResult()?.attemptsRemaining != null}>
                        <span class="badge">
                          {settledResult()!.unlimited
                            ? "unlimited retries"
                            : `${settledResult()!.attemptsRemaining} tries left`}
                        </span>
                      </Show>
                      <Show when={settledResult()?.afterDeadline}>
                        <span class="badge">practice run</span>
                      </Show>
                    </div>

                    <Show when={settledResult()?.reason}>
                      <p class="comment text-xs">{settledResult()!.reason}</p>
                    </Show>

                    <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <Show when={shareData()}>
                        <button
                          type="button"
                          onClick={() => setSharing(true)}
                          class="btn-brand px-4 py-2 text-sm cursor-pointer"
                        >
                          Share card
                        </button>
                      </Show>

                      <A href="/leaderboard" class="btn-ghost px-4 py-2 text-sm">
                        View leaderboard →
                      </A>
                    </div>

                    <Show when={isJump()}>
                      <div class="pt-2">
                        <button
                          type="button"
                          onClick={playAgain}
                          disabled={busy()}
                          class="btn-primary text-sm px-6 py-2.5 disabled:opacity-50 font-black cursor-pointer uppercase tracking-wider"
                          style={{
                            background: "var(--pop-yellow)",
                            color: "var(--ink)",
                            border: "var(--ink-w-bold) solid var(--ink)",
                          }}
                        >
                          {busy() ? "Setting up next climb…" : "Climb again"}
                        </button>
                      </div>
                    </Show>

                    <Show when={isHunt() && !isAllHuntTreasuresFound(settledResult()?.score)}>
                      <div class="pt-2">
                        <CommunityGroupCard />
                      </div>
                    </Show>
                  </div>
                </Show>

                <Show when={!settledResult()}>
                  <div class="space-y-3 pt-2 text-center w-full">
                    <p class="font-extrabold text-base">Run recorded</p>
                    <p class="comment text-xs">Your run was submitted successfully.</p>
                    <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <A href="/leaderboard" class="btn-ghost px-4 py-2 text-sm">
                        View leaderboard →
                      </A>
                      <A href={`/games?day=${game()!.day}`} class="btn-ghost px-4 py-2 text-sm">
                        Back to Hub
                      </A>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={error()}>
              <div class="card pop-red text-sm font-semibold max-w-sm">{error()}</div>
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

      <Show when={showNudge()}>
        <PookalamNudgeModal
          gameTitle={game()?.title || "Game"}
          onContinue={() => {
            setShowNudge(false);
            void doPlayAgain();
          }}
          onClose={() => setShowNudge(false)}
        />
      </Show>

      <Show when={celebrating() && settledResult()?.valid && game()?.gameType !== "jump"}>
        <WinModal
          shout={shout(resultMood(), attemptKey())}
          shoutColor={SHOUT_COLOR[resultMood()]}
          seed={attemptKey()}
          valid={settledResult()!.valid}
          reason={settledResult()!.reason}
          figures={<ResultFigures result={settledResult()!} gameType={game()?.gameType} />}
          share={shareData() ? <ShareCard data={shareData()!} compact /> : undefined}
          afterDeadline={settledResult()!.afterDeadline}
          isPersonalBest={settledResult()!.isPersonalBest}
          onClose={() => setCelebrating(false)}
        />
      </Show>

      <Show when={sharing() && shareData()}>
        <ShareCardModal data={shareData()!} onClose={() => setSharing(false)} />
      </Show>
    </div>
  );
}

function isAllHuntTreasuresFound(score?: number | null): boolean {
  return (score ?? 0) >= 10;
}

function GameBar(props: {
  day: number;
  slug: string;
  title: string;
  status: string;
  isTester: boolean;
  gameType: string;
  elapsed: number | null;
  liveScore: number | null;
  scoreIsLive: boolean;
  onHowTo?: () => void;
}) {
  const playing = () => props.elapsed !== null;
  const chip = () => {
    if (props.isTester && props.status === "tester") {
      return { label: "Tester preview", pop: "var(--pop-yellow)" };
    }
    if (props.status === "closed") {
      return { label: "Closed", pop: "var(--paper-2)" };
    }
    if (props.status === "live") {
      return { label: "Live", pop: "var(--pop-teal)" };
    }
    return { label: props.status, pop: "var(--paper-2)" };
  };

  return (
    <div class="flex items-center justify-between gap-2 sm:gap-4">
      <A
        href={`/games?day=${props.day}`}
        class="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-[var(--ink)] hover:underline shrink-0"
        title="Back to Hub"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        <span>Hub</span>
      </A>

      <div class="min-w-0 flex-1 text-center">
        <div class="flex items-center justify-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-[var(--ink-soft)]">
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
