import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "../src/server/db/client";
import {
  devices,
  gameAttempts,
  games,
  suspiciousLogs,
  userDevices,
  users,
} from "../src/server/db/schema";
import { matchSignals, scoreLink, type DeviceSignals } from "../src/server/anti-cheat/link";

interface UserNode {
  id: string;
  name: string;
  email: string;
  college: string;
  collegeOther: string | null;
  branch: string | null;
  batch: string | null;
  phone: string | null;
  trustScore: number;
  role: string;
  banLevel: number;
  devices: Array<
    DeviceSignals & { id: string; deviceHash: string; ip: string | null; platform: string | null }
  >;
  attempts: Array<{
    gameId: string;
    gameSlug: string;
    durationMs: number | null;
    score: number | null;
    submittedAt: Date | null;
    ip: string | null;
    valid: boolean;
  }>;
  logsCount: number;
}

interface SimilarityEdge {
  userA: UserNode;
  userB: UserNode;
  confidence: number;
  matchedSignals: string[];
  reasons: string[];
}

interface Cluster {
  id: number;
  users: UserNode[];
  maxConfidence: number;
  edges: SimilarityEdge[];
}

async function runAnalysis() {
  console.log("🔍 Fetching database records for cheat & multi-account analysis...");
  const db = getDb();

  const [allUsers, allDevices, allUserDevices, allAttempts, allLogs, allGames] = await Promise.all([
    db.select().from(users),
    db.select().from(devices),
    db.select().from(userDevices),
    db
      .select({
        id: gameAttempts.id,
        userId: gameAttempts.userId,
        gameId: gameAttempts.gameId,
        durationMs: gameAttempts.durationMs,
        score: gameAttempts.score,
        submittedAt: gameAttempts.submittedAt,
        ip: gameAttempts.ip,
        serverValid: gameAttempts.serverValid,
      })
      .from(gameAttempts),
    db.select().from(suspiciousLogs),
    db.select().from(games),
  ]);

  console.log(
    `📊 Loaded ${allUsers.length} users, ${allDevices.length} devices, ${allAttempts.length} attempts.`,
  );

  const gameMap = new Map(allGames.map((g) => [g.id, g.slug]));
  const deviceMap = new Map(allDevices.map((d) => [d.id, d]));

  // Group devices per user
  const userDeviceMap = new Map<string, string[]>();
  for (const ud of allUserDevices) {
    const list = userDeviceMap.get(ud.userId) || [];
    list.push(ud.deviceId);
    userDeviceMap.set(ud.userId, list);
  }

  // Group attempts per user
  const userAttemptsMap = new Map<string, UserNode["attempts"]>();
  for (const a of allAttempts) {
    const list = userAttemptsMap.get(a.userId) || [];
    list.push({
      gameId: a.gameId,
      gameSlug: gameMap.get(a.gameId) || "unknown",
      durationMs: a.durationMs,
      score: a.score,
      submittedAt: a.submittedAt,
      ip: a.ip,
      valid: a.serverValid,
    });
    userAttemptsMap.set(a.userId, list);
  }

  // Group logs per user
  const userLogsCount = new Map<string, number>();
  for (const log of allLogs) {
    if (log.userId) {
      userLogsCount.set(log.userId, (userLogsCount.get(log.userId) || 0) + 1);
    }
  }

  // Build UserNodes
  const userNodes: UserNode[] = allUsers.map((u): UserNode => {
    const devIds = userDeviceMap.get(u.id) || [];
    const devRows = devIds
      .map((id) => deviceMap.get(id))
      .filter((d): d is (typeof allDevices)[0] => !!d)
      .map((d) => ({
        id: d.id,
        deviceHash: d.deviceHash,
        fpVisitorId: d.fpVisitorId,
        hardwareHash: d.hardwareHash,
        canvasHash: d.canvasHash,
        webglHash: d.webglHash,
        fontHash: d.fontHash,
        screenHash: d.screenHash,
        audioHash: d.audioHash,
        localIp: d.localIp,
        lastIp: d.lastIp,
        ip: d.lastIp,
        platform: d.platform,
      }));

    return {
      id: u.id,
      name: u.name ?? "Anonymous",
      email: u.email,
      college: u.college ?? "other",
      collegeOther: u.collegeOther,
      branch: u.branch,
      batch: u.batch,
      phone: u.whatsappNumber,
      trustScore: u.trustScore,
      role: u.role ?? "player",
      banLevel: u.banLevel,
      devices: devRows,
      attempts: userAttemptsMap.get(u.id) || [],
      logsCount: userLogsCount.get(u.id) || 0,
    };
  });

  // Calculate Pairwise Similarities
  console.log("⚡ Calculating pairwise similarities and entropy metrics...");
  const edges: SimilarityEdge[] = [];

  for (let i = 0; i < userNodes.length; i++) {
    for (let j = i + 1; j < userNodes.length; j++) {
      const uA = userNodes[i];
      const uB = userNodes[j];

      const matchedSignals: string[] = [];
      const reasons: string[] = [];
      let maxScore = 0;

      // 1. Phone number match
      if (uA.phone && uB.phone && uA.phone === uB.phone) {
        matchedSignals.push("phone");
        reasons.push(`Exact Phone match: ${uA.phone}`);
        maxScore = Math.max(maxScore, 85);
      }

      // 2. Cross-device signal comparisons
      for (const dA of uA.devices) {
        for (const dB of uB.devices) {
          if (dA.deviceHash === dB.deviceHash) {
            matchedSignals.push("same_device");
            reasons.push(`Shared exact device hash`);
            maxScore = Math.max(maxScore, 95);
          } else {
            const sigs = matchSignals(dA, dB);
            if (sigs.length > 0) {
              const verdict = scoreLink(sigs);
              if (verdict.confidence > 0) {
                sigs.forEach((s) => matchedSignals.push(s));
                reasons.push(`Device link (${sigs.join(", ")}: ${verdict.confidence}%)`);
                maxScore = Math.max(maxScore, verdict.confidence);
              }
            }
          }
        }
      }

      // 3. Temporal game submission correlation
      for (const attA of uA.attempts) {
        for (const attB of uB.attempts) {
          if (
            attA.gameId === attB.gameId &&
            attA.submittedAt &&
            attB.submittedAt &&
            attA.ip &&
            attB.ip &&
            attA.ip === attB.ip
          ) {
            const diffMin =
              Math.abs(attA.submittedAt.getTime() - attB.submittedAt.getTime()) / (60 * 1000);
            if (diffMin <= 20) {
              matchedSignals.push("temporal_ip");
              reasons.push(
                `Played ${attA.gameSlug} within ${Math.round(diffMin)}m on same IP (${attA.ip})`,
              );
              maxScore = Math.min(100, maxScore + 25);
            }
          }
        }
      }

      const uniqueSignals = [...new Set(matchedSignals)];
      if (maxScore >= 30 && uniqueSignals.length > 0) {
        edges.push({
          userA: uA,
          userB: uB,
          confidence: maxScore,
          matchedSignals: uniqueSignals,
          reasons: [...new Set(reasons)],
        });
      }
    }
  }

  // Connected Components / Union-Find Clustering
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  };

  const union = (idA: string, idB: string) => {
    const rootA = find(idA);
    const rootB = find(idB);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  edges.forEach((e) => union(e.userA.id, e.userB.id));

  const clustersMap = new Map<string, { users: Set<UserNode>; edges: SimilarityEdge[] }>();
  for (const edge of edges) {
    const root = find(edge.userA.id);
    const c = clustersMap.get(root) || { users: new Set(), edges: [] };
    c.users.add(edge.userA);
    c.users.add(edge.userB);
    c.edges.push(edge);
    clustersMap.set(root, c);
  }

  const clusters: Cluster[] = [...clustersMap.values()]
    .map((c, idx) => ({
      id: idx + 1,
      users: [...c.users],
      maxConfidence: Math.max(...c.edges.map((e) => e.confidence)),
      edges: c.edges.sort((a, b) => b.confidence - a.confidence),
    }))
    .sort((a, b) => b.maxConfidence - a.maxConfidence);

  console.log(`\n🚨 FOUND ${clusters.length} SUSPECT MULTI-ACCOUNT CLUSTERS:`);
  for (const c of clusters.slice(0, 10)) {
    console.log(
      `  [Cluster #${c.id}] Confidence: ${c.maxConfidence}% | Accounts: ${c.users.map((u) => u.email).join(", ")} | Signals: ${c.edges[0]?.matchedSignals.join(", ")}`,
    );
  }

  // Generate Interactive HTML Report
  const htmlPath = resolve(process.cwd(), "cheat-analysis-report.html");
  const htmlContent = generateHtmlReport(clusters, userNodes, allLogs);
  writeFileSync(htmlPath, htmlContent, "utf-8");
  console.log(`\n✨ Interactive HTML Report saved to: ${htmlPath}`);
}

