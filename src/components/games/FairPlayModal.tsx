import { AlertTriangle, CheckCircle2, ShieldAlert, Smartphone, Users } from "lucide-solid";
import { onCleanup, onMount } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";

import { getMultiStoreSync, setMultiStoreSync } from "~/lib/multi-store";

export const FAIR_PLAY_STORAGE_KEY = "foss_fair_play_ack_v1";

export function hasAcknowledgedFairPlay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return getMultiStoreSync(FAIR_PLAY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveFairPlayAcknowledgement(): void {
  if (typeof window === "undefined") return;
  try {
    setMultiStoreSync(FAIR_PLAY_STORAGE_KEY, "true");
  } catch {
    // Ignore private browsing storage errors
  }
}

export interface FairPlayModalProps {
  onAccept: () => void;
  onClose: () => void;
}

export function FairPlayModal(props: FairPlayModalProps) {
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    });
  });

  const handleAgree = () => {
    saveFairPlayAcknowledgement();
    props.onAccept();
  };

  return (
    <div
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 select-none"
      style={{ background: "rgb(34 32 43 / 0.82)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Fair Play & Bounty Eligibility Rules"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="card pop-yellow anim-sheet-in my-auto w-full max-w-lg space-y-4 p-5 sm:p-6"
        style={{
          border: "var(--ink-w-bold) solid var(--ink)",
          background: "var(--paper)",
        }}
      >
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Confetti seed="fairplay-modal" count={6} opacity={0.3} />
        </div>

        {/* Header */}
        <div class="flex items-start justify-between gap-3 relative z-10">
          <div class="flex items-center gap-2.5">
            <SpriteIcon name="foss-mec-badge" size={36} animate="wobble" interactive />
            <div>
              <span
                class="badge text-[10px] uppercase font-black"
                style={{ "--pop": "var(--pop-red)" }}
              >
                Important Notice
              </span>
              <h2
                class="text-xl sm:text-2xl leading-tight font-black m-0 text-[var(--ink)]"
                style={{ "font-family": "var(--font-stack-display)" }}
              >
                Fair Play & Rewards Policy
              </h2>
            </div>
          </div>

          <button
            type="button"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base cursor-pointer hover:bg-[var(--pop-yellow)]"
            style={{
              background: "var(--paper-3)",
              border: "var(--ink-w) solid var(--ink)",
              "font-family": "var(--font-stack-display)",
              "font-weight": 800,
            }}
            onClick={props.onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p class="text-xs sm:text-sm font-semibold text-[var(--ink-soft)] leading-relaxed relative z-10 m-0">
          To keep daily ₹250 cash bounties and leaderboard podiums fair and fun for all players,
          please confirm you understand our anti-cheat rules before starting:
        </p>

        {/* Core Rules List */}
        <div class="space-y-2.5 relative z-10">
          <div
            class="p-3 rounded flex items-start gap-3 bg-[var(--paper-2)] border"
            style={{ border: "1.5px solid var(--ink)" }}
          >
            <Users size={20} class="text-[var(--pop-red-deep)] shrink-0 mt-0.5" />
            <div class="space-y-0.5 text-xs">
              <p class="font-extrabold text-[var(--ink)] m-0">No Multiple Accounts</p>
              <p class="font-semibold text-[var(--ink-soft)] m-0 leading-normal">
                Playing with alternate/burner Google accounts to scout puzzles or gain extra tries
                will result in disqualification of all linked accounts.
              </p>
            </div>
          </div>

          <div
            class="p-3 rounded flex items-start gap-3 bg-[var(--paper-2)] border"
            style={{ border: "1.5px solid var(--ink)" }}
          >
            <Smartphone size={20} class="text-[var(--pop-purple-deep)] shrink-0 mt-0.5" />
            <div class="space-y-0.5 text-xs">
              <p class="font-extrabold text-[var(--ink)] m-0">One Person, One Account</p>
              <p class="font-semibold text-[var(--ink-soft)] m-0 leading-normal">
                Creating extra Google accounts to get more tries or scout puzzles is not allowed.
              </p>
            </div>
          </div>

          <div
            class="p-3 rounded flex items-start gap-3 bg-[var(--paper-2)] border"
            style={{ border: "1.5px solid var(--ink)" }}
          >
            <ShieldAlert size={20} class="text-[var(--pop-pink-deep)] shrink-0 mt-0.5" />
            <div class="space-y-0.5 text-xs">
              <p class="font-extrabold text-[var(--ink)] m-0">No Solution Copying or Scripting</p>
              <p class="font-semibold text-[var(--ink-soft)] m-0 leading-normal">
                Sharing solve paths, copying others' solutions, or using automation bots/scripts
                violates fair play. Solve it yourself!
              </p>
            </div>
          </div>
        </div>

        {/* Notice Footer */}
        <div class="p-2.5 rounded bg-[var(--pop-yellow)]/30 border border-[var(--ink)]/40 flex items-center gap-2 text-[11px] font-bold text-[var(--ink)] relative z-10">
          <AlertTriangle size={15} class="shrink-0 text-[var(--pop-red-deep)]" />
          <span>
            All daily bounty winners undergo cryptographic backend replay & verification before
            payout.
          </span>
        </div>

        {/* Buttons */}
        <div class="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-1 relative z-10">
          <button
            type="button"
            class="btn-ghost w-full sm:w-auto text-xs sm:text-sm py-2 px-4"
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-brand flex-1 w-full text-sm sm:text-base py-2.5 px-4 font-black inline-flex items-center justify-center gap-2"
            onClick={handleAgree}
          >
            <CheckCircle2 size={16} strokeWidth={2.5} />
            <span>I Understand & Agree to Play Fair →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
