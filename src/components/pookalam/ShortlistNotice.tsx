import { createAsync } from "@solidjs/router";
import { PartyPopper, X } from "lucide-solid";
import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { ShoutBurst } from "~/components/art/Burst";
import { SHOUT_COLOR, shout } from "~/lib/shouts";
import type { getMyPookalamNotice } from "~/server/pookalam/actions";
import { pookalamNotice } from "~/lib/queries";
import { getMultiStoreSync, setMultiStoreSync } from "~/lib/multi-store";

/**
 * The once-per-browser "your pookalam made the shortlist" announcement.
 *
 * A shortlisted entrant is told in the admin queue and on their submit page,
 * but neither is somewhere a player just opens the app and happens to look.
 * This meets them on first load instead.
 *
 * Shown once per browser so it stops nagging after the first dismissal; a new
 * device gets the reveal again, which is the right trade - it costs a tap and
 * the alternative is an entrant who never realises they're in the running.
 * The permanent home for the news is the "your entry" card on the
 * Code-a-Pookalam page, so missing the popup is not missing the message.
 *
 * The admin's note to the entrant rides along on the same query the shortlist
 * flag comes from, so there is no extra round trip to show it here.
 */

type Notice = NonNullable<Awaited<ReturnType<typeof getMyPookalamNotice>>>;

const SEEN_KEY = "pookalam:shortlist-notice-seen";

function hasSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return getMultiStoreSync(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    setMultiStoreSync(SEEN_KEY, "1");
  } catch {
    // Private-mode storage is a nice-to-have; the popup just reappears.
  }
}

export function ShortlistNotice() {
  /*
   * The fetch is gated on the dismissal check, not just the render.
   *
   * This component is mounted on every route, so asking first and checking
   * `hasSeen()` afterwards meant a `pookalam_submissions` select on every page
   * load - including `/leaderboard` and `/admin` - for every entrant who
   * dismissed the popup days ago. The answer was thrown away every time.
   *
   * `hasSeen` reads localStorage, which does not exist during SSR, so the ask
   * is deferred to mount. Nothing is lost: the popup is client-only anyway,
   * and it costs one request from the few browsers that might actually show
   * it instead of one from every browser on every page.
   */
  const [wanted, setWanted] = createSignal(false);
  const data = createAsync(() => (wanted() ? pookalamNotice() : Promise.resolve(null)));
  const [dismissed, setDismissed] = createSignal(false);

  const notice = (): Notice | null => data() ?? null;

  const show = () => notice()?.shortlisted && notice()!.status === "approved" && !dismissed();

  onMount(() => {
    if (!hasSeen()) setWanted(true);
  });

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // Freeze the page behind the dialog, but only while it is actually on
  // screen - the component stays mounted across the whole app, so locking the
  // scroll here unconditionally would freeze every page for everyone.
  createEffect(() => {
    if (!show()) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.body.style.overflow = previous;
    });
  });

  const close = () => {
    setDismissed(true);
    markSeen();
  };

  return (
    <Show when={show()}>
      <div
        class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
        style={{ background: "rgb(34 32 43 / 0.78)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Your pookalam was shortlisted"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) close();
        }}
      >
        <div class="card pop-yellow my-auto w-full max-w-md space-y-4 text-center border-2 border-[var(--ink)] shadow-2xl p-6">
          <button
            type="button"
            class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[var(--paper-2)] border-2 border-[var(--ink)] cursor-pointer"
            onClick={close}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") close();
            }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={3} />
          </button>

          <ShoutBurst
            text={shout("triumph", "pookalam-shortlist")}
            color={SHOUT_COLOR.triumph}
            seed="pookalam-shortlist"
          />

          <div class="flex items-center justify-center gap-2">
            <PartyPopper size={18} />
            <p class="text-lg font-black m-0">You're in the running!</p>
          </div>

          <img
            src={notice()!.imageUrl}
            alt={notice()!.title}
            class="mx-auto w-full max-w-[12rem]"
            style={{
              "aspect-ratio": "1 / 1",
              "object-fit": "contain",
              background: "var(--paper-2)",
              border: "var(--ink-w-bold) solid var(--ink)",
              "border-radius": "var(--radius)",
            }}
          />
          <p class="font-extrabold m-0">“{notice()!.title}”</p>

          <p class="comment text-sm">
            your pookalam was shortlisted for the Day 7 community vote. good luck!
          </p>

          <Show when={notice()!.reviewNote}>
            <p class="text-sm font-semibold text-left bg-[var(--paper-2)] p-3 rounded-md border border-[var(--ink)]">
              <span class="font-black">From the judges: </span>
              {notice()!.reviewNote}
            </p>
          </Show>

          <a
            href="/code-a-pookalam"
            class="btn-brand w-full py-2.5 font-black text-sm"
            onClick={close}
          >
            See your entry
          </a>
        </div>
      </div>
    </Show>
  );
}
