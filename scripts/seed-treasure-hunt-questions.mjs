// Seeds or updates treasure hunt questions from scripts/treasure-hunt-questions.json
//
// Usage: node --env-file=.env scripts/seed-treasure-hunt-questions.mjs
// Destructive: clears existing questions + progress and re-inserts (non-production use).
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const jsonPath = path.join(process.cwd(), "scripts", "treasure-hunt-questions.json");
if (!fs.existsSync(jsonPath)) {
  console.error("Cannot find scripts/treasure-hunt-questions.json");
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, "utf8");
const questions = JSON.parse(raw);

console.log(
  `Seeding ${questions.length} treasure hunt questions (destructive — clearing existing)...`,
);

// Clear progress first due to FK (current_question_id -> hunt_questions.id ON DELETE SET NULL)
await sql`delete from user_hunt_progress`;
await sql`delete from hunt_questions`;

for (const q of questions) {
  await sql`
    insert into hunt_questions (
      slug, title, hint_html, answer, difficulty, order_index, active, updated_at
    ) values (
      ${q.slug},
      ${q.title},
      ${q.hintHtml},
      ${q.answer},
      ${q.difficulty},
      ${q.orderIndex || 0},
      true,
      now()
    )
    on conflict (slug) do update set
      title = excluded.title,
      hint_html = excluded.hint_html,
      answer = excluded.answer,
      difficulty = excluded.difficulty,
      order_index = excluded.order_index,
      active = excluded.active,
      updated_at = now()
  `;
}

console.log(`Successfully seeded/updated ${questions.length} treasure hunt questions.`);
await sql.end();
