import { A } from "@solidjs/router";
import { ArrowLeft, RefreshCw, TriangleAlert } from "lucide-solid";
import { Show, createSignal, onMount } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { SignInScene } from "~/components/auth/SignInScene";
import { collectFingerprint, type FingerprintResult } from "~/lib/fingerprint";
import { getBrowserSupabase } from "~/lib/supabase-client";
import { completeDirectSignIn, completeSignIn } from "~/server/auth/actions";

function leave(to: string): void {
  window.location.replace(to);
}

interface Explained {
  title: string;
  message: string;
  /** What the player can actually do about it. */
  hint?: string;
  /** Whether a stack trace is worth offering. */
  technical: boolean;
  sprite: "papad-face" | "muthukuda";
}

/**
 * Turns a thrown error into something a player can act on.
 *
 * The default card dumped the raw message and a stack trace, which is right for
 * a bug and wrong for a rule. "This device is already linked to another
 * account" is not a failure - it is the one-account-per-device rule doing
 * exactly its job - and showing it under a red "Sign-In Failed" heading with a
 * stack trace tells someone their sign-in broke when it did not.
 *
 * So the cases we deliberately enforce get an explanation and a way forward;
 * anything unrecognised keeps the technical card, because that one really is a
 * bug and the trace is what gets it fixed.
 */
function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.statusText === "string") return obj.statusText;
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  return typeof error === "number" || typeof error === "boolean" ? String(error) : "Unknown error";
}

function explain(error: unknown): Explained {
  const raw = extractErrorMessage(error);

  if (/already linked to another account|device.*taken/i.test(raw)) {
    return {
      title: "This device is already taken",
      message: "Somebody has already signed in on this phone or laptop with a different account.",
      hint: "Sign in with that first account on this device to continue. If you think this is a mistake, talk to the organisers.",
      technical: false,
      sprite: "muthukuda",
    };
  }

  if (/expired|took too long/i.test(raw)) {
    return {
      title: "That took a bit too long",
      message: "Your sign-in window closed before it finished.",
      hint: "Tap try again - it only takes a second the second time.",
      technical: false,
      sprite: "papad-face",
    };
  }

  if (/could not be verified|start again from this site/i.test(raw)) {
    return {
      title: "Couldn't verify that sign-in",
      message: "The sign-in didn't start from this site, so we stopped it.",
      hint: "Head back and start from the sign-in page.",
      technical: false,
      sprite: "muthukuda",
    };
  }

  if (/canceled|denied/i.test(raw)) {
    return {
      title: "Sign-in was cancelled",
      message: "Google didn't hand us an account - you may have closed the window or hit cancel.",
      hint: "No harm done. Try again whenever you're ready.",
      technical: false,
      sprite: "papad-face",
    };
  }

  return {
    title: "Sign-in failed",
    message: raw || "Something went wrong while completing your sign in.",
    technical: true,
    sprite: "papad-face",
  };
}

/**
 * Device signals, or nothing if they take too long.
 *
 * Never allowed to block sign-in: a browser that stalls on canvas or audio
 * probing must still get the player in. Missing signals mean weaker device
 * binding for that account, which the anti-cheat side already handles.
 */
async function fingerprint(): Promise<{
  signals?: FingerprintResult["signals"];
  visitorId: string | null;
}> {
  try {
    const result = await Promise.race([
      collectFingerprint(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Fingerprint timeout")), 2500),
      ),
    ]);
    return { signals: result.signals, visitorId: result.visitorId };
  } catch (err) {
    console.warn("[AuthCallback] Fingerprint collection timed out or failed:", err);
    return { visitorId: null };
  }
}

