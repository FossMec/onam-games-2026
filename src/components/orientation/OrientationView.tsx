import { clientOnly } from "@solidjs/start";
import { A, createAsync, revalidate } from "@solidjs/router";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  Clock,
  Flower2,
  Gamepad2,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Trophy,
  User,
  X,
} from "lucide-solid";
import { getOrientationConfig } from "~/server/orientation/actions";
import { ORIENTATION_BATCHES } from "~/lib/orientation";
import { formatAdaptiveDuration } from "~/lib/time";
import { Halftone } from "~/components/art/Burst";
import { gameImageForType, memeImage } from "~/lib/img";

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

function warmChunk(type: string) {
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
    default:
      return Promise.resolve();
  }
}

export function OrientationView() {
  const config = createAsync(() => getOrientationConfig());

  const [name, setName] = createSignal("");
  const [batch, setBatch] = createSignal<string>("CS A");
  const [showRegisterModal, setShowRegisterModal] = createSignal(false);
  const [registering, setRegistering] = createSignal(false);
  const [registerError, setRegisterError] = createSignal("");

  const [view, setView] = createSignal<unknown>(null);
  const [attemptToken, setAttemptToken] = createSignal<string | null>(null);
  const [startedAt, setStartedAt] = createSignal<number | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [_result, setResult] = createSignal<any>(null);
  const [jumpScore, setJumpScore] = createSignal(0);

  // Clock interval for timer
  onMount(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  });

  // Background polling every 5s so when coordinators trigger START or change batch, player unlocks automatically
  onMount(() => {
    const poll = setInterval(() => {
      if (!attemptToken()) {
        void revalidate("orientation-config" as any);
      }
    }, 5000);
    onCleanup(() => clearInterval(poll));
  });

  const participant = () => config()?.participant ?? null;
  const gameCard = () => config()?.gameCard ?? null;
  const myAttempt = () => config()?.myAttempt ?? null;
  const settings = () => config()?.settings ?? null;

  const isRegistered = () => !!participant();
  const isCurrentBatch = () => participant()?.batch === settings()?.currentBatch;
  const canPlay = () => isRegistered() && isCurrentBatch() && !!gameCard() && !!settings()?.enabled;
  const hasSubmitted = () => myAttempt()?.status === "submitted";
  const hasInProgress = () => myAttempt()?.status === "in_progress";

  // Pre-fill form if participant exists
  onMount(() => {
    const p = participant();
    if (p) {
      setName(p.name);
      setBatch(p.batch);
    }
  });

  const doRegister = async (e?: Event) => {
    if (e) e.preventDefault();
    setRegisterError("");
    const trimmed = name().trim();
    if (!trimmed || trimmed.length < 2) {
      setRegisterError("Please enter a name with at least 2 characters");
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch("/api/orientation/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, batch: batch() }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setRegisterError(data.error ?? "Failed to save registration");
        return;
      }
      setShowRegisterModal(false);
      await revalidate("orientation-config" as any);
      location.reload();
    } catch {
      setRegisterError("Network error. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const startPlay = async () => {
    setError("");
    setBusy(true);
    try {
      if (gameCard()?.gameType) await warmChunk(gameCard()!.gameType);
      const res = await fetch("/api/orientation/start", { method: "POST" });
      const data = (await res.json()) as any;
      if (!res.ok || !data.view) {
        setError(data.error ?? "Failed to start");
        return;
      }
      setView(data.view);
      setAttemptToken(data.attemptToken);
      setStartedAt(new Date(data.startedAt).getTime());
      setNow(Date.now());
    } catch {
      setError("Network hiccup. Please try again.");
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
      const body: any = { attemptToken: token, submittedState };
      if (gameCard()?.gameType === "jump") body.claimedScore = jumpScore();
      const res = await fetch("/api/orientation/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data.error ?? "Failed to submit score");
        return;
      }
      setResult(data);
      setAttemptToken(null);
      setStartedAt(null);
      setView(null);
      setTimeout(() => location.reload(), 400);
    } catch {
      setError("Network error while submitting score");
    } finally {
      setBusy(false);
    }
  };

  const traceWord = async (cells: { r: number; c: number }[]) => {
    const token = attemptToken();
    if (!token) return null;
    const res = await fetch("/api/orientation/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptToken: token, cells }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data.word ?? null;
  };

  // Orientation-mode grading for FOSSwipe. The shared TinderGame defaults to
  // `/api/game/[slug]/check`, which needs a Google session — orientation play
  // is cookie-based with no login, so that endpoint 401s ("Not signed in").
  const checkTinder = async (slice: { id: string; open: boolean }[]) => {
    const token = attemptToken();
    if (!token || slice.length === 0) return null;
    try {
      const res = await fetch("/api/orientation/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptToken: token,
          expectedIds: slice.map((d) => d.id),
          decisions: slice,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok || !data.wrongIds) return null;
      return { wrongIds: data.wrongIds as string[], wrong: (data.wrong ?? []) as any };
    } catch {
      return null;
    }
  };

  const elapsed = () => {
    if (startedAt() == null) return null;
    return Math.max(0, now() - startedAt()!);
  };

  return (
    <main class="container space-y-6 py-4 sm:space-y-8 sm:py-6">
      {/* 1. First Section: FOSS Hero & Sadya Meme */}
      <section class="relative overflow-hidden rounded-xl sm:rounded-2xl border-2 border-[var(--ink)] bg-[var(--paper-2)] p-4 sm:p-7 text-center space-y-4">
        <Halftone opacity={0.07} class="absolute inset-0 pointer-events-none" />

        <div class="relative z-10 space-y-2">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--ink)] bg-[var(--pop-yellow)] text-xs font-black uppercase tracking-wider select-none">
            <Sparkles size={13} strokeWidth={2.5} />
            <span>FOSS MEC 2026 Orientation</span>
          </div>

          <h1
            class="text-2xl sm:text-4xl font-black tracking-tight text-[var(--ink)] m-0"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            FOSS MEC Onam Games
          </h1>

          <p
            class="text-base sm:text-xl font-bold leading-snug tracking-tight max-w-xl mx-auto text-[var(--ink)]"
            style={{ "font-family": "var(--font-stack-hand)" }}
          >
            The FOSS you love was made by people like you.
            <br />
            Come make a little noise with us.
          </p>
        </div>

        {/* Sadya Meme */}
        <div class="relative z-10 pt-1 flex justify-center">
          <div class="card card-plain p-2.5 sm:p-3 border-2 border-[var(--ink)] bg-[var(--paper)] rounded-xl text-center space-y-2 max-w-sm w-full ">
            <img
              src={memeImage("talk-is-cheap-sadya.webp")}
              alt="Talk is cheap, show me the code — Sadya Edition"
              class="w-full h-auto object-contain rounded-lg border border-[var(--ink)]"
              loading="eager"
            />
            <p class="comment text-xs sm:text-sm m-0 font-bold">
              Talk is cheap. Show me the code... or pass the payasam.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Registered Player Status Bar (if registered) */}
      <Show when={isRegistered()}>
        <div class="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-[var(--ink)] bg-[var(--paper-2)] text-xs">
          <div class="flex items-center gap-2">
            <User size={14} strokeWidth={2.5} />
            <span class="font-bold">
              Playing as <strong class="font-black text-[var(--ink)]">{participant()!.name}</strong>
            </span>
            <span class="opacity-40">·</span>
            <span class="badge text-[10px] font-black bg-[var(--pop-yellow)] border border-[var(--ink)]">
              Class {participant()!.batch}
            </span>
          </div>

          <Show when={!hasSubmitted() && !attemptToken()}>
            <button
              type="button"
              onClick={() => {
                setName(participant()!.name);
                setBatch(participant()!.batch);
                setShowRegisterModal(true);
              }}
              class="text-xs font-bold underline decoration-2 underline-offset-2 cursor-pointer hover:text-[var(--pop-teal)]"
            >
              Change
            </button>
          </Show>
        </div>
      </Show>

      {/* 3. Game Card & Arena Flow */}
      <Show when={!config()}>
        <div class="card card-plain p-8 text-center border-2 border-[var(--ink)]">
          <RefreshCw
            size={24}
            strokeWidth={2.5}
            class="animate-spin mx-auto mb-2 text-[var(--ink-soft)]"
          />
          <p class="text-xs font-bold">Loading orientation challenge...</p>
        </div>
      </Show>

      <Show when={config()}>
        {/* Case A: No Game Configured by Admin */}
        <Show when={!gameCard()}>
          <div class="card pop-red p-6 text-center space-y-2 border-2 border-[var(--ink)]">
            <HelpCircle size={24} strokeWidth={2.5} class="mx-auto" />
            <p class="font-black text-sm">Challenge Setting Up</p>
            <p class="text-xs font-semibold">
              The coordinators are picking today's challenge. Please hold on — this screen will
              refresh automatically.
            </p>
          </div>
        </Show>

        {/* Case B: Game Card Display (Visible when game exists and not in active play arena) */}
        <Show when={gameCard() && !attemptToken()}>
          <div class="card card-plain p-4 sm:p-6 border-2 border-[var(--ink)] space-y-4">
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 border-b-2 border-[var(--ink)] pb-4">
              {/* Game Artwork / Logo */}
              <div class="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden border-2 border-[var(--ink)] bg-[var(--paper-3)]  flex items-center justify-center">
                <img
                  src={gameImageForType(gameCard()!.gameType)}
                  alt={gameCard()!.title}
                  class="w-full h-full object-cover"
                  loading="eager"
                />
              </div>

              <div class="flex-1 w-full text-center sm:text-left space-y-1.5">
                <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                  <span class="badge text-[10px] font-black bg-[var(--pop-yellow)] border border-[var(--ink)]">
                    ORIENTATION CHALLENGE
                  </span>
                  <span class="text-xs font-mono font-bold uppercase opacity-60">
                    Difficulty: {gameCard()!.difficulty}
                  </span>
                  <Show when={canPlay() && !hasSubmitted()}>
                    <span class="badge bg-[var(--pop-teal)] text-[10px] font-black py-0.5 px-2 border border-[var(--ink)]">
                      READY
                    </span>
                  </Show>
                </div>
                <h2
                  class="text-2xl sm:text-3xl font-black m-0 tracking-tight"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  {gameCard()!.title}
                </h2>
                <p class="text-xs sm:text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                  {(gameCard() as any).tagline}
                </p>
              </div>
            </div>

            {/* Teaser & Rules */}
            <Show when={(gameCard() as any).teaser}>
              <p class="text-xs sm:text-sm font-medium italic" style={{ color: "var(--ink-soft)" }}>
                "{(gameCard() as any).teaser}"
              </p>
            </Show>

            <Show when={(gameCard() as any).howTo?.length}>
              <div class="bg-[var(--paper-2)] rounded-lg p-3.5 border border-[var(--ink-soft)]/30 space-y-1.5">
                <p
                  class="text-xs font-black uppercase tracking-wider"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  How to play
                </p>
                <ul class="list-disc pl-4 text-xs font-medium space-y-1">
                  <For each={(gameCard() as any).howTo}>{(step: string) => <li>{step}</li>}</For>
                </ul>
              </div>
            </Show>

            {/* NOT REGISTERED YET */}
            <Show when={!isRegistered()}>
              <div class="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(true)}
                  class="btn-brand w-full py-3 text-sm sm:text-base font-black rounded-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <Gamepad2 size={18} strokeWidth={2.5} />
                  <span>Join Challenge & Enter Class</span>
                </button>
                <p
                  class="text-center text-[11px] font-semibold"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Select your class from CS A, CS B, CS C, CU, EC A, EC B, EB, EE, EV, ME.
                </p>
              </div>
            </Show>

            {/* REGISTERED BUT AWAITING KICKOFF / BATCH TURN */}
            {/* Note: psychological UX rule: we do not leak which batch is currently active */}
            <Show
              when={
                isRegistered() && (!isCurrentBatch() || !settings()?.enabled) && !hasSubmitted()
              }
            >
              <div class="card bg-[var(--paper-2)] p-4 sm:p-5 text-center space-y-3 rounded-xl border-2 border-[var(--ink)]">
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--ink)] bg-[var(--paper)] text-xs font-black">
                  <Clock size={13} strokeWidth={2.5} />
                  <span>Arena on Standby</span>
                </div>
                <h3 class="text-lg font-black m-0">The game hasn't kicked off yet</h3>
                <p
                  class="text-xs sm:text-sm font-semibold max-w-md mx-auto"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Hang tight while the coordinators get things ready for your class. When the
                  organizers announce the kickoff, your screen will unlock automatically.
                </p>

                <div class="pt-1 flex flex-wrap items-center justify-center gap-3">
                  <A
                    href="/orientation/leaderboard"
                    class="btn-ghost px-4 py-2 text-xs font-black rounded-lg cursor-pointer inline-flex items-center gap-1.5 bg-[var(--paper)] border-2 border-[var(--ink)]"
                  >
                    <Trophy size={14} strokeWidth={2.5} />
                    <span>View Class Standings</span>
                  </A>
                  <a
                    href="/#community-pookalam"
                    class="btn-brand px-4 py-2 text-xs font-black rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Flower2 size={14} strokeWidth={2.5} />
                    <span>Try Community Pookalam</span>
                  </a>
                </div>

                {/* Fun FOSS Fact to keep them entertained */}
                <div class="text-left bg-[var(--paper)] p-3 rounded-lg border border-[var(--ink-soft)]/20 text-xs space-y-1">
                  <p class="font-black text-[11px] uppercase tracking-wider text-[var(--ink)]">
                    FOSS Fun Fact
                  </p>
                  <p class="font-medium" style={{ color: "var(--ink-soft)" }}>
                    Linux powers 100% of the world's top 500 supercomputers, billions of smartphones
                    (Android), and the vast majority of the internet. It was started in 1991 by a
                    curious university student named Linus Torvalds!
                  </p>
                </div>
              </div>
            </Show>

            {/* REGISTERED & CAN PLAY (ACTIVE BATCH & ENABLED) */}
            <Show when={canPlay() && !hasSubmitted()}>
              <div class="pt-2 space-y-2">
                <Show when={hasInProgress()}>
                  <p class="text-xs font-bold text-amber-700">
                    You have an unfinished attempt in progress. Click below to resume.
                  </p>
                </Show>
                <button
                  type="button"
                  onClick={startPlay}
                  disabled={busy()}
                  class="btn-brand w-full py-3.5 text-base font-black rounded-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Gamepad2 size={18} strokeWidth={2.5} />
                  <span>
                    {busy()
                      ? "Starting..."
                      : hasInProgress()
                        ? "Resume Game"
                        : "Play Now — 1 Attempt"}
                  </span>
                </button>
                <Show when={error()}>
                  <p class="text-xs font-bold text-red-600 text-center">{error()}</p>
                </Show>
              </div>
            </Show>

            {/* ALREADY SUBMITTED (1 ATTEMPT FINISHED) */}
            <Show when={hasSubmitted()}>
              <div class="card pop-yellow p-5 text-center space-y-3 rounded-xl border-2 border-[var(--ink)]">
                <p class="font-black text-lg m-0">You have completed your run</p>
                <Show when={myAttempt()}>
                  <p class="font-mono font-black text-3xl my-1">
                    {myAttempt()!.metric === "score"
                      ? `${myAttempt()!.score ?? 0} pts`
                      : formatAdaptiveDuration(myAttempt()!.durationMs ?? 0)}
                  </p>
                  <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                    One attempt recorded for Class {participant()?.batch}. Your score is on the
                    leaderboard!
                  </p>
                </Show>

                <div class="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <A
                    href="/orientation/leaderboard"
                    class="btn-brand px-5 py-2.5 text-xs sm:text-sm font-black rounded-lg cursor-pointer inline-flex items-center gap-2"
                  >
                    <Trophy size={14} strokeWidth={2.5} />
                    <span>View Class Leaderboard</span>
                  </A>
                  <a
                    href="/#community-pookalam"
                    class="btn-ghost px-5 py-2.5 text-xs sm:text-sm font-black rounded-lg cursor-pointer inline-flex items-center gap-2 bg-[var(--paper)] border-2 border-[var(--ink)]"
                  >
                    <Flower2 size={14} strokeWidth={2.5} />
                    <span>Join Community Pookalam</span>
                  </a>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Case C: Active Play Arena */}
        <Show when={attemptToken() && view()}>
          <div class="card card-plain p-3.5 sm:p-4 border-2 border-[var(--ink)] space-y-3">
            <div class="flex items-center justify-between text-xs font-mono font-black border-b border-[var(--ink-soft)]/30 pb-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="badge text-[10px] font-black bg-[var(--pop-yellow)]">
                  Class {participant()!.batch}
                </span>
                <span>{gameCard()!.title}</span>
              </span>
              <Show when={elapsed() != null}>
                <span class="text-sm">{formatAdaptiveDuration(elapsed()!)}</span>
              </Show>
              <Show when={(gameCard() as any).gameType === "jump"}>
                <span class="text-sm">{jumpScore()} m</span>
              </Show>
            </div>

            <Show when={gameCard()?.gameType === "tinder" && (view() as any)?.kind === "tinder"}>
              <TinderGame
                slug={(gameCard() as any).slug}
                attemptToken={attemptToken()!}
                cards={(view() as any).cards}
                disabled={busy()}
                onCheck={checkTinder}
                onFinish={finish}
              />
            </Show>
            <Show when={gameCard()?.gameType === "jigsaw" && (view() as any)?.kind === "jigsaw"}>
              <JigsawGame
                view={view() as any}
                startedAt={startedAt() ?? Date.now()}
                disabled={busy()}
                onFinish={finish}
              />
            </Show>
            <Show when={gameCard()?.gameType === "wend" && (view() as any)?.kind === "wend"}>
              <WendGame
                view={view() as any}
                disabled={busy()}
                onTrace={traceWord}
                onFinish={finish}
              />
            </Show>
            <Show when={gameCard()?.gameType === "unblock" && (view() as any)?.kind === "vallam"}>
              <VallamGame view={view() as any} disabled={busy()} onFinish={finish} />
            </Show>
            <Show when={gameCard()?.gameType === "jump" && (view() as any)?.kind === "jump"}>
              <JumpGame
                view={view() as any}
                disabled={busy()}
                onScore={setJumpScore}
                onFinish={finish}
              />
            </Show>
            <Show when={gameCard()?.gameType === "hunt"}>
              <div class="card bg-[var(--paper-2)] p-5 text-center space-y-2 rounded-xl border-2 border-[var(--ink)]">
                <p class="font-black text-sm">Treasure Hunt isn't playable in orientation mode</p>
                <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                  The hunt needs individual Google accounts and runs across the whole festival site.
                  Coordinators: pick FOSSwipe, Jigsaw, sudoWend, BoatLock or Maveli Jump for
                  orientation play.
                </p>
              </div>
            </Show>
          </div>
        </Show>
      </Show>

      {/* 4. Registration Modal */}
      <Show when={showRegisterModal()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 bg-[rgb(34_32_43_/_0.75)] backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && isRegistered()) setShowRegisterModal(false);
          }}
        >
          <div class="card card-plain p-6 sm:p-7 space-y-4 border-2 border-[var(--ink)] bg-[var(--paper)] max-w-md w-full relative  rounded-xl">
            <Show when={isRegistered()}>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                class="absolute right-3.5 top-3.5 grid h-7 w-7 place-items-center rounded-full bg-[var(--paper-2)] border border-[var(--ink)] cursor-pointer"
                aria-label="Close"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </Show>

            <div class="space-y-1 text-left">
              <span class="badge text-[10px] font-black uppercase tracking-wider bg-[var(--pop-yellow)] border border-[var(--ink)]">
                Orientation Sign-up
              </span>
              <h2
                class="text-xl sm:text-2xl font-black m-0"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                Enter Your Details
              </h2>
              <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                First years at MEC: enter your full name and choose your class.
              </p>
            </div>

            <form onSubmit={doRegister} class="space-y-4 text-left">
              <label class="block text-xs font-black space-y-1">
                <span>Your Name</span>
                <input
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="e.g. Anand Krishna"
                  class="input w-full text-sm font-semibold"
                  autofocus
                  required
                />
              </label>

              <label class="block text-xs font-black space-y-1">
                <span>Class / Batch</span>
                <select
                  value={batch()}
                  onChange={(e) => setBatch(e.currentTarget.value)}
                  class="input w-full text-sm font-semibold cursor-pointer"
                >
                  <For each={ORIENTATION_BATCHES}>
                    {(b) => <option value={b}>Class {b}</option>}
                  </For>
                </select>
                <span class="block text-[11px] font-normal" style={{ color: "var(--ink-soft)" }}>
                  Available: CS A, CS B, CS C, CU, EC A, EC B, EB, EE, EV, ME.
                </span>
              </label>

              <Show when={registerError()}>
                <p class="text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {registerError()}
                </p>
              </Show>

              <button
                type="submit"
                disabled={registering()}
                class="btn-brand w-full py-3 text-sm font-black rounded-lg cursor-pointer disabled:opacity-50"
              >
                {registering() ? "Saving..." : "Save & Continue"}
              </button>
            </form>
          </div>
        </div>
      </Show>
    </main>
  );
}
