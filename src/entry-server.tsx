// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" type="image/png" sizes="32x32" href="/foss-logo-original.png" />
          <link rel="icon" type="image/x-icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" href="/foss-logo-original.png" />
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
