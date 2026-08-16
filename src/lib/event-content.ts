/**
 * All landing-page and Code-a-Pookalam copy, in one editable place.
 *
 * Kept out of the JSX deliberately: the words are not final and will change
 * several times before launch, and whoever edits them should not have to read
 * a component to do it. Nothing here is used for logic - game behaviour lives
 * in `src/server/games/registry.ts`.
 *
 * PLACEHOLDER VALUES are marked TODO. Dates, prize amounts and links must be
 * confirmed before this goes public.
 */

import type { SpriteName } from "./sprites";

export const EVENT = {
  name: "FOSS ONAM",

  /**
   * The hero's numbers, as chips rather than a sentence.
   *
   * A row of big numerals is read at a glance where a line of small bold text
   * just adds to the wall.
   *
   * The old tagline's "zero dignity" is not among them. It worked as the
   * punchline of a sentence and meant nothing stranded in a chip of its own -
   * a reader gets "0 DIGNITY" with no setup and no idea what it refers to. The
   * prize is the fact worth the fourth slot anyway.
   */
  stats: [
    { value: "7", label: "days" },
    { value: "6", label: "mini-games" },
    { value: "1", label: "pookalam" },
    { value: "₹5K+", label: "prize pool" },
  ],

  /**
   * The one paragraph, doing the work two used to.
   *
   * The hero previously ran a search-engine sentence and this blurb back to
   * back, which said the same thing twice in small type and pushed the buttons
   * off a phone screen. The fix was deleting the duplicate, not trimming this -
   * an intermediate draft cut it to a terse list and lost all of the warmth.
   */
  blurb:
    "A celebration of Onam and open source, run by fossmec. Create an intricate flower carpet purely with code in Code-a-Pookalam (open all week), and play a fun new mini-game every evening to climb the leaderboard and win daily cash prizes!",
  // TODO: confirm before launch.
  dates: "TODO - event dates",
  registerNote: "Sign in with Google. Takes about eleven seconds.",

  about: {
    title: "About FOSS ONAM",
    headline: "Seven days of games, code, and celebration",
    description:
      "FOSS ONAM is the inaugural open-source festival created by FOSS MEC (Model Engineering College), expanding our annual Code-a-Pookalam competition into a full week of celebrations. We bring together students, developers, and puzzle enthusiasts for 6 daily mini-games, algorithmic pookalam design, and collaborative community art — celebrating Onam through code.",
    features: [
      {
        title: "6 Daily Puzzle Challenges",
        icon: "maveli-laptop" as SpriteName,
        pop: "pop-yellow",
        body: "A fresh mini-game unlocks each day. Complete the challenge to win daily ₹200 cash bounties.",
      },
      {
        title: "Code-a-Pookalam Contest",
        icon: "pookalam-flower" as SpriteName,
        pop: "pop-teal",
        body: "Design a flower carpet purely with code (Canvas, SVG, or CSS). Compete for ₹3,000 podium prizes judged by peer ELO voting.",
      },
      {
        title: "Live Community Pookalam",
        icon: "sadya-leaf" as SpriteName,
        pop: "pop-pink",
        body: "Pick authentic flower petals and post wishes on the real-time collaborative canvas.",
      },
      {
        title: "100% Free & Open Source",
        icon: "foss-mec-badge" as SpriteName,
        pop: "pop-purple",
        body: "Free entry for everyone with ₹5,000+ total prize pool. Built by FOSS MEC and fully open source under GPLv3.",
      },
    ],
    auth: {
      title: "Why Sign in with Google?",
      body: "Google Sign-In is used solely for secure account authentication: saving your puzzle solve times, tracking daily prize eligibility, and verifying contest submissions. We do not request or access any private files, contacts, or sensitive data.",
    },
  },

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
      body: "Refresh, close the tab, throw your phone - the timer keeps ticking server-side. Finish the run you started.",
    },
    {
      title: "Daily cash prizes",
      body: "Top the daily leaderboard each evening to take home ₹200 cash for that day's challenge.",
    },
    {
      title: "Code-a-Pookalam contest",
      body: "Code-a-Pookalam winners take home ₹1,500 (1st), ₹1,000 (2nd), and ₹500 (3rd) in cash prizes!",
    },
    {
      title: "Fair play & server verification",
      body: "All moves and solve times are cryptographically verified on the backend. Pure skill only.",
    },
  ],

  scoring: {
    title: "Daily Competition Rankings",
    body: "Each day is an independent race against the clock. The player with the fastest verified solve time (or highest score in arcade mode) takes that day's ₹200 cash prize!",
    aside: "seven days, seven independent chances to win",
  },

  prizes: [
    {
      rank: "Daily Game Champions (7 Days)",
      detail: "₹200 cash each day - Awarded to the #1 verified player for that day's challenge",
    },
    {
      rank: "Code-a-Pookalam 1st Place",
      detail: "₹1,500 cash prize - Crowned best algorithmic coded pookalam",
    },
    {
      rank: "Code-a-Pookalam 2nd & 3rd",
      detail: "₹1,000 (2nd) & ₹500 (3rd) - Podium runners-up cash prizes",
    },
    {
      rank: "Best Voter Bounty",
      detail: "₹200 for the sharpest eyes - spot the best pookalam and it's yours!",
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
      q: "How can I join FOSS MEC?",
      a: "Join our community WhatsApp groups! The next recruitment will take place in the upcoming semester. Follow foss.mec.ac.in and our community channels for announcements.",
    },
    {
      q: "How and when do I get my cash prize if I win?",
      a: "Daily winners (₹200) and Code-a-Pookalam winners (up to ₹1,500) will be contacted directly through their WhatsApp number or email registered on their account right after results are verified. Payouts are made via UPI.",
    },
    {
      q: "Do I need to know how to code?",
      a: "For the daily games, no. Not even slightly - they're pure arcade reflex, puzzle, and mini-game fun. For Code-a-Pookalam, yes - that one is all about algorithmic pookalam generation.",
    },
    {
      q: "Is it true that the lore behind Maveli is that he got stuck in Vim?",
      a: "Legend has it Maveli accidentally typed `vim onam.txt` in 800 AD and couldn't figure out how to exit. Every year on Thiruvonam he manages a brief `:wq!` escape to visit Kerala, only to end up right back in Vim again.",
    },
    {
      q: "I missed a day. Can I still win?",
      a: "Yes! Every day's game is an independent competition with its own ₹200 daily cash prize. Missed days don't hold you back from winning future days.",
    },
    {
      q: "Can I play on my phone?",
      a: "Yes! Every single mini-game and the entire platform is responsive and optimized for mobile browsers.",
    },
    {
      q: "Is this only for MEC students?",
      a: "No, anyone can participate! Select 'Other' during registration and mention your college.",
    },
    {
      q: "Can I play while in a post-Sadya food coma?",
      a: "Scientifically proven to reduce reaction times by 40%, but highly encouraged. If you can top the daily leaderboard after 3 rounds of Payasam and Pappadam, you deserve legendary status.",
    },
    {
      q: "Does Maveli run Linux?",
      a: "Maveli runs Arch Linux (btw), Linus Torvalds loves Sadya, and Tux is officially the open-source mascot of Kerala.",
    },
    {
      q: "Can I use AI to help create my Code-a-Pookalam?",
      a: "Yes! AI assistance (Claude, ChatGPT, Gemini, Copilot, Cursor, etc.) is 100% permitted. However, you must submit runnable source code and a rendered snapshot of the output. Pure raw image generations without code do not count - the output must be driven by executable code.",
    },
    {
      q: "What if I find a bug?",
      a: "Tell us immediately on our community channels! Finding and reporting a bug is appreciated; exploiting one for unfair score advantage leads to immediate disqualification.",
    },
  ],
} as const;

