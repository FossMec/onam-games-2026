import { useSearchParams } from "@solidjs/router";
import { Key, RefreshCw, ShieldAlert, X } from "lucide-solid";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { LoadingScreen } from "~/components/LoadingScreen";
import { treasureMapImage } from "~/lib/img";
import { getDistroForQuestionIndex } from "~/lib/treasure-distros";
import type { HuntPublicState, HuntSubmitResult } from "~/server/games/hunt/service";

export interface TreasureHuntGameProps {
  onFinish?: (submission: unknown) => void;
  disabled?: boolean;
}

// 10 Hand-Analyzed Island Landmarks (Verified 100% Solid Land / Non-Water on 1200x1200 map)
const LANDMARKS = [
  { x: 14.2, y: 26.0, name: "Teal Shoals" },
  { x: 36.7, y: 21.0, name: "Bridge Atoll" },
  { x: 45.0, y: 33.5, name: "Kernel Plain" },
  { x: 58.3, y: 28.5, name: "Coral Peaks" },
  { x: 81.7, y: 22.7, name: "Alpine Highlands" },
  { x: 91.7, y: 34.3, name: "Eastern Cliffs" },
  { x: 86.7, y: 48.5, name: "Pink Isle" },
  { x: 19.2, y: 75.2, name: "Pyramid Ridge" },
  { x: 45.0, y: 76.8, name: "Teal Cape" },
  { x: 68.3, y: 77.7, name: "Peninsula Bay" },
];