function generateHtmlReport(
  clusters: Cluster[],
  allUsers: UserNode[],
  _logs: Array<typeof suspiciousLogs.$inferSelect>,
): string {
  const generatedTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const clusterCards = clusters
    .map((c) => {
      const sevClass =
        c.maxConfidence >= 60
          ? "bg-red-50 border-red-500 text-red-900"
          : "bg-amber-50 border-amber-500 text-amber-900";
      const badgeClass =
        c.maxConfidence >= 60 ? "bg-red-600 text-white" : "bg-amber-600 text-white";

      const usersHtml = c.users
        .map(
          (u) => `
        <div class="p-3 bg-white rounded border border-gray-200 shadow-sm text-sm">
          <div class="font-black text-gray-900">${escapeHtml(u.name)} <span class="font-normal text-xs text-gray-500">(${escapeHtml(u.email)})</span></div>
          <div class="text-xs text-gray-600 mt-1">
            <strong>College:</strong> ${escapeHtml(u.college === "mec" ? "Govt Model Engineering College (MEC)" : u.collegeOther || u.college)}
            ${u.branch ? `· <strong>Branch:</strong> ${escapeHtml(u.branch)}` : ""}
            ${u.phone ? `· <strong>Phone:</strong> ${escapeHtml(u.phone)}` : ""}
          </div>
          <div class="flex items-center gap-2 mt-2 font-mono text-xs">
            <span class="px-1.5 py-0.5 rounded bg-gray-100 border">Trust: ${u.trustScore}</span>
            <span class="px-1.5 py-0.5 rounded bg-gray-100 border">Devices: ${u.devices.length}</span>
            <span class="px-1.5 py-0.5 rounded bg-gray-100 border">Attempts: ${u.attempts.length}</span>
            ${u.logsCount > 0 ? `<span class="px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">Alerts: ${u.logsCount}</span>` : ""}
          </div>
        </div>
      `,
        )
        .join("");

      const evidenceHtml = c.edges
        .map(
          (e) => `
        <div class="text-xs py-1.5 border-b border-gray-200 last:border-0">
          <span class="font-bold text-gray-800">${escapeHtml(e.userA.name)}</span> ↔ <span class="font-bold text-gray-800">${escapeHtml(e.userB.name)}</span>
          <span class="ml-2 font-mono font-black text-xs px-1.5 py-0.5 rounded ${e.confidence >= 60 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}">${e.confidence}% confidence</span>
          <div class="text-gray-600 mt-0.5">${escapeHtml(e.reasons.join(" · "))}</div>
        </div>
      `,
        )
        .join("");

      return `
      <div class="border-2 rounded-xl p-5 ${sevClass} space-y-4 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded text-xs font-black uppercase ${badgeClass}">Cluster #${c.id}</span>
            <span class="font-black text-lg">${c.users.length} Linked Accounts</span>
          </div>
          <span class="font-mono font-black text-sm px-3 py-1 rounded bg-white border border-current">${c.maxConfidence}% Combined Score</span>
        </div>

        <div>
          <h4 class="text-xs font-black uppercase tracking-wider text-gray-700 mb-2">Associated Accounts</h4>
          <div class="grid md:grid-cols-2 gap-2.5">${usersHtml}</div>
        </div>

        <div class="p-3.5 bg-white/90 rounded-lg border border-gray-300">
          <h4 class="text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5">Matched Entropy Evidence</h4>
          <div class="space-y-1">${evidenceHtml}</div>
        </div>
      </div>
    `;
    })
    .join("");

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FOSS Onam - Anti-Cheat & Multi-Account Similarity Graph</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
  </head>
  <body class="bg-gray-100 text-gray-900 min-h-screen p-6">
    <div class="max-w-6xl mx-auto space-y-6">
      <header class="bg-white p-6 rounded-xl border border-gray-300 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-black text-gray-900">🌸 FOSS Onam Anti-Cheat & Multi-Account Intelligence</h1>
          <p class="text-xs text-gray-500 mt-1">Entropy-weighted similarity graph and heuristic detection report · Generated ${generatedTime}</p>
        </div>
        <div class="flex gap-3">
          <div class="text-center px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <div class="text-xl font-black">${allUsers.length}</div>
            <div class="text-[10px] font-bold text-gray-500 uppercase">Total Players</div>
          </div>
          <div class="text-center px-4 py-2 bg-red-50 rounded-lg border border-red-200">
            <div class="text-xl font-black text-red-700">${clusters.length}</div>
            <div class="text-[10px] font-bold text-red-600 uppercase">Suspect Clusters</div>
          </div>
        </div>
      </header>

      <section class="space-y-4">
        <h2 class="text-lg font-black text-gray-900">🚨 Ranked Multi-Account Suspect Rings</h2>
        ${clusters.length > 0 ? `<div class="space-y-4">${clusterCards}</div>` : '<div class="p-8 bg-white rounded-xl text-center font-bold text-gray-500 border">No multi-account clusters detected with current thresholds.</div>'}
      </section>
    </div>
  </body>
  </html>
  `;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

runAnalysis().catch((err) => {
  console.error("Analysis script failed:", err);
  process.exit(1);
});
