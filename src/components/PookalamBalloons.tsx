import { useLocation } from "@solidjs/router";
import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
  POOKALAM_CREDITS_EVENT,
  addPookalamCredits,
  canCollectPookalamBalloon,
  pookalamDailyLimit,
} from "~/lib/pookalam-credits";

const COLORS = ["var(--pop-yellow)", "var(--pop-teal)", "var(--pop-pink)", "var(--pop-purple)"];
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const SPAWN_COUNT_KEY = "onam-games:pookalam-balloon-spawns";

export function PookalamBalloons() {
  const location = useLocation();
  const [balloon, setBalloon] = createSignal<{ left: number; color: string } | null>(null);
  const [popped, setPopped] = createSignal(false);
  const [pageHeight, setPageHeight] = createSignal(0);
  /** Set to true when the admin has disabled balloons site-wide. */
  const [disabled, setDisabled] = createSignal(false);
  let spawnTimer: ReturnType<typeof setTimeout> | undefined;
  let removeTimer: ReturnType<typeof setTimeout> | undefined;
  let balloonLayer: HTMLDivElement | undefined;
  let measurePage: (() => void) | undefined;
  // Fixed travel speed keeps short and long pages visually consistent.
  const riseDuration = () => Math.max(30_000, ((pageHeight() + 160) / 55) * 1_000);

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const spawnedToday = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(SPAWN_COUNT_KEY) ?? "null");
      return stored?.day === todayKey() && typeof stored.count === "number" ? stored.count : 0;
    } catch {
      return 0;
    }
  };

  const recordSpawn = () => {
    try {
      localStorage.setItem(
        SPAWN_COUNT_KEY,
        JSON.stringify({ day: todayKey(), count: spawnedToday() + 1 }),
      );
    } catch {
      /* storage disabled; the in-memory cap still applies to this mount */
    }
  };

  const schedule = () => {
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
    spawnTimer = undefined;
    removeTimer = undefined;
    setBalloon(null);
  };

  const pop = () => {
    if (!balloon() || popped()) return;
    setPopped(true);
    addPookalamCredits(5);
    if (removeTimer) clearTimeout(removeTimer);
    removeTimer = setTimeout(() => {
      setBalloon(null);
      schedule();
    }, 2500);
  };

  createEffect(() => {
    if (location.pathname.startsWith("/games/")) {
      stop();
    } else if (!disabled() && !balloon() && !spawnTimer) {
      schedule();
    }
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
    // Read the admin disable flag once at startup. A failure here is not fatal
    // — balloons just keep running, which is the safe default.
    fetch("/api/pookalam/state")
      .then((r) => r.json())
      .then((state) => {
        if (state?.disableBalloons) {
          setDisabled(true);
          stop();
        }
      })
      .catch(() => {
        /* ignore — balloons run by default */
      });

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
    // Credits changed (spend, refund, pop, or time refill): re-evaluate the
    // rain. A bucket that was full on load never armed a timer, so spending
    // down below the cap must kick the scheduler back to life.
    const handleCreditsChanged = () => {
      if (location.pathname.startsWith("/games/")) return;
      if (!disabled() && !balloon() && !spawnTimer) schedule();
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
  });

  return (
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
            aria-label="Pop balloon for five pookalam credits"
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
              <span class="pookalam-balloon-reward">+5 Community Pookalam Credits</span>
            </Show>
          </button>
        ) : null;
      })()}
    </div>
  );
}
