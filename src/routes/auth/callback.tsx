import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-solid";
import { Show, createSignal, onMount } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { collectFingerprint, type FingerprintResult } from "~/lib/fingerprint";
import { getBrowserSupabase } from "~/lib/supabase-client";
import { completeSignIn } from "~/server/auth/actions";

function leave(to: string): void {
  window.location.replace(to);
}

export default function AuthCallback() {
  const [status, setStatus] = createSignal<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = createSignal<string>("");
  const [details, setDetails] = createSignal<string>("");

  onMount(async () => {
    try {
      const url = new URL(window.location.href);

      // Check for OAuth error in query params or hash
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errorParam =
        url.searchParams.get("error_description") ||
        url.searchParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");

      if (errorParam) {
        console.error("[AuthCallback] OAuth provider returned error:", errorParam);
        setStatus("error");
        setErrorMessage("Authentication was canceled or denied by Google.");
        setDetails(errorParam);
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
        setStatus("error");
        setErrorMessage(
          "Could not obtain your authentication tokens. Please try signing in again.",
        );
        setDetails(
          `URL: ${window.location.pathname}${window.location.search}${window.location.hash ? " [hash present]" : ""}`,
        );
        return;
      }

      console.info("[AuthCallback] Valid session acquired. Collecting fingerprint...");

      // Collect device fingerprint with safe fallback timeout
      let fpSignals: FingerprintResult["signals"] | undefined;
      let fpVisitorId: string | null = null;
      try {
        const fpPromise = collectFingerprint();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Fingerprint timeout")), 2500),
        );
        const fpResult = await Promise.race([fpPromise, timeoutPromise]);
        fpSignals = fpResult.signals;
        fpVisitorId = fpResult.visitorId;
      } catch (fpErr) {
        console.warn("[AuthCallback] Fingerprint collection timed out or failed:", fpErr);
      }

      // Complete backend sign-in, session creation, and device binding
      console.info("[AuthCallback] Calling backend completeSignIn...");
      const result = await completeSignIn(
        {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at ?? undefined,
        },
        fpSignals ?? ({} as never),
        fpVisitorId,
      );

      console.info("[AuthCallback] Sign-in complete! Redirecting to destination...");
      leave(result.onboardingCompleted ? "/" : "/onboarding");
    } catch (err: unknown) {
      const errObj = err as Error;
      console.error("[AuthCallback] Uncaught error during sign-in:", err);
      setStatus("error");
      setErrorMessage(
        errObj?.message || "An unexpected error occurred while completing your sign in.",
      );
      setDetails(errObj?.stack || String(err));
    }
  });

  return (
    <main class="container flex min-h-[70vh] items-center justify-center py-8">
      <Show
        when={status() === "error"}
        fallback={
          <div
            class="w-full max-w-sm rounded-lg p-8 text-center"
            style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
          >
            <div class="flex justify-center mb-3">
              <SpriteIcon name="tux-king" size={48} animate="wobble" />
            </div>
            <p
              class="text-2xl"
              style={{ "font-family": "var(--font-stack-display)", "font-weight": 800 }}
            >
              Signing you in…
            </p>
            <p class="comment mt-2">checking you're not four people in a trench coat</p>
          </div>
        }
      >
        <div
          class="card pop-red w-full max-w-md p-6 text-center space-y-4 shadow-lg border-2 border-[var(--ink)]"
          style={{ background: "var(--paper-2)" }}
        >
          <div class="flex justify-center text-[var(--pop-red)]">
            <AlertTriangle size={48} strokeWidth={2.5} />
          </div>

          <h1 class="text-2xl font-black text-[var(--ink)]">Sign-In Failed</h1>

          <p class="font-bold text-sm text-[var(--pop-red)] leading-relaxed">{errorMessage()}</p>

          <Show when={details()}>
            <details class="text-left bg-[var(--paper)] p-2.5 rounded-md border border-[var(--ink-soft)]/40 text-xs font-mono">
              <summary class="cursor-pointer font-bold text-[var(--ink-soft)] select-none">
                Technical Details
              </summary>
              <pre class="mt-2 whitespace-pre-wrap break-all text-[11px] opacity-80 max-h-32 overflow-y-auto">
                {details()}
              </pre>
            </details>
          </Show>

          <div class="flex flex-wrap gap-2 justify-center pt-2">
            <a
              href="/auth/signin"
              class="btn-brand flex items-center justify-center gap-1.5 py-2 px-4 text-sm cursor-pointer"
            >
              <RefreshCw size={15} />
              <span>Try Again</span>
            </a>
            <a
              href="/"
              class="btn-ghost flex items-center justify-center gap-1.5 py-2 px-4 text-sm cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Back to Home</span>
            </a>
          </div>
        </div>
      </Show>
    </main>
  );
}
