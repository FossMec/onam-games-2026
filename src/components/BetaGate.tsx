import { createAsync, useLocation } from "@solidjs/router";
import { Show, type JSX } from "solid-js";
import { ShoutBurst } from "~/components/art/Burst";
import { Confetti } from "~/components/art/Confetti";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { signOutAndReload } from "~/lib/sign-out";
import { getAccessState } from "~/server/auth/actions";

/**
 * The closed-beta door.
 *
 * While `access.closed_beta` is on, the site is testers only. Two doors, two
 * different messages, because they are two different problems:
 *
 *   not signed in   we cannot know who you are yet, so: sign in.
 *   signed in       we know, and you are not on the list: contact Dijith.
 *
 * `/auth/*` is always let through - gating the sign-in page behind sign-in
 * would lock out the testers too.
 *
 * This is a door, not a vault: it hides the shell. Every action that actually
 * matters is authorised on the server independently of this, so a determined
 * visitor calling a server function directly gains nothing they did not
 * already have.
 */
export function BetaGate(props: { children: JSX.Element }) {
  const access = createAsync(() => getAccessState());
  const location = useLocation();

  const isAuthRoute = () => location.pathname.startsWith("/auth");
  // Legal pages must stay reachable for the Google OAuth consent screen even
  // while the beta door is shut.
  const isLegalRoute = () => location.pathname === "/privacy" || location.pathname === "/terms";
  // Undefined while the state is loading - render the page rather than flashing
  // a denial at somebody who turns out to be a tester.
  const blocked = () =>
    access() !== undefined && !access()!.allowed && !isAuthRoute() && !isLegalRoute();

  return (
    <Show when={!blocked()} fallback={<Denied signedIn={!!access()?.signedIn} />}>
      {props.children}
    </Show>
  );
}

function Denied(props: { signedIn: boolean }) {
  return (
    <main class="container relative py-16">
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <Confetti seed="beta-gate" count={8} animate />
      </div>

      <div class="card pop-red relative mx-auto max-w-lg space-y-4 text-center">
        <ShoutBurst
          text={props.signedIn ? "Sorry!" : "Sign in"}
          color="var(--pop-red)"
          seed="beta-gate"
        />

        <div class="flex justify-center">
          <SpriteIcon name="tux-king" size={64} animate="float" alt="" />
        </div>

        <p class="text-xs font-black uppercase tracking-widest">FOSS ONAM</p>
        <p class="font-semibold leading-relaxed">
          A free, open-source online festival by FOSS MEC with daily browser games, fair-play
          leaderboards, and the Code-a-Pookalam community art contest.
        </p>

        <Show
          when={props.signedIn}
          fallback={
            <>
              <h1 class="text-2xl">Closed beta</h1>
              <p class="font-semibold">
                The games are open to testers only right now. Sign in to see whether you are on the
                list.
              </p>
              <div class="flex flex-col space-y-4">
                <a href="/auth/signin" class="btn-brand inline-block">
                  Sign in with Google
                </a>
                <p class="comment">the door is locked, not welded.</p>
              </div>
            </>
          }
        >
          <h1 class="text-2xl">Access denied</h1>
          <p class="font-semibold">
            This account is not on the tester list. The site opens to everyone when the event goes
            live.
          </p>
          <p class="font-semibold">Contact Dijith if you think this is a mistake.</p>
          <p class="comment">no hard feelings. come back on launch night.</p>
          <button type="button" class="btn-ghost" onClick={() => void signOutAndReload("/")}>
            Sign in with a different account
          </button>
        </Show>
      </div>
    </main>
  );
}
