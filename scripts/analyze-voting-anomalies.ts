import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

// Auto-load .env or .dev.vars if present
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
          if (!process.env[key]) process.env[key] = val;
        }
      }
    } catch {
      /* ignore */
    }
  }
}

const args = process.argv.slice(2);

// Helper to get CLI arguments
function getArg(name: string, fallback: string | null = null): string | null {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1].trim() : fallback;
}

const dumpFile = getArg("--dump", null);
const filterEmail = getArg("--email", null)?.toLowerCase();
const minVotes = Number(getArg("--min-votes", "5") || "5");
const onlyEmergency = args.includes("--emergency");

async function main() {
  console.log("🌸 Code-a-Pookalam Full Community Voting Matrix & Anomaly Inspector");
  console.log(`📊 10-Participant Win Matrix for Unbanned Voters (min votes: ${minVotes})\n`);

  let users: any[] = [];
  let submissions: any[] = [];
  let votes: any[] = [];

  let sql: any = null;

  if (dumpFile) {
    const fullDumpPath = resolve(process.cwd(), dumpFile);
    console.log(`📦 Reading from dump: ${fullDumpPath}`);
    if (!existsSync(fullDumpPath)) {
      console.error(`❌ Dump file not found: ${fullDumpPath}`);
      process.exit(1);
    }
    const raw = JSON.parse(readFileSync(fullDumpPath, "utf-8"));
    users = raw.users;
    submissions = raw.submissions.filter((s: any) => s.status === "approved" && s.shortlisted);
    votes = raw.votes;
  } else {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error(
        "❌ DATABASE_URL is not set. Please set it in .env or pass --dump dumps/pookalam-full-raw-latest.json",
      );
      process.exit(1);
    }
    sql = postgres(databaseUrl, { max: 1 });

    const [uRows, sRows, vRows] = await Promise.all([
      sql`
        SELECT id, email, name, college, branch, batch, div, whatsapp_number AS "whatsappNumber",
               role, ban_level AS "banLevel", trust_score AS "trustScore", created_at AS "createdAt"
        FROM users
      `,
      sql`
        SELECT s.id, s.user_id AS "userId", u.name AS "authorName", u.email AS "authorEmail",
               s.title, s.rating, s.adjustment, s.matches, s.wins, s.shortlisted, s.status
        FROM pookalam_submissions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'approved' AND s.shortlisted = true
      `,
      sql`
        SELECT id, voter_id AS "voterId", winner_id AS "winnerId", loser_id AS "loserId", created_at AS "createdAt"
        FROM pookalam_votes
        ORDER BY created_at ASC
      `,
    ]);

    users = uRows;
    submissions = sRows;
    votes = vRows;
  }

  // Canonical ordering of 10 pookalams
  const orderedNames = [
    "Girishankar MK",
    "Athul Krishna Girish",
    "Fayaz Unas",
    "Aaron Kurian Abraham",
    "Pranath Prasanth",
    "Ajay Krishna D",
    "Siva",
    "Megha Elias",
    "Devanarayanan (Kesu)",
    "Aaron Paul",
  ];
  const shortHeaders = [
    "Giri",
    "Athul",
    "Fayaz",
    "AaronK",
    "Pranth",
    "Ajay",
    "Siva",
    "Megha",
    "Kesu",
    "AaronP",
  ];

  const subByName = new Map(submissions.map((s) => [s.authorName, s]));
  const sortedSubIds = orderedNames.map((n) => subByName.get(n)?.id).filter(Boolean) as string[];
  const userById = new Map(users.map((u) => [u.id, u]));

  // Reference quality tiers
  const topTierNames = [
    "Girishankar MK",
    "Athul Krishna Girish",
    "Aaron Kurian Abraham",
    "Fayaz Unas",
  ];
  const bottomTierNames = ["Aaron Paul", "Devanarayanan (Kesu)", "Ajay Krishna D", "Siva"];
  const topTierIds = new Set(
    submissions.filter((s) => topTierNames.includes(s.authorName)).map((s) => s.id),
  );
  const bottomTierIds = new Set(
    submissions.filter((s) => bottomTierNames.includes(s.authorName)).map((s) => s.id),
  );

  // Group votes by voter
  const votesByVoter = new Map<string, any[]>();
  for (const v of votes) {
    if (!votesByVoter.has(v.voterId)) votesByVoter.set(v.voterId, []);
    votesByVoter.get(v.voterId)!.push(v);
  }

  const rows: any[] = [];

  for (const [voterId, vList] of votesByVoter.entries()) {
    const u = userById.get(voterId);
    if (!u) continue;

    if (filterEmail && !u.email?.toLowerCase().includes(filterEmail)) {
      continue;
    }

    if (u.banLevel > 0 && !filterEmail) continue;
    if (vList.length < minVotes && !filterEmail) continue;

    const wins = new Map<string, number>();
    const matches = new Map<string, number>();
    for (const id of sortedSubIds) {
      wins.set(id, 0);
      matches.set(id, 0);
    }

    for (const v of vList) {
      if (wins.has(v.winnerId)) wins.set(v.winnerId, wins.get(v.winnerId)! + 1);
      if (matches.has(v.winnerId)) matches.set(v.winnerId, matches.get(v.winnerId)! + 1);
      if (matches.has(v.loserId)) matches.set(v.loserId, matches.get(v.loserId)! + 1);
    }

    // Find candidate target
    let bestTargetId: string | null = null;
    let bestTargetRate = 0;
    let bestTargetWins = 0;
    let bestTargetMatches = 0;

    for (const id of sortedSubIds) {
      const m = matches.get(id) || 0;
      const w = wins.get(id) || 0;
      if (m >= 5) {
        const rate = w / m;
        if (rate > bestTargetRate || (rate === bestTargetRate && w > bestTargetWins)) {
          bestTargetRate = rate;
          bestTargetId = id;
          bestTargetWins = w;
          bestTargetMatches = m;
        }
      }
    }

    // Count Sabotage (non-target matches where bottom-tier beat top-tier)
    let nonTargetTopVsBottomMatches = 0;
    let nonTargetSabotageVotes = 0;

    for (const v of vList) {
      if (v.winnerId === bestTargetId || v.loserId === bestTargetId) continue;

      const isWinnerBottom = bottomTierIds.has(v.winnerId);
      const isLoserTop = topTierIds.has(v.loserId);
      const isWinnerTop = topTierIds.has(v.winnerId);
      const isLoserBottom = bottomTierIds.has(v.loserId);

      if (isWinnerBottom && isLoserTop) {
        nonTargetSabotageVotes++;
        nonTargetTopVsBottomMatches++;
      } else if (isWinnerTop && isLoserBottom) {
        nonTargetTopVsBottomMatches++;
      }
    }

    const sabotageRate =
      nonTargetTopVsBottomMatches > 0 ? nonTargetSabotageVotes / nonTargetTopVsBottomMatches : 0;
    const isTargetBiased = bestTargetRate >= 0.8 && bestTargetWins >= 6;

    let anomalyScore = 0;
    if (isTargetBiased) {
      anomalyScore += 45 * bestTargetRate;
    }
    anomalyScore += 55 * sabotageRate;

    const finalScore = Math.min(100, Math.round(anomalyScore));
    if (onlyEmergency && finalScore < 70) continue;

    rows.push({
      user: u,
      votesCount: vList.length,
      wins,
      matches,
      score: finalScore,
      boosted: bestTargetId ? orderedNames[sortedSubIds.indexOf(bestTargetId)] : "None",
      targetWins: `${bestTargetWins}/${bestTargetMatches}`,
      sabotageRate: `${nonTargetSabotageVotes}/${nonTargetTopVsBottomMatches} (${Math.round(sabotageRate * 100)}%)`,
    });
  }

  // Sort: Emergency accounts first (descending score), then vote count descending
  rows.sort((a, b) => b.score - a.score || b.votesCount - a.votesCount);

  const headerStr = ` ${"STATUS".padEnd(6)} | ${"VOTER NAME".padEnd(18)} | ${"EMAIL".padEnd(28)} | ${shortHeaders.map((h) => h.padStart(6)).join(" | ")} | ${"TOTAL"} | ${"SCORE"}`;
  const divider = "-".repeat(headerStr.length);

  console.log(divider);
  console.log(headerStr);
  console.log(divider);

  for (const r of rows) {
    const status = r.score >= 75 ? "EMERG " : r.score >= 60 ? "SUSP  " : "OK    ";
    const nameStr = (r.user.name || "Unknown").slice(0, 18).padEnd(18);
    const emailStr = (r.user.email || "No email").slice(0, 28).padEnd(28);

    const cols = sortedSubIds.map((id) => {
      const w = r.wins.get(id) || 0;
      if (w >= 8) return `*${w}*`.padStart(6);
      if (w === 0 && r.votesCount >= 30) return ` 0!`.padStart(6);
      return `${w}`.padStart(6);
    });

    const totalStr = `${r.votesCount}`.padStart(5);
    const scoreStr = `${r.score}`.padStart(5);

    console.log(
      ` ${status} | ${nameStr} | ${emailStr} | ${cols.join(" | ")} | ${totalStr} | ${scoreStr}`,
    );
  }
  console.log(divider);

  console.log("\nLegend:");
  console.log(
    "  EMERG = Score >= 75 (High confidence manipulator) | SUSP = Score >= 60 (Suspicious outlier)",
  );
  console.log(
    "  *8* / *9* = Heavily boosted candidate              | 0! = Completely downvoted competitor",
  );
  console.log("\n💡 Useful CLI Options:");
  console.log(
    "  vp run analyze:votes --emergency        (Show only the emergency flagged accounts)",
  );
  console.log("  vp run analyze:votes --email ajith      (Deep dive on a specific email/name)");

  if (sql) await sql.end();
}

main().catch(async (err) => {
  console.error("❌ Matrix generation failed:", err);
  process.exit(1);
});
