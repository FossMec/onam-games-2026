#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import readline from "node:readline";

let deploymentId = process.argv[2];
const projectName = "onam-games";

if (!deploymentId || deploymentId.startsWith("--")) {
  console.log(`\x1b[90m🔍 Finding latest successful deployment for [${projectName}]...\x1b[0m`);
  try {
    const listOutput = execSync(
      `npx wrangler pages deployment list --project-name ${projectName}`,
      { encoding: "utf8" },
    );
    const matches = [
      ...listOutput.matchAll(
        /│\s+([a-f0-9-]{36})\s+│\s+Production\s+│[^│]+│[^│]+│[^│]+│\s+(?!Failure)/g,
      ),
    ];
    if (matches.length > 0) {
      deploymentId = matches[0][1];
      console.log(`\x1b[32m✔ Selected latest deployment: ${deploymentId}\x1b[0m\n`);
    }
  } catch (err) {
    console.error("Failed to list deployments automatically:", err.message);
  }
}

const args = ["wrangler", "pages", "deployment", "tail"];
if (deploymentId) {
  args.push(deploymentId);
}
args.push("--project-name", projectName, "--environment", "production", "--format", "json");

console.log(`\x1b[1m\x1b[36m🚀 Starting Cloudflare Live CPU Profiler...\x1b[0m\n`);

const child = spawn("npx", args, { stdio: ["inherit", "pipe", "inherit"] });

const rl = readline.createInterface({
  input: child.stdout,
  terminal: false,
});

let totalCount = 0;
let totalCpuMs = 0;
let getCount = 0;
let getCpuMs = 0;
let postCount = 0;
let postCpuMs = 0;
let maxCpuMs = 0;
let minCpuMs = Infinity;

const recentCpu = [];

rl.on("line", (line) => {
  if (!line.trim()) return;

  if (!line.startsWith("{")) {
    if (line.includes("Connected to deployment") || line.includes("waiting for logs")) {
      console.log(`\x1b[32m✔ ${line.trim()}\x1b[0m\n`);
      console.log(
        `${"STATUS".padEnd(8)} ${"METHOD".padEnd(7)} ${"PATH".padEnd(34)} ${"CPU TIME".padEnd(12)} ${"AVG CPU".padEnd(12)} ${"WINDOW (20)"}`,
      );
      console.log("-".repeat(90));
    }
    return;
  }

  try {
    const data = JSON.parse(line);
    const event = data.event || {};
    const req = event.request || {};
    const method = req.method || "GET";
    const rawUrl = req.url || "/";
    const pathname = new URL(rawUrl, "http://localhost").pathname;
    const status = data.outcome === "ok" ? "200" : data.outcome || "ERR";

    let cpuMs = 0;
    if (typeof data.cpuTime === "number") {
      cpuMs = data.cpuTime > 1000 ? data.cpuTime / 1000 : data.cpuTime;
    } else if (typeof data.duration === "number") {
      cpuMs = data.duration;
    } else if (typeof event.cpuTime === "number") {
      cpuMs = event.cpuTime > 1000 ? event.cpuTime / 1000 : event.cpuTime;
    }

    totalCount += 1;
    totalCpuMs += cpuMs;
    if (cpuMs > maxCpuMs) maxCpuMs = cpuMs;
    if (cpuMs < minCpuMs) minCpuMs = cpuMs;

    if (method === "GET") {
      getCount += 1;
      getCpuMs += cpuMs;
    } else {
      postCount += 1;
      postCpuMs += cpuMs;
    }

    recentCpu.push(cpuMs);
    if (recentCpu.length > 20) recentCpu.shift();

    const avgTotal = (totalCpuMs / totalCount).toFixed(2);
    const windowAvg = (recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length).toFixed(2);

    const cpuColor =
      cpuMs >= 10
        ? "\x1b[31;1m" // Red (>= 10ms threshold)
        : cpuMs >= 6
          ? "\x1b[33;1m" // Yellow (Medium)
          : "\x1b[32;1m"; // Green (< 6ms)

    const pathFormatted =
      pathname.length > 32 ? pathname.slice(0, 29) + "..." : pathname.padEnd(34);
    const methodFormatted = method.padEnd(7);
    const statusFormatted = status.padEnd(8);

    console.log(
      `\x1b[1m${statusFormatted}\x1b[0m ${methodFormatted} ${pathFormatted} ` +
        `${cpuColor}${cpuMs.toFixed(2).padStart(6)}ms\x1b[0m     ` +
        `\x1b[36m${avgTotal.padStart(5)}ms\x1b[0m      ` +
        `\x1b[35m${windowAvg.padStart(5)}ms\x1b[0m`,
    );

    if (totalCount % 10 === 0) {
      const getAvg = getCount ? (getCpuMs / getCount).toFixed(2) : "0.00";
      const postAvg = postCount ? (postCpuMs / postCount).toFixed(2) : "0.00";
      console.log(
        `\x1b[90m── [STATS (${totalCount} reqs)] GET Avg: ${getAvg}ms | POST Avg: ${postAvg}ms | Min: ${minCpuMs.toFixed(2)}ms | Max: ${maxCpuMs.toFixed(2)}ms ──\x1b[0m`,
      );
    }
  } catch {
    // Ignore non-json / unparseable lines
  }
});

child.on("close", (code) => {
  console.log(`\n\x1b[1mProfiler stopped (exit code ${code}).\x1b[0m`);
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
  process.exit(0);
});