/**
 * The Code-a-Pookalam competition - the one event that isn't a timed game.
 * Runs alongside the week and is judged separately.
 */
export const POOKALAM = {
  title: "Code-a-Pookalam",
  tagline: "Code your floral masterpiece. Geometry, algorithms, shaders, or turtle math.",
  blurb:
    "A pookalam is a flower carpet laid out on the ground for Onam - radial, symmetric, and gloriously intricate. Your mission is to code one from scratch. Use HTML Canvas, SVG, CSS, Python Turtle, Graphviz, Shaders, or p5.js. AI assistance is welcome as long as your output is driven by executable code!",

  submitBy: "Day 6 (Before 11:59 PM IST)",
  votingOn: "Day 7 (All-day Community ELO Arena)",

  rules: [
    "Submit a link to your runnable source (GitHub repo, Gist, GitLab, Codeberg, CodePen or similar) AND upload the rendered image.",
    "The render must be square (1:1). We check the shape in your browser before it uploads, so a widescreen screenshot will be refused on the spot.",
    "No name, handle, watermark, signature or logo anywhere in the image. Day 7 voting is anonymous - anything identifying you gets the entry pulled.",
    "AI assistance is fully allowed! Use LLMs, shader generators, or creative coding prompts - as long as you submit clean, runnable code that produces the render.",
    "Any language or medium goes: HTML5 Canvas, SVG, CSS, Python (Turtle / Pygame / Matplotlib), Graphviz, GLSL Shaders, p5.js, Processing, or ASCII art.",
    "The design must read as a pookalam: radial, layered, and geometrically balanced.",
    "Open-source spirit: include a short README or note explaining your concept and approach.",
  ],

  judging: [
    {
      name: "Visual Quality & Polish",
      body: "Harmonious color palettes, crisp geometry, and high-impact aesthetics.",
    },
    {
      name: "Technical Complexity & Craft",
      body: "Clever algorithmic logic, procedural math, shader depth, or creative constraints.",
    },
    {
      name: "Originality & Concept",
      body: "Unique themes, unexpected cultural motifs, generative surprises, or clever storytelling.",
    },
    {
      name: "Closeness to Real Pookalam",
      body: "Authentic radial layers, floral petals, and recognizable Onam soul.",
    },
    {
      name: "Open-Source & Reproducibility",
      body: "Clean, documented, and easily runnable code that inspires the community.",
    },
  ],

  votingBlurb:
    "After submissions close on Day 6, our jury shortlists the top standout pookalams. On Day 7, these entries face off in an all-day live pairwise Elo matchmaker arena where the entire community votes! You never see a name - just two pookalams and one question. Pick enough pairs and you land on the voters' leaderboard, ranked on how well you called it rather than how fast you tapped.",

  aside: "someone will submit a fractal. someone always submits a fractal.",
} as const;
