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
  let mobileContainerRef: HTMLDivElement | undefined = undefined;
  let desktopContainerRef: HTMLDivElement | undefined = undefined;

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  onMount(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMobile = mobileContainerRef?.contains(target);
      const insideDesktop = desktopContainerRef?.contains(target);
      if (!insideMobile && !insideDesktop) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  return (
    <header
      class="sticky top-0 z-30"
      style={{
        background: "var(--paper)",
        "border-bottom": "var(--ink-w-bold) solid var(--ink)",
      }}
    >
      <div class="container py-2 sm:py-2.5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          {/* Top Row on Mobile: Brand on Left, User Profile on Right */}
          <div class="flex items-center justify-between w-full sm:w-auto">
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

            {/* Mobile-only User Profile Container */}
            <div ref={(el) => (mobileContainerRef = el)} class="sm:hidden relative shrink-0">
              <Show
                when={me()}
                fallback={
                  <a
                    href="/auth/signin"
                    class="btn-brand py-1 px-3 text-xs rounded-full font-extrabold cursor-pointer inline-flex items-center gap-1"
                  >
                    <User size={12} strokeWidth={2.5} />
                    <span>Sign In</span>
                  </a>
                }
              >
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  class="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-extrabold transition-all cursor-pointer bg-[var(--paper-2)] hover:bg-[var(--pop-yellow)]"
                  style={{ border: "2px solid var(--ink)" }}
                  aria-expanded={dropdownOpen()}
                  aria-label="User profile menu"
                >
                  <div class="w-5 h-5 rounded-full bg-[var(--pop-teal)] border border-[var(--ink)] grid place-items-center text-[10px] font-black uppercase">
                    {me()!.name.charAt(0)}
                  </div>
                  <ChevronDown size={12} strokeWidth={2.5} class="opacity-70" />
                </button>

                {/* Mobile Dropdown Popover */}
                <Show when={dropdownOpen()}>
                  <div
                    class="absolute right-0 top-full mt-2 w-64 rounded-lg p-3.5 bg-[var(--paper-2)] shadow-2xl z-50 space-y-3"
                    style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
                  >
                    <div class="space-y-1 pb-2.5 border-b border-[var(--ink-soft)]/20">
                      <div class="flex items-center gap-2.5">
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
                      <Show when={me()!.role === "admin"}>
                        <span
                          class="badge text-[10px] uppercase font-black"
                          style={{ "--pop": "var(--pop-yellow)" }}
                        >
                          Admin
                        </span>
                      </Show>
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

          {/* Nav Links + Desktop User Profile */}
          <div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
            <nav class="flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <For each={LINKS}>
                {(link) => (
                  <a
                    href={link.href}
                    class="flex-1 sm:flex-initial text-center inline-flex items-center justify-center gap-1 rounded-full px-3 py-1 text-xs sm:px-3.5 sm:py-1.5 sm:text-sm transition-transform active:translate-y-0.5"
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

            {/* Desktop User Profile Container */}
            <div ref={(el) => (desktopContainerRef = el)} class="hidden sm:block relative shrink-0">
              <Show
                when={me()}
                fallback={
                  <a
                    href="/auth/signin"
                    class="btn-brand py-1.5 px-3.5 text-sm rounded-full font-extrabold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <User size={14} strokeWidth={2.5} />
                    <span>Sign In</span>
                  </a>
                }
              >
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold transition-all cursor-pointer bg-[var(--paper-2)] hover:bg-[var(--pop-yellow)]"
                  style={{ border: "2px solid var(--ink)" }}
                  aria-expanded={dropdownOpen()}
                  aria-label="User profile menu"
                >
                  <div class="w-5 h-5 rounded-full bg-[var(--pop-teal)] border border-[var(--ink)] grid place-items-center text-[10px] font-black uppercase">
                    {me()!.name.charAt(0)}
                  </div>
                  <span class="max-w-[7rem] truncate text-left">{me()!.name}</span>
                  <ChevronDown size={13} strokeWidth={2.5} class="opacity-70" />
                </button>

                {/* Desktop Dropdown Popover */}
                <Show when={dropdownOpen()}>
                  <div
                    class="absolute right-0 top-full mt-2 w-72 rounded-lg p-3.5 bg-[var(--paper-2)] shadow-2xl z-50 space-y-3"
                    style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
                  >
                    <div class="space-y-1 pb-2.5 border-b border-[var(--ink-soft)]/20">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-[var(--pop-yellow)] border-2 border-[var(--ink)] grid place-items-center font-black text-sm uppercase">
                          {me()!.name.charAt(0)}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <p class="font-extrabold text-sm truncate">{me()!.name}</p>
                            <Show when={me()!.role === "admin"}>
                              <span
                                class="badge text-[9px] py-0 px-1.5 uppercase font-black"
                                style={{ "--pop": "var(--pop-yellow)" }}
                              >
                                Admin
                              </span>
                            </Show>
                          </div>
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
      </div>
    </header>
  );
}
