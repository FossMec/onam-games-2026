import { useLocation } from "@solidjs/router";
import { For, Show } from "solid-js";
import { SpriteIcon } from "./art/SpriteIcon";

/**
 * Three items, short labels. A phone header has room for the wordmark and about
 * this much; anything more wraps and the sticky bar eats the screen.
 */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/code-a-pookalam", label: "Submit Pookalam" },
];

/**
 * Sticky comic header. The wordmark uses the layered Bungee/Bungee-Shade
 * chrome; nav items are inked pills that fill with colour when active, so the
 * current page reads at a glance on a phone without a separate indicator.
 *
 * Responsive 2-line layout on mobile so long labels never crowd or clip.
 */
export function Nav() {
  const location = useLocation();
  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  return (
    <header
      class="sticky top-0 z-20"
      style={{
        background: "var(--paper)",
        "border-bottom": "var(--ink-w-bold) solid var(--ink)",
      }}
    >
      <div class="container flex flex-col sm:flex-row items-center sm:justify-between gap-2 py-2 sm:py-2.5">
        <a href="/" class="flex items-center gap-2 group shrink-0">
          <SpriteIcon
            name="foss-mec-badge"
            size={28}
            animate="wobble"
            interactive
            class="sm:h-8 sm:w-8 transition-transform group-hover:rotate-12"
          />
          <div class="flex items-baseline gap-1.5">
            <span class="wordmark text-lg sm:text-2xl" data-text="FOSS ONAM">
              FOSS ONAM
            </span>
            <span
              class="text-[11px] sm:text-xs font-extrabold tracking-tight uppercase"
              style={{
                "font-family": "var(--font-stack-display)",
                color: "var(--ink)",
                opacity: "0.85",
              }}
            >
              by fossmec
            </span>
          </div>
        </a>

        <nav class="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0">
          <For each={LINKS}>
            {(link) => (
              <a
                href={link.href}
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs sm:px-3.5 sm:py-1.5 sm:text-sm transition-transform active:translate-y-0.5"
                style={{
                  "font-family": "var(--font-stack-display)",
                  "font-weight": 800,
                  border: "2px solid var(--ink)",
                  background: isActive(link.href) ? "var(--pop-teal)" : "var(--paper-2)",
                }}
              >
                <span>{link.label}</span>
                <Show when={link.href === "/code-a-pookalam"}>
                  <svg
                    class="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 17L17 7" />
                    <path d="M7 7h10v10" />
                  </svg>
                </Show>
              </a>
            )}
          </For>
        </nav>
      </div>
    </header>
  );
}
