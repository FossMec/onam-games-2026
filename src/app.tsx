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
          <Title>FOSS ONAM — FOSS Onam Games by FOSS MEC</Title>
          <Meta
            name="description"
            content="Seven days of games. One week of Onam. A comic-themed, open-source celebration with daily browser challenges, Code-a-Pookalam, and live leaderboards by FOSS MEC."
          />
          <Meta name="author" content="Dijith Dinesh" />
          <Meta name="creator" content="Dijith Dinesh" />
          <Meta name="application-name" content="FOSS ONAM" />
          <Meta property="og:site_name" content="FOSS ONAM" />
          <Meta
            name="google-site-verification"
            content="-lINJGuul9m8kUB9WitBwq3UQZi8gWz52ncMnYWyc9I"
          />
          <Meta property="og:title" content="FOSS ONAM — FOSS Onam Games by FOSS MEC" />
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
            {/*
              Every page, above the navigation header — a warning nobody sees is not
              a warning.
            */}
            <Suspense>
              <BanNotice />
            </Suspense>
            <Suspense>
              <Nav />
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