export function TreasureHuntGame(props: TreasureHuntGameProps) {
  const [searchParams] = useSearchParams();
  const [state, setState] = createSignal<HuntPublicState | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [answerInput, setAnswerInput] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [cooldownSeconds, setCooldownSeconds] = createSignal(0);
  const [selectedQuestionId, setSelectedQuestionId] = createSignal<string | null>(null);
  const [justSolved, setJustSolved] = createSignal<string | null>(null);
  const [expandedDistro, setExpandedDistro] = createSignal(false);
  const [flyingDiscovery, setFlyingDiscovery] = createSignal<{
    qId: string;
    distro: ReturnType<typeof getDistroForQuestionIndex>;
    target: { x: number; y: number };
    phase: "center" | "flying";
  } | null>(null);

  let cooldownInterval: ReturnType<typeof setInterval> | undefined;

  const startCooldownTimer = (seconds: number) => {
    if (cooldownInterval) clearInterval(cooldownInterval);
    if (seconds <= 0) {
      setCooldownSeconds(0);
      return;
    }

    const targetTime = Date.now() + seconds * 1000;
    setCooldownSeconds(seconds);

    cooldownInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(cooldownInterval);
        cooldownInterval = undefined;
      }
    }, 500);
  };

  onCleanup(() => {
    if (cooldownInterval) clearInterval(cooldownInterval);
  });

  const mapBgUrl = () => treasureMapImage() || "/images/treasure-map.webp";

  const fetchState = async () => {
    try {
      const res = await fetch("/api/hunt/state");
      if (res.ok) {
        const data = (await res.json()) as HuntPublicState;
        setState(data);
        if (data.cooldownRemainingSec > 0) {
          startCooldownTimer(data.cooldownRemainingSec);
        }

        // Check if query parameter passed an answer/token to prefill
        const paramAns =
          searchParams.answer || searchParams.token || searchParams.code || searchParams.q;
        if (paramAns && typeof paramAns === "string") {
          setAnswerInput(paramAns.trim());
          if (data.currentQuestion) {
            setSelectedQuestionId(data.currentQuestion.id);
          }
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void fetchState();
  });

  const selectedQuestion = createMemo(() => {
    const s = state();
    const id = selectedQuestionId();
    if (!s || !id) return null;
    return s.allQuestions.find((q) => q.id === id) ?? null;
  });

  const isSelectedActive = createMemo(() => {
    const s = state();
    const id = selectedQuestionId();
    if (!s || !id || !s.currentQuestion) return false;
    return id === s.currentQuestion.id;
  });

  const isSelectedSolved = createMemo(() => {
    const s = state();
    const id = selectedQuestionId();
    if (!s || !id) return false;
    return s.solvedQuestionIds.includes(id);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (busy() || cooldownSeconds() > 0 || props.disabled) return;
    const ans = answerInput().trim();
    if (!ans) return;

    setBusy(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/hunt/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: ans }),
      });

      const data = (await res.json()) as HuntSubmitResult & { error?: string };

      if (!res.ok) {
        setErrorMsg(data.error ?? data.reason ?? "Failed to submit answer");
        if (data.cooldownRemainingSec) {
          startCooldownTimer(data.cooldownRemainingSec);
        }
        return;
      }

      if (data.state) {
        setState(data.state);
      }

      if (data.valid) {
        setAnswerInput("");
        startCooldownTimer(0);
        setSelectedQuestionId(null); // Never auto-open next clue - user taps map to view

        const solvedId = data.solvedQuestionId;
        const qIdx =
          data.state?.allQuestions.findIndex((item) => item.id === solvedId) ??
          state()?.allQuestions.findIndex((item) => item.id === solvedId) ??
          0;
        const distro = getDistroForQuestionIndex(Math.max(0, qIdx));
        const targetLandmark = LANDMARKS[Math.max(0, qIdx)] ?? { x: 50, y: 50 };

        setJustSolved(solvedId ?? "solved");
        setTimeout(() => setJustSolved(null), 3000);

        // Discovery Fly-In Animation: Center -> Target Island Position
        setFlyingDiscovery({
          qId: solvedId ?? "",
          distro,
          target: targetLandmark,
          phase: "center",
        });

        setTimeout(() => {
          setFlyingDiscovery((prev) => (prev ? { ...prev, phase: "flying" } : null));
        }, 1100);

        setTimeout(() => {
          setFlyingDiscovery(null);
          if (
            data.isComplete ||
            data.state?.completed ||
            (data.state?.solvedCount &&
              data.state.solvedCount >= (data.state.totalQuestionsCount ?? 10))
          ) {
            props.onFinish?.({ token: "TREASURE_HUNT_ALL_COMPLETED" });
          }
        }, 2200);
      } else {
        setErrorMsg(data.reason ?? "Incorrect answer. Keep searching!");
        if (data.cooldownRemainingSec > 0) {
          startCooldownTimer(data.cooldownRemainingSec);
        }
      }
    } catch {
      setErrorMsg("Network error. Please check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const isAllCompleted = () =>
    (state()?.completed ?? false) ||
    (state()?.solvedCount ?? 0) >= (state()?.totalQuestionsCount ?? 10);

  return (
    <div class="relative w-full h-full max-h-full flex flex-col items-center justify-center overflow-hidden select-none">
      <Show when={loading()}>
        <div class="m-auto text-center py-12">
          <LoadingScreen compact message="Inking the archipelago treasure map…" />
        </div>
      </Show>

      <Show when={!loading() && state()}>
        {/* Top Header: Handwriting font title, Progress & Leaderboard Link */}
        <div class="shrink-0 mb-1.5 flex items-center justify-between w-full max-w-[min(94vw,calc(100dvh-6.5rem))] px-2 gap-2">
          <h2
            class="text-base sm:text-2xl font-black text-[var(--ink)] tracking-tight m-0 truncate"
            style={{ "font-family": "var(--font-stack-kalam)" }}
          >
            The Free Software Archipelago
          </h2>
          <div class="flex items-center gap-2 shrink-0">
            <Show when={isAllCompleted()}>
              <a
                href="/leaderboard"
                class="btn-brand text-xs font-black uppercase px-3 py-1 rounded border-2 border-[var(--ink)] cursor-pointer inline-flex items-center gap-1"
              >
                <span>Leaderboard →</span>
              </a>
            </Show>
            <span
              class={`text-[10px] sm:text-xs font-mono font-black uppercase px-2 py-0.5 rounded border border-[var(--ink)]/30 ${
                isAllCompleted()
                  ? "bg-[var(--pop-teal)] text-[var(--ink)]"
                  : "bg-[var(--paper-2)] text-[var(--ink-soft)]"
              }`}
            >
              {state()?.solvedCount ?? 0} / {state()?.totalQuestionsCount ?? 10} Treasures
            </span>
          </div>
        </div>

        {/* -------------------- 1:1 SQUARE TREASURE MAP -------------------- */}
        <div class="relative aspect-square w-full max-w-[min(94vw,calc(100dvh-8.5rem))] mx-auto rounded-2xl border-2 border-[var(--ink)] overflow-hidden bg-surface ">
          {/* Authentic Map Background Art (Transparent Ocean, Hand-drawn Islands) */}
          <img
            src={mapBgUrl()}
            alt="Treasure Map"
            class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
          />

          {/* 10 Island Landmark Pins */}
          <For each={state()?.allQuestions}>
            {(q, idx) => {
              const landmark = () => LANDMARKS[idx()] ?? { x: 50, y: 50, name: "Isle" };
              const distro = () => getDistroForQuestionIndex(idx());
              const isCurrent = () => state()?.currentQuestion?.id === q.id;
              const isSolved = () =>
                (state()?.solvedQuestionIds.includes(q.id) ?? false) &&
                flyingDiscovery()?.qId !== q.id;
              const isSelected = () => selectedQuestionId() === q.id;

              return (
                <div
                  class="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center cursor-pointer transition-transform duration-150"
                  style={{
                    left: `${landmark().x}%`,
                    top: `${landmark().y}%`,
                  }}
                  onClick={() => {
                    if (isSolved() || isCurrent()) {
                      setSelectedQuestionId(q.id);
                    }
                  }}
                >
                  {/* Pin Circle / Logo Emblem */}
                  <div
                    class={`relative rounded-full grid place-items-center transition-transform duration-150 ${
                      isSolved()
                        ? "w-9 h-9 sm:w-11 sm:h-11 bg-surface-2 border-[2.5px] border-[var(--ink)] "
                        : isCurrent()
                          ? "w-10 h-10 sm:w-12 sm:h-12 bg-[var(--pop-yellow)] border-[3px] border-[var(--ink)] "
                          : "w-8 h-8 sm:w-9 sm:h-9 bg-surface border-2 border-[var(--ink)] "
                    } ${isSelected() ? "scale-110" : ""}`}
                  >
                    <Show when={isSolved()}>
                      <img
                        src={distro().svgPath}
                        alt={distro().name}
                        class="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    </Show>

                    <Show when={!isSolved() && isCurrent()}>
                      <Key size={18} class="text-[var(--ink)] stroke-[2.5]" />
                    </Show>

                    <Show when={!isSolved() && !isCurrent()}>
                      <span class="text-[10px] sm:text-xs font-mono font-black text-[var(--ink)]">
                        #{idx() + 1}
                      </span>
                    </Show>
                  </div>

                  {/* Distro Name Badge for Solved Landmarks */}
                  <Show when={isSolved()}>
                    <span class="mt-1 text-[9px] sm:text-[10px] font-black uppercase text-[var(--ink)] bg-surface border-2 border-[var(--ink)] px-2 py-0.5 rounded  leading-tight whitespace-nowrap">
                      {distro().name}
                    </span>
                  </Show>

                  {/* Active Clue Badge */}
                  <Show when={!isSolved() && isCurrent()}>
                    <span class="mt-1 text-[9px] sm:text-[10px] font-black uppercase text-[var(--ink)] bg-[var(--pop-pink)] border-2 border-[var(--ink)] px-2 py-0.5 rounded  leading-tight whitespace-nowrap">
                      Active Clue
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>

          {/* Discovery Celebration: Relic appears in center and flies into exact landmark position */}
          <Show when={flyingDiscovery()}>
            {(disc) => {
              const isFlying = () => disc().phase === "flying";
              return (
                <div
                  class="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none transition-all duration-1000 ease-in-out flex flex-col items-center"
                  style={{
                    left: isFlying() ? `${disc().target.x}%` : "50%",
                    top: isFlying() ? `${disc().target.y}%` : "50%",
                  }}
                >
                  {/* Exact same sized circle as the landmark pin */}
                  <div
                    class="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-surface-2 border-[2.5px] border-[var(--ink)]  grid place-items-center transition-transform duration-1000 ease-in-out"
                    style={{
                      transform: isFlying() ? "scale(1)" : "scale(2.2)",
                    }}
                  >
                    <img
                      src={disc().distro.svgPath}
                      alt={disc().distro.name}
                      class="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                    />
                  </div>

                  {/* Discovery label positioned without altering the circle center */}
                  <div
                    class={`absolute top-full mt-3 transition-opacity duration-300 pointer-events-none whitespace-nowrap ${
                      isFlying() ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <span class="text-xs font-black uppercase text-[var(--ink)] bg-[var(--pop-yellow)] border-2 border-[var(--ink)] px-2.5 py-0.5 rounded  block">
                      Discovered {disc().distro.name}
                    </span>
                  </div>
                </div>
              );
            }}
          </Show>
        </div>

        {/* -------------------- CLUE / DISTRO TROPHY MODAL -------------------- */}
        <Show when={selectedQuestionId() && selectedQuestion()}>
          {(() => {
            const q = selectedQuestion()!;
            const overallIdx = () => state()!.allQuestions.findIndex((item) => item.id === q.id);
            const distro = () => getDistroForQuestionIndex(overallIdx());
            const isSolved = () => isSelectedSolved();
            const isActive = () => isSelectedActive();

            return (
              <div
                class="fixed inset-0 z-50 grid place-items-center p-3 sm:p-4 overflow-y-auto"
                style={{ background: "rgba(34, 32, 43, 0.82)" }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelectedQuestionId(null);
                }}
              >
                <div
                  class="card pop-yellow max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-none relative overflow-hidden my-auto"
                  style={{ border: "2px solid var(--ink)" }}
                >
                  <Show when={justSolved()}>
                    <Confetti seed="clue-solved-burst" count={8} animate />
                  </Show>

                  {/* Modal Header Bar */}
                  <div class="flex items-center justify-between gap-2 border-b-2 border-[var(--ink)]/15 pb-2.5">
                    <div class="flex items-center gap-2">
                      <span class="badge text-xs font-black uppercase px-2 py-0.5 bg-[var(--pop-pink)] text-white">
                        {isSolved() ? "Discovered Relic" : `Relic #${overallIdx() + 1}`}
                      </span>
                      <span class="text-xs font-mono font-bold text-[var(--ink-soft)] uppercase">
                        Tier: {q.difficulty}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedQuestionId(null)}
                      class="grid h-7 w-7 place-items-center rounded-md bg-[var(--paper-2)] border border-[var(--ink)] text-[var(--ink)] cursor-pointer"
                      aria-label="Close"
                    >
                      <X size={15} strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Solved Relic Showcase / Friendly ELI15 Distro Guide */}
                  <Show when={isSolved()}>
                    <div class="space-y-3.5">
                      {/* Distro Header Card */}
                      <div class="p-3 rounded-xl bg-[var(--paper)] border-2 border-[var(--ink)] flex items-center gap-3.5">
                        <div class="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-[var(--paper-2)] border-2 border-[var(--ink)] p-2 grid place-items-center shrink-0">
                          <img
                            src={distro().svgPath}
                            alt={distro().name}
                            class="w-full h-full object-contain"
                          />
                        </div>
                        <div class="min-w-0 flex-1">
                          <span class="badge text-[9px] font-black uppercase px-1.5 py-0 bg-[var(--pop-teal)] text-[var(--ink)] border border-[var(--ink)]">
                            Discovered FOSS Treasure
                          </span>
                          <h4 class="text-base sm:text-lg font-black text-[var(--ink)] truncate m-0 leading-tight mt-0.5">
                            {distro().name}
                          </h4>
                          <p class="text-xs font-semibold text-[var(--ink-soft)] truncate m-0">
                            {distro().tagline}
                          </p>
                        </div>
                      </div>

                      {/* What is it? */}
                      <div class="space-y-1 p-3 rounded-xl bg-[var(--paper-2)] border border-[var(--ink)]/40 text-left">
                        <h5 class="text-xs font-black uppercase text-[var(--ink)] tracking-wide m-0">
                          What is it?
                        </h5>
                        <p class="text-xs sm:text-sm font-medium text-[var(--ink)] leading-relaxed m-0">
                          {distro().whatIsIt}
                        </p>
                      </div>

                      {/* What makes it special? */}
                      <div class="space-y-1 p-3 rounded-xl bg-[var(--paper-2)] border border-[var(--ink)]/40 text-left">
                        <h5 class="text-xs font-black uppercase text-[var(--ink)] tracking-wide m-0">
                          Why is it cool?
                        </h5>
                        <p class="text-xs sm:text-sm font-medium text-[var(--ink)] leading-relaxed m-0">
                          {distro().specialPower}
                        </p>
                      </div>

                      {/* Who uses it? */}
                      <div class="space-y-1 p-3 rounded-xl bg-[var(--paper-2)] border border-[var(--ink)]/40 text-left">
                        <h5 class="text-xs font-black uppercase text-[var(--ink)] tracking-wide m-0">
                          Who uses it?
                        </h5>
                        <p class="text-xs sm:text-sm font-medium text-[var(--ink)] leading-relaxed m-0">
                          {distro().whoIsItFor}
                        </p>
                      </div>

                      {/* Expandable Story Section */}
                      <div class="space-y-2">
                        <button
                          type="button"
                          onClick={() => setExpandedDistro(!expandedDistro())}
                          class="w-full py-2 px-3 rounded-lg border-2 border-[var(--ink)] bg-[var(--paper)] text-xs font-black uppercase text-[var(--ink)] flex items-center justify-between cursor-pointer"
                        >
                          <span>
                            {expandedDistro()
                              ? "Show Less"
                              : `Read the Full Story of ${distro().name}`}
                          </span>
                          <span class="font-mono text-xs">{expandedDistro() ? "▲" : "▼"}</span>
                        </button>

                        <Show when={expandedDistro()}>
                          <div class="space-y-2 p-3.5 rounded-xl bg-[var(--paper-2)] border-2 border-[var(--ink)] text-xs sm:text-sm text-[var(--ink)] leading-relaxed text-left">
                            <For each={distro().storyParagraphs}>
                              {(paragraph) => <p class="m-0 font-medium">{paragraph}</p>}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </Show>

                  {/* Active Question Clue & Submission Form */}
                  <Show when={!isSolved()}>
                    <div class="space-y-2">
                      <h3
                        class="text-lg sm:text-xl font-black text-[var(--ink)] m-0 leading-tight"
                        style={{ "font-family": "var(--font-stack-display)" }}
                      >
                        {q.title}
                      </h3>

                      {/* Rich HTML Hint */}
                      <div
                        class="p-3.5 rounded-xl bg-[var(--paper)] border-2 border-[var(--ink)] text-sm font-medium leading-relaxed"
                        innerHTML={
                          isActive()
                            ? (state()?.currentQuestion?.hintHtml ?? q.title)
                            : '<p class="italic text-xs text-[var(--ink-soft)] m-0">Solve earlier clues to reveal this treasure.</p>'
                        }
                      />
                    </div>

                    {/* Answer Input Box */}
                    <Show when={isActive()}>
                      <form onSubmit={handleSubmit} class="space-y-3 pt-1">
                        <div class="flex flex-col sm:flex-row gap-2">
                          <input
                            value={answerInput()}
                            onInput={(e) => setAnswerInput(e.currentTarget.value)}
                            disabled={busy() || cooldownSeconds() > 0 || props.disabled}
                            placeholder="Enter your answer or token…"
                            class="input flex-1 font-mono text-sm py-2.5 px-3 font-bold uppercase"
                          />

                          <button
                            type="submit"
                            disabled={
                              busy() ||
                              !answerInput().trim() ||
                              cooldownSeconds() > 0 ||
                              props.disabled
                            }
                            class="btn-brand py-2.5 px-5 text-sm font-black shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            <Show
                              when={cooldownSeconds() > 0}
                              fallback={busy() ? "Checking…" : "Submit ➔"}
                            >
                              Wait ({cooldownSeconds()}s)
                            </Show>
                          </button>
                        </div>

                        {/* Cooldown Info */}
                        <Show when={cooldownSeconds() > 0}>
                          <div class="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--paper-2)] border border-[var(--ink)]/30 text-xs font-bold text-[var(--ink-soft)]">
                            <RefreshCw
                              size={13}
                              class="text-[var(--pop-pink)] animate-spin shrink-0"
                            />
                            <span>
                              1 guess per min. Ready in <strong>{cooldownSeconds()}s</strong>.
                            </span>
                          </div>
                        </Show>

                        {/* Error Alert */}
                        <Show when={errorMsg()}>
                          <div class="p-2.5 rounded-lg bg-[var(--pop-red)] text-white text-xs font-bold flex items-center gap-2">
                            <ShieldAlert size={15} class="shrink-0" />
                            <span>{errorMsg()}</span>
                          </div>
                        </Show>
                      </form>
                    </Show>
                  </Show>
                </div>
              </div>
            );
          })()}
        </Show>

        <Show when={justSolved()}>
          <Confetti seed="treasure-solved" count={12} animate />
        </Show>
      </Show>
    </div>
  );
}
