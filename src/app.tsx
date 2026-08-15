import { Meta, MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
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
          <Title>FOSS Onam Games 2026 — FOSS MEC</Title>
          <Meta
            name="description"
            content="Seven days of games. One week of Onam. A comic-themed, open-source celebration with daily browser challenges, Code-a-Pookalam, and live leaderboards by FOSS MEC."
          />
          <Meta name="author" content="Dijith Dinesh" />
          <Meta name="creator" content="Dijith Dinesh" />
          <Meta property="og:title" content="FOSS Onam Games 2026 — FOSS MEC" />
          <Meta
            property="og:description"
            content="Seven days of games. One week of Onam. Designed & engineered by Dijith Dinesh for FOSS MEC."
          />
          <Meta property="og:image" content="/images/og-image.jpeg" />
          <Meta name="twitter:card" content="summary_large_image" />
          <Meta name="twitter:creator" content="@dijith" />
          <Meta name="twitter:image" content="/images/og-image.jpeg" />

          {/* Slow rotating pookalam background rays */}
          <div class="bg-radial-spin" aria-hidden="true" />
          {/* Filter defs, mounted once for the whole app. */}
          <InkFilter />
          <div class="flex min-h-screen flex-col relative z-0">
            <Suspense>
              <Nav />
            </Suspense>
            {/*
              Every page, not just the game page — a warning nobody sees is not
              a warning.

              Its own boundary, and it must have one: `BanNotice` reads an async
              resource, and an async read with no Suspense above it has nothing
              to defer into during SSR. The server sent no markup for the
              warning modal while the client, once the ban state resolved, tried
              to hydrate it — "unable to find DOM nodes for hydration key". The
              boundary is separate from the page's so a slow ban lookup cannot
              hold up the route, or the other way round.
            */}
            <Suspense>
              <BanNotice />
            </Suspense>
            <div class="flex-1">
              <Suspense>
                {/* Closed beta: testers only, until `access.closed_beta` is off. */}
                <BetaGate>{props.children}</BetaGate>
              </Suspense>
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
