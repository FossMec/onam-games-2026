import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { BanNotice } from "./components/BanNotice";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";
import { InkFilter } from "./components/art/InkFilter";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>FOSS Onam Games</Title>
          {/* Slow rotating pookalam background rays */}
          <div class="bg-radial-spin" aria-hidden="true" />
          {/* Filter defs, mounted once for the whole app. */}
          <InkFilter />
          <div class="flex min-h-screen flex-col relative z-0">
            <Nav />
            {/* Every page, not just the game page — a warning nobody sees is not a warning. */}
            <BanNotice />
            <div class="flex-1">
              <Suspense>{props.children}</Suspense>
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
