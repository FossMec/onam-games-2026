// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => {
  // All analytics IDs configurable via Cloudflare Variables - change env, redeploy, done
  const umamiWebsiteId =
    process.env.VITE_UMAMI_WEBSITE_ID ||
    process.env.UMAMI_WEBSITE_ID ||
    process.env.VITE_UMAMI_ID ||
    "e55018c4-dbfc-4970-a2eb-8e08e32465c1";
  const umamiScriptUrl =
    process.env.VITE_UMAMI_SCRIPT_URL ||
    process.env.VITE_UMAMI_SRC ||
    process.env.UMAMI_SCRIPT_URL ||
    "https://cloud.umami.is/script.js";
  const clarityProjectId =
    process.env.VITE_CLARITY_PROJECT_ID ||
    process.env.CLARITY_PROJECT_ID ||
    process.env.VITE_CLARITY_ID;

  return (
    <StartServer
      document={({ assets, children, scripts }) => (
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" type="image/svg+xml" href="/logo.svg" />
            <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
            <link rel="icon" type="image/x-icon" href="/favicon.ico" />
            <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
            {/*
            Only the two faces that carry every page are preloaded. The other
            four (wordmark, shouts, mono, marker hand) load lazily - preloading
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
            {umamiWebsiteId ? (
              <script defer src={umamiScriptUrl} data-website-id={umamiWebsiteId} />
            ) : null}
            {clarityProjectId ? (
              <script
                type="text/javascript"
                innerHTML={`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityProjectId}");`}
              />
            ) : null}
            {assets}
          </head>
          <body>
            <div id="app">{children}</div>
            {scripts}
          </body>
        </html>
      )}
    />
  );
});
