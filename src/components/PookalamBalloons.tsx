import { useLocation } from "@solidjs/router";
import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
  POOKALAM_CREDITS_EVENT,
  addPookalamCredits,
  getPookalamCreditState,
  type PookalamCreditState,
} from "~/lib/pookalam-credits";

const COLORS = ["var(--pop-yellow)", "var(--pop-teal)", "var(--pop-pink)", "var(--pop-purple)"];
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

export function PookalamBalloons() {
  const location = useLocation();
  let layerRef: HTMLDivElement | undefined;

  const [balloon, setBalloon] = createSignal<{
    left: number;
    color: string;
    isTreasure?: boolean;
    durationMs: number;
  } | null>(null);
  const [popped, setPopped] = createSignal(false);
  const [disabled, setDisabled] = createSignal(false);
  const [huntBalloonActive, setHuntBalloonActive] = createSignal(false);
  const [treasureTokenModal, setTreasureTokenModal] = createSignal(false);
  const [creditState, setCreditState] = createSignal<PookalamCreditState>(getPookalamCreditState());

  let spawnTimer: ReturnType<typeof setTimeout> | undefined;
  let removeTimer: ReturnType<typeof setTimeout> | undefined;
  let treasureTimer: ReturnType<typeof setTimeout> | undefined;

  const getCurrentContainerHeight = () => {
    return (
      layerRef?.parentElement?.scrollHeight ??
      layerRef?.offsetHeight ??
      (typeof window !== "undefined" ? window.innerHeight : 800)
    );
  };

  const calculateDuration = (h: number) => {
    return Math.max(25_000, Math.round(((h + 160) / 55) * 1_000));
  };

  const refreshCreditState = () => {
    setCreditState(getPookalamCreditState());
  };

  const scheduleTreasure = () => {
    if (!huntBalloonActive()) return;
    if (treasureTimer) clearTimeout(treasureTimer);
    if (spawnTimer) {
      clearTimeout(spawnTimer);
      spawnTimer = undefined;
    }
    const delay = randomBetween(1_500, 4_000);
    treasureTimer = setTimeout(() => {
      treasureTimer = undefined;
      if (!huntBalloonActive()) return;

      const curH = getCurrentContainerHeight();
      const dur = calculateDuration(curH);

      setPopped(false);
      setBalloon({
        left: randomBetween(15, 80),
        color: "var(--pop-yellow)",
        isTreasure: true,
        durationMs: dur,
      });

      removeTimer = setTimeout(() => {
        setBalloon(null);
        scheduleTreasure();
      }, dur);
    }, delay);
  };

  const schedule = () => {
    if (huntBalloonActive()) {
      scheduleTreasure();
      return;
    }
    if (disabled()) return;

    refreshCreditState();
    if (!creditState().canCollectBalloon) return;

    if (spawnTimer) clearTimeout(spawnTimer);
    const delay = import.meta.env.DEV ? randomBetween(1_500, 3_000) : randomBetween(12_000, 24_000);

    spawnTimer = setTimeout(() => {
      spawnTimer = undefined;
      if (disabled()) return;

      refreshCreditState();
      if (!creditState().canCollectBalloon) return;

      const curH = getCurrentContainerHeight();
      const dur = calculateDuration(curH);

      setPopped(false);
      setBalloon({
        left: randomBetween(8, 88),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        durationMs: dur,
      });

      removeTimer = setTimeout(() => {
        setBalloon(null);
        schedule();
      }, dur);
    }, delay);
  };

  const stop = () => {
    if (spawnTimer) clearTimeout(spawnTimer);
    if (removeTimer) clearTimeout(removeTimer);
    if (treasureTimer) clearTimeout(treasureTimer);
    spawnTimer = undefined;
    removeTimer = undefined;
    treasureTimer = undefined;
    setBalloon(null);
  };

  const pop = () => {
    const current = balloon();
    if (!current || popped()) return;
    setPopped(true);
    addPookalamCredits(5);
    refreshCreditState();

    if (current.isTreasure) {
      setTreasureTokenModal(true);
    }
    if (removeTimer) clearTimeout(removeTimer);
    removeTimer = setTimeout(() => {
      setBalloon(null);
      if (huntBalloonActive()) {
        scheduleTreasure();
      } else {
        schedule();
      }
    }, 2000);
  };

  const checkHuntQuestionState = () => {
    fetch("/api/hunt/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.isGameActive) {
          setHuntBalloonActive(false);
          return;
        }
        const hasBalloon =
          data?.currentQuestion?.isBalloon ||
          (data?.isTesterMode &&
            data?.allQuestions?.some(
              (q: { id: string; isBalloon?: boolean }) =>
                q.isBalloon && !data?.solvedQuestionIds?.includes(q.id),
            ));
        if (hasBalloon) {
          setHuntBalloonActive(true);
          if (!balloon()?.isTreasure) {
            scheduleTreasure();
          }
        } else {
          setHuntBalloonActive(false);
        }
      })
      .catch(() => {
        /* ignore */
      });
  };

  createEffect(() => {
    const path = location.pathname;
    const isGameRoute = path === "/games" || path.startsWith("/games/");
    const canCollect = creditState().canCollectBalloon;

    if (isGameRoute || disabled()) {
      stop();
      return;
    }

    checkHuntQuestionState();

    if (huntBalloonActive()) {
      if (!balloon() && !treasureTimer) scheduleTreasure();
      return;
    }

    if (canCollect) {
      if (!balloon() && !spawnTimer) {
        schedule();
      }
    } else {
      if (spawnTimer) {
        clearTimeout(spawnTimer);
        spawnTimer = undefined;
      }
    }
  });

  onMount(() => {
    fetch("/api/pookalam/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((state) => {
        if (state?.disableBalloons) {
          setDisabled(true);
          stop();
        }
      })
      .catch(() => {
        /* ignore */
      });

    checkHuntQuestionState();
    refreshCreditState();

    const handleCreditsChanged = () => {
      refreshCreditState();
    };

    window.addEventListener(POOKALAM_CREDITS_EVENT, handleCreditsChanged);
    window.addEventListener("storage", handleCreditsChanged);

    onCleanup(() => {
      window.removeEventListener(POOKALAM_CREDITS_EVENT, handleCreditsChanged);
      window.removeEventListener("storage", handleCreditsChanged);
    });
  });

  onCleanup(() => {
    stop();
  });

  return (
    <>
      <div
        ref={(el) => {
          layerRef = el;
        }}
        class="pookalam-balloon-layer"
        aria-live="polite"
      >
        <Show when={balloon()}>
          {(current) => (
            <button
              type="button"
              class={`pookalam-balloon ${popped() ? "is-popped" : ""}`}
              style={{
                left: `${current().left}%`,
                "--balloon-color": current().color,
                "--balloon-duration": `${current().durationMs}ms`,
              }}
              onClick={pop}
              aria-label={
                current().isTreasure
                  ? "Pop special royal treasure balloon!"
                  : "Pop balloon for five pookalam credits"
              }
            >
              <Show
                when={popped()}
                fallback={
                  <>
                    <span class="pookalam-balloon-body" aria-hidden="true" />
                    <span class="pookalam-balloon-string" aria-hidden="true" />
                  </>
                }
              >
                <span class="pookalam-balloon-reward">
                  {current().isTreasure
                    ? "Secret Payload Captured!"
                    : "+5 Community Pookalam Credits"}
                </span>
              </Show>
            </button>
          )}
        </Show>
      </div>

      {/* Secret Treasure Balloon Token Modal */}
      <Show when={treasureTokenModal()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: "rgba(34, 32, 43, 0.85)" }}
        >
          <div class="card pop-yellow max-w-sm w-full p-5 text-center space-y-3 anim-sheet-in">
            <h3 class="text-xl font-black m-0">Royal Air Delivery!</h3>
            <p class="text-xs font-semibold text-[var(--ink-soft)]">
              You intercepted Maveli's carrier balloon in the sky!
            </p>
            <div class="p-3 bg-[var(--paper-2)] rounded border-2 border-[var(--ink)] space-y-1">
              <span class="text-[10px] uppercase font-bold text-[var(--ink-soft)] block">
                Treasure Token
              </span>
              <code class="text-base font-mono font-black text-[var(--pop-pink)] select-all block">
                4X2YAO
              </code>
            </div>
            <button
              type="button"
              onClick={() => setTreasureTokenModal(false)}
              class="btn-brand w-full py-2 text-sm font-black cursor-pointer"
            >
              Got It!
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