export default function AuthCallback() {
  const [status, setStatus] = createSignal<"loading" | "error">("loading");
  const [problem, setProblem] = createSignal<Explained | null>(null);
  const [details, setDetails] = createSignal<string>("");

  const fail = (error: unknown, trace?: string) => {
    setProblem(explain(error));
    setDetails(trace ?? "");
    setStatus("error");
  };

  onMount(async () => {
    try {
      const url = new URL(window.location.href);

      /*
       * Direct flow: `/api/auth/google/callback` already redeemed the code and
       * parked the Supabase session in a sealed cookie, so there is nothing to
       * find in this URL and nothing for the browser Supabase client to do.
       * All that is left is the fingerprint, which only the browser can take.
       */
      if (url.searchParams.get("direct")) {
        console.info("[AuthCallback] Direct Google flow - claiming parked session…");
        const fp = await fingerprint();
        const result = await completeDirectSignIn(fp.signals ?? ({} as never), fp.visitorId);
        leave(result.onboardingCompleted ? "/" : "/onboarding");
        return;
      }

      // Check for OAuth error in query params or hash
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errorParam =
        url.searchParams.get("error_description") ||
        url.searchParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");

      if (errorParam) {
        console.error("[AuthCallback] OAuth provider returned error:", errorParam);
        fail(new Error("Authentication was canceled or denied by Google."), errorParam);
        return;
      }

      const supabase = getBrowserSupabase();
      let session = null;

      // 1. Check if tokens are in the URL hash (implicit flow)
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const expiresIn = hashParams.get("expires_in");

      if (accessToken && refreshToken) {
        console.info("[AuthCallback] Found access_token in URL hash, setting session...");
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error && data.session) {
          session = data.session;
        } else if (error) {
          console.warn("[AuthCallback] setSession from hash error:", error);
          // Construct fallback session from hash
          session = {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresIn ? Math.floor(Date.now() / 1000) + Number(expiresIn) : undefined,
          };
        }
      }

      // 2. Check PKCE code if provided
      const code = url.searchParams.get("code");
      if (!session && code) {
        console.info("[AuthCallback] Attempting PKCE code exchange...");
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            session = data.session;
          } else if (error) {
            console.warn("[AuthCallback] PKCE code exchange failed:", error.message);
          }
        } catch (pkceErr) {
          console.warn("[AuthCallback] exchangeCodeForSession threw:", pkceErr);
        }
      }

      // 3. Check existing or detected session from Supabase client
      if (!session) {
        console.info("[AuthCallback] Reading session from getSession()...");
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          session = data.session;
        }
      }

      // 4. Wait briefly for onAuthStateChange if session is still settling
      if (!session) {
        console.info("[AuthCallback] Waiting for auth state change event...");
        session = await new Promise<any>((resolve) => {
          const { data: authListener } = supabase.auth.onAuthStateChange(
            (_event, currentSession) => {
              if (currentSession) {
                authListener.subscription.unsubscribe();
                resolve(currentSession);
              }
            },
          );
          setTimeout(() => {
            authListener.subscription.unsubscribe();
            resolve(null);
          }, 3000);
        });
      }

      if (!session || !session.access_token || !session.refresh_token) {
        console.error("[AuthCallback] No active session could be established.");
        fail(
          new Error("Could not obtain your authentication tokens. Please try signing in again."),
          `URL: ${window.location.pathname}${window.location.search}${window.location.hash ? " [hash present]" : ""}`,
        );
        return;
      }

      console.info("[AuthCallback] Valid session acquired. Collecting fingerprint...");

      // Collect device fingerprint with safe fallback timeout
      const fp = await fingerprint();

      // Complete backend sign-in, session creation, and device binding
      console.info("[AuthCallback] Calling backend completeSignIn...");
      const result = await completeSignIn(
        {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at ?? undefined,
        },
        fp.signals ?? ({} as never),
        fp.visitorId,
      );

      console.info("[AuthCallback] Sign-in complete! Redirecting to destination...");
      leave(result.onboardingCompleted ? "/" : "/onboarding");
    } catch (err: unknown) {
      console.error("[AuthCallback] Uncaught error during sign-in:", err);
      fail(err, err instanceof Error ? (err.stack ?? "") : String(err));
    }
  });

  return (
    <Show when={status() === "error" && problem()} keyed fallback={<SignInScene />}>
      {(prob) => (
        <main class="container flex min-h-[70vh] items-center justify-center py-8">
          <div
            class="card w-full max-w-md text-center space-y-3"
            style={{ "--pop": prob.technical ? "var(--pop-red)" : "var(--pop-yellow)" }}
          >
            {/*
              A rule we chose to enforce is not a crash, and it should not wear a
              crash's clothes. Enforcement gets a mascot and an explanation; only
              an actual bug gets the red triangle.
            */}
            <div class="flex justify-center">
              <Show
                when={prob.technical}
                fallback={<SpriteIcon name={prob.sprite} size={56} animate="float" />}
              >
                <span style={{ color: "var(--pop-red)" }}>
                  <TriangleAlert size={48} strokeWidth={2.5} />
                </span>
              </Show>
            </div>

            <h1 class="text-2xl font-black m-0">{prob.title}</h1>

            <p class="font-bold text-sm leading-relaxed m-0">{prob.message}</p>

            <Show when={prob.hint}>
              <p class="comment text-xs">{prob.hint}</p>
            </Show>

            {/* Offered only when the trace could actually help someone. */}
            <Show when={prob.technical && details()}>
              <details
                class="text-left p-2.5 rounded-md text-xs font-mono"
                style={{ background: "var(--paper)", border: "2px solid var(--ink)" }}
              >
                <summary class="cursor-pointer font-bold select-none">Technical details</summary>
                <pre class="mt-2 whitespace-pre-wrap break-all text-[11px] opacity-80 max-h-32 overflow-y-auto">
                  {details()}
                </pre>
              </details>
            </Show>

            <div class="flex flex-wrap gap-2 justify-center pt-1">
              <A href="/auth/signin" class="btn-brand inline-flex items-center gap-1.5 text-sm">
                <RefreshCw size={15} />
                <span>Try again</span>
              </A>
              <A href="/" class="btn-ghost inline-flex items-center gap-1.5 text-sm">
                <ArrowLeft size={15} />
                <span>Back to home</span>
              </A>
            </div>
          </div>
        </main>
      )}
    </Show>
  );
}
