import { Key, RefreshCw, ShieldAlert, X } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { LoadingScreen } from "~/components/LoadingScreen";
import { getDistroForQuestionIndex, mapQuestionsToDistros } from "~/lib/treasure-distros";
import type { HuntPublicState, HuntSubmitResult } from "~/server/games/hunt/service";

export interface TreasureHuntGameProps {
  onFinish?: (submission: unknown) => void;
  disabled?: boolean;
}

// 10 Organic Landmark coordinates for Desktop (1000x650)
const DESKTOP_COORDINATES = [
  { x: 120, y: 500, name: "Harbor Inlet" },
  { x: 220, y: 340, name: "Coconut Bay" },
  { x: 170, y: 160, name: "Northern Shoals" },
  { x: 380, y: 130, name: "Kernel Ridge" },
  { x: 500, y: 250, name: "Grand Pookalam" },
  { x: 400, y: 440, name: "Vallam Channel" },
  { x: 580, y: 530, name: "Coral Reach" },
  { x: 740, y: 460, name: "Muthukuda Cape" },
  { x: 820, y: 290, name: "Freedom Straits" },
  { x: 870, y: 120, name: "Patala Vault" },
];

// 10 Organic Landmark coordinates for Mobile (420x780)
const MOBILE_COORDINATES = [
  { x: 100, y: 70, name: "Harbor Inlet" },
  { x: 310, y: 135, name: "Coconut Bay" },
  { x: 130, y: 210, name: "Northern Shoals" },
  { x: 300, y: 280, name: "Kernel Ridge" },
  { x: 115, y: 355, name: "Grand Pookalam" },
  { x: 290, y: 430, name: "Vallam Channel" },
  { x: 125, y: 505, name: "Coral Reach" },
  { x: 305, y: 580, name: "Muthukuda Cape" },
  { x: 140, y: 655, name: "Freedom Straits" },
  { x: 270, y: 725, name: "Patala Vault" },
];

function makeSegmentPath(p0: { x: number; y: number }, p1: { x: number; y: number }): string {
  const midX = (p0.x + p1.x) / 2;
  const midY = (p0.y + p1.y) / 2;
  const cx = midX + (p0.y - p1.y) * 0.18;
  const cy = midY + (p1.x - p0.x) * 0.18;
  return `M ${p0.x},${p0.y} Q ${cx},${cy} ${p1.x},${p1.y}`;
}

