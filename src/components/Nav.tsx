import { useLocation } from "@solidjs/router";
import { For } from "solid-js";

/**
 * Three items, short labels. A phone header has room for the wordmark and about
 * this much; anything more wraps and the sticky bar eats the screen.
 */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Board" },
  { href: "/code-a-pookalam", label: "Pookalam" },
];

/**
 * Sticky comic header. The wordmark uses the layered Bungee/Bungee-Shade
 * chrome; nav items are inked pills that fill with colour when active, so the
 * current page reads at a glance on a phone without a separate indicator.
 *
 * Admin is deliberately not linked — it used to sit in the public nav for
 * everyone. The page still gates itself, but advertising it was pointless.
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
      <div class="container flex items-center justify-between gap-3 py-2.5">
        <a href="/" class="wordmark text-xl sm:text-2xl" data-text="FOSS ONAM">
          FOSS ONAM
        </a>

        <nav class="flex items-center gap-2">
          <For each={LINKS}>
            {(link) => (
              <a
                href={link.href}
                class="rounded-full px-3 py-1.5 text-sm transition-transform active:translate-y-0.5"
                style={{
                  "font-family": "var(--font-stack-display)",
                  "font-weight": 800,
                  border: "2px solid var(--ink)",
                  background: isActive(link.href) ? "var(--pop-teal)" : "var(--paper-2)",
                }}
              >
                {link.label}
              </a>
            )}
          </For>
        </nav>
      </div>
    </header>
  );
}
