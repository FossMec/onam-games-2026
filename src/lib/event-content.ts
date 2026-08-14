/**
 * All landing-page and Code-a-Pookalam copy, in one editable place.
 *
 * Kept out of the JSX deliberately: the words are not final and will change
 * several times before launch, and whoever edits them should not have to read
 * a component to do it. Nothing here is used for logic — game behaviour lives
 * in `src/server/games/registry.ts`.
 *
 * PLACEHOLDER VALUES are marked TODO. Dates, prize amounts and links must be
 * confirmed before this goes public.
 */

export const EVENT = {
  name: "FOSS Onam Games",
  tagline: "Seven days. Six mini-games. One pookalam. Zero dignity.",
  blurb:
    "A celebration of Onam and open source, run by fossmec. Create an intricate flower carpet purely with code in Code-a-Pookalam (open all week), and play a fun new mini-game every evening to climb the leaderboard and win daily cash prizes!",
  // TODO: confirm before launch.
  dates: "TODO — event dates",
  registerNote: "Sign in with Google. Takes about eleven seconds.",

  howItWorks: [
    {
      title: "A game a day",
      body: "One new mini-game unlocks every evening. Solve it fast to top that day's board.",
    },
    {
      title: "Code-a-Pookalam",
      body: "Create an intricate pookalam purely using code (HTML Canvas, SVG, or CSS). Submissions stay open all week!",
    },
    {
      title: "Everyone gets the same puzzle",
      body: "Same seed, same puzzle, same difficulty for all players. Zero unfair advantages.",
    },
    {
      title: "One shot per game",
      body: "You only get one official ranked run per game once you hit Start. Make every second count.",
    },
    {
      title: "The clock does not stop",
      body: "Refresh, close the tab, throw your phone — the timer keeps ticking server-side. Finish the run you started.",
    },
    {
      title: "Points over raw seconds",
      body: "Each day you score based on your relative ranking, not raw milliseconds. Consistency across all 7 days wins the crown.",
    },
    {
      title: "Daily & pookalam cash prizes",
      body: "Daily winners receive ₹200 each day. Code-a-Pookalam winners take home ₹1,500, ₹1,000, and ₹500!",
    },
    {
      title: "Fair play & server verification",
      body: "All moves and solve times are cryptographically verified on the backend. Pure skill only.",
    },
  ],

  scoring: {
    title: "How scoring actually works",
    body: "Every game gives up to 1050 points, based on how much of the field you beat that day. Finish first out of 200 and you get the lot. Finish dead last and you still get 50 for turning up. Miss a day and you get nothing, which is the entire retention strategy.",
    aside: "yes we thought about this way too hard",
  },

  prizes: [
    { rank: "Overall Winner", detail: "1st Place Champion — Top of the 7-day points leaderboard" },
    {
      rank: "Code-a-Pookalam 1st",
      detail: "₹1,500 cash prize — Crowned best coded algorithmic pookalam",
    },
    { rank: "Code-a-Pookalam 2nd & 3rd", detail: "₹1,000 (2nd) & ₹500 (3rd) — Podium winners" },
    {
      rank: "Daily Game Winners",
      detail: "₹200 cash each day (7 days) — Announced after each day's deadline",
    },
    {
      rank: "Lucky Voter Winner",
      detail: "₹200 prize drawn randomly among voters in the Day 7 Pookalam ELO showdown",
    },
  ],

  rules: [
    "One account per person, one account per device.",
    "Play it yourself. Don't automate it.",
    "Sharing answers ruins the day for everyone, including you, because it's ranked.",
    "Breaking these means a warning, then a bench, then you're out.",
  ],

  faq: [
    {
      q: "Do I need to know how to code?",
      a: "For the games, no. Not even slightly. For Code-a-Pookalam, yes — that one's the whole point.",
    },
    {
      q: "I missed a day. Am I finished?",
      a: "Not finished, just behind. A missed day is zero points and there's no make-up round, but the week is long and people fall off constantly.",
    },
    {
      q: "Can I play on my phone?",
      a: "That's mostly what we built it for. Every game works on a phone.",
    },
    {
      q: "Is this only for MEC students?",
      a: "No. Anyone can play — pick 'Other' when you sign up and tell us where you're from.",
    },
    {
      q: "What if I find a bug?",
      a: "Tell us. Finding a bug is fine. Quietly farming one is not, and it's the fastest route to a ban.",
    },
  ],
} as const;

/**
 * The Code-a-Pookalam competition — the one event that isn't a timed game.
 * Runs alongside the week and is judged separately.
 */
export const POOKALAM = {
  title: "Code-a-Pookalam",
  tagline: "Draw a pookalam. With code. No image editors, no cheating, no mercy.",
  blurb:
    "A pookalam is a flower carpet laid out on the ground for Onam — radial, symmetric, and absurdly intricate. Your job is to produce one entirely in code. No image files, no tracing, no AI-generated PNG you found. Just geometry, colour, and whatever patience you have left.",

  // TODO: confirm all dates.
  submitBy: "TODO — submission deadline",
  votingOn: "TODO — public voting day",

  rules: [
    "Everything must be generated by your code. No raster assets, no imported artwork.",
    "Any language, any framework, any renderer. Canvas, SVG, p5, turtle, shader, ASCII — your call.",
    "The output must be a pookalam: radial and symmetric. A gradient square is not a pookalam.",
    "Submit the source, not just the picture. We run it.",
    "Original work only. A lightly recoloured tutorial is not your pookalam.",
  ],

  judging: [
    { name: "Visual impact", body: "Does it stop you scrolling?" },
    {
      name: "Technical craft",
      body: "Is the code doing something interesting, or is it 400 hardcoded circles?",
    },
    { name: "Symmetry & structure", body: "Does it read as a real pookalam?" },
    { name: "Originality", body: "Have we seen this exact thing on a tutorial site?" },
  ],

  votingBlurb:
    "Shortlisted entries go to public voting — head-to-head pairs, you pick the better one, ratings settle over the week. Entries stay anonymous while voting is open so nobody wins on friend count alone.",

  aside: "someone will submit a fractal. someone always submits a fractal.",
} as const;
