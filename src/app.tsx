import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>FOSS Onam Games</Title>
          <nav class="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
            <div class="container flex items-center justify-between gap-4 py-3">
              <a href="/" class="font-bold tracking-tight text-brand">
                FOSS ✕ Onam
              </a>
              <div class="flex gap-4 text-sm">
                <a href="/" class="hover:text-brand">
                  Home
                </a>
                <a href="/leaderboard" class="hover:text-brand">
                  Leaderboard
                </a>
                <a href="/admin" class="hover:text-brand">
                  Admin
                </a>
              </div>
            </div>
          </nav>
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
