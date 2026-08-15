import { Link, Meta, MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ErrorBoundary, Suspense } from "solid-js";
import { AppError } from "./components/AppError";
import { BanNotice } from "./components/BanNotice";
import { BetaGate } from "./components/BetaGate";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";
import { InkFilter } from "./components/art/InkFilter";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>FOSS ONAM - FOSS Onam Games by FOSS MEC</Title>
          <Meta
            name="description"
            content="Seven days of games. One week of Onam. A open-source celebration with daily browser challenges, Code-a-Pookalam, and live leaderboards by FOSS MEC."
          />
          <Meta name="author" content="Dijith Dinesh" />
          <Meta name="creator" content="Dijith Dinesh" />
          <Meta name="application-name" content="FOSS ONAM" />
          <Meta property="og:site_name" content="FOSS ONAM" />
          <Meta property="og:type" content="website" />
          <Meta property="og:url" content="https://foss-onam-games.vercel.app/" />
          <Meta
            name="google-site-verification"
            content="-lINJGuul9m8kUB9WitBwq3UQZi8gWz52ncMnYWyc9I"
          />
          <Meta property="og:title" content="FOSS ONAM — FOSS Onam Games by FOSS MEC" />
          <Meta
            property="og:description"
            content="Seven days of games. One week of Onam. A open-source online festival with daily browser challenges, fair-play leaderboards, and Code-a-Pookalam by FOSS MEC."
          />
          <Meta
            property="og:image"
            content="https://foss-onam-games.vercel.app/images/og-image.webp"
          />
          <Meta property="og:image:type" content="image/webp" />
          <Meta property="og:image:width" content="1376" />
          <Meta property="og:image:height" content="768" />
          <Meta name="twitter:card" content="summary_large_image" />
          <Meta name="twitter:site" content="@fossmec" />
          <Meta name="twitter:creator" content="@fossmec" />
          <Meta name="twitter:title" content="FOSS ONAM — FOSS Onam Games by FOSS MEC" />
          <Meta
            name="twitter:description"
            content="Seven days of games. One week of Onam. A open-source festival with daily browser challenges, leaderboards, and prizes by FOSS MEC."
          />
          <Meta
            name="twitter:image"
            content="https://foss-onam-games.vercel.app/images/og-image.webp"
          />
          <Link rel="canonical" href="https://foss-onam-games.vercel.app/" />
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
            {/*
              Every page, above the navigation header — a warning nobody sees is not
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
                <Nav />
              </Suspense>
            </ErrorBoundary>
            <div class="flex-1">
              <ErrorBoundary fallback={(_error, reset) => <AppError reset={reset} />}>
                <Suspense>
                  {/* Closed beta: testers only, until `access.closed_beta` is off. */}
                  <BetaGate>{props.children}</BetaGate>
                </Suspense>
              </ErrorBoundary>
            </div>
            <Footer />
          </div>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
