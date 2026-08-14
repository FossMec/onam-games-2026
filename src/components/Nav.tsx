import { createAsync, useLocation } from "@solidjs/router";
import { ChevronDown, GraduationCap, LogOut, Mail, User } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { signOutAndReload } from "~/lib/sign-out";
import { getMe } from "~/server/auth/actions";
import { SpriteIcon } from "./art/SpriteIcon";

/**
 * Short labels for navigation. Responsive layout on phone so long labels never crowd.
 */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/code-a-pookalam", label: "Pookalam" },
];

export function Nav() {
  const location = useLocation();
  const me = createAsync(() => getMe());
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined = undefined;

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  return (
    <header
      class="sticky top-0 z-30"
      style={{
        background: "var(--paper)",
        "border-bottom": "var(--ink-w-bold) solid var(--ink)",
      }}
    >
      <div class="container flex flex-wrap items-center justify-between gap-2 py-2 sm:py-2.5">
        {/* Brand */}
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
              class="text-[11px] sm:text-xs font-extrabold tracking-tight uppercase hidden xs:inline"
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

        {/* Center / Right Section: Links & User Dropdown */}
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <nav class="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <For each={LINKS}>
              {(link) => (
                <a
                  href={link.href}
                  class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm transition-transform active:translate-y-0.5"
                  style={{
                    "font-family": "var(--font-stack-display)",
                    "font-weight": 800,
                    border: "2px solid var(--ink)",
                    background: isActive(link.href) ? "var(--pop-teal)" : "var(--paper-2)",
                  }}
                >
                  <span>{link.label}</span>
                </a>
              )}
            </For>
          </nav>

          {/* User Profile Dropdown or Sign In */}
          <div class="relative shrink-0" ref={(el) => (dropdownRef = el)}>
            <Show
              when={me()}
              fallback={
                <a
                  href="/auth/signin"
                  class="btn-brand py-1 px-3 text-xs sm:text-sm rounded-full font-extrabold cursor-pointer inline-flex items-center gap-1"
                >
                  <User size={13} strokeWidth={2.5} />
                  <span>Sign In</span>
                </a>
              }
            >
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm font-extrabold transition-all cursor-pointer bg-[var(--paper-2)] hover:bg-[var(--pop-yellow)]"
                style={{
                  border: "2px solid var(--ink)",
                }}
                aria-expanded={dropdownOpen()}
                aria-label="User profile menu"
              >
                <div class="w-5 h-5 rounded-full bg-[var(--pop-teal)] border border-[var(--ink)] grid place-items-center text-[10px] font-black uppercase">
                  {me()!.name.charAt(0)}
                </div>
                <span class="max-w-[5rem] sm:max-w-[7rem] truncate text-left hidden xs:inline">
                  {me()!.name}
                </span>
                <ChevronDown size={13} strokeWidth={2.5} class="opacity-70" />
              </button>

              {/* Dropdown Menu */}
              <Show when={dropdownOpen()}>
                <div
                  class="absolute right-0 mt-2 w-64 sm:w-72 rounded-lg p-3 bg-[var(--paper-2)] shadow-xl z-50 space-y-3"
                  style={{
                    border: "var(--ink-w-bold) solid var(--ink)",
                  }}
                >
                  {/* User Info Header */}
                  <div class="space-y-1 pb-2 border-b border-[var(--ink-soft)]/20">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-full bg-[var(--pop-yellow)] border-2 border-[var(--ink)] grid place-items-center font-black text-sm uppercase">
                        {me()!.name.charAt(0)}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="font-extrabold text-sm truncate">{me()!.name}</p>
                        <p
                          class="text-xs truncate flex items-center gap-1 font-mono"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          <Mail size={11} class="shrink-0" />
                          <span class="truncate">{me()!.email}</span>
                        </p>
                      </div>
                    </div>

                    <Show when={me()!.college}>
                      <div
                        class="flex items-center gap-1 text-xs pt-1"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        <GraduationCap size={12} class="shrink-0" />
                        <span class="truncate">
                          {me()!.college} {me()!.branch ? `· ${me()!.branch}` : ""}
                        </span>
                      </div>
                    </Show>
                  </div>

                  {/* Actions */}
                  <div class="space-y-1">
                    <button
                      type="button"
                      onClick={() => void signOutAndReload()}
                      class="w-full text-left font-extrabold text-xs py-2 px-2.5 rounded-md text-[var(--pop-red)] hover:bg-[var(--pop-red)] hover:text-[var(--ink)] transition-colors inline-flex items-center gap-2 cursor-pointer border border-transparent hover:border-[var(--ink)]"
                    >
                      <LogOut size={14} strokeWidth={2.5} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </header>
  );
}
