import { clientOnly } from "@solidjs/start";
import { Link, Meta, MetaProvider } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ErrorBoundary, Show, Suspense } from "solid-js";
import { AppError } from "./components/AppError";
import { BetaGate } from "./components/BetaGate";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";
import { LoadingScreen } from "./components/LoadingScreen";
import { InkFilter } from "./components/art/InkFilter";
import "./app.css";

const BanNotice = clientOnly(() =>
  import("./components/BanNotice").then((m) => ({ default: m.BanNotice })),
);
const ShortlistNotice = clientOnly(() =>
  import("./components/pookalam/ShortlistNotice").then((m) => ({ default: m.ShortlistNotice })),
);
const PookalamBalloons = clientOnly(() =>
  import("./components/PookalamBalloons").then((m) => ({ default: m.PookalamBalloons })),
);
const FloatingFeedbackButton = clientOnly(() =>
  import("./components/feedback/FloatingFeedbackButton").then((m) => ({
    default: m.FloatingFeedbackButton,
  })),
);

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Meta name="author" content="Dijith Dinesh" />
          <Meta name="creator" content="Dijith Dinesh" />
          <Meta name="application-name" content="Onam Games" />
          <Meta property="og:site_name" content="Onam Games" />
          <Meta property="og:type" content="website" />
          <Show
            when={
              import.meta.env.VITE_GOOGLE_SITE_VERIFICATION ||
              "hmMLL8KnfSg_CX5_cjL7qq_fqiclk-QLJsPh2xqA_MM"
            }
          >
            {(token) => <Meta name="google-site-verification" content={token()} />}
          </Show>
          <Meta name="twitter:card" content="summary_large_image" />
          <Meta name="twitter:site" content="@fossmec" />
          <Meta name="twitter:creator" content="@fossmec" />
          <Link rel="icon" type="image/svg+xml" href="/logo.svg" />
          {/*
            No 512x512 `rel="icon"` here. Browsers were fetching the 34 KB
            favicon.png on every single page load to satisfy it, on top of the
            SVG they actually use. The manifest still declares it, which is
            where a 512px icon is genuinely wanted - and that is fetched once,
            at install, rather than on every visit.
          */}
          <Link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <Link rel="manifest" href="/site.webmanifest" />

          {/* Privacy-Friendly Web Analytics (Umami / Cloudflare / Vercel) */}
          {import.meta.env.VITE_UMAMI_WEBSITE_ID && (
            <script
              defer
              src={import.meta.env.VITE_UMAMI_SRC || "https://cloud.umami.is/script.js"}
              data-website-id={import.meta.env.VITE_UMAMI_WEBSITE_ID}
            />
          )}
          {import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN && (
            <script
              defer
              src="https://static.cloudflareinsights.com/beacon.min.js"
              data-cf-beacon={JSON.stringify({
                token: import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN,
              })}
            />
          )}

          {/* Slow rotating pookalam background rays */}
          <div class="bg-radial-spin" aria-hidden="true" />
          {/* Filter defs, mounted once for the whole app. */}
          <InkFilter />
          <div class="flex min-h-screen flex-col relative z-0">
            <PookalamBalloons />
            {/*
              Every page, above the navigation header - a warning nobody sees is not
              a warning.
            */}
            {/*
              Each strip of the shell gets its own boundary. A banner that
              cannot render is a banner nobody misses; a header that cannot
              render must not take the page with it.
            */}
            <ErrorBoundary fallback={null}>
              <Suspense>
                <BanNotice />
              </Suspense>
            </ErrorBoundary>
            <ErrorBoundary fallback={null}>
              <Suspense>
                <ShortlistNotice />
              </Suspense>
            </ErrorBoundary>
            <ErrorBoundary fallback={null}>
              <Suspense>
                <Nav />
              </Suspense>
            </ErrorBoundary>
            <div class="flex-1">
              <ErrorBoundary fallback={(error, reset) => <AppError error={error} reset={reset} />}>
                <Suspense fallback={<LoadingScreen />}>
                  {/* Closed beta: testers only, until `access.closed_beta` is off. */}
                  <BetaGate>{props.children}</BetaGate>
                </Suspense>
              </ErrorBoundary>
            </div>
            <Footer />
            <ErrorBoundary fallback={null}>
              <Suspense>
                <FloatingFeedbackButton />
              </Suspense>
            </ErrorBoundary>
          </div>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
