import { createAsync } from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import { ShoutBurst } from "~/components/art/Burst";
import { SHOUT_COLOR } from "~/lib/shouts";
import { ackWarningAction, getMyBanState } from "~/server/auth/actions";

/**
 * Ban and warning state, on every page.
 *
 * This used to live only on the game page, so a warned player saw nothing until
 * they happened to open a game — which is the one moment a warning is least
 * useful, because they are already about to play. Mounted in the app shell it
 * appears wherever they are.
 *
 * The two levels are shown differently on purpose:
 *
 *   Level 1  a modal that has to be dismissed. It is a warning; it is supposed
 *            to interrupt, and dismissing it is recorded so a repeat incident
 *            can raise it again.
 *   Level 2+ a banner, not a wall. A benched player keeps the leaderboard, the
 *            schedule and every other page — someone who can still watch has a
 *            reason to come back when the clock runs out. A wall does not.
 *
 * Soft bans expire on their own: `describeBan` compares `banUntil` to the clock
 * on every read, so nothing has to run to lift one.
 */
export function BanNotice() {
  const state = createAsync(() => getMyBanState());
  const [dismissed, setDismissed] = createSignal(false);

  const warning = () => state()?.level === 1 && state()!.needsAck && !dismissed();
  const benched = () => (state()?.level ?? 0) >= 2;

  const acknowledge = () => {
    setDismissed(true);
    void ackWarningAction();
  };

  return (
    <>
      <Show when={benched()}>
        <div
          class="relative overflow-hidden"
          style={{
            background: state()!.level === 4 ? "var(--pop-red)" : "var(--pop-yellow)",
            "border-bottom": "var(--ink-w-bold) solid var(--ink)",
          }}
        >
          <div class="container flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span class="sticker" style={{ "--pop": "var(--paper-2)" }}>
              {state()!.level === 4 ? "OUT" : "BENCHED"}
            </span>
            <p class="font-extrabold">{state()!.message}</p>
          </div>
        </div>
      </Show>

      <Show when={warning()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: "rgb(34 32 43 / 0.72)" }}
          role="dialog"
          aria-modal="true"
        >
          <div class="card pop-yellow w-full max-w-md space-y-4 text-center">
            <ShoutBurst text="ENTHUVA!" color={SHOUT_COLOR.confused} seed="ban-warning" />
            <p class="font-extrabold">{state()!.message}</p>
            <p class="comment">nothing's been taken away. yet.</p>
            <button type="button" class="btn-brand w-full" onClick={acknowledge}>
              Understood
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
