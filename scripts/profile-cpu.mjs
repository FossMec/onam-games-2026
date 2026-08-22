#!/usr/bin/env node

import { spawn } from "node:child_process";

const projectName = process.argv[2] || "onam-games";
const environment = process.argv[3] || "production";

console.log(
  `\x1b[1m\x1b[36m🚀 Starting Cloudflare Live Tail for [${projectName}] (${environment})...\x1b[0m\n`,
);

const child = spawn(
  "npx",
  [
    "wrangler",
    "pages",
    "deployment",
    "tail",
    "--project-name",
    projectName,
    "--environment",
    environment,
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: "--dns-result-order=ipv4first" },
  },
);

child.on("close", (code) => {
  process.exit(code || 0);
});
