#!/usr/bin/env node
/**
 * Deletes Code-a-Pookalam votes for testers/admins (or specific users) so they can test voting again.
 *
 * It removes votes from `pookalam_votes`, recalculates remaining Elo ratings and match stats
 * on `pookalam_submissions`, and clears `pookalam_standings` cache.
 *
 * Usage:
 *   node --env-file=.env scripts/reset-pookalam-votes.mjs                  # Reset all testers & admins
 *   node --env-file=.env scripts/reset-pookalam-votes.mjs --email foo@bar # Reset a specific user by email
 *   node --env-file=.env scripts/reset-pookalam-votes.mjs --all           # Reset ALL votes across all users
 *   node --env-file=.env scripts/reset-pookalam-votes.mjs --dry-run       # Preview without deleting
 */

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "❌ DATABASE_URL is not set. Run with node --env-file=.env scripts/reset-pookalam-votes.mjs",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isAll = args.includes("--all");
const emailIndex = args.indexOf("--email");
const targetEmail = emailIndex !== -1 ? args[emailIndex + 1]?.trim().toLowerCase() : null;
const userIndex = args.indexOf("--user");
const targetUserId = userIndex !== -1 ? args[userIndex + 1]?.trim() : null;

const sql = postgres(databaseUrl, { max: 1 });

const K_FACTOR = 32;
function expectedScore(rating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}
function applyResult(winnerRating, loserRating) {
  const expected = expectedScore(winnerRating, loserRating);
  return {
    winner: winnerRating + K_FACTOR * (1 - expected),
    loser: loserRating - K_FACTOR * (1 - expected),
  };
}

try {
  console.log("🌸 Code-a-Pookalam Vote Reset Utility");
  if (isDryRun) console.log("🔍 Running in DRY RUN mode (no changes will be applied)\n");

  let targetUsers = [];

  if (isAll) {
    console.log("🎯 Mode: ALL votes across all users");
    const allVoters = await sql`
      SELECT DISTINCT u.id, u.email, u.name, u.role
      FROM pookalam_votes v
      INNER JOIN users u ON u.id = v.voter_id
    `;
    targetUsers = allVoters;
  } else if (targetEmail) {
    console.log(`🎯 Mode: Target email: ${targetEmail}`);
    targetUsers = await sql`
      SELECT id, email, name, role FROM users WHERE LOWER(email) = ${targetEmail}
    `;
    if (targetUsers.length === 0) {
      console.error(`❌ No user found with email "${targetEmail}"`);
      process.exit(1);
    }
  } else if (targetUserId) {
    console.log(`🎯 Mode: Target userId: ${targetUserId}`);
    targetUsers = await sql`
      SELECT id, email, name, role FROM users WHERE id = ${targetUserId}
    `;
    if (targetUsers.length === 0) {
      console.error(`❌ No user found with id "${targetUserId}"`);
      process.exit(1);
    }
  } else {
    console.log("🎯 Mode: Testers & Admins (default)");
    // Find users who are admins, testers, or present in the testers table
    targetUsers = await sql`
      SELECT DISTINCT u.id, u.email, u.name, u.role
      FROM users u
      LEFT JOIN testers t ON LOWER(t.email) = LOWER(u.email)
      WHERE u.role IN ('tester', 'admin') OR (t.active = true AND t.id IS NOT NULL)
    `;
  }

  if (targetUsers.length === 0) {
    console.log("ℹ️  No matching target users found in database.");
    process.exit(0);
  }

  const targetUserIds = targetUsers.map((u) => u.id);
  console.log(`👥 Found ${targetUsers.length} target user(s):`);
  for (const u of targetUsers) {
    const [cnt] = await sql`SELECT count(*)::int as n FROM pookalam_votes WHERE voter_id = ${u.id}`;
    console.log(`   • [${u.role}] ${u.email} (${u.name}) — ${cnt.n} votes cast`);
  }

  const [votesToDelete] = await sql`
    SELECT count(*)::int as n FROM pookalam_votes WHERE voter_id = ANY(${targetUserIds})
  `;

  console.log(`\n📊 Total votes to delete: ${votesToDelete.n}`);

  if (votesToDelete.n === 0) {
    console.log("✅ No votes to remove. Users are already eligible to vote.");
    process.exit(0);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] Would delete votes and recompute Elo ratings for remaining votes.");
    process.exit(0);
  }

  await sql.begin(async (tx) => {
    // 1. Delete target votes
    const deleted = await tx`
      DELETE FROM pookalam_votes
      WHERE voter_id = ANY(${targetUserIds})
      RETURNING id
    `;
    console.log(`🗑️  Deleted ${deleted.length} vote records from pookalam_votes.`);

    // 2. Reset all submissions to baseline Elo
    await tx`
      UPDATE pookalam_submissions
      SET rating = 1200, matches = 0, wins = 0, updated_at = NOW()
    `;

    // 3. Replay remaining votes in chronological order so Elo math stays 100% accurate
    const remainingVotes = await tx`
      SELECT winner_id, loser_id
      FROM pookalam_votes
      ORDER BY created_at ASC
    `;

    if (remainingVotes.length > 0) {
      console.log(
        `🔄 Replaying ${remainingVotes.length} remaining votes to reconstruct accurate Elo ratings...`,
      );
      const subs = await tx`SELECT id, rating, matches, wins FROM pookalam_submissions`;
      const state = new Map(
        subs.map((s) => [s.id, { rating: Number(s.rating), matches: 0, wins: 0 }]),
      );

      for (const vote of remainingVotes) {
        const w = state.get(vote.winner_id);
        const l = state.get(vote.loser_id);
        if (w && l) {
          const next = applyResult(w.rating, l.rating);
          w.rating = next.winner;
          w.matches += 1;
          w.wins += 1;
          l.rating = next.loser;
          l.matches += 1;
        }
      }

      for (const [id, s] of state.entries()) {
        await tx`
          UPDATE pookalam_submissions
          SET rating = ${s.rating}, matches = ${s.matches}, wins = ${s.wins}, updated_at = NOW()
          WHERE id = ${id}
        `;
      }
    }

    // 4. Invalidate cached leaderboard snapshots
    await tx`DELETE FROM pookalam_standings`;
    console.log("🧹 Cleared pookalam_standings cached leaderboards.");
  });

  console.log("\n🎉 Vote reset complete! Target users can now vote again.");
} catch (err) {
  console.error("❌ Failed to reset votes:", err);
  process.exit(1);
} finally {
  await sql.end();
}
