import { useSearchParams } from "@solidjs/router";
import { Key, RefreshCw, ShieldAlert, X } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { LoadingScreen } from "~/components/LoadingScreen";
import { CommunityGroupCard } from "~/components/CommunityGroupCard";
import { treasureMapImage } from "~/lib/img";
import { getDistroForQuestionIndex } from "~/lib/treasure-distros";
import type { HuntPublicState, HuntSubmitResult } from "~/server/games/hunt/service";

export interface TreasureHuntGameProps {
  disabled?: boolean;
  onComplete?: (stats: { score: number; durationMs?: number }) => void;
}

// FOSS MEC socials — icon-only row shown below the clue + answer (Image 1)
const FOSS_SOCIALS = [
  {
    href: "https://instagram.com/foss_mec",
    label: "Instagram",
    path: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  },
  {
    href: "https://t.me/joinchat/wHtSpuMBQxODhl",
    label: "Telegram",
    path: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  },
  {
    href: "https://linkedin.com/company/fossmec",
    label: "LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    href: "https://github.com/FOSSMEC",
    label: "GitHub",
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
  {
    href: "https://x.com/FossMec",
    label: "X",
    path: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
  },
  {
    href: "https://mastodon.social/@FOSS_MEC",
    label: "Mastodon",
    path: "M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z",
  },
] as const;

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
  const [tokenDigits, setTokenDigits] = createSignal<string[]>(["", "", "", "", "", ""]);
  const [busy, setBusy] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [cooldownSeconds, setCooldownSeconds] = createSignal(0);
  const [selectedQuestionId, setSelectedQuestionId] = createSignal<string | null>(null);
  const [justSolved, setJustSolved] = createSignal<string | null>(null);
  const [completionStats, setCompletionStats] = createSignal<{
    score: number;
    durationMs?: number;
  } | null>(null);
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
          const cleaned = paramAns.trim().toUpperCase();
          if (data.currentQuestion?.inputType === "token") {
            const chars = cleaned
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 6)
              .split("");
            const filled: string[] = ["", "", "", "", "", ""];
            for (let i = 0; i < chars.length; i++) filled[i] = chars[i];
            setTokenDigits(filled);
            setAnswerInput(filled.join(""));
          } else {
            setAnswerInput(cleaned);
          }
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

  const isTesterMode = () => !!state()?.isTesterMode;

  const isSelectedActive = createMemo(() => {
    const s = state();
    const id = selectedQuestionId();
    if (!s || !id) return false;
    if (s.isTesterMode) return !s.solvedQuestionIds.includes(id);
    if (!s.currentQuestion) return false;
    return id === s.currentQuestion.id;
  });

  const isSelectedSolved = createMemo(() => {
    const s = state();
    const id = selectedQuestionId();
    if (!s || !id) return false;
    return s.solvedQuestionIds.includes(id);
  });

  const selectedInputType = (): "token" | "answer" => {
    const q = selectedQuestion();
    if (!q) return state()?.currentQuestion?.inputType ?? "answer";
    return (q as { inputType?: "token" | "answer" }).inputType ?? "answer";
  };

  const isTokenMode = () => selectedInputType() === "token";

  let prevSelected: string | null = null;
  createEffect(() => {
    const id = selectedQuestionId();
    if (id !== prevSelected) {
      prevSelected = id;
      setAnswerInput("");
      setTokenDigits(["", "", "", "", "", ""]);
      setErrorMsg("");
    }
  });

  const tokenValue = () => tokenDigits().join("");
  const isTokenComplete = () => tokenDigits().every((c) => /^[A-Z0-9]$/.test(c));

  const handleTokenInput = (idx: number, raw: string) => {
    const char = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(-1);
    const next = [...tokenDigits()];
    next[idx] = char;
    setTokenDigits(next);
    setAnswerInput(next.join(""));
    if (char && idx < 5) {
      const el = document.getElementById(`hunt-otp-${idx + 1}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  };

  const handleTokenKeyDown = (idx: number, e: KeyboardEvent) => {
    if (e.key === "Backspace" && !tokenDigits()[idx] && idx > 0) {
      const prev = document.getElementById(`hunt-otp-${idx - 1}`) as HTMLInputElement | null;
      prev?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) {
      (document.getElementById(`hunt-otp-${idx - 1}`) as HTMLInputElement | null)?.focus();
    }
    if (e.key === "ArrowRight" && idx < 5) {
      (document.getElementById(`hunt-otp-${idx + 1}`) as HTMLInputElement | null)?.focus();
    }
  };

  const handleTokenPaste = (e: ClipboardEvent) => {
    const text = (e.clipboardData?.getData("text") ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const filled: string[] = ["", "", "", "", "", ""];
    for (let i = 0; i < text.length; i++) filled[i] = text[i];
    setTokenDigits(filled);
    setAnswerInput(filled.join(""));
    const focusIdx = Math.min(text.length, 5);
    (document.getElementById(`hunt-otp-${focusIdx}`) as HTMLInputElement | null)?.focus();
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (busy() || cooldownSeconds() > 0 || props.disabled) return;
    const ans = (isTokenMode() ? tokenValue() : answerInput()).trim().toUpperCase();
    if (!ans) return;
    if (isTokenMode() && !isTokenComplete()) return;

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
        if (data.isComplete) {
          const stats = {
            score: data.score ?? data.state.solvedCount,
            durationMs: data.durationMs,
          };
          setCompletionStats(stats);
          // The server has already closed the attempt. Stop the local display
          // clock without making a second network request.
          props.onComplete?.(stats);
        }
        setAnswerInput("");
        setTokenDigits(["", "", "", "", "", ""]);
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
              <div class="flex items-center gap-2">
                <Show when={completionStats()}>
                  {(stats) => (
                    <span class="text-[10px] sm:text-xs font-black uppercase text-[var(--ink-soft)]">
                      Complete · {stats().score}/10
                      <Show when={stats().durationMs !== undefined}>
                        {" · "}
                        {Math.round((stats().durationMs ?? 0) / 1000)}s
                      </Show>
                    </span>
                  )}
                </Show>
                <a
                  href="/leaderboard"
                  class="btn-brand text-xs font-black uppercase px-3 py-1 rounded border-2 border-[var(--ink)] cursor-pointer inline-flex items-center gap-1"
                >
                  <span>Leaderboard →</span>
                </a>
              </div>
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
              const isSolved = () =>
                (state()?.solvedQuestionIds.includes(q.id) ?? false) &&
                flyingDiscovery()?.qId !== q.id;
              const isCurrent = () =>
                isTesterMode() ? !isSolved() : state()?.currentQuestion?.id === q.id;
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

        {/* Nudge below the map */}
        <p
          class="mt-2 text-center text-sm sm:text-base font-black tracking-tight"
          style={{ "font-family": "var(--font-stack-kalam)", color: "var(--ink)" }}
        >
          What are you waiting for? Only hints are here — answers are somewhere else!
        </p>

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
                            ? ((q as unknown as { hintHtml?: string }).hintHtml ??
                              state()?.currentQuestion?.hintHtml ??
                              q.title)
                            : '<p class="italic text-xs text-[var(--ink-soft)] m-0">Solve earlier clues to reveal this treasure.</p>'
                        }
                      />
                    </div>

                    {/* Answer / Token Input Box */}
                    <Show when={isActive()}>
                      <form onSubmit={handleSubmit} class="space-y-3 pt-1">
                        <Show
                          when={isTokenMode()}
                          fallback={
                            <div class="flex flex-col sm:flex-row gap-2">
                              <input
                                value={answerInput()}
                                onInput={(e) => setAnswerInput(e.currentTarget.value.toUpperCase())}
                                disabled={busy() || cooldownSeconds() > 0 || props.disabled}
                                placeholder="Enter your answer…"
                                autocomplete="off"
                                spellcheck={false}
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
                          }
                        >
                          <div class="space-y-2">
                            <p class="text-[11px] font-black uppercase tracking-widest text-[var(--ink-soft)]">
                              6-character code (letters and numbers only)
                            </p>
                            <div
                              class="grid grid-cols-6 gap-1.5 sm:gap-2"
                              onPaste={handleTokenPaste as any}
                            >
                              <For each={[0, 1, 2, 3, 4, 5]}>
                                {(idx) => (
                                  <input
                                    id={`hunt-otp-${idx}`}
                                    value={tokenDigits()[idx]}
                                    onInput={(e) => handleTokenInput(idx, e.currentTarget.value)}
                                    onKeyDown={(e) =>
                                      handleTokenKeyDown(idx, e as unknown as KeyboardEvent)
                                    }
                                    disabled={busy() || cooldownSeconds() > 0 || props.disabled}
                                    maxlength={1}
                                    autocomplete="off"
                                    spellcheck={false}
                                    class="input w-full h-11 sm:h-12 text-center font-mono text-base sm:text-lg font-black uppercase p-0"
                                    style={{ "letter-spacing": "0.02em" }}
                                  />
                                )}
                              </For>
                            </div>
                            <button
                              type="submit"
                              disabled={
                                busy() ||
                                !isTokenComplete() ||
                                cooldownSeconds() > 0 ||
                                props.disabled
                              }
                              class="btn-brand w-full py-2.5 px-4 sm:px-5 text-sm font-black cursor-pointer disabled:opacity-50"
                            >
                              <Show
                                when={cooldownSeconds() > 0}
                                fallback={busy() ? "Checking…" : "Submit ➔"}
                              >
                                Wait ({cooldownSeconds()}s)
                              </Show>
                            </button>
                          </div>
                        </Show>

                        {/* Cooldown Info */}
                        <Show when={cooldownSeconds() > 0}>
                          <div class="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--paper-2)] border border-[var(--ink)]/30 text-xs font-bold text-[var(--ink-soft)]">
                            <RefreshCw
                              size={13}
                              class="text-[var(--pop-pink)] animate-spin shrink-0"
                            />
                            <span>
                              1 guess per 30s. Ready in <strong>{cooldownSeconds()}s</strong>.
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

                    {/* FOSS MEC socials — icon-only, below question + answer */}
                    <div class="flex flex-wrap items-center justify-center gap-2 pt-3 mt-1 border-t-2 border-[var(--ink)]/10">
                      <For each={FOSS_SOCIALS}>
                        {(social) => (
                          <a
                            href={social.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={social.label}
                            title={social.label}
                            class="grid h-9 w-9 place-items-center rounded-full bg-[var(--paper)] border-2 border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--paper-2)] transition-colors"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              class="h-4 w-4 fill-current"
                            >
                              <path d={social.path} />
                            </svg>
                            <span class="sr-only">{social.label}</span>
                          </a>
                        )}
                      </For>
                    </div>

                    {/* Community Group Link Card */}
                    <CommunityGroupCard compact class="w-full mt-2.5" />
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
