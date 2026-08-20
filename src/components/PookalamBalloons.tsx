import { useLocation } from "@solidjs/router";
import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
  POOKALAM_CREDITS_EVENT,
  addPookalamCredits,
  canCollectPookalamBalloon,
  pookalamDailyLimit,
} from "~/lib/pookalam-credits";
import { getMultiStoreSync, setMultiStoreSync } from "~/lib/multi-store";

const COLORS = ["var(--pop-yellow)", "var(--pop-teal)", "var(--pop-pink)", "var(--pop-purple)"];
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const SPAWN_COUNT_KEY = "onam-games:pookalam-balloon-spawns";

export function PookalamBalloons() {
  const location = useLocation();
  const [balloon, setBalloon] = createSignal<{
    left: number;
    color: string;
    isTreasure?: boolean;
  } | null>(null);
  const [popped, setPopped] = createSignal(false);
  const [pageHeight, setPageHeight] = createSignal(0);
  /** Set to true when the admin has disabled balloons site-wide. */
  const [disabled, setDisabled] = createSignal(false);
  const [huntBalloonActive, setHuntBalloonActive] = createSignal(false);
  const [treasureTokenModal, setTreasureTokenModal] = createSignal(false);

  let spawnTimer: ReturnType<typeof setTimeout> | undefined;
  let removeTimer: ReturnType<typeof setTimeout> | undefined;
  let treasureTimer: ReturnType<typeof setTimeout> | undefined;
  let balloonLayer: HTMLDivElement | undefined;
  let measurePage: (() => void) | undefined;
  // Fixed travel speed keeps short and long pages visually consistent.
  const riseDuration = () => Math.max(30_000, ((pageHeight() + 160) / 55) * 1_000);

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const spawnedToday = () => {
    try {
      const stored = JSON.parse(getMultiStoreSync(SPAWN_COUNT_KEY) ?? "null");
      return stored?.day === todayKey() && typeof stored.count === "number" ? stored.count : 0;
    } catch {
      return 0;
    }
  };

  const recordSpawn = () => {
    try {
      setMultiStoreSync(
        SPAWN_COUNT_KEY,
        JSON.stringify({ day: todayKey(), count: spawnedToday() + 1 }),
      );
    } catch {
      /* storage disabled; the in-memory cap still applies to this mount */
    }
  };

  const scheduleTreasure = () => {
    if (!huntBalloonActive()) return;
    if (treasureTimer) clearTimeout(treasureTimer);
    const delay = randomBetween(30_000, 60_000);
    treasureTimer = setTimeout(() => {
      treasureTimer = undefined;
      if (!huntBalloonActive()) return;
      setPopped(false);
      setBalloon({
        left: randomBetween(15, 80),
        color: "var(--pop-yellow)",
        isTreasure: true,
      });
      removeTimer = setTimeout(() => {
        setBalloon(null);
        scheduleTreasure();
      }, riseDuration());
    }, delay);
  };

  const schedule = () => {
    if (huntBalloonActive()) {
      scheduleTreasure();
      return;
    }
    if (disabled()) return;
    if (
      (pookalamDailyLimit() > 0 && spawnedToday() >= Math.ceil(pookalamDailyLimit() / 5)) ||
      !canCollectPookalamBalloon()
    )
      return;
    spawnTimer = setTimeout(
      () => {
        spawnTimer = undefined;
        if (disabled()) return;
        if (
          (pookalamDailyLimit() > 0 && spawnedToday() >= Math.ceil(pookalamDailyLimit() / 5)) ||
          !canCollectPookalamBalloon()
        )
          return;
        recordSpawn();
        setPopped(false);
        setBalloon({
          left: randomBetween(8, 88),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
        removeTimer = setTimeout(() => {
          setBalloon(null);
          schedule();
        }, riseDuration());
      },
      import.meta.env.DEV ? randomBetween(1_200, 2_600) : randomBetween(12_000, 26_000),
    );
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
    }, 2500);
  };

  const checkHuntQuestionState = () => {
    fetch("/api/hunt/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.currentQuestion?.slug === "rising-treasure-balloon") {
          setHuntBalloonActive(true);
          scheduleTreasure();
        } else {
          setHuntBalloonActive(false);
        }
      })
      .catch(() => {
        /* ignore */
      });
  };

  createEffect(() => {
    if (location.pathname === "/games" || location.pathname.startsWith("/games/")) {
      stop();
    } else if (!disabled() && !balloon() && !spawnTimer && !treasureTimer) {
      schedule();
    }
    checkHuntQuestionState();
  });

  createEffect(() => {
    if (location.pathname) {
      requestAnimationFrame(() => {
        measurePage?.();
        requestAnimationFrame(() => measurePage?.());
      });
    }
  });

  onMount(() => {
    fetch("/api/pookalam/state")
      .then((r) => r.json())
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

    const measure = () => {
      if (!balloonLayer) return;
      const previousHeight = balloonLayer.style.height;
      balloonLayer.style.height = "0px";
      const contentHeight = Math.max(
        window.innerHeight,
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      balloonLayer.style.height = previousHeight;
      setPageHeight(contentHeight);
    };
    measurePage = measure;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);

    const handleCreditsChanged = () => {
      if (location.pathname === "/games" || location.pathname.startsWith("/games/")) return;
      if (!disabled() && !balloon() && !spawnTimer && !treasureTimer) schedule();
    };
    window.addEventListener(POOKALAM_CREDITS_EVENT, handleCreditsChanged);
    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener(POOKALAM_CREDITS_EVENT, handleCreditsChanged);
      measurePage = undefined;
    });
  });

  onCleanup(() => {
    if (spawnTimer) clearTimeout(spawnTimer);
    if (removeTimer) clearTimeout(removeTimer);
    if (treasureTimer) clearTimeout(treasureTimer);
  });

  return (
    <>
      <div
        ref={(element) => (balloonLayer = element)}
        class="pookalam-balloon-layer"
        style={{ height: `${pageHeight()}px` }}
        aria-live="polite"
      >
        {(() => {
          const current = balloon();
          return current ? (
            <button
              type="button"
              class={`pookalam-balloon ${popped() ? "is-popped" : ""}`}
              style={{
                left: `${current.left}%`,
                "--balloon-color": current.color,
                "--balloon-duration": `${riseDuration()}ms`,
                "--balloon-distance": `${pageHeight()}px`,
              }}
              onClick={pop}
              aria-label={
                current.isTreasure
                  ? "Pop special royal treasure balloon!"
                  : "Pop balloon for five pookalam credits"
              }
            >
              <Show
                when={popped()}
                fallback={
                  <>
                    <span class="pookalam-balloon-body" aria-hidden="true"></span>
                    <span class="pookalam-balloon-string" aria-hidden="true" />
                  </>
                }
              >
                <span class="pookalam-balloon-reward">
                  {current.isTreasure
                    ? "Secret Payload Captured!"
                    : "+5 Community Pookalam Credits"}
                </span>
              </Show>
            </button>
          ) : null;
        })()}
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
                AIR_DELIVERY_MAVELI
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
