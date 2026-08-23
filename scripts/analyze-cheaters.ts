import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Auto-load .env or .dev.vars if present in project root
for (const envFile of [".env", ".env.local", ".dev.vars"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    try {
      const lines = readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed
            .slice(idx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
}

import { getDb } from "../src/server/db/client";
import type {
  User,
  Device,
  UserDevice,
  GameAttempt,
  SuspiciousLog,
  Game,
} from "../src/server/db/schema";
import type { FingerprintSignals } from "../src/lib/fingerprint";

export interface UserNode {
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
  createdAt: string;
  lastLoginAt: string | null;
  devices: Array<{
    id: string;
    deviceHash: string;
    hardwareHash: string | null;
    fpVisitorId: string | null;
    canvasHash: string | null;
    webglHash: string | null;
    fontHash: string | null;
    screenHash: string | null;
    audioHash: string | null;
    localIp: string | null;
    lastIp: string | null;
    firstIp: string | null;
    platform: string | null;
    userAgent: string | null;
    firstCountry: string | null;
    firstCity: string | null;
    lastCountry: string | null;
    lastCity: string | null;
    firstSeenAt?: string;
    lastSeenAt?: string;
    attemptsCount?: number;
    fingerprint: Partial<FingerprintSignals> | null;
  }>;
  attempts: Array<{
    id: string;
    gameId: string;
    gameSlug: string;
    gameTitle: string;
    durationMs: number | null;
    score: number | null;
    startedAt: string | null;
    submittedAt: string | null;
    ip: string | null;
    valid: boolean;
    isAnomalous: boolean;
    status: string;
  }>;
  logs: Array<{
    id: string;
    eventType: string;
    severity: string;
    actionTaken: string;
    ip: string | null;
    createdAt: string;
    details: Record<string, unknown> | null;
  }>;
}

export interface SignalDiffItem {
  name: string;
  category: "identity" | "network" | "hardware" | "display" | "browser" | "hashes" | "academic";
  valA: string;
  valB: string;
  isMatch: boolean;
  isDifferent: boolean;
  entropyWeight: number;
  note?: string;
}

export interface SimilarityEdge {
  userAId: string;
  userBId: string;
  confidence: number;
  riskTier: "critical" | "high" | "medium" | "low";
  matchedSignals: string[];
  reasons: string[];
  falsePositiveRisk: "none" | "low" | "medium" | "high";
  falsePositiveNotes: string[];
  signalDiffs: SignalDiffItem[];
}

export interface Cluster {
  id: number;
  users: UserNode[];
  maxConfidence: number;
  primaryClassification:
    | "CONFIRMED_MULTI_ACCOUNT"
    | "PROBABLE_MULTI_ACCOUNT"
    | "SUSPICIOUS_HARDWARE_OVERLAP"
    | "SHARED_CAMPUS_NETWORK"
    | "INFORMATIONAL_OVERLAP";
  riskTier: "critical" | "high" | "medium" | "low";
  edges: SimilarityEdge[];
  warnings: string[];
}

export interface NetworkSummary {
  ip: string;
  userCount: number;
  isCampusOrNat: boolean;
  colleges: Record<string, number>;
  primaryCollege?: string;
}

async function runAnalysis() {
  console.log("🔍 Fetching database records for cheat & multi-account forensic analysis...");
  const db = getDb();

  const [allUsers, allDevices, allUserDevices, allAttempts, allLogs, allGames] = await Promise.all([
    db<User[]>`
      SELECT
        id, email, name, college, college_other AS "collegeOther", branch, batch,
        whatsapp_number AS "whatsappNumber", trust_score AS "trustScore", ban_level AS "banLevel",
        ban_until AS "banUntil", ban_reason AS "banReason", streak_count AS "streakCount",
        created_at AS "createdAt", last_login_at AS "lastLoginAt"
      FROM users
    `,
    db<Device[]>`
      SELECT
        id, device_hash AS "deviceHash", hardware_hash AS "hardwareHash", fp_visitor_id AS "fpVisitorId",
        canvas_hash AS "canvasHash", webgl_hash AS "webglHash", font_hash AS "fontHash",
        screen_hash AS "screenHash", audio_hash AS "audioHash", local_ip AS "localIp",
        last_ip AS "lastIp", first_ip AS "firstIp", platform, user_agent AS "userAgent",
        first_country AS "firstCountry", first_city AS "firstCity", last_country AS "lastCountry",
        last_city AS "lastCity", first_seen_at AS "firstSeenAt", last_seen_at AS "lastSeenAt",
        attempts_count AS "attemptsCount", fingerprint_json AS "fingerprintJson"
      FROM devices
    `,
    db<UserDevice[]>`
      SELECT id, user_id AS "userId", device_id AS "deviceId", first_used_at AS "firstUsedAt", last_used_at AS "lastUsedAt"
      FROM user_devices
    `,
    db<GameAttempt[]>`
      SELECT
        id, game_id AS "gameId", user_id AS "userId", device_id AS "deviceId",
        duration_ms AS "durationMs", score, started_at AS "startedAt", submitted_at AS "submittedAt",
        ip, server_valid AS "serverValid", is_anomalous AS "isAnomalous", status
      FROM game_attempts
    `,
    db<SuspiciousLog[]>`
      SELECT
        id, user_id AS "userId", device_id AS "deviceId", event_type AS "eventType",
        severity, action_taken AS "actionTaken", ip, created_at AS "createdAt",
        details_json AS "detailsJson"
      FROM suspicious_logs
    `,
    db<Game[]>`
      SELECT id, slug, title FROM games
    `,
  ]);

  console.log(
    `📊 Loaded ${allUsers.length} users, ${allDevices.length} devices, ${allAttempts.length} attempts, ${allLogs.length} logs.`,
  );

  const gameMap = new Map(allGames.map((g) => [g.id, { slug: g.slug, title: g.title }]));
  const deviceMap = new Map(allDevices.map((d) => [d.id, d]));

  // 1. IP & Network Density Mapping
  const ipUserMap = new Map<string, Set<string>>();
  const ipCollegeMap = new Map<string, Map<string, number>>();

  for (const a of allAttempts) {
    if (a.ip && a.userId) {
      if (!ipUserMap.has(a.ip)) ipUserMap.set(a.ip, new Set());
      ipUserMap.get(a.ip)!.add(a.userId);
    }
  }
  for (const d of allDevices) {
    const ip = d.lastIp;
    if (ip) {
      const uids = allUserDevices.filter((ud) => ud.deviceId === d.id).map((ud) => ud.userId);
      if (!ipUserMap.has(ip)) ipUserMap.set(ip, new Set());
      uids.forEach((uid) => ipUserMap.get(ip)!.add(uid));
    }
  }

  const userCollegeMap = new Map(
    allUsers.map((u) => [
      u.id,
      u.college === "mec"
        ? "Govt Model Engineering College (MEC)"
        : u.collegeOther || u.college || "other",
    ]),
  );

  for (const [ip, uids] of ipUserMap.entries()) {
    const colMap = new Map<string, number>();
    for (const uid of uids) {
      const col = userCollegeMap.get(uid) || "Unknown";
      colMap.set(col, (colMap.get(col) || 0) + 1);
    }
    ipCollegeMap.set(ip, colMap);
  }

  const networkDensity = new Map<string, NetworkSummary>();
  for (const [ip, uids] of ipUserMap.entries()) {
    const userCount = uids.size;
    const colMap = ipCollegeMap.get(ip) || new Map();
    const colsObj: Record<string, number> = {};
    let topCol = "";
    let topColCount = 0;
    for (const [c, count] of colMap.entries()) {
      colsObj[c] = count;
      if (count > topColCount) {
        topColCount = count;
        topCol = c;
      }
    }
    const isCampusOrNat = userCount >= 6;
    networkDensity.set(ip, {
      ip,
      userCount,
      isCampusOrNat,
      colleges: colsObj,
      primaryCollege: topColCount >= 2 ? topCol : undefined,
    });
  }

  // 2. Group devices, attempts, logs per user
  const userDeviceMap = new Map<string, string[]>();
  for (const ud of allUserDevices) {
    const list = userDeviceMap.get(ud.userId) || [];
    list.push(ud.deviceId);
    userDeviceMap.set(ud.userId, list);
  }

  const userAttemptsMap = new Map<string, UserNode["attempts"]>();
  for (const a of allAttempts) {
    const list = userAttemptsMap.get(a.userId) || [];
    const gInfo = gameMap.get(a.gameId) || { slug: "unknown", title: "Unknown Game" };
    list.push({
      id: a.id,
      gameId: a.gameId,
      gameSlug: gInfo.slug,
      gameTitle: gInfo.title,
      durationMs: a.durationMs,
      score: a.score,
      startedAt: a.startedAt ? a.startedAt.toISOString() : null,
      submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      ip: a.ip,
      valid: a.serverValid,
      isAnomalous: a.isAnomalous,
      status: a.status,
    });
    userAttemptsMap.set(a.userId, list);
  }

  const userLogsMap = new Map<string, UserNode["logs"]>();
  for (const log of allLogs) {
    if (log.userId) {
      const list = userLogsMap.get(log.userId) || [];
      list.push({
        id: log.id,
        eventType: log.eventType,
        severity: log.severity,
        actionTaken: log.actionTaken,
        ip: log.ip,
        createdAt: log.createdAt.toISOString(),
        details: log.detailsJson as Record<string, unknown> | null,
      });
      userLogsMap.set(log.userId, list);
    }
  }

  // 3. Build UserNode models with full telemetry
  const userNodes: UserNode[] = allUsers.map((u) => {
    const devIds = userDeviceMap.get(u.id) || [];
    const devRows = devIds
      .map((id) => deviceMap.get(id))
      .filter((d): d is (typeof allDevices)[0] => !!d)
      .map((d) => ({
        id: d.id,
        deviceHash: d.deviceHash,
        hardwareHash: d.hardwareHash,
        fpVisitorId: d.fpVisitorId,
        canvasHash: d.canvasHash,
        webglHash: d.webglHash,
        fontHash: d.fontHash,
        screenHash: d.screenHash,
        audioHash: d.audioHash,
        localIp: d.localIp,
        lastIp: d.lastIp,
        firstIp: d.firstIp,
        platform: d.platform,
        userAgent: d.userAgent,
        firstCountry: d.firstCountry,
        firstCity: d.firstCity,
        lastCountry: d.lastCountry,
        lastCity: d.lastCity,
        firstSeenAt: d.firstSeenAt ? d.firstSeenAt.toISOString() : new Date().toISOString(),
        lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : new Date().toISOString(),
        attemptsCount: d.attemptsCount || 0,
        fingerprint: (d.fingerprintJson as Partial<FingerprintSignals>) || null,
      }));

    return {
      id: u.id,
      name: u.name ?? "Anonymous Player",
      email: u.email,
      college: u.college ?? "other",
      collegeOther: u.collegeOther,
      branch: u.branch,
      batch: u.batch,
      phone: u.whatsappNumber,
      trustScore: u.trustScore,
      role: u.role ?? "player",
      banLevel: u.banLevel,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      devices: devRows,
      attempts: userAttemptsMap.get(u.id) || [],
      logs: userLogsMap.get(u.id) || [],
    };
  });

  // 4. Pairwise Forensic Comparison
  console.log("⚡ Executing multi-factor entropy correlation matrix...");
  const edges: SimilarityEdge[] = [];

  for (let i = 0; i < userNodes.length; i++) {
    for (let j = i + 1; j < userNodes.length; j++) {
      const uA = userNodes[i];
      const uB = userNodes[j];
      const edge = compareUserPair(uA, uB, networkDensity);
      if (edge) {
        edges.push(edge);
      }
    }
  }

  // 5. Connected Component Clustering
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

  // Form visible suspect cluster rings for any pairs >= 25%
  edges.filter((e) => e.confidence >= 25).forEach((e) => union(e.userAId, e.userBId));

  const clustersMap = new Map<string, { users: Set<UserNode>; edges: SimilarityEdge[] }>();
  const userById = new Map(userNodes.map((u) => [u.id, u]));

  for (const edge of edges) {
    if (edge.confidence < 25) continue;
    const root = find(edge.userAId);
    const c = clustersMap.get(root) || { users: new Set(), edges: [] };
    const uA = userById.get(edge.userAId);
    const uB = userById.get(edge.userBId);
    if (uA) c.users.add(uA);
    if (uB) c.users.add(uB);
    c.edges.push(edge);
    clustersMap.set(root, c);
  }

  const clusters: Cluster[] = [...clustersMap.values()]
    .map((c, idx) => {
      const sortedEdges = c.edges.sort((a, b) => b.confidence - a.confidence);
      const maxConfidence = sortedEdges[0]?.confidence ?? 0;

      let primaryClassification: Cluster["primaryClassification"] = "INFORMATIONAL_OVERLAP";
      const hasPhone = sortedEdges.some((e) => e.matchedSignals.includes("phone"));
      const hasDeviceHash = sortedEdges.some((e) => e.matchedSignals.includes("same_device"));
      const hasVisitor = sortedEdges.some((e) => e.matchedSignals.includes("fp_visitor"));
      const hasLanIp = sortedEdges.some((e) => e.matchedSignals.includes("local_ip_match"));
      const hasHardware = sortedEdges.some(
        (e) =>
          e.matchedSignals.includes("hardware_composite") ||
          e.matchedSignals.includes("hardware_composite_residential"),
      );
      const isCampusDominated = sortedEdges.every((e) => e.falsePositiveRisk === "high");

      if (hasPhone || hasDeviceHash) {
        primaryClassification = "CONFIRMED_MULTI_ACCOUNT";
      } else if (hasVisitor || hasLanIp || (hasHardware && maxConfidence >= 70)) {
        primaryClassification = "PROBABLE_MULTI_ACCOUNT";
      } else if (hasHardware || maxConfidence >= 50) {
        primaryClassification = "SUSPICIOUS_HARDWARE_OVERLAP";
      } else if (isCampusDominated) {
        primaryClassification = "SHARED_CAMPUS_NETWORK";
      }

      let riskTier: Cluster["riskTier"] = "low";
      if (maxConfidence >= 75) riskTier = "critical";
      else if (maxConfidence >= 55) riskTier = "high";
      else if (maxConfidence >= 35) riskTier = "medium";

      const warnings: string[] = [];
      if (sortedEdges.some((e) => e.falsePositiveRisk === "high")) {
        warnings.push("Shared campus/dormitory network or common phone model profile detected.");
      }

      return {
        id: idx + 1,
        users: [...c.users],
        maxConfidence,
        primaryClassification,
        riskTier,
        edges: sortedEdges,
        warnings,
      };
    })
    .sort((a, b) => b.maxConfidence - a.maxConfidence);

  console.log(`\n🚨 Identified ${clusters.length} suspicious multi-account / anomalous clusters:`);
  for (const c of clusters.slice(0, 15)) {
    console.log(
      `  [Cluster #${c.id} - ${c.primaryClassification}] Score: ${c.maxConfidence}% (${c.riskTier.toUpperCase()}) | Players: ${c.users.map((u) => u.email).join(", ")}`,
    );
  }

  // 6. Generate Self-Contained Interactive Forensic HTML Report
  const htmlPath = resolve(process.cwd(), "cheat-analysis-report.html");
  const htmlContent = generateInteractiveDashboard(clusters, userNodes, allLogs, networkDensity);
  writeFileSync(htmlPath, htmlContent, "utf-8");
  console.log(`\n✨ Forensic Interactive Dashboard written to: ${htmlPath}`);

  // 7. Explicit process termination
  console.log("🏁 Analysis complete. Exiting.");
  process.exit(0);
}

export function compareUserPair(
  uA: UserNode,
  uB: UserNode,
  networkDensity: Map<string, NetworkSummary>,
): SimilarityEdge | null {
  const matchedSignals: string[] = [];
  const reasons: string[] = [];
  const falsePositiveNotes: string[] = [];
  const baseDiffs: SignalDiffItem[] = [];

  let score = 0;
  let falsePositiveRisk: SimilarityEdge["falsePositiveRisk"] = "none";

  // 1. Phone Match
  const phoneMatch = !!(uA.phone && uB.phone && uA.phone === uB.phone);
  baseDiffs.push({
    name: "Phone Number",
    category: "identity",
    valA: uA.phone || "Not provided",
    valB: uB.phone || "Not provided",
    isMatch: phoneMatch,
    isDifferent: !phoneMatch && (!!uA.phone || !!uB.phone),
    entropyWeight: 100,
    note: phoneMatch ? "Exact WhatsApp / Phone Match" : undefined,
  });

  if (phoneMatch) {
    matchedSignals.push("phone");
    reasons.push(`Exact Phone Number Match: ${uA.phone}`);
    score = Math.max(score, 100);
  }

  // 2. Academic Affiliation
  const collegeA = uA.collegeOther || uA.college;
  const collegeB = uB.collegeOther || uB.college;
  const collegeMatch = collegeA.toLowerCase() === collegeB.toLowerCase();
  baseDiffs.push({
    name: "College / Institution",
    category: "academic",
    valA: collegeA,
    valB: collegeB,
    isMatch: collegeMatch,
    isDifferent: !collegeMatch,
    entropyWeight: 10,
  });

  if (uA.branch && uB.branch) {
    const branchMatch = uA.branch.toLowerCase() === uB.branch.toLowerCase();
    baseDiffs.push({
      name: "Branch / Dept",
      category: "academic",
      valA: uA.branch,
      valB: uB.branch,
      isMatch: branchMatch,
      isDifferent: !branchMatch,
      entropyWeight: 10,
    });
  }

  if (uA.batch && uB.batch) {
    const batchMatch = uA.batch === uB.batch;
    baseDiffs.push({
      name: "Graduation Batch",
      category: "academic",
      valA: uA.batch,
      valB: uB.batch,
      isMatch: batchMatch,
      isDifferent: !batchMatch,
      entropyWeight: 5,
    });
  }

  baseDiffs.push({
    name: "Account Trust Score",
    category: "identity",
    valA: `${uA.trustScore} / 100`,
    valB: `${uB.trustScore} / 100`,
    isMatch: uA.trustScore === uB.trustScore,
    isDifferent: uA.trustScore !== uB.trustScore,
    entropyWeight: 5,
  });

  // 3. Evaluate Best Device Pair
  let bestDeviceScore = 0;
  let bestDeviceDiffs: SignalDiffItem[] = [];

  for (const dA of uA.devices) {
    for (const dB of uB.devices) {
      const devSignals: string[] = [];
      const devReasons: string[] = [];
      const devFpNotes: string[] = [];
      const devDiffs: SignalDiffItem[] = [];

      const devScore = evaluateDevicePair(
        dA,
        dB,
        networkDensity,
        devSignals,
        devReasons,
        devFpNotes,
        devDiffs,
      );

      if (devScore > bestDeviceScore || bestDeviceDiffs.length === 0) {
        bestDeviceScore = devScore;
        bestDeviceDiffs = devDiffs;
        devSignals.forEach((s) => matchedSignals.push(s));
        devReasons.forEach((r) => reasons.push(r));
        devFpNotes.forEach((n) => falsePositiveNotes.push(n));
      }
    }
  }
  score = Math.max(score, bestDeviceScore);

  // 4. Temporal Gameplay Correlation
  let temporalBonus = 0;
  for (const attA of uA.attempts) {
    for (const attB of uB.attempts) {
      if (attA.gameId === attB.gameId && attA.submittedAt && attB.submittedAt) {
        const timeA = new Date(attA.submittedAt).getTime();
        const timeB = new Date(attB.submittedAt).getTime();
        const diffMin = Math.abs(timeA - timeB) / (60 * 1000);

        if (diffMin <= 20) {
          const sameIp = attA.ip && attB.ip && attA.ip === attB.ip;
          const ipNet = sameIp ? networkDensity.get(attA.ip!) : undefined;
          const isCampus = ipNet?.isCampusOrNat;

          if (sameIp && !isCampus) {
            temporalBonus = Math.max(temporalBonus, 20);
            matchedSignals.push("temporal_interleave_residential");
            reasons.push(
              `Played ${attA.gameTitle} within ${Math.round(diffMin)}m from shared residential IP (${attA.ip})`,
            );
          } else if (sameIp && isCampus) {
            temporalBonus = Math.max(temporalBonus, 10);
            matchedSignals.push("temporal_interleave_campus");
            reasons.push(
              `Played ${attA.gameTitle} within ${Math.round(diffMin)}m on shared campus Wi-Fi (${attA.ip})`,
            );
            falsePositiveNotes.push("Active at similar times on campus network.");
          } else if (bestDeviceScore >= 40) {
            temporalBonus = Math.max(temporalBonus, 15);
            matchedSignals.push("temporal_interleave_cross_network");
            reasons.push(
              `Played ${attA.gameTitle} within ${Math.round(diffMin)}m on matching device profile`,
            );
          }
        }
      }
    }
  }

  score = Math.min(100, score + temporalBonus);

  // Assess False Positive Risk Tier
  if (falsePositiveNotes.length > 0) {
    if (score < 50) falsePositiveRisk = "high";
    else if (score < 75) falsePositiveRisk = "medium";
    else falsePositiveRisk = "low";
  }

  const uniqueSignals = [...new Set(matchedSignals)];
  const uniqueReasons = [...new Set(reasons)];
  const uniqueFpNotes = [...new Set(falsePositiveNotes)];

  if (score < 25) return null;

  let riskTier: SimilarityEdge["riskTier"] = "low";
  if (score >= 75) riskTier = "critical";
  else if (score >= 55) riskTier = "high";
  else if (score >= 35) riskTier = "medium";

  const allDiffs = deduplicateDiffs([...baseDiffs, ...bestDeviceDiffs]);

  return {
    userAId: uA.id,
    userBId: uB.id,
    confidence: Math.round(score),
    riskTier,
    matchedSignals: uniqueSignals,
    reasons: uniqueReasons,
    falsePositiveRisk,
    falsePositiveNotes: uniqueFpNotes,
    signalDiffs: allDiffs,
  };
}

function evaluateDevicePair(
  dA: UserNode["devices"][0],
  dB: UserNode["devices"][0],
  networkDensity: Map<string, NetworkSummary>,
  matchedSignals: string[],
  reasons: string[],
  falsePositiveNotes: string[],
  diffs: SignalDiffItem[],
): number {
  let devScore = 0;
  const fpA = dA.fingerprint || {};
  const fpB = dB.fingerprint || {};

  // --- 1. IDENTITY & CRYPTOGRAPHIC HASHES ---
  const sameDeviceHash = dA.deviceHash === dB.deviceHash;
  diffs.push({
    name: "Persistent Device Storage ID",
    category: "hashes",
    valA: dA.deviceHash ? `${dA.deviceHash.slice(0, 20)}...` : "None",
    valB: dB.deviceHash ? `${dB.deviceHash.slice(0, 20)}...` : "None",
    isMatch: sameDeviceHash,
    isDifferent: !sameDeviceHash,
    entropyWeight: 100,
    note: sameDeviceHash
      ? "Exact shared browser storage (multi-store cookie/localStorage)"
      : undefined,
  });

  if (sameDeviceHash) {
    matchedSignals.push("same_device");
    reasons.push("Exact shared persistent device hash (same browser storage)");
    return 100;
  }

  const sameVisitor = !!(dA.fpVisitorId && dB.fpVisitorId && dA.fpVisitorId === dB.fpVisitorId);
  diffs.push({
    name: "FingerprintJS Visitor ID",
    category: "hashes",
    valA: dA.fpVisitorId || "None",
    valB: dB.fpVisitorId || "None",
    isMatch: sameVisitor,
    isDifferent: !sameVisitor && (!!dA.fpVisitorId || !!dB.fpVisitorId),
    entropyWeight: 85,
    note: sameVisitor ? "Survives storage clear / private browsing" : undefined,
  });

  if (sameVisitor) {
    matchedSignals.push("fp_visitor");
    reasons.push(`Identical FingerprintJS Visitor ID (${dA.fpVisitorId})`);
    devScore = Math.max(devScore, 85);
  }

  const sameHardwareHash = !!(
    dA.hardwareHash &&
    dB.hardwareHash &&
    dA.hardwareHash === dB.hardwareHash
  );
  diffs.push({
    name: "Composite Hardware Hash",
    category: "hashes",
    valA: dA.hardwareHash ? `${dA.hardwareHash.slice(0, 20)}...` : "None",
    valB: dB.hardwareHash ? `${dB.hardwareHash.slice(0, 20)}...` : "None",
    isMatch: sameHardwareHash,
    isDifferent: !sameHardwareHash && (!!dA.hardwareHash || !!dB.hardwareHash),
    entropyWeight: 70,
  });

  const sameCanvas = !!(dA.canvasHash && dB.canvasHash && dA.canvasHash === dB.canvasHash);
  diffs.push({
    name: "Canvas 2D Hash",
    category: "hashes",
    valA: dA.canvasHash ? `${dA.canvasHash.slice(0, 16)}...` : "None",
    valB: dB.canvasHash ? `${dB.canvasHash.slice(0, 16)}...` : "None",
    isMatch: sameCanvas,
    isDifferent: !sameCanvas && (!!dA.canvasHash || !!dB.canvasHash),
    entropyWeight: 45,
  });

  const sameAudio = !!(dA.audioHash && dB.audioHash && dA.audioHash === dB.audioHash);
  diffs.push({
    name: "Audio Context Frequency Hash",
    category: "hashes",
    valA: dA.audioHash ? `${dA.audioHash.slice(0, 16)}...` : "None",
    valB: dB.audioHash ? `${dB.audioHash.slice(0, 16)}...` : "None",
    isMatch: sameAudio,
    isDifferent: !sameAudio && (!!dA.audioHash || !!dB.audioHash),
    entropyWeight: 40,
  });

  // --- 2. NETWORK & GEO-LOCATION ---
  const samePublicIp = !!(dA.lastIp && dB.lastIp && dA.lastIp === dB.lastIp);
  const sameLocalIp = !!(dA.localIp && dB.localIp && dA.localIp === dB.localIp);
  const ipNet = dA.lastIp ? networkDensity.get(dA.lastIp) : undefined;
  const isCampus = ipNet?.isCampusOrNat ?? false;

  diffs.push({
    name: "Public IP Address (Last Seen)",
    category: "network",
    valA: dA.lastIp || "None",
    valB: dB.lastIp || "None",
    isMatch: samePublicIp,
    isDifferent: !samePublicIp && (!!dA.lastIp || !!dB.lastIp),
    entropyWeight: isCampus ? 10 : 30,
    note: isCampus
      ? `Shared Campus Network (${ipNet?.userCount} users)`
      : "Residential / Single Network",
  });

  diffs.push({
    name: "Public IP Address (First Seen)",
    category: "network",
    valA: dA.firstIp || "None",
    valB: dB.firstIp || "None",
    isMatch: !!(dA.firstIp && dB.firstIp && dA.firstIp === dB.firstIp),
    isDifferent: !dA.firstIp || !dB.firstIp || dA.firstIp !== dB.firstIp,
    entropyWeight: 20,
  });

  const geoA =
    [dA.lastCity, dA.lastCountry].filter(Boolean).join(", ") ||
    (dA.lastCountry
      ? `${dA.lastCountry === "IN" ? "India (IN)" : dA.lastCountry}${fpA.timezone ? " · " + fpA.timezone : ""}`
      : "Unknown");
  const geoB =
    [dB.lastCity, dB.lastCountry].filter(Boolean).join(", ") ||
    (dB.lastCountry
      ? `${dB.lastCountry === "IN" ? "India (IN)" : dB.lastCountry}${fpB.timezone ? " · " + fpB.timezone : ""}`
      : "Unknown");
  const sameGeo = geoA !== "Unknown" && geoB !== "Unknown" && geoA === geoB;
  diffs.push({
    name: "Cloudflare Geo Location",
    category: "network",
    valA: geoA,
    valB: geoB,
    isMatch: sameGeo,
    isDifferent: !sameGeo && geoA !== "Unknown" && geoB !== "Unknown",
    entropyWeight: 15,
    note: "Edge IP geo from Cloudflare (CF-IPCountry). City headers require Cloudflare Managed Transforms enabled.",
  });

  diffs.push({
    name: "WebRTC Local LAN IP",
    category: "network",
    valA: dA.localIp || "mDNS / Hidden",
    valB: dB.localIp || "mDNS / Hidden",
    isMatch: sameLocalIp,
    isDifferent: !sameLocalIp && (!!dA.localIp || !!dB.localIp),
    entropyWeight: 60,
    note: sameLocalIp ? "Identical private LAN IP" : undefined,
  });

  if (samePublicIp && sameLocalIp && dA.localIp) {
    matchedSignals.push("local_ip_match");
    reasons.push(`Identical Public IP (${dA.lastIp}) AND WebRTC Local LAN IP (${dA.localIp})`);
    devScore = Math.max(devScore, 90);
  } else if (samePublicIp) {
    if (isCampus) {
      matchedSignals.push("shared_campus_ip");
      reasons.push(`Shared Campus Gateway IP (${dA.lastIp}) with ${ipNet?.userCount} total users`);
      falsePositiveNotes.push(`Campus Wi-Fi match with ${ipNet?.userCount} students.`);
      devScore = Math.max(devScore, 35);
    } else {
      matchedSignals.push("shared_residential_ip");
      reasons.push(`Exact Shared Public IP (${dA.lastIp})`);
      devScore = Math.max(devScore, 60);
    }
  }

  // --- 3. HARDWARE & DEVICE SPECS ---
  const sameModel = !!(fpA.uaModel && fpB.uaModel && fpA.uaModel === fpB.uaModel);
  diffs.push({
    name: "Device Hardware Model (Client Hint)",
    category: "hardware",
    valA: fpA.uaModel || "Not reported",
    valB: fpB.uaModel || "Not reported",
    isMatch: sameModel,
    isDifferent: !sameModel && (!!fpA.uaModel || !!fpB.uaModel),
    entropyWeight: 50,
  });

  const samePlatform = !!(dA.platform && dB.platform && dA.platform === dB.platform);
  diffs.push({
    name: "Operating Platform",
    category: "hardware",
    valA: dA.platform || "Unknown",
    valB: dB.platform || "Unknown",
    isMatch: samePlatform,
    isDifferent: !samePlatform && (!!dA.platform || !!dB.platform),
    entropyWeight: 20,
  });

  const sameCores = !!(
    fpA.hardwareConcurrency &&
    fpB.hardwareConcurrency &&
    fpA.hardwareConcurrency === fpB.hardwareConcurrency
  );
  diffs.push({
    name: "CPU Cores (Concurrency)",
    category: "hardware",
    valA: fpA.hardwareConcurrency ? `${fpA.hardwareConcurrency} Cores` : "Unknown",
    valB: fpB.hardwareConcurrency ? `${fpB.hardwareConcurrency} Cores` : "Unknown",
    isMatch: sameCores,
    isDifferent: !sameCores && (!!fpA.hardwareConcurrency || !!fpB.hardwareConcurrency),
    entropyWeight: 15,
  });

  const sameMemory = !!(
    fpA.deviceMemory &&
    fpB.deviceMemory &&
    fpA.deviceMemory === fpB.deviceMemory
  );
  diffs.push({
    name: "Device Memory (RAM)",
    category: "hardware",
    valA: fpA.deviceMemory ? `${fpA.deviceMemory} GB` : "Not reported",
    valB: fpB.deviceMemory ? `${fpB.deviceMemory} GB` : "Not reported",
    isMatch: sameMemory,
    isDifferent: !sameMemory && (!!fpA.deviceMemory || !!fpB.deviceMemory),
    entropyWeight: 15,
  });

  const sameTouch = fpA.maxTouchPoints === fpB.maxTouchPoints;
  diffs.push({
    name: "Touch Support Points",
    category: "hardware",
    valA: fpA.maxTouchPoints !== undefined ? `${fpA.maxTouchPoints} Touch Points` : "Unknown",
    valB: fpB.maxTouchPoints !== undefined ? `${fpB.maxTouchPoints} Touch Points` : "Unknown",
    isMatch: sameTouch,
    isDifferent: !sameTouch,
    entropyWeight: 10,
  });

  const sameTz = !!(fpA.timezone && fpB.timezone && fpA.timezone === fpB.timezone);
  diffs.push({
    name: "System Timezone & Offset",
    category: "hardware",
    valA: fpA.timezone ? `${fpA.timezone} (${fpA.timezoneOffset}m)` : "Unknown",
    valB: fpB.timezone ? `${fpB.timezone} (${fpB.timezoneOffset}m)` : "Unknown",
    isMatch: sameTz,
    isDifferent: !sameTz && (!!fpA.timezone || !!fpB.timezone),
    entropyWeight: 10,
  });

  // --- 4. DISPLAY & GRAPHICS ---
  const sameWebgl = !!(dA.webglHash && dB.webglHash && dA.webglHash === dB.webglHash);
  diffs.push({
    name: "WebGL GPU Renderer",
    category: "display",
    valA: fpA.webglRenderer || fpA.webgl || "Standard GPU",
    valB: fpB.webglRenderer || fpB.webgl || "Standard GPU",
    isMatch: sameWebgl,
    isDifferent: !sameWebgl,
    entropyWeight: 50,
  });

  const sameScreen = !!(dA.screenHash && dB.screenHash && dA.screenHash === dB.screenHash);
  diffs.push({
    name: "Display Specs (Resolution & DPR)",
    category: "display",
    valA: fpA.screen || "Unknown",
    valB: fpB.screen || "Unknown",
    isMatch: sameScreen,
    isDifferent: !sameScreen,
    entropyWeight: 25,
  });

  const sameGamut = !!(fpA.colorGamut && fpB.colorGamut && fpA.colorGamut === fpB.colorGamut);
  diffs.push({
    name: "Color Gamut & HDR",
    category: "display",
    valA: fpA.colorGamut ? `${fpA.colorGamut} ${fpA.hdrSupport ? "(HDR)" : ""}` : "sRGB",
    valB: fpB.colorGamut ? `${fpB.colorGamut} ${fpB.hdrSupport ? "(HDR)" : ""}` : "sRGB",
    isMatch: sameGamut,
    isDifferent: !sameGamut && (!!fpA.colorGamut || !!fpB.colorGamut),
    entropyWeight: 10,
  });

  // --- 5. BROWSER ENVIRONMENT ---
  const sameUa = !!(dA.userAgent && dB.userAgent && dA.userAgent === dB.userAgent);
  diffs.push({
    name: "Browser User Agent",
    category: "browser",
    valA: dA.userAgent || "Unknown",
    valB: dB.userAgent || "Unknown",
    isMatch: sameUa,
    isDifferent: !sameUa && (!!dA.userAgent || !!dB.userAgent),
    entropyWeight: 20,
  });

  const sameLang = !!(fpA.languages && fpB.languages && fpA.languages === fpB.languages);
  diffs.push({
    name: "Browser Languages",
    category: "browser",
    valA: fpA.languages || fpA.language || "Unknown",
    valB: fpB.languages || fpB.language || "Unknown",
    isMatch: sameLang,
    isDifferent: !sameLang && (!!fpA.languages || !!fpB.languages),
    entropyWeight: 10,
  });

  // --- 6. TIMESTAMPS & ACTIVITY ---
  diffs.push({
    name: "First Seen Activity",
    category: "identity",
    valA: dA.firstSeenAt ? new Date(dA.firstSeenAt).toLocaleString("en-IN") : "Unknown",
    valB: dB.firstSeenAt ? new Date(dB.firstSeenAt).toLocaleString("en-IN") : "Unknown",
    isMatch: false,
    isDifferent: false,
    entropyWeight: 0,
  });

  diffs.push({
    name: "Total Attempts on Device",
    category: "identity",
    valA: `${dA.attemptsCount || 0} attempts`,
    valB: `${dB.attemptsCount || 0} attempts`,
    isMatch: false,
    isDifferent: false,
    entropyWeight: 0,
  });

  // Combined IP + Platform / Hardware Scoring
  if (samePublicIp && (sameModel || samePlatform)) {
    devScore = Math.max(devScore, isCampus ? 55 : 75);
    matchedSignals.push("shared_ip_same_platform");
    reasons.push(
      `Shared IP (${dA.lastIp}) with matching OS / platform (${dA.platform || "same platform"})`,
    );
  }

  // Calibrated Hardware Scoring
  if (sameHardwareHash || (sameCanvas && sameAudio && sameWebgl)) {
    if (sameLocalIp && dA.localIp) {
      matchedSignals.push("hardware_composite_lan");
      reasons.push("Matching Hardware Signature AND WebRTC Private LAN IP");
      devScore = Math.max(devScore, 90);
    } else if (samePublicIp && !isCampus) {
      matchedSignals.push("hardware_composite_residential");
      reasons.push("Matching Composite Hardware on Shared Residential IP");
      devScore = Math.max(devScore, 85);
    } else if (sameVisitor) {
      matchedSignals.push("hardware_composite_visitor");
      devScore = Math.max(devScore, 85);
    } else if (samePublicIp && isCampus) {
      matchedSignals.push("hardware_composite_campus");
      reasons.push("Matching Hardware Profile on Campus Wi-Fi");
      falsePositiveNotes.push("Common hardware model on campus Wi-Fi.");
      devScore = Math.max(devScore, 65);
    } else {
      matchedSignals.push("hardware_profile_match");
      reasons.push("Matching Hardware GPU/Canvas/Audio Profile (Different Networks)");
      falsePositiveNotes.push("Possible same device on mobile vs Wi-Fi, or common phone model.");
      devScore = Math.max(devScore, 40);
    }
  }

  return devScore;
}

function deduplicateDiffs(diffs: SignalDiffItem[]): SignalDiffItem[] {
  const seen = new Set<string>();
  const out: SignalDiffItem[] = [];
  for (const d of diffs) {
    if (!seen.has(d.name)) {
      seen.add(d.name);
      out.push(d);
    }
  }
  return out;
}

export function generateInteractiveDashboard(
  clusters: Cluster[],
  allUsers: UserNode[],
  allLogs: SuspiciousLog[],
  networkDensity: Map<string, NetworkSummary>,
): string {
  const generatedTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const criticalCount = clusters.filter((c) => c.riskTier === "critical").length;
  const highCount = clusters.filter((c) => c.riskTier === "high").length;
  const mediumCount = clusters.filter((c) => c.riskTier === "medium").length;
  const campusCount = [...networkDensity.values()].filter((n) => n.isCampusOrNat).length;

  const embeddedData = JSON.stringify({
    generatedTime,
    totalPlayers: allUsers.length,
    clusters,
    allUsers,
    networks: [...networkDensity.values()],
  });

  return `<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-950 text-slate-100">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FOSS Onam 🌸 Anti-Cheat Forensic Intelligence & Telemetry Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    code, .font-mono { font-family: 'JetBrains Mono', monospace; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0f172a; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #475569; }
    .tab-btn.active { background-color: rgb(245 158 11 / 0.15); color: rgb(251 191 36); border-color: rgb(245 158 11 / 0.4); }
  </style>
</head>
<body class="h-full flex flex-col antialiased selection:bg-amber-500 selection:text-black">
  <!-- Header -->
  <header class="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-6 py-4">
    <div class="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">
          🌸
        </div>
        <div>
          <h1 class="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            FOSS Onam Anti-Cheat Intelligence
            <span class="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">Forensic Studio</span>
          </h1>
          <p class="text-xs text-slate-400">Pairwise 1v1 Scores · Deep Telemetry · Generated ${generatedTime}</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2">
        <div class="inline-flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
          <button onclick="switchTab('clusters')" id="tabBtn-clusters" class="tab-btn active px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5">
            <span>🚨 Suspect Rings</span>
            <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[10px]">${clusters.length}</span>
          </button>
          <button onclick="switchTab('comparator')" id="tabBtn-comparator" class="tab-btn px-3.5 py-1.5 rounded-lg font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5">
            <span>🔬 Compare Any 2 Players</span>
          </button>
          <button onclick="switchTab('directory')" id="tabBtn-directory" class="tab-btn px-3.5 py-1.5 rounded-lg font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5">
            <span>👥 All Players (${allUsers.length})</span>
          </button>
        </div>

        <button onclick="exportReportJson()" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export JSON
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content Area -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
    <!-- Metric Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Players</div>
        <div class="text-2xl font-bold text-white mt-1">${allUsers.length}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">Active participants</div>
      </div>
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-400">Suspect Leads</div>
        <div class="text-2xl font-bold text-amber-400 mt-1">${clusters.length}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">Grouped clusters</div>
      </div>
      <div class="bg-slate-900/60 border border-red-500/30 bg-red-500/5 rounded-xl p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-red-400">Critical Multi-Accounts</div>
        <div class="text-2xl font-bold text-red-500 mt-1">${criticalCount}</div>
        <div class="text-[11px] text-red-400/80 mt-0.5">≥75% confidence</div>
      </div>
      <div class="bg-slate-900/60 border border-orange-500/30 bg-orange-500/5 rounded-xl p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-orange-400">High / Medium Leads</div>
        <div class="text-2xl font-bold text-orange-400 mt-1">${highCount + mediumCount}</div>
        <div class="text-[11px] text-orange-400/80 mt-0.5">Hardware / network leads</div>
      </div>
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-400">Campus Networks</div>
        <div class="text-2xl font-bold text-cyan-400 mt-1">${campusCount}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">Identified subnets</div>
      </div>
    </div>

    <!-- TAB 1: CLUSTERS VIEW -->
    <div id="tabContent-clusters" class="space-y-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <input type="text" id="searchInput" placeholder="Search clusters by name, email, phone, IP, city, or college..." 
                 class="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition">
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="inline-flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button onclick="setFilter('severity', 'all')" class="filter-btn-sev active px-3 py-1 rounded-lg font-medium transition" data-val="all">All</button>
            <button onclick="setFilter('severity', 'critical')" class="filter-btn-sev px-3 py-1 rounded-lg font-medium text-red-400 hover:text-white transition" data-val="critical">Critical</button>
            <button onclick="setFilter('severity', 'high')" class="filter-btn-sev px-3 py-1 rounded-lg font-medium text-orange-400 hover:text-white transition" data-val="high">High</button>
            <button onclick="setFilter('severity', 'medium')" class="filter-btn-sev px-3 py-1 rounded-lg font-medium text-amber-400 hover:text-white transition" data-val="medium">Medium</button>
          </div>

          <select id="signalFilter" onchange="setFilter('signal', this.value)" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-500">
            <option value="all">All Signal Types</option>
            <option value="phone">Exact Phone Match</option>
            <option value="same_device">Exact Device Hash</option>
            <option value="fp_visitor">FingerprintJS Visitor</option>
            <option value="local_ip_match">WebRTC LAN IP</option>
            <option value="hardware_profile_match">Hardware Profile</option>
            <option value="shared_campus_ip">Shared Campus Wi-Fi</option>
          </select>

          <select id="sortBy" onchange="setFilter('sort', this.value)" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-500">
            <option value="score_desc">Highest Risk First</option>
            <option value="accounts_desc">Most Accounts First</option>
            <option value="id_asc">Cluster ID</option>
          </select>
        </div>
      </div>

      <div id="clusterList" class="space-y-4"></div>
    </div>

    <!-- TAB 2: MANUAL ANY-PLAYER COMPARATOR -->
    <div id="tabContent-comparator" class="hidden space-y-6">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div>
          <h2 class="text-lg font-extrabold text-white flex items-center gap-2">
            🔬 Live Side-by-Side Player Telemetry Comparator
          </h2>
          <p class="text-xs text-slate-400 mt-1">Search & select ANY two players to perform a full 1-on-1 telemetry diff across Location, Platform, Hardware, GPU, Browser, and Cryptographic Hashes.</p>
        </div>

        <!-- Searchable Player Selectors -->
        <div class="grid md:grid-cols-2 gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800 relative">
          <!-- Player A Searchable Combobox -->
          <div class="relative space-y-2">
            <label class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
              <span>Player A</span>
              <span id="playerABadge" class="text-[10px] font-mono text-slate-400 font-normal">Selected</span>
            </label>
            <input type="text" id="comboboxInputA" oninput="filterCombobox('A')" onfocus="showComboboxList('A')" placeholder="🔍 Type name, email, phone, or IP to search Player A..." 
                   class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-sans">
            <div id="comboboxListA" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto divide-y divide-slate-800"></div>
          </div>

          <!-- Player B Searchable Combobox -->
          <div class="relative space-y-2">
            <label class="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
              <span>Player B</span>
              <span id="playerBBadge" class="text-[10px] font-mono text-slate-400 font-normal">Selected</span>
            </label>
            <input type="text" id="comboboxInputB" oninput="filterCombobox('B')" onfocus="showComboboxList('B')" placeholder="🔍 Type name, email, phone, or IP to search Player B..." 
                   class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-500 font-sans">
            <div id="comboboxListB" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto divide-y divide-slate-800"></div>
          </div>
        </div>

        <div id="manualComparisonResult" class="space-y-6"></div>
      </div>
    </div>

    <!-- TAB 3: PLAYER DIRECTORY -->
    <div id="tabContent-directory" class="hidden space-y-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div class="relative flex-1 max-w-lg">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <input type="text" id="dirSearchInput" oninput="renderDirectory()" placeholder="Search directory by name, email, college, branch, phone, IP, location..." 
                 class="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none">
        </div>
        <span class="text-xs text-slate-400 font-mono" id="dirTotalCount">Showing all players</span>
      </div>

      <div class="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold">
              <th class="p-3.5">Player Name & Email</th>
              <th class="p-3.5">College & Dept</th>
              <th class="p-3.5">Location & Phone</th>
              <th class="p-3.5">Hardware & IP</th>
              <th class="p-3.5 text-center">Trust</th>
              <th class="p-3.5 text-center">Attempts</th>
              <th class="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="directoryTableBody" class="divide-y divide-slate-800/60 font-mono"></tbody>
        </table>
      </div>
    </div>
  </main>

  <!-- Deep Dive Side-by-Side Modal / Drawer -->
  <div id="detailModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center p-4 md:p-6 overflow-y-auto">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
      <div class="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
        <div class="flex items-center gap-3">
          <div id="modalSeverityBadge" class="px-2.5 py-1 text-xs font-bold rounded-md bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider">
            CRITICAL RISK
          </div>
          <div>
            <h3 class="text-lg font-bold text-white flex items-center gap-2" id="modalTitle">
              Cluster Inspector #1
            </h3>
            <p class="text-xs text-slate-400" id="modalSubtitle">Forensic Signal Comparison & Attempt Trace</p>
          </div>
        </div>
        <button onclick="closeModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
          ✕
        </button>
      </div>

      <div class="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex-1 w-full">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Account A</label>
            <select id="selectAccountA" onchange="renderModalDiff()" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"></select>
          </div>
          <div class="text-slate-600 font-bold hidden md:block">VS</div>
          <div class="flex-1 w-full">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Account B</label>
            <select id="selectAccountB" onchange="renderModalDiff()" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"></select>
          </div>
        </div>

        <div id="modalEvidenceBox" class="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2"></div>

        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>🔬 Complete Telemetry Comparison Matrix</span>
            </h4>
            <div class="flex items-center gap-2">
              <button onclick="toggleRawJson()" id="rawJsonBtn" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700 transition">
                { } View Raw Telemetry JSON
              </button>
              <span class="text-[11px] text-slate-500 font-normal">🟢 Match · 🔴 Diff · ⚪ Missing</span>
            </div>
          </div>

          <div id="rawJsonViewerContainer" class="hidden grid md:grid-cols-2 gap-3 mb-4 font-mono text-[11px]">
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-72 overflow-y-auto">
              <div class="text-amber-400 font-bold mb-1 pb-1 border-b border-slate-900" id="rawJsonTitleA">Account A Raw Telemetry</div>
              <pre id="rawJsonContentA" class="text-slate-300"></pre>
            </div>
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-72 overflow-y-auto">
              <div class="text-amber-400 font-bold mb-1 pb-1 border-b border-slate-900" id="rawJsonTitleB">Account B Raw Telemetry</div>
              <pre id="rawJsonContentB" class="text-slate-300"></pre>
            </div>
          </div>

          <div class="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                  <th class="p-3 w-1/4">Telemetry Attribute</th>
                  <th class="p-3 w-1/3">Account A Value</th>
                  <th class="p-3 w-1/3">Account B Value</th>
                  <th class="p-3 w-16 text-center">Status</th>
                </tr>
              </thead>
              <tbody id="signalDiffTableBody" class="divide-y divide-slate-800/60 font-mono"></tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">🎮 Game Attempts & Submission Chronology</h4>
          <div id="modalAttemptsTimeline" class="space-y-2 max-h-64 overflow-y-auto pr-1"></div>
        </div>

        <div id="modalLogsSection">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">🛡️ Anti-Cheat Security Audit Logs</h4>
          <div id="modalLogsContainer" class="space-y-2 max-h-52 overflow-y-auto pr-1"></div>
        </div>
      </div>

      <div class="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div class="text-slate-400 flex items-center gap-2">
          <span>Recommendation:</span>
          <span id="modalRecommendationBadge" class="font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">FLAG FOR REVIEW</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="copyAccountIds()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition">
            Copy User IDs
          </button>
          <button onclick="closeModal()" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition">
            Done
          </button>
        </div>
      </div>
    </div>
  </div>

  <script id="analysis-data" type="application/json">
    ${embeddedData.replace(/</g, "\\u003c")}
  </script>

  <script>
    const reportData = JSON.parse(document.getElementById('analysis-data').textContent);
    let activeFilters = { search: '', severity: 'all', signal: 'all', sort: 'score_desc' };
    let currentActiveCluster = null;
    let showingRawJson = false;
    let selectedPlayerAId = reportData.allUsers[0]?.id || '';
    let selectedPlayerBId = reportData.allUsers[1]?.id || reportData.allUsers[0]?.id || '';

    function init() {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          activeFilters.search = e.target.value.toLowerCase().trim();
          renderClusters();
        });
      }

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#comboboxInputA') && !e.target.closest('#comboboxListA')) {
          document.getElementById('comboboxListA')?.classList.add('hidden');
        }
        if (!e.target.closest('#comboboxInputB') && !e.target.closest('#comboboxListB')) {
          document.getElementById('comboboxListB')?.classList.add('hidden');
        }
      });

      updateComboboxDisplay();
      renderClusters();
      renderDirectory();
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active', 'text-amber-400'));
      document.querySelectorAll('[id^="tabContent-"]').forEach(el => el.classList.add('hidden'));

      document.getElementById('tabBtn-' + tabId).classList.add('active');
      document.getElementById('tabContent-' + tabId).classList.remove('hidden');

      if (tabId === 'comparator') {
        runManualComparison();
      }
    }

    function setFilter(type, value) {
      activeFilters[type] = value;
      if (type === 'severity') {
        document.querySelectorAll('.filter-btn-sev').forEach(btn => {
          if (btn.getAttribute('data-val') === value) {
            btn.classList.add('active', 'bg-slate-800', 'text-white');
          } else {
            btn.classList.remove('active', 'bg-slate-800', 'text-white');
          }
        });
      }
      renderClusters();
    }

    function renderClusters() {
      const container = document.getElementById('clusterList');
      let filtered = [...reportData.clusters];

      if (activeFilters.severity !== 'all') {
        filtered = filtered.filter(c => c.riskTier === activeFilters.severity);
      }

      if (activeFilters.signal !== 'all') {
        filtered = filtered.filter(c => c.edges.some(e => e.matchedSignals.includes(activeFilters.signal)));
      }

      if (activeFilters.search) {
        const term = activeFilters.search;
        filtered = filtered.filter(c => {
          const matchUser = c.users.some(u => 
            u.name.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            (u.phone && u.phone.includes(term)) ||
            (u.college && u.college.toLowerCase().includes(term)) ||
            (u.collegeOther && u.collegeOther.toLowerCase().includes(term)) ||
            u.devices.some(d => 
              (d.lastIp && d.lastIp.includes(term)) || 
              (d.localIp && d.localIp.includes(term)) || 
              (d.lastCity && d.lastCity.toLowerCase().includes(term)) ||
              (d.lastCountry && d.lastCountry.toLowerCase().includes(term)) ||
              d.deviceHash.includes(term) ||
              (d.userAgent && d.userAgent.toLowerCase().includes(term))
            )
          );
          const matchId = ('cluster #' + c.id).includes(term) || String(c.id) === term;
          return matchUser || matchId;
        });
      }

      if (activeFilters.sort === 'score_desc') {
        filtered.sort((a, b) => b.maxConfidence - a.maxConfidence);
      } else if (activeFilters.sort === 'accounts_desc') {
        filtered.sort((a, b) => b.users.length - a.users.length);
      } else if (activeFilters.sort === 'id_asc') {
        filtered.sort((a, b) => a.id - b.id);
      }

      if (filtered.length === 0) {
        container.innerHTML = \`
          <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
            <div class="text-3xl mb-2">🔍</div>
            <div class="text-base font-bold text-slate-300">No matching suspect rings found</div>
            <div class="text-xs text-slate-500 mt-1">Try relaxing filters or use the <strong>Compare Any 2 Players</strong> tab to inspect specific accounts.</div>
          </div>
        \`;
        return;
      }

      container.innerHTML = filtered.map(c => renderClusterCard(c)).join('');
    }

    function renderClusterCard(cluster) {
      let sevBg = "border-slate-800 bg-slate-900/60";
      let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";
      let scoreColor = "text-slate-200";

      if (cluster.riskTier === "critical") {
        sevBg = "border-red-500/40 bg-red-950/10 hover:border-red-500/60";
        badgeClass = "bg-red-500/20 text-red-400 border-red-500/30";
        scoreColor = "text-red-400";
      } else if (cluster.riskTier === "high") {
        sevBg = "border-orange-500/40 bg-orange-950/10 hover:border-orange-500/60";
        badgeClass = "bg-orange-500/20 text-orange-400 border-orange-500/30";
        scoreColor = "text-orange-400";
      } else if (cluster.riskTier === "medium") {
        sevBg = "border-amber-500/40 bg-amber-950/10 hover:border-amber-500/60";
        badgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";
        scoreColor = "text-amber-400";
      }

      const usersHtml = cluster.users.map(u => {
        const d = u.devices[0] || {};
        const fp = d.fingerprint || {};
        const loc = [d.lastCity, d.lastCountry].filter(Boolean).join(', ') || (d.lastCountry ? (d.lastCountry === 'IN' ? 'India (IN)' : d.lastCountry) : 'Unknown Geo');
        return \`
          <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-white text-sm truncate">\${escapeHtml(u.name)}</span>
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">Trust: \${u.trustScore}</span>
              </div>
              <div class="text-xs text-slate-400 truncate mt-0.5 font-mono">\${escapeHtml(u.email)}</div>
              <div class="text-xs text-slate-500 mt-2 line-clamp-1">
                🏛️ \${escapeHtml(u.college === "mec" ? "Govt Model Engineering College (MEC)" : u.collegeOther || u.college)}
              </div>
              <div class="text-[11px] text-cyan-400/90 mt-1 font-mono flex items-center gap-1">
                📍 \${escapeHtml(loc)} \${d.lastIp ? \`(\${d.lastIp})\` : ''}
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-900 text-[11px] font-mono text-slate-400 flex-wrap">
              <span>\${u.devices.length} dev</span> ·
              <span>\${u.attempts.length} games</span>
              \${u.phone ? \` · <span>📞 \${escapeHtml(u.phone)}</span>\` : ''}
              \${u.logs.length > 0 ? \`<span class="px-1 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30 ml-auto">\${u.logs.length} alerts</span>\` : ''}
            </div>
          </div>
        \`;
      }).join('');

      // Render Distinct 1-on-1 Pairwise Breakdown Cards
      const pairwiseLinksHtml = cluster.edges.map(e => {
        const uA = cluster.users.find(u => u.id === e.userAId) || reportData.allUsers.find(u => u.id === e.userAId);
        const uB = cluster.users.find(u => u.id === e.userBId) || reportData.allUsers.find(u => u.id === e.userBId);
        if (!uA || !uB) return '';

        let pairScoreColor = e.confidence >= 75 ? 'text-red-400' : e.confidence >= 55 ? 'text-orange-400' : e.confidence >= 35 ? 'text-amber-400' : 'text-slate-300';
        let pairBadgeColor = e.confidence >= 75 ? 'bg-red-500/20 text-red-400 border-red-500/30' : e.confidence >= 55 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

        const signalsBadges = e.matchedSignals.map(s => \`
          <span class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
            \${formatSignalName(s)}
          </span>
        \`).join('');

        return \`
          <div class="bg-slate-950 border border-slate-800/90 rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:border-slate-700 transition">
            <div class="space-y-1.5 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-white text-xs font-sans">\${escapeHtml(uA.name)}</span>
                <span class="text-slate-500 font-mono text-xs">⚡ 1v1 ⚡</span>
                <span class="font-bold text-white text-xs font-sans">\${escapeHtml(uB.name)}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase border \${pairBadgeColor}">
                  \${e.confidence}% 1v1 MATCH
                </span>
              </div>
              <div class="text-[11px] text-slate-400 line-clamp-1">
                \${escapeHtml(e.reasons[0] || 'Correlated telemetry signals')}
              </div>
              <div class="flex items-center gap-1.5 flex-wrap pt-1">
                \${signalsBadges}
              </div>
            </div>
            <button onclick="openModalWithPair(\${cluster.id}, '\${uA.id}', '\${uB.id}')" 
                    class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold font-sans transition whitespace-nowrap self-end md:self-center">
              Inspect 1v1 Diff ➔
            </button>
          </div>
        \`;
      }).join('');

      return \`
        <div class="border rounded-2xl p-5 \${sevBg} space-y-4 shadow-xl transition">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-2.5">
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold uppercase border \${badgeClass}">
                Cluster #\${cluster.id}
              </span>
              <span class="font-extrabold text-white text-base tracking-tight">
                \${cluster.users.length} Linked Accounts
              </span>
              <span class="text-xs text-slate-400 font-medium">
                (\${formatClassification(cluster.primaryClassification)})
              </span>
            </div>

            <div class="flex items-center gap-3">
              <div class="text-right">
                <div class="text-xs uppercase font-semibold text-slate-400">Peak Link Score</div>
                <div class="text-xl font-extrabold font-mono \${scoreColor}">\${cluster.maxConfidence}%</div>
              </div>
              <button onclick="openModal(\${cluster.id})" class="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center gap-1.5">
                <span>Inspect Full Cluster</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>

          <div class="grid md:grid-cols-2 lg:grid-cols-\${Math.min(cluster.users.length, 3)} gap-3">
            \${usersHtml}
          </div>

          <!-- 1v1 Comparison Breakdown Section -->
          <div class="space-y-2 pt-2 border-t border-slate-800/80">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>1-on-1 Pairwise Comparison Scores</span>
              <span class="text-slate-500 font-normal font-mono">\${cluster.edges.length} Pairwise Links</span>
            </div>
            <div class="space-y-2">
              \${pairwiseLinksHtml}
            </div>
          </div>
        </div>
      \`;
    }

    function showComboboxList(slot) {
      filterCombobox(slot);
      document.getElementById('comboboxList' + slot)?.classList.remove('hidden');
    }

    function filterCombobox(slot) {
      const input = document.getElementById('comboboxInput' + slot);
      const listEl = document.getElementById('comboboxList' + slot);
      if (!input || !listEl) return;

      const term = input.value.toLowerCase().trim();
      let filtered = reportData.allUsers;
      if (term) {
        filtered = filtered.filter(u => 
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.phone && u.phone.includes(term)) ||
          (u.college && u.college.toLowerCase().includes(term)) ||
          u.devices.some(d => (d.lastIp && d.lastIp.includes(term)))
        );
      }

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="p-3 text-center text-xs text-slate-500">No players found</div>';
      } else {
        listEl.innerHTML = filtered.slice(0, 50).map(u => \`
          <div onclick="selectComboboxPlayer('\${slot}', '\${u.id}')" class="p-2.5 hover:bg-slate-800 cursor-pointer transition flex items-center justify-between text-xs">
            <div>
              <div class="font-bold text-white">\${escapeHtml(u.name)}</div>
              <div class="text-[11px] text-slate-400 font-mono">\${escapeHtml(u.email)} · \${escapeHtml(u.college)}</div>
            </div>
            <div class="text-right text-[10px] text-slate-500 font-mono">
              \${u.phone ? \`📞 \${escapeHtml(u.phone)}\` : 'No phone'}
            </div>
          </div>
        \`).join('');
      }
      listEl.classList.remove('hidden');
    }

    function selectComboboxPlayer(slot, userId) {
      if (slot === 'A') selectedPlayerAId = userId;
      else selectedPlayerBId = userId;

      document.getElementById('comboboxList' + slot)?.classList.add('hidden');
      updateComboboxDisplay();
      runManualComparison();
    }

    function updateComboboxDisplay() {
      const uA = reportData.allUsers.find(u => u.id === selectedPlayerAId);
      const uB = reportData.allUsers.find(u => u.id === selectedPlayerBId);

      const inputA = document.getElementById('comboboxInputA');
      const inputB = document.getElementById('comboboxInputB');
      if (inputA && uA) inputA.value = \`\${uA.name} (\${uA.email})\`;
      if (inputB && uB) inputB.value = \`\${uB.name} (\${uB.email})\`;
    }

    function launchComparison(userAId, userBId) {
      selectedPlayerAId = userAId;
      selectedPlayerBId = userBId;
      updateComboboxDisplay();
      switchTab('comparator');
      runManualComparison();
    }

    function runManualComparison() {
      const uAId = selectedPlayerAId;
      const uBId = selectedPlayerBId;
      const container = document.getElementById('manualComparisonResult');

      const uA = reportData.allUsers.find(u => u.id === uAId);
      const uB = reportData.allUsers.find(u => u.id === uBId);
      if (!uA || !uB) {
        container.innerHTML = '<div class="text-center p-8 text-slate-500">Please select two valid players.</div>';
        return;
      }

      if (uAId === uBId) {
        container.innerHTML = '<div class="text-center p-8 text-amber-400 bg-amber-950/20 border border-amber-500/30 rounded-xl">Selected the same player for both slots. Choose another player to compare against.</div>';
        return;
      }

      const diffs = [];
      const reasons = [];
      let matchScore = 0;

      // Phone
      const phoneMatch = !!(uA.phone && uB.phone && uA.phone === uB.phone);
      diffs.push({
        name: "Phone Number", category: "identity", valA: uA.phone || "Not provided", valB: uB.phone || "Not provided",
        isMatch: phoneMatch, isDifferent: !phoneMatch && (!!uA.phone || !!uB.phone), note: phoneMatch ? "Exact Phone Match" : undefined
      });
      if (phoneMatch) {
        reasons.push("Exact Phone Number match: " + uA.phone);
        matchScore = Math.max(matchScore, 100);
      }

      // College & Dept
      const colA = uA.collegeOther || uA.college;
      const colB = uB.collegeOther || uB.college;
      const colMatch = colA.toLowerCase() === colB.toLowerCase();
      diffs.push({
        name: "College / Institution", category: "academic", valA: colA, valB: colB,
        isMatch: colMatch, isDifferent: !colMatch
      });

      diffs.push({
        name: "Branch / Department", category: "academic", valA: uA.branch || "Not reported", valB: uB.branch || "Not reported",
        isMatch: !!(uA.branch && uB.branch && uA.branch.toLowerCase() === uB.branch.toLowerCase()),
        isDifferent: !uA.branch || !uB.branch || uA.branch.toLowerCase() !== uB.branch.toLowerCase()
      });

      // Best Device Diff
      const dA = uA.devices[0] || {};
      const dB = uB.devices[0] || {};
      const fpA = dA.fingerprint || {};
      const fpB = dB.fingerprint || {};

      // Hashes
      const sameDevHash = !!(dA.deviceHash && dB.deviceHash && dA.deviceHash === dB.deviceHash);
      diffs.push({
        name: "Persistent Device Storage ID", category: "hashes", valA: dA.deviceHash ? dA.deviceHash.slice(0, 20) + '...' : 'None', valB: dB.deviceHash ? dB.deviceHash.slice(0, 20) + '...' : 'None',
        isMatch: sameDevHash, isDifferent: !sameDevHash
      });
      if (sameDevHash) {
        reasons.push("Exact shared persistent device storage hash");
        matchScore = Math.max(matchScore, 100);
      }

      const sameVisitor = !!(dA.fpVisitorId && dB.fpVisitorId && dA.fpVisitorId === dB.fpVisitorId);
      diffs.push({
        name: "FingerprintJS Visitor ID", category: "hashes", valA: dA.fpVisitorId || 'None', valB: dB.fpVisitorId || 'None',
        isMatch: sameVisitor, isDifferent: !sameVisitor && (!!dA.fpVisitorId || !!dB.fpVisitorId)
      });
      if (sameVisitor) {
        reasons.push("Identical FingerprintJS Visitor ID");
        matchScore = Math.max(matchScore, 85);
      }

      const sameHw = !!(dA.hardwareHash && dB.hardwareHash && dA.hardwareHash === dB.hardwareHash);
      diffs.push({
        name: "Composite Hardware Hash", category: "hashes", valA: dA.hardwareHash ? dA.hardwareHash.slice(0, 20) + '...' : 'None', valB: dB.hardwareHash ? dB.hardwareHash.slice(0, 20) + '...' : 'None',
        isMatch: sameHw, isDifferent: !sameHw
      });

      const sameCanvas = !!(dA.canvasHash && dB.canvasHash && dA.canvasHash === dB.canvasHash);
      diffs.push({
        name: "Canvas 2D Hash", category: "hashes", valA: dA.canvasHash ? dA.canvasHash.slice(0, 16) + '...' : 'None', valB: dB.canvasHash ? dB.canvasHash.slice(0, 16) + '...' : 'None',
        isMatch: sameCanvas, isDifferent: !sameCanvas
      });

      const sameAudio = !!(dA.audioHash && dB.audioHash && dA.audioHash === dB.audioHash);
      diffs.push({
        name: "Audio Frequency Hash", category: "hashes", valA: dA.audioHash ? dA.audioHash.slice(0, 16) + '...' : 'None', valB: dB.audioHash ? dB.audioHash.slice(0, 16) + '...' : 'None',
        isMatch: sameAudio, isDifferent: !sameAudio
      });

      // Network & Geo
      const samePublicIp = !!(dA.lastIp && dB.lastIp && dA.lastIp === dB.lastIp);
      diffs.push({
        name: "Public IP Address (Last Seen)", category: "network", valA: dA.lastIp || 'None', valB: dB.lastIp || 'None',
        isMatch: samePublicIp, isDifferent: !samePublicIp && (!!dA.lastIp || !!dB.lastIp)
      });

      const geoA = [dA.lastCity, dA.lastCountry].filter(Boolean).join(', ') || (dA.lastCountry ? (dA.lastCountry === 'IN' ? 'India (IN)' : dA.lastCountry) : 'Unknown');
      const geoB = [dB.lastCity, dB.lastCountry].filter(Boolean).join(', ') || (dB.lastCountry ? (dB.lastCountry === 'IN' ? 'India (IN)' : dB.lastCountry) : 'Unknown');
      diffs.push({
        name: "Cloudflare Geo Location", category: "network", valA: geoA, valB: geoB,
        isMatch: geoA !== 'Unknown' && geoA === geoB, isDifferent: geoA !== 'Unknown' && geoA !== geoB
      });

      const sameLocalIp = !!(dA.localIp && dB.localIp && dA.localIp === dB.localIp);
      diffs.push({
        name: "WebRTC Local LAN IP", category: "network", valA: dA.localIp || 'mDNS / Hidden', valB: dB.localIp || 'mDNS / Hidden',
        isMatch: sameLocalIp, isDifferent: !sameLocalIp && (!!dA.localIp || !!dB.localIp)
      });
      if (samePublicIp && sameLocalIp && dA.localIp) {
        reasons.push("Identical Public IP AND WebRTC Local LAN IP (" + dA.localIp + ")");
        matchScore = Math.max(matchScore, 90);
      } else if (samePublicIp) {
        reasons.push("Shared Public IP (" + dA.lastIp + ")");
        matchScore = Math.max(matchScore, 25);
      }

      // Hardware Specs
      diffs.push({
        name: "Device Model (Client Hint)", category: "hardware", valA: fpA.uaModel || "Not reported", valB: fpB.uaModel || "Not reported",
        isMatch: !!(fpA.uaModel && fpB.uaModel && fpA.uaModel === fpB.uaModel),
        isDifferent: !fpA.uaModel || !fpB.uaModel || fpA.uaModel !== fpB.uaModel
      });

      diffs.push({
        name: "Operating Platform", category: "hardware", valA: dA.platform || "Unknown", valB: dB.platform || "Unknown",
        isMatch: !!(dA.platform && dB.platform && dA.platform === dB.platform),
        isDifferent: !dA.platform || !dB.platform || dA.platform !== dB.platform
      });

      diffs.push({
        name: "CPU Cores", category: "hardware", valA: fpA.hardwareConcurrency ? fpA.hardwareConcurrency + ' Cores' : 'Unknown', valB: fpB.hardwareConcurrency ? fpB.hardwareConcurrency + ' Cores' : 'Unknown',
        isMatch: !!(fpA.hardwareConcurrency && fpB.hardwareConcurrency && fpA.hardwareConcurrency === fpB.hardwareConcurrency),
        isDifferent: !fpA.hardwareConcurrency || !fpB.hardwareConcurrency || fpA.hardwareConcurrency !== fpB.hardwareConcurrency
      });

      diffs.push({
        name: "Device RAM", category: "hardware", valA: fpA.deviceMemory ? fpA.deviceMemory + ' GB' : 'Not reported', valB: fpB.deviceMemory ? fpB.deviceMemory + ' GB' : 'Not reported',
        isMatch: !!(fpA.deviceMemory && fpB.deviceMemory && fpA.deviceMemory === fpB.deviceMemory),
        isDifferent: !fpA.deviceMemory || !fpB.deviceMemory || fpA.deviceMemory !== fpB.deviceMemory
      });

      diffs.push({
        name: "WebGL GPU Renderer", category: "display", valA: fpA.webglRenderer || fpA.webgl || 'Standard GPU', valB: fpB.webglRenderer || fpB.webgl || 'Standard GPU',
        isMatch: !!(dA.webglHash && dB.webglHash && dA.webglHash === dB.webglHash),
        isDifferent: !dA.webglHash || !dB.webglHash || dA.webglHash !== dB.webglHash
      });

      diffs.push({
        name: "Display Resolution & DPR", category: "display", valA: fpA.screen || "Unknown", valB: fpB.screen || "Unknown",
        isMatch: !!(dA.screenHash && dB.screenHash && dA.screenHash === dB.screenHash),
        isDifferent: !dA.screenHash || !dB.screenHash || dA.screenHash !== dB.screenHash
      });

      diffs.push({
        name: "Browser User Agent", category: "browser", valA: dA.userAgent || "Unknown", valB: dB.userAgent || "Unknown",
        isMatch: !!(dA.userAgent && dB.userAgent && dA.userAgent === dB.userAgent),
        isDifferent: !dA.userAgent || !dB.userAgent || dA.userAgent !== dB.userAgent
      });

      if (sameHw || (sameCanvas && sameAudio && dA.webglHash && dB.webglHash && dA.webglHash === dB.webglHash)) {
        if (samePublicIp) {
          reasons.push("Matching Hardware Signature on Shared Network");
          matchScore = Math.max(matchScore, 65);
        } else {
          reasons.push("Matching Hardware GPU/Canvas Profile (Different Networks)");
          matchScore = Math.max(matchScore, 40);
        }
      }

      // Check chronological attempts overlap
      for (const aA of uA.attempts) {
        for (const aB of uB.attempts) {
          if (aA.gameId === aB.gameId && aA.submittedAt && aB.submittedAt) {
            const diffMin = Math.abs(new Date(aA.submittedAt) - new Date(aB.submittedAt)) / 60000;
            if (diffMin <= 20) {
              reasons.push("Played " + aA.gameTitle + " within " + Math.round(diffMin) + "m");
              matchScore = Math.min(100, matchScore + 20);
            }
          }
        }
      }

      const diffRows = diffs.map(d => {
        let badge = '<span class="text-slate-500">⚪</span>';
        let rowBg = "";
        if (d.isMatch) {
          badge = '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">MATCH</span>';
          rowBg = "bg-emerald-950/10";
        } else if (d.isDifferent) {
          badge = '<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">DIFF</span>';
        }
        return \`
          <tr class="\${rowBg} hover:bg-slate-900/60 transition">
            <td class="p-3 text-slate-300 font-sans font-semibold">\${escapeHtml(d.name)}</td>
            <td class="p-3 text-slate-300 break-all font-mono">\${escapeHtml(d.valA)}</td>
            <td class="p-3 text-slate-300 break-all font-mono">\${escapeHtml(d.valB)}</td>
            <td class="p-3 text-center">\${badge}</td>
          </tr>
        \`;
      }).join('');

      const reasonsHtml = reasons.length > 0
        ? reasons.map(r => \`<li class="flex items-center gap-1.5 text-slate-200"><span>⚡</span> <span>\${escapeHtml(r)}</span></li>\`).join('')
        : '<li class="text-slate-500">No overlapping signals detected between these two players.</li>';

      let scoreColor = matchScore >= 75 ? "text-red-400" : matchScore >= 50 ? "text-orange-400" : matchScore >= 30 ? "text-amber-400" : "text-emerald-400";

      container.innerHTML = \`
        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div class="text-xs uppercase font-bold text-slate-400">1-on-1 Pairwise Similarity Score</div>
            <div class="text-3xl font-extrabold font-mono \${scoreColor}">\${matchScore}%</div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="navigator.clipboard.writeText('\${uA.id}, \${uB.id}'); alert('Copied IDs: \${uA.id}, \${uB.id}');" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold">
              Copy Player IDs
            </button>
          </div>
        </div>

        <div class="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Evidence Breakdown</div>
          <ul class="space-y-1 text-xs">\${reasonsHtml}</ul>
        </div>

        <div class="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold">
                <th class="p-3 w-1/4">Telemetry Attribute</th>
                <th class="p-3 w-1/3">\${escapeHtml(uA.name)}</th>
                <th class="p-3 w-1/3">\${escapeHtml(uB.name)}</th>
                <th class="p-3 w-16 text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">\${diffRows}</tbody>
          </table>
        </div>
      \`;
    }

    function renderDirectory() {
      const term = (document.getElementById('dirSearchInput')?.value || '').toLowerCase().trim();
      const tbody = document.getElementById('directoryTableBody');
      const countEl = document.getElementById('dirTotalCount');
      if (!tbody) return;

      let list = reportData.allUsers;
      if (term) {
        list = list.filter(u => 
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.phone && u.phone.includes(term)) ||
          (u.college && u.college.toLowerCase().includes(term)) ||
          (u.branch && u.branch.toLowerCase().includes(term)) ||
          u.devices.some(d => 
            (d.lastIp && d.lastIp.includes(term)) || 
            (d.lastCity && d.lastCity.toLowerCase().includes(term)) ||
            (d.lastCountry && d.lastCountry.toLowerCase().includes(term)) ||
            d.deviceHash.includes(term)
          )
        );
      }

      if (countEl) countEl.textContent = \`Showing \${list.length} of \${reportData.allUsers.length} players\`;

      tbody.innerHTML = list.map(u => {
        const d = u.devices[0] || {};
        const fp = d.fingerprint || {};
        const loc = [d.lastCity, d.lastCountry].filter(Boolean).join(', ') || (d.lastCountry ? (d.lastCountry === 'IN' ? 'India (IN)' : d.lastCountry) : 'Unknown Location');
        const gpu = fp.webglRenderer || fp.webgl || d.platform || 'Standard GPU';

        return \`
          <tr class="hover:bg-slate-950 transition">
            <td class="p-3.5">
              <div class="font-bold text-white font-sans">\${escapeHtml(u.name)}</div>
              <div class="text-[11px] text-slate-400 font-mono">\${escapeHtml(u.email)}</div>
            </td>
            <td class="p-3.5 font-sans">
              <div class="text-slate-300">\${escapeHtml(u.college === 'mec' ? 'Govt Model Engineering College' : u.collegeOther || u.college)}</div>
              <div class="text-[10px] text-slate-500">\${u.branch ? escapeHtml(u.branch) : 'General'} \${u.batch ? \`('\${u.batch})\` : ''}</div>
            </td>
            <td class="p-3.5">
              <div class="text-cyan-400 text-[11px] font-mono">📍 \${escapeHtml(loc)}</div>
              <div class="text-slate-400 text-[11px] font-mono mt-0.5">\${u.phone ? escapeHtml(u.phone) : '<span class="text-slate-600">No Phone</span>'}</div>
            </td>
            <td class="p-3.5 text-[11px]">
              <div class="text-slate-300 font-mono">\${d.lastIp || 'No IP'}</div>
              <div class="text-[10px] text-slate-500 font-mono truncate max-w-xs" title="\${escapeHtml(gpu)}">\${escapeHtml(gpu)}</div>
            </td>
            <td class="p-3.5 text-center">
              <span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-bold">\${u.trustScore}</span>
            </td>
            <td class="p-3.5 text-center text-slate-300 font-mono">\${u.attempts.length}</td>
            <td class="p-3.5 text-right font-sans">
              <button onclick="launchComparison('\${u.id}', '\${reportData.allUsers.find(other => other.id !== u.id)?.id || u.id}')" 
                      class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs transition">
                Compare
              </button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function openModalWithPair(clusterId, userAId, userBId) {
      const cluster = reportData.clusters.find(c => c.id === clusterId);
      if (!cluster) return;
      currentActiveCluster = cluster;
      showingRawJson = false;

      document.getElementById('modalTitle').textContent = \`Cluster Forensic Inspector #\${cluster.id}\`;
      document.getElementById('modalSubtitle').textContent = \`Pairwise 1v1 Diff Inspector\`;

      const selectA = document.getElementById('selectAccountA');
      const selectB = document.getElementById('selectAccountB');
      selectA.innerHTML = cluster.users.map(u => \`<option value="\${u.id}" \${u.id === userAId ? 'selected' : ''}>\${escapeHtml(u.name)} (\${escapeHtml(u.email)})</option>\`).join('');
      selectB.innerHTML = cluster.users.map(u => \`<option value="\${u.id}" \${u.id === userBId ? 'selected' : ''}>\${escapeHtml(u.name)} (\${escapeHtml(u.email)})</option>\`).join('');

      renderModalDiff();
      document.getElementById('detailModal').classList.remove('hidden');
    }

    function openModal(clusterId) {
      const cluster = reportData.clusters.find(c => c.id === clusterId);
      if (!cluster) return;
      currentActiveCluster = cluster;
      showingRawJson = false;

      document.getElementById('modalTitle').textContent = \`Cluster Forensic Inspector #\${cluster.id}\`;
      document.getElementById('modalSubtitle').textContent = \`\${cluster.users.length} accounts analyzed · Peak similarity score: \${cluster.maxConfidence}%\`;

      const sevBadge = document.getElementById('modalSeverityBadge');
      sevBadge.textContent = \`\${cluster.riskTier.toUpperCase()} RISK\`;
      sevBadge.className = \`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wider \${
        cluster.riskTier === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
        cluster.riskTier === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
      }\`;

      const selectA = document.getElementById('selectAccountA');
      const selectB = document.getElementById('selectAccountB');
      selectA.innerHTML = cluster.users.map((u, i) => \`<option value="\${u.id}" \${i === 0 ? 'selected' : ''}>\${escapeHtml(u.name)} (\${escapeHtml(u.email)})</option>\`).join('');
      selectB.innerHTML = cluster.users.map((u, i) => \`<option value="\${u.id}" \${i === 1 || (i === 0 && cluster.users.length === 1) ? 'selected' : ''}>\${escapeHtml(u.name)} (\${escapeHtml(u.email)})</option>\`).join('');

      renderModalDiff();
      document.getElementById('detailModal').classList.remove('hidden');
    }

    function closeModal() {
      document.getElementById('detailModal').classList.add('hidden');
      currentActiveCluster = null;
    }

    function toggleRawJson() {
      showingRawJson = !showingRawJson;
      const container = document.getElementById('rawJsonViewerContainer');
      const btn = document.getElementById('rawJsonBtn');
      if (showingRawJson) {
        container.classList.remove('hidden');
        btn.textContent = 'Hide Raw JSON';
      } else {
        container.classList.add('hidden');
        btn.textContent = '{ } View Raw Telemetry JSON';
      }
    }

    function renderModalDiff() {
      if (!currentActiveCluster) return;
      const uAId = document.getElementById('selectAccountA').value;
      const uBId = document.getElementById('selectAccountB').value;

      const uA = currentActiveCluster.users.find(u => u.id === uAId);
      const uB = currentActiveCluster.users.find(u => u.id === uBId);
      if (!uA || !uB) return;

      const edge = currentActiveCluster.edges.find(e => 
        (e.userAId === uAId && e.userBId === uBId) || (e.userAId === uBId && e.userBId === uAId)
      );

      // Raw JSON Views
      document.getElementById('rawJsonTitleA').textContent = uA.name + ' - Raw Telemetry';
      document.getElementById('rawJsonTitleB').textContent = uB.name + ' - Raw Telemetry';
      document.getElementById('rawJsonContentA').textContent = JSON.stringify(uA, null, 2);
      document.getElementById('rawJsonContentB').textContent = JSON.stringify(uB, null, 2);

      // Evidence Box
      const evidenceBox = document.getElementById('modalEvidenceBox');
      const reasonsList = edge ? edge.reasons.map(r => \`<li class="flex items-center gap-1.5 text-slate-200"><span>⚡</span> <span>\${escapeHtml(r)}</span></li>\`).join('') : '<li class="text-slate-400">Indirect multi-account association via cluster graph.</li>';
      const fpNotes = edge && edge.falsePositiveNotes.length > 0 
        ? edge.falsePositiveNotes.map(n => \`<div class="text-amber-400/90 text-xs flex items-center gap-1 mt-1"><span>⚠️</span> <span>\${escapeHtml(n)}</span></div>\`).join('')
        : '';

      evidenceBox.innerHTML = \`
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Direct Pairwise Evidence</span>
          <span class="font-mono font-bold text-amber-400">\${edge ? edge.confidence + '% 1v1 match' : 'Graph Linked'}</span>
        </div>
        <ul class="space-y-1 text-xs">\${reasonsList}</ul>
        \${fpNotes}
      \`;

      // Signal Diff Table
      const tableBody = document.getElementById('signalDiffTableBody');
      const diffs = edge ? edge.signalDiffs : [];
      if (diffs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">No direct signal diff recorded.</td></tr>';
      } else {
        tableBody.innerHTML = diffs.map(d => {
          let statusBadge = '<span class="text-slate-500">⚪</span>';
          let rowClass = "";
          if (d.isMatch) {
            statusBadge = '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">MATCH</span>';
            rowClass = "bg-emerald-950/10";
          } else if (d.isDifferent) {
            statusBadge = '<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">DIFF</span>';
          }
          return \`
            <tr class="\${rowClass} hover:bg-slate-900/60 transition">
              <td class="p-3 text-slate-300 font-sans font-semibold">
                \${escapeHtml(d.name)}
                \${d.note ? \`<div class="text-[10px] text-slate-500 font-normal mt-0.5 font-sans">\${escapeHtml(d.note)}</div>\` : ''}
              </td>
              <td class="p-3 text-slate-300 break-all">\${escapeHtml(d.valA)}</td>
              <td class="p-3 text-slate-300 break-all">\${escapeHtml(d.valB)}</td>
              <td class="p-3 text-center">\${statusBadge}</td>
            </tr>
          \`;
        }).join('');
      }

      // Attempts Chronology
      const attemptsContainer = document.getElementById('modalAttemptsTimeline');
      const allPairAttempts = [
        ...uA.attempts.map(a => ({ ...a, user: uA.name, userEmail: uA.email })),
        ...uB.attempts.map(a => ({ ...a, user: uB.name, userEmail: uB.email }))
      ].sort((a, b) => {
        const tA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return tB - tA;
      });

      if (allPairAttempts.length === 0) {
        attemptsContainer.innerHTML = '<div class="text-xs text-slate-500 p-3 bg-slate-950 rounded-lg">No game submissions found for either account.</div>';
      } else {
        attemptsContainer.innerHTML = allPairAttempts.map(att => \`
          <div class="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono">
            <div>
              <span class="font-bold text-white font-sans">\${escapeHtml(att.user)}</span>
              <span class="text-slate-400 ml-2">\${escapeHtml(att.gameTitle)}</span>
              \${att.score !== null ? \`<span class="text-amber-400 ml-2">Score: \${att.score}</span>\` : ''}
              \${att.durationMs ? \`<span class="text-slate-500 ml-2">(\${(att.durationMs/1000).toFixed(1)}s)</span>\` : ''}
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-slate-400">\${att.submittedAt ? new Date(att.submittedAt).toLocaleTimeString() : 'In Progress'}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold \${att.valid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">
                \${att.valid ? 'VALID' : 'INVALID'}
              </span>
            </div>
          </div>
        \`).join('');
      }

      // Security Logs
      const logsContainer = document.getElementById('modalLogsContainer');
      const allPairLogs = [
        ...uA.logs.map(l => ({ ...l, user: uA.name })),
        ...uB.logs.map(l => ({ ...l, user: uB.name }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (allPairLogs.length === 0) {
        logsContainer.innerHTML = '<div class="text-xs text-slate-500 p-3 bg-slate-950 rounded-lg">No suspicious alerts recorded for these accounts.</div>';
      } else {
        logsContainer.innerHTML = allPairLogs.map(l => \`
          <div class="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span class="font-bold text-white">\${escapeHtml(l.user)}</span>
              <span class="text-red-400 ml-2 font-mono">\${escapeHtml(l.eventType)}</span>
              \${l.ip ? \`<span class="text-slate-500 ml-2 font-mono">IP: \${l.ip}</span>\` : ''}
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-500 font-mono">\${new Date(l.createdAt).toLocaleTimeString()}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">\${l.severity}</span>
            </div>
          </div>
        \`).join('');
      }

      const recBadge = document.getElementById('modalRecommendationBadge');
      if (currentActiveCluster.primaryClassification === 'CONFIRMED_MULTI_ACCOUNT') {
        recBadge.textContent = 'CONFIRMED DUAL ACCOUNT · BAN SECONDARY / RESET TRUST';
        recBadge.className = 'font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30';
      } else if (currentActiveCluster.primaryClassification === 'PROBABLE_MULTI_ACCOUNT') {
        recBadge.textContent = 'HIGH PROBABILITY DUPLICATE · AUDIT LEADERBOARD REWARDS';
        recBadge.className = 'font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30';
      } else if (currentActiveCluster.primaryClassification === 'SHARED_CAMPUS_NETWORK') {
        recBadge.textContent = 'CAMPUS WI-FI PEER · SAFE / WHITELIST';
        recBadge.className = 'font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      } else {
        recBadge.textContent = 'INFORMATIONAL OVERLAP · MONITOR';
        recBadge.className = 'font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700';
      }
    }

    function copyAccountIds() {
      if (!currentActiveCluster) return;
      const ids = currentActiveCluster.users.map(u => \`\${u.name} <\${u.email}> (\${u.id})\`).join('\\n');
      navigator.clipboard.writeText(ids);
      alert('Copied account details to clipboard:\\n' + ids);
    }

    function exportReportJson() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "foss-onam-cheat-analysis-" + new Date().toISOString().slice(0, 10) + ".json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    function formatSignalName(s) {
      const names = {
        phone: '📞 Phone Match',
        same_device: '📱 Exact Device Hash',
        fp_visitor: '🧬 FingerprintJS Visitor',
        local_ip_match: '🌐 WebRTC LAN IP',
        shared_residential_ip: '🏠 Residential IP',
        shared_campus_ip: '🏛️ Campus Wi-Fi',
        hardware_composite_lan: '💻 Same Machine LAN',
        hardware_composite_residential: '🏠 Shared Household Dev',
        hardware_composite_visitor: '🧬 Visitor + Hardware',
        hardware_profile_match: '📱 Same Hardware Profile',
        hardware_composite_campus: '🏛️ Campus Hardware Match',
        device_model: '📱 Hardware Model Hint',
        temporal_interleave_residential: '⏱️ Sequential Game Hopping',
        temporal_interleave_campus: '⏱️ Campus Timing Overlap',
        temporal_interleave_cross_network: '⏱️ Cross-Network Velocity'
      };
      return names[s] || s;
    }

    function formatClassification(c) {
      const names = {
        CONFIRMED_MULTI_ACCOUNT: 'Confirmed Dual Account',
        PROBABLE_MULTI_ACCOUNT: 'Probable Multi-Account',
        SUSPICIOUS_HARDWARE_OVERLAP: 'Hardware Signature Overlap',
        SHARED_CAMPUS_NETWORK: 'Shared Campus Network',
        INFORMATIONAL_OVERLAP: 'Informational Overlap'
      };
      return names[c] || c;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>
`;
}

const isDirectExecution = process.argv[1]?.includes("analyze-cheaters");
if (isDirectExecution) {
  runAnalysis().catch((err) => {
    console.error("Analysis script failed:", err);
    process.exit(1);
  });
}
