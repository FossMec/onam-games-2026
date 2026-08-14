// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#FBF3E4" />

          {/* Primary Meta Tags */}
          <title>FOSS Onam Games 2026 — FOSS MEC</title>
          <meta
            name="description"
            content="Seven days of games. One week of Onam. A comic-themed, open-source celebration with daily browser challenges, Code-a-Pookalam, and live leaderboards by FOSS MEC."
          />
          <meta name="author" content="Dijith Dinesh" />
          <meta name="creator" content="Dijith Dinesh" />
          <meta name="publisher" content="FOSS MEC" />
          <meta
            name="keywords"
            content="FOSS MEC, Onam Games, Model Engineering College, Open Source, Code-a-Pookalam, Maveli, SolidJS, Kerala Games"
          />

          {/* Favicons & App Icons */}
          <link rel="icon" type="image/x-icon" href="/favicon.ico" />
          <link rel="icon" type="image/png" sizes="32x32" href="/foss-logo-original.png" />
          <link rel="apple-touch-icon" href="/foss-logo-original.png" />

          {/* Open Graph / Facebook (TODO: Update og:image once final campaign banner is locked from images-raw/og-img.jpeg) */}
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="FOSS Onam Games" />
          <meta property="og:title" content="FOSS Onam Games 2026 — FOSS MEC" />
          <meta
            property="og:description"
            content="Seven days of games. One week of Onam. A comic-themed, open-source celebration with daily browser challenges, Code-a-Pookalam, and live leaderboards."
          />
          <meta property="og:image" content="/images/og-image.jpeg" />
          <meta property="og:image:alt" content="FOSS Onam Games 2026 Poster" />

          {/* Twitter Cards */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:creator" content="@dijith" />
          <meta name="twitter:title" content="FOSS Onam Games 2026 — FOSS MEC" />
          <meta
            name="twitter:description"
            content="Seven days of games. One week of Onam. Designed & engineered by Dijith Dinesh for FOSS MEC."
          />
          <meta name="twitter:image" content="/images/og-image.jpeg" />

          {/*
            Only the two faces that carry every page are preloaded. The other
            four (wordmark, shouts, mono, marker hand) load lazily — preloading
            all six would fight the HTML for bandwidth on a campus connection.
          */}
          <link
            rel="preload"
            href="/fonts/baloo-chettan-2.woff2"
            as="font"
            type="font/woff2"
            crossorigin="anonymous"
          />
          <link
            rel="preload"
            href="/fonts/nunito.woff2"
            as="font"
            type="font/woff2"
            crossorigin="anonymous"
          />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