export function TreasureHuntGame(props: TreasureHuntGameProps) {
  const [state, setState] = createSignal<HuntPublicState | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [answerInput, setAnswerInput] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [cooldownSeconds, setCooldownSeconds] = createSignal(0);
  const [selectedQuestionId, setSelectedQuestionId] = createSignal<string | null>(null);
  const [justSolved, setJustSolved] = createSignal<string | null>(null);
  const [isMobile, setIsMobile] = createSignal(false);

  onMount(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    onCleanup(() => window.removeEventListener("resize", check));
  });

  const fetchState = async () => {
    try {
      const res = await fetch("/api/hunt/state");
      if (res.ok) {
        const data = (await res.json()) as HuntPublicState;
        setState(data);
        if (data.cooldownRemainingSec > 0) {
          setCooldownSeconds(data.cooldownRemainingSec);
        }
        if (data.currentQuestion && !selectedQuestionId()) {
          setSelectedQuestionId(data.currentQuestion.id);
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

  createEffect(() => {
    if (cooldownSeconds() <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    onCleanup(() => clearInterval(interval));
  });

  const distroMapping = createMemo(() => {
    const s = state();
    if (!s || !s.allQuestions) return new Map();
    return mapQuestionsToDistros(s.allQuestions);
  });

  const solvedSet = createMemo(() => new Set(state()?.solvedQuestionIds ?? []));
  const activeQuestion = () => state()?.currentQuestion ?? null;

  const selectedQuestion = createMemo(() => {
    const s = state();
    const qid = selectedQuestionId();
    if (!s || !qid) return null;
    return s.allQuestions.find((q) => q.id === qid) ?? null;
  });

  const isSelectedActive = () =>
    selectedQuestionId() && activeQuestion()?.id === selectedQuestionId();

  const isSelectedSolved = () =>
    selectedQuestionId() ? solvedSet().has(selectedQuestionId()!) : false;

  const currentCoords = () => (isMobile() ? MOBILE_COORDINATES : DESKTOP_COORDINATES);
  const currentViewBox = () => (isMobile() ? "0 0 420 780" : "0 0 1000 650");

  const activeIndex = createMemo(() => {
    const s = state();
    const act = activeQuestion();
    if (!s || !act) return -1;
    return s.allQuestions.findIndex((q) => q.id === act.id);
  });

  const handleSubmit = async (e?: Event) => {
    e?.preventDefault();
    const ans = answerInput().trim();
    if (!ans || busy() || cooldownSeconds() > 0) return;

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
          setCooldownSeconds(data.cooldownRemainingSec);
        }
        return;
      }

      if (data.state) {
        setState(data.state);
        if (data.state.cooldownRemainingSec > 0) {
          setCooldownSeconds(data.state.cooldownRemainingSec);
        }
      }

      if (data.valid) {
        setAnswerInput("");
        setJustSolved(data.solvedQuestionId ?? "solved");
        setTimeout(() => setJustSolved(null), 3500);

        if (data.state.currentQuestion) {
          setSelectedQuestionId(data.state.currentQuestion.id);
        } else if (data.isComplete || data.state.completed) {
          setSelectedQuestionId(null);
          props.onFinish?.({ token: "TREASURE_HUNT_ALL_COMPLETED" });
        }
      } else {
        setErrorMsg(data.reason ?? "Incorrect answer. Keep searching!");
        if (data.cooldownRemainingSec > 0) {
          setCooldownSeconds(data.cooldownRemainingSec);
        }
      }
    } catch {
      setErrorMsg("Network error. Please check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="relative w-full h-full max-h-full flex flex-col items-center justify-center overflow-hidden select-none">
      <Show when={loading()}>
        <div class="m-auto text-center py-12">
          <LoadingScreen compact message="Inking the archipelago treasure map…" />
        </div>
      </Show>

      <Show when={!loading() && state()}>
        {/* -------------------- TREASURE REALM MAP SVG CANVAS -------------------- */}
        <div class="relative w-full h-full max-h-full flex items-center justify-center overflow-hidden rounded-2xl border-2 border-[var(--ink)] bg-[var(--paper)]">
          <svg
            viewBox={currentViewBox()}
            preserveAspectRatio="xMidYMid meet"
            class="w-full h-full max-h-full block"
          >
            <defs>
              {/* Water Ripples Pattern */}
              <pattern
                id="water-ripples"
                x="0"
                y="0"
                width="40"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 5,10 Q 12,6 20,10 Q 28,14 35,10"
                  fill="none"
                  stroke="var(--ink)"
                  stroke-width="1.2"
                  opacity="0.1"
                />
              </pattern>
            </defs>

            {/* Ocean Base Background */}
            <rect width="100%" height="100%" fill="var(--paper)" />
            <rect width="100%" height="100%" fill="url(#water-ripples)" />

            {/* Inked Island Landmasses (Desktop vs Mobile Organic Layouts) */}
            <Show
              when={isMobile()}
              fallback={
                /* Desktop Islands */
                <g>
                  {/* Island 1 */}
                  <path
                    d="M 60,340 C 90,260 140,240 230,260 C 310,280 290,420 250,520 C 210,600 110,620 70,540 C 40,480 40,400 60,340 Z"
                    fill="var(--paper-2)"
                    stroke="var(--ink)"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                  />
                  {/* Island 2 */}
                  <path
                    d="M 120,120 C 160,70 260,60 360,80 C 450,100 480,180 420,230 C 350,280 260,250 180,240 C 120,230 90,160 120,120 Z"
                    fill="var(--paper-2)"
                    stroke="var(--ink)"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                  />
                  {/* Island 3 */}
                  <path
                    d="M 440,220 C 520,180 620,190 660,260 C 700,320 670,410 590,440 C 510,470 420,440 380,380 C 340,320 380,250 440,220 Z"
                    fill="var(--paper-2)"
                    stroke="var(--ink)"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                  />
                  {/* Island 4 */}
                  <path
                    d="M 460,510 C 520,470 650,470 700,530 C 740,580 680,630 580,635 C 480,640 420,560 460,510 Z"
                    fill="var(--paper-2)"
                    stroke="var(--ink)"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                  />
                  {/* Island 5 */}
                  <path
                    d="M 720,380 C 760,260 770,160 840,90 C 910,30 970,70 960,180 C 950,290 920,420 860,490 C 800,560 700,480 720,380 Z"
                    fill="var(--paper-2)"
                    stroke="var(--ink)"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                  />
                  {/* Compass Rose */}
                  <g transform="translate(100, 90) scale(0.75)">
                    <circle
                      cx="0"
                      cy="0"
                      r="38"
                      fill="none"
                      stroke="var(--ink)"
                      stroke-width="1.5"
                      opacity="0.3"
                    />
                    <path
                      d="M 0,-42 L 7,-6 L 0,0 Z"
                      fill="var(--pop-red)"
                      stroke="var(--ink)"
                      stroke-width="1.5"
                    />
                    <path
                      d="M 0,-42 L -7,-6 L 0,0 Z"
                      fill="var(--paper-2)"
                      stroke="var(--ink)"
                      stroke-width="1.5"
                    />
                    <circle cx="0" cy="0" r="4" fill="var(--ink)" />
                    <text
                      x="0"
                      y="-48"
                      text-anchor="middle"
                      font-family="var(--font-stack-display)"
                      font-size="12"
                      font-weight="900"
                      fill="var(--ink)"
                    >
                      N
                    </text>
                  </g>
                </g>
              }
            >
              {/* Mobile Islands (Vertical Archipelago) */}
              <g>
                <path
                  d="M 40,40 C 120,20 360,30 380,140 C 390,200 320,260 260,260 C 180,260 40,220 30,140 C 20,80 40,40 40,40 Z"
                  fill="var(--paper-2)"
                  stroke="var(--ink)"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <path
                  d="M 50,290 C 140,270 360,270 380,360 C 390,430 310,480 240,480 C 160,480 40,440 30,370 C 20,320 50,290 50,290 Z"
                  fill="var(--paper-2)"
                  stroke="var(--ink)"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <path
                  d="M 40,510 C 140,490 360,490 380,590 C 390,660 300,750 200,760 C 100,770 40,700 30,620 C 20,550 40,510 40,510 Z"
                  fill="var(--paper-2)"
                  stroke="var(--ink)"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
              </g>
            </Show>

            {/* ----------------- PROGRESSIVE ROAD PATH SYSTEM ----------------- */}
            {(() => {
              const qs = state()!.allQuestions;
              const coords = currentCoords();
              const actIdx = activeIndex();

              return (
                <For each={qs.slice(0, qs.length - 1)}>
                  {(_, idx) => {
                    const p0 = coords[idx()];
                    const p1 = coords[idx() + 1];
                    if (!p0 || !p1) return null;

                    const d = makeSegmentPath(p0, p1);
                    // A segment is revealed if its destination is <= activeIndex (or all if completed)
                    const isRevealed = () => state()!.completed || (actIdx >= 0 && idx() < actIdx);

                    return (
                      <g>
                        {/* Revealed / Charted Road */}
                        <Show
                          when={isRevealed()}
                          fallback={
                            /* Unrevealed Dashed Future Path */
                            <path
                              d={d}
                              fill="none"
                              stroke="var(--ink)"
                              stroke-width={isMobile() ? "2.5" : "3"}
                              stroke-dasharray="5,7"
                              stroke-linecap="round"
                              opacity="0.35"
                            />
                          }
                        >
                          {/* Outer Border Inked Road Line */}
                          <path
                            d={d}
                            fill="none"
                            stroke="var(--ink)"
                            stroke-width={isMobile() ? "5" : "6"}
                            stroke-linecap="round"
                          />
                          {/* Inner Golden Revealed Road Fill */}
                          <path
                            d={d}
                            fill="none"
                            stroke="var(--pop-yellow)"
                            stroke-width={isMobile() ? "2.5" : "3.5"}
                            stroke-linecap="round"
                          />
                        </Show>
                      </g>
                    );
                  }}
                </For>
              );
            })()}

            {/* ----------------- MAP LANDMARK NODES ----------------- */}
            <For each={state()!.allQuestions}>
              {(q, idx) => {
                const coord = () =>
                  currentCoords()[idx()] ?? {
                    x: 50 + idx() * 30,
                    y: 300,
                    name: `Relic #${idx() + 1}`,
                  };
                const isSolved = () => solvedSet().has(q.id);
                const isActive = () => activeQuestion()?.id === q.id;
                const distro = () => distroMapping().get(q.id) ?? getDistroForQuestionIndex(idx());
                const radius = () => (isMobile() ? 20 : 23);

                return (
                  <g
                    transform={`translate(${coord().x}, ${coord().y})`}
                    class="cursor-pointer"
                    onClick={() => {
                      setErrorMsg("");
                      setSelectedQuestionId(q.id);
                    }}
                  >
                    {/* Active Halo Ring */}
                    <Show when={isActive()}>
                      <circle
                        r={radius() + 9}
                        fill="none"
                        stroke="var(--pop-yellow)"
                        stroke-width="3"
                        stroke-dasharray="4,4"
                        class="animate-spin-slow"
                      />
                      <circle r={radius() + 4} fill="var(--pop-yellow)" opacity="0.25" />
                    </Show>

                    {/* Node Landmark Base Circle */}
                    <circle
                      r={radius()}
                      fill={
                        isSolved()
                          ? "var(--pop-teal)"
                          : isActive()
                            ? "var(--pop-yellow)"
                            : "var(--paper-2)"
                      }
                      stroke="var(--ink)"
                      stroke-width="2.5"
                    />

                    {/* Node Interior Icon */}
                    <Show
                      when={isSolved()}
                      fallback={
                        <Show
                          when={isActive()}
                          fallback={
                            /* Locked Landmark #X */
                            <text
                              text-anchor="middle"
                              dominant-baseline="central"
                              font-family="var(--font-stack-display)"
                              font-size={isMobile() ? "12" : "13"}
                              font-weight="900"
                              fill="var(--ink-soft)"
                            >
                              #{idx() + 1}
                            </text>
                          }
                        >
                          {/* Active Landmark Key */}
                          <g transform="translate(-8, -8)">
                            <Key size={16} class="text-[var(--ink)]" strokeWidth={2.5} />
                          </g>
                        </Show>
                      }
                    >
                      {/* Solved Distro SVG Logo */}
                      <image
                        href={distro().svgPath}
                        x={-radius() * 0.58}
                        y={-radius() * 0.58}
                        width={radius() * 1.16}
                        height={radius() * 1.16}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </Show>

                    {/* Active Target Banner Badge */}
                    <Show when={isActive()}>
                      <g transform={`translate(0, ${-radius() - 10})`}>
                        <rect
                          x="-24"
                          y="-9"
                          width="48"
                          height="17"
                          rx="8.5"
                          fill="var(--pop-pink)"
                          stroke="var(--ink)"
                          stroke-width="1.5"
                        />
                        <text
                          x="0"
                          y="2.5"
                          text-anchor="middle"
                          font-family="var(--font-stack-display)"
                          font-size="8.5"
                          font-weight="900"
                          fill="white"
                        >
                          CLUE #{idx() + 1}
                        </text>
                      </g>
                    </Show>

                    {/* Solved Check Badge */}
                    <Show when={isSolved()}>
                      <g transform={`translate(${radius() * 0.65}, ${-radius() * 0.65})`}>
                        <circle
                          r="6.5"
                          fill="var(--pop-yellow)"
                          stroke="var(--ink)"
                          stroke-width="1.5"
                        />
                        <path
                          d="M -2.5,0 L -0.8,1.8 L 2.5,-1.8"
                          fill="none"
                          stroke="var(--ink)"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                      </g>
                    </Show>

                    {/* Landmark Name Label */}
                    <text
                      y={radius() + 13}
                      text-anchor="middle"
                      font-family="var(--font-stack-body)"
                      font-size={isMobile() ? "9" : "10"}
                      font-weight="800"
                      fill="var(--ink)"
                    >
                      {isSolved() ? distro().name : `Relic #${idx() + 1}`}
                    </text>
                  </g>
                );
              }}
            </For>
          </svg>
        </div>

        {/* -------------------- CLUE & SUBMIT MODAL (POPUPS OVER MAP) -------------------- */}
        <Show when={selectedQuestionId() && selectedQuestion()}>
          {(() => {
            const q = selectedQuestion()!;
            const overallIdx = () => state()!.allQuestions.findIndex((item) => item.id === q.id);
            const distro = () =>
              distroMapping().get(q.id) ?? getDistroForQuestionIndex(overallIdx());
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
                  class="card pop-yellow max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative overflow-hidden my-auto"
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

                  {/* Solved Relic Showcase */}
                  <Show when={isSolved()}>
                    <div class="p-3 rounded-xl bg-[var(--paper)] border-2 border-[var(--ink)] flex items-center gap-3">
                      <div class="w-11 h-11 rounded-lg bg-[var(--paper-2)] border border-[var(--ink)] p-1.5 grid place-items-center shrink-0">
                        <img
                          src={distro().svgPath}
                          alt={distro().name}
                          class="w-full h-full object-contain"
                        />
                      </div>
                      <div class="min-w-0">
                        <span class="badge text-[9px] font-black uppercase px-1.5 py-0 bg-[var(--pop-teal)] text-[var(--ink)]">
                          Discovered
                        </span>
                        <h4 class="text-sm font-black text-[var(--ink)] truncate m-0">
                          {distro().name}
                        </h4>
                        <p class="text-xs font-semibold text-[var(--ink-soft)] truncate m-0">
                          {distro().tagline}
                        </p>
                      </div>
                    </div>
                  </Show>

                  {/* Clue Text */}
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
                          ? (activeQuestion()?.hintHtml ?? q.title)
                          : isSolved()
                            ? '<p class="text-xs font-bold text-[var(--ink-soft)] m-0">✓ Solved and charted on your treasure map!</p>'
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
                          class="input flex-1 font-mono text-sm py-2.5 px-3 font-bold"
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
                            class="text-[var(--pop-pink)] animate-spin-slow shrink-0"
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
                </div>
              </div>
            );
          })()}
        </Show>
      </Show>
    </div>
  );
}
