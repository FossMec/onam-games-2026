import { A, createAsync, useLocation } from "@solidjs/router";
import { ChevronDown, GraduationCap, LogOut, Mail, Send, User } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { signOutAndReload } from "~/lib/sign-out";
import { getMe } from "~/server/auth/actions";
import { SpriteIcon } from "./art/SpriteIcon";

/**
 * Short labels for navigation. Responsive layout on phone so long labels never crowd.
 */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/code-a-pookalam", label: "Pookalam" },
];

function ProfileMenu(props: {
  me: NonNullable<Awaited<ReturnType<typeof getMe>>>;
  compact?: boolean;
}) {
  const [open, setOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined = undefined;

  onMount(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    });
  });

  return (
    <div ref={(el) => (containerRef = el)} class="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        class={`inline-flex items-center gap-1.5 rounded-full font-extrabold transition-all cursor-pointer bg-[var(--paper-2)] hover:bg-[var(--pop-yellow)] ${
          props.compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        }`}
        style={{ border: "2px solid var(--ink)" }}
        aria-expanded={open()}
        aria-label="User profile menu"
      >
        <Show
          when={props.me.avatarUrl}
          fallback={
            <div class="w-5 h-5 rounded-full bg-[var(--pop-teal)] border border-[var(--ink)] grid place-items-center text-[10px] font-black uppercase shrink-0">
              {props.me.name.charAt(0)}
            </div>
          }
        >
          <img
            src={props.me.avatarUrl!}
            alt={props.me.name}
            class="w-5 h-5 rounded-full object-cover shrink-0 select-none block"
            style={{ border: "1.5px solid var(--ink)" }}
          />
        </Show>
        <Show when={!props.compact}>
          <span class="max-w-[7rem] truncate text-left">{props.me.name}</span>
        </Show>
        <ChevronDown size={props.compact ? 12 : 13} strokeWidth={2.5} class="opacity-70" />
      </button>

      <Show when={open()}>
        {/* Dropdown Card */}
        <div
          class="absolute right-0 top-full mt-2 w-64 sm:w-72 rounded-lg p-3.5 bg-[var(--paper-2)] shadow-2xl z-50 space-y-3"
          style={{ border: "var(--ink-w-bold) solid var(--ink)" }}
        >
          <div class="space-y-1 pb-2.5 border-b border-[var(--ink-soft)]/20">
            <div class="flex items-center gap-2.5">
              <Show
                when={props.me.avatarUrl}
                fallback={
                  <div class="w-8 h-8 rounded-full bg-[var(--pop-yellow)] border-2 border-[var(--ink)] grid place-items-center font-black text-sm uppercase shrink-0">
                    {props.me.name.charAt(0)}
                  </div>
                }
              >
                <img
                  src={props.me.avatarUrl!}
                  alt={props.me.name}
                  class="w-8 h-8 rounded-full object-cover shrink-0 select-none block"
                  style={{ border: "2px solid var(--ink)" }}
                />
              </Show>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <p class="font-extrabold text-sm truncate">{props.me.name}</p>
                  <Show when={props.me.role === "admin"}>
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
                  <span class="truncate">{props.me.email}</span>
                </p>
              </div>
            </div>

            {/* Streak + Best stat pills */}
            <div class="flex items-center gap-2 pt-1.5">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--pop-teal)]/20 border border-[var(--pop-teal-deep)]/30">
                Streak {props.me.streakCount}
              </span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--pop-yellow)]/30 border border-[var(--ink)]/20">
                Best {props.me.bestStreak}
              </span>
              <Show when={props.me.college}>
                <span
                  class="text-[10px] font-semibold truncate flex items-center gap-0.5 min-w-0"
                  style={{ color: "var(--ink-soft)" }}
                >
                  <GraduationCap size={10} class="shrink-0" />
                  <span class="truncate">{props.me.college}</span>
                </span>
              </Show>
            </div>
          </div>

          <div class="space-y-1 text-xs font-bold">
            <A
              href="/onboarding"
              class="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--pop-yellow)] transition-colors"
            >
              <User size={13} strokeWidth={2.5} />
              <span>Edit Profile</span>
            </A>
            <Show when={props.me.role === "admin"}>
              <A
                href="/admin"
                class="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--pop-yellow)] transition-colors text-[var(--pop-purple-deep)] font-extrabold"
              >
                <SpriteIcon name="arch-crown" size={13} />
                <span>Admin Panel</span>
              </A>
            </Show>
            <button
              type="button"
              onClick={() => void signOutAndReload()}
              class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--pop-red)] hover:text-white transition-colors text-left cursor-pointer text-[var(--pop-red-deep)]"
            >
              <LogOut size={13} strokeWidth={2.5} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

export function Nav() {
  const loc = useLocation();
  const me = createAsync(() => getMe());

  const isActive = (href: string) => {
    if (href === "/") return loc.pathname === "/";
    return loc.pathname.startsWith(href);
  };

  const isPookalamSection = () => loc.pathname.startsWith("/code-a-pookalam");

  return (
    <>
      <header
        class="sticky top-0 z-30 w-full backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--paper) 92%, transparent)",
          "border-bottom": "var(--ink-w) solid var(--ink)",
        }}
      >
        <div class="container py-2 sm:py-2.5">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
            {/* Top row on mobile: Logo + Auth */}
            <div class="flex items-center justify-between w-full sm:w-auto">
              <A href="/" class="flex items-center gap-2.5 transition-transform  select-none">
                <SpriteIcon
                  name="foss-mec-badge"
                  size={32}
                  animate="wobble"
                  interactive
                  class="shrink-0"
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
              </A>

              {/* Mobile-only User Profile */}
              <div class="sm:hidden flex items-center gap-2 shrink-0">
                <Show
                  when={me()}
                  fallback={
                    <A
                      href="/auth/signin"
                      class="btn-brand py-1 px-3 text-xs rounded-full font-extrabold cursor-pointer inline-flex items-center gap-1"
                    >
                      <User size={12} strokeWidth={2.5} />
                      <span>Sign In</span>
                    </A>
                  }
                >
                  {(user) => <ProfileMenu me={user()} compact />}
                </Show>
              </div>
            </div>

            {/* Nav Links + Desktop User Profile */}
            <div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
              <nav class="flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <For each={LINKS}>
                  {(link) => (
                    <A
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
                    </A>
                  )}
                </For>

                {/* Submit button when on code-a-pookalam section */}
                <Show when={isPookalamSection()}>
                  <A
                    href="/code-a-pookalam/submit"
                    class="flex-1 sm:flex-initial text-center inline-flex items-center justify-center gap-1 rounded-full px-3 py-1 text-xs sm:px-3.5 sm:py-1.5 sm:text-sm transition-transform active:translate-y-0.5 cursor-pointer"
                    style={{
                      "font-family": "var(--font-stack-display)",
                      "font-weight": 800,
                      border: "2px solid var(--ink)",
                      background:
                        loc.pathname === "/code-a-pookalam/submit"
                          ? "var(--pop-pink)"
                          : "var(--pop-yellow)",
                      color: loc.pathname === "/code-a-pookalam/submit" ? "white" : "var(--ink)",
                    }}
                  >
                    <Send size={12} strokeWidth={2.5} />
                    <span>Submit</span>
                  </A>
                </Show>
              </nav>

              {/* Desktop User Profile */}
              <div class="hidden sm:block shrink-0">
                <Show
                  when={me()}
                  fallback={
                    <A
                      href="/auth/signin"
                      class="btn-brand py-1.5 px-3.5 text-sm rounded-full font-extrabold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <User size={14} strokeWidth={2.5} />
                      <span>Sign In</span>
                    </A>
                  }
                >
                  {(user) => <ProfileMenu me={user()} />}
                </Show>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
