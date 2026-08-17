import { createAsync } from "@solidjs/router";
import { AlertTriangle, Clock, ShieldAlert } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { ShoutBurst } from "~/components/art/Burst";
import { SHOUT_COLOR } from "~/lib/shouts";
import { ackWarningAction } from "~/server/auth/actions";
import { shell } from "~/lib/queries";

/**
 * Ban and warning state, mounted across the entire application.
 *
 * Provides:
 * 1. A permanent top banner above the header reminding the player of active warnings,
 *    temporary benches (Level 2/3), or account restrictions (Level 4) on every reload.
 * 2. An interrupt modal for Level 1 warnings that the player must acknowledge.
 */
export function BanNotice() {
  // Shares the shell's single round trip with Nav and BetaGate rather than
  // making a fourth request of its own on every navigation.
  const data = createAsync(() => shell());
  const state = () => data()?.ban ?? null;
  const [modalDismissed, setModalDismissed] = createSignal(false);

  const isLevel1 = () => state()?.level === 1;
  const isBenched = () => (state()?.level ?? 0) === 2 || (state()?.level ?? 0) === 3;
  const isHardBanned = () => (state()?.level ?? 0) === 4;

  const showModal = () => isLevel1() && state()!.needsAck && !modalDismissed();

  const acknowledge = () => {
    setModalDismissed(true);
    void ackWarningAction();
  };

  return (
    <>
      {/* ---------------------------------------------------- 1. Permanent Top Banner (Above Header) */}
      <Show when={state() && state()!.level > 0}>
        <div
          class="w-full text-xs font-bold transition-all"
          style={{
            background: isHardBanned()
              ? "var(--pop-red)"
              : isBenched()
                ? "var(--pop-yellow)"
                : "var(--paper-3)",
            color: "var(--ink)",
            "border-bottom": "var(--ink-w-bold) solid var(--ink)",
          }}
        >
          <div class="container flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-1.5 px-4">
            <div class="flex items-center gap-2 min-w-0">
              <Show
                when={isHardBanned()}
                fallback={
                  <Show
                    when={isBenched()}
                    fallback={<AlertTriangle size={14} class="text-amber-700 shrink-0" />}
                  >
                    <Clock size={14} class="shrink-0" />
                  </Show>
                }
              >
                <ShieldAlert size={14} class="text-white shrink-0" />
              </Show>

              <span
                class="px-1.5 py-0.2 rounded font-black text-[10px] uppercase border"
                style={{
                  background: isHardBanned()
                    ? "rgba(0,0,0,0.2)"
                    : isBenched()
                      ? "var(--pop-pink)"
                      : "var(--pop-yellow)",
                  border: "1px solid var(--ink)",
                }}
              >
                {isHardBanned() ? "OUT" : isBenched() ? "BENCHED" : "WARNING"}
              </span>

              <p class="truncate text-[11px] sm:text-xs">
                {isLevel1()
                  ? "Account Warning: Irregular activity detected. Repeat incidents will lead to a gameplay timeout."
                  : state()!.message}
              </p>
            </div>

            <Show when={isBenched() && state()?.until}>
              <span class="text-[10px] font-mono font-black opacity-80 shrink-0">
                Resumes:{" "}
                {new Date(state()!.until!).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                IST
              </span>
            </Show>
          </div>
        </div>
      </Show>

      {/* ---------------------------------------------------- 2. Level 1 Warning Interrupt Modal */}
      <Show when={showModal()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div class="card pop-yellow w-full max-w-md space-y-4 text-center border-2 border-[var(--ink)] shadow-2xl p-6">
            <ShoutBurst text="ENTHUVA!" color={SHOUT_COLOR.confused} seed="ban-warning" />
            <div class="space-y-2 text-left bg-[var(--paper-2)] p-3 rounded-md border border-[var(--ink)]">
              <p class="font-extrabold text-sm text-[var(--ink)]">Official Account Warning</p>
              <p class="text-xs leading-relaxed text-[var(--ink)] font-semibold">
                {state()!.message}
              </p>
            </div>
            <p class="comment text-xs font-bold">
              nothing has been taken away yet. play fairly and enjoy the games!
            </p>
            <button
              type="button"
              class="btn-brand w-full py-2.5 font-black text-sm cursor-pointer"
              onClick={acknowledge}
            >
              I Understand & Agree
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
