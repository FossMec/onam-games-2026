/**
 * The Code-a-Pookalam beginner road - content and progress.
 *
 * The competition page used to be a brochure: prizes, rules, judging pillars,
 * six tutorial tracks. All true, none of it an answer to "what do I do now?".
 * A first-year who has never run `git init` read that page and concluded the
 * prize was already spoken for by someone with a GitHub streak.
 *
 * So the page is a road instead. Nine stops, in the order a beginner actually
 * needs them. The rules and the judging pillars did not disappear - they became
 * the stop where they matter, which is late, after something is on screen.
 *
 * The shape of a stop is the important part, and every field earns its place:
 *
 *   hook    one line. If somebody reads nothing else, they read this.
 *   steps   two to four tiny actions. This *is* the stop. Nobody reads an essay
 *           on a competition page, so the default state shows only the doing.
 *   more    the explanation, folded away behind a summary. There for the
 *           curious, invisible to everyone in a hurry.
 *   links   where to go when this page stops being enough. Pointing at MDN and
 *           the git cheat sheet beats pretending to be a textbook.
 *   levelUp the same stop on hard mode, for second- and third-years. Every stop
 *           has one, so nobody scrolls nine cards of things they already know
 *           and concludes the page is not for them.
 *
 * Day labels are a suggested pace and nothing else. Submissions are open the
 * whole week and someone starting on Day 5 can still finish; the labels exist
 * so the week reads as a season rather than a deadline, and every mention of
 * them in the UI is paired with permission to ignore them.
 */

import type { SpriteName } from "./sprites";

/** Which existing component, if any, gets mounted inside a stop. */
export type RoadPayload = "past-work" | "tutorials" | "studio" | "rules" | "submit";

export type RoadLink = { label: string; href: string; note: string };

/**
 * How a stop's steps are drawn.
 *
 * Nine identical cards is a form to fill in, not a story - by the third one the
 * eye stops landing. Each stop picks the shape that suits what it is asking
 * for: things to look at swipe, things to do stack as checkable rows, and
 * things you type appear in a terminal, because that is where you will type
 * them.
 */
export type RoadForm = "swipe" | "checklist" | "terminal";

export type RoadStop = {
  /** Stable - it is the localStorage entry and the scroll anchor. Never renumber. */
  id: string;
  /** Suggested pace, never enforced. */
  day: string;
  title: string;
  /** One line. The promise of the stop. */
  hook: string;
  /**
   * The same line with the reader's name in it, used when they are signed in.
   *
   * Written out per stop rather than glued on with a comma, because "Pick one
   * tool, ignore the rest, Aravind" is what glueing gets you. Signed-out
   * visitors get `hook` and never see a placeholder.
   */
  hookNamed: string;
  /** The stop itself: tiny actions, one line each. */
  steps: string[];
  form: RoadForm;
  /**
   * `sandbox` snippets run in the page against a `ctx`, `W`, `H` the sandbox
   * supplies. Everything else is read-only with a copy button - you cannot run
   * `git init` in a canvas.
   */
  code?: { label: string; snippet: string; sandbox?: boolean };
  /** An extra picture where words were doing a picture's job. */
  visual?: "palette" | "petal-dial";
  /** Folded away by default. The why, for whoever wants it. */
  more?: string[];
  links?: RoadLink[];
  /**
   * The question to paste into a chatbot for this stop.
   *
   * AI is allowed in this contest, and a beginner with ChatGPT open is doing
   * what every working developer does. What they lack is the question - so each
   * stop ships one that gets a useful answer, aimed at understanding the stop
   * rather than at producing an entry.
   */
  aiPrompt: string;
  /**
   * What you just earned, said once, after you tick the stop.
   *
   * Not a fanfare - an earlier version threw a shout across the card and it
   * read as a slot machine. A first-year who has just made a computer draw a
   * circle does not know that is a real skill; somebody has to tell them, in
   * plain words, and then get out of the way.
   */
  praise: string;
  levelUp?: string;
  /** Flat `--pop-*` name. Colours this leg of the road and the stop's card. */
  pop: string;
  sprite: SpriteName;
  payload?: RoadPayload;
  /** An honest small number. "Two hours" scares people off; ten minutes does not. */
  minutes: string;
};

export const ROAD_STOPS: RoadStop[] = [
  {
    id: "see-it",
    day: "Day 1",
    title: "Look at what you're making",
    hook: "Scroll. That is the whole stop. Enjoy it while it lasts.",
    hookNamed: "Scroll, {name}. That is the whole stop - enjoy it while it lasts.",
    steps: [
      "Scroll the gallery below. All students, last year, same contest.",
      "Pick two you love and one you think you could actually manage.",
      "Note that no name appears on the voting screen. Not yours, not theirs.",
    ],
    form: "swipe",
    more: [
      "A pookalam is a flower carpet: rings of petals around a centre, one shape repeated until it turns into a flower. Coding one means writing the instructions instead of sitting on the floor at 6am placing petals by hand.",
      "Day 7 voting is anonymous - two pookalams side by side, pick one. No profile, no follower count, no college. A first attempt and a final-year's attempt get judged the same way, by strangers, on the picture alone.",
    ],
    links: [
      {
        label: "Wikipedia · Pookkalam",
        href: "https://en.wikipedia.org/wiki/Pookkalam",
        note: "what it is, and why Onam has one",
      },
      {
        label: "The Coding Train",
        href: "https://thecodingtrain.com/",
        note: "beginner creative-coding videos",
      },
    ],
    aiPrompt:
      "I am a first-year student. Explain what an Onam pookalam is, what makes one look good, and list 5 simple ways a beginner could draw one using code. Keep it under 200 words.",
    praise:
      "You know what you are building now, and you have seen that students made every one of these. That is a better start than most people get.",
    levelUp: "Find the one thing nobody tried last year. That gap is your entry.",
    pop: "pop-yellow",
    sprite: "concentric-pookalam",
    payload: "past-work",
    minutes: "5 min",
  },
  {
    id: "pick-a-tool",
    day: "Day 1",
    title: "Pick one tool, ignore the rest",
    hook: "You leave with an empty file you can draw in.",
    hookNamed: "you leave this stop with an empty file you can draw in.",
    steps: [
      "Any language works. The tracks below are examples, not a menu.",
      "Never installed anything? Use the browser - press F12, you already have it.",
      "Did Python in class? Use turtle. Same lab exercise, better prize.",
      "Whatever you pick, stay on it. Switching on Day 4 is how this goes wrong.",
    ],
    form: "swipe",
    more: [
      "Switching tools halfway through the week is the most popular way this goes wrong, and it has never once produced a better pookalam. Which tool you use matters far less than the hours you put into one of them.",
      "The six tracks below are the ones people reached for last year - they are starting points, not a list of allowed options. C, Java, Rust, a spreadsheet, a plotter, whatever you have: if code produced the picture, it counts, and nobody gets points for picking a harder language.",
    ],
    links: [
      {
        label: "MDN · Canvas tutorial",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial",
        note: "the browser track, from zero",
      },
      {
        label: "Python turtle docs",
        href: "https://docs.python.org/3/library/turtle.html",
        note: "the one from first-year lab",
      },
      {
        label: "Trinket · Python in a browser",
        href: "https://trinket.io/python",
        note: "if you cannot install Python",
      },
      {
        label: "p5.js · get started",
        href: "https://p5js.org/tutorials/get-started/",
        note: "creative coding, very friendly",
      },
    ],
    aiPrompt:
      "I want to make an Onam pookalam - a round flower carpet - out of code, and I have barely written any code before. Compare doing it in the browser with HTML canvas against doing it in Python turtle: which one gets something on my screen tonight? Then give me the few lines I need to start.",
    praise: "Decision made. Deciding was the hard part of today - everything after this is typing.",
    levelUp:
      "Shaders, WebGL, Manim, Graphviz, PostScript, a pen plotter, a Minecraft world - anything that renders counts, and the weirder the medium the better the README reads.",
    pop: "pop-teal",
    sprite: "terminal-star",
    payload: "tutorials",
    minutes: "10 min",
  },
  {
    id: "first-shape",
    day: "Day 2",
    title: "Draw one circle",
    hook: "One shape on screen. Yes, that is today's entire goal.",
    hookNamed: "One shape on screen. Yes, that is today's entire goal.",
    steps: [
      "Look right - that circle came from the code on the left.",
      "Change the 60 to 140 and press Run.",
      'Change the colour to "#5FBFA8" and press Run again.',
      "That is it. You just drew with code. Close the laptop.",
    ],
    form: "checklist",
    code: {
      label: "your first drawing - edit it, run it",
      sandbox: true,
      snippet: `// ctx is your brush. W and H are the canvas size.
ctx.beginPath();
ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);  // x, y, radius
ctx.fillStyle = "#F5C443";
ctx.fill();`,
    },
    more: [
      "Everybody wants to skip to the pretty part and everybody regrets it. The moment a computer draws one dot because you told it to, the entire rest of this road is repetition of that.",
      "The same code works in your own browser: press F12 on any page, open the Console tab, make a canvas and paste it. Broke something? Reset puts the snippet back - you cannot damage anything here.",
    ],
    links: [
      {
        label: "MDN · drawing shapes",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes",
        note: "arcs, rectangles, paths",
      },
    ],
    aiPrompt:
      'I am making a pookalam out of code and this is my first line of it: ctx.beginPath(); ctx.arc(180, 180, 60, 0, Math.PI * 2); ctx.fillStyle = "#F5C443"; ctx.fill(); Explain every word and number in it to somebody who has never written code. What do I change to move it or make it bigger?',
    praise:
      "You just made a computer draw something because you told it to. Every pookalam on this page started with exactly that, and so does every app you have ever used.",
    levelUp:
      "Skip ahead and build the pipeline instead: one 2000×2000 offscreen canvas, one `render(seed)`, one export call. Future-you at 11:47pm on Day 6 says thanks.",
    pop: "pop-blue",
    sprite: "pookalam-flower",
    minutes: "10 min",
  },
  {
    id: "make-it-round",
    day: "Day 3",
    title: "Make it go round",
    hook: "One petal becomes twelve. This is the whole trick.",
    hookNamed: "One petal becomes twelve. This is the whole trick.",
    steps: [
      "One loop, twelve turns, one petal each turn. That is the ring on the right.",
      "Those are leaves, not dots - `ellipse` takes a length and a width.",
      "Change `petals` to 6. Run. Then 24. Then 60.",
      "Change `radius` to 60, then 160. Watch the ring breathe.",
    ],
    form: "checklist",
    visual: "petal-dial",
    code: {
      label: "twelve leaves in a ring - change a number, run it",
      sandbox: true,
      snippet: `const petals = 12;
const radius = 110;

for (let i = 0; i < petals; i++) {
  ctx.save();
  ctx.translate(W / 2, H / 2);              // work from the centre
  ctx.rotate((i * 2 * Math.PI) / petals);   // turn a bit, every time

  ctx.beginPath();
  ctx.ellipse(radius, 0, 36, 14, 0, 0, Math.PI * 2);  // a leaf: long, thin

  if (i % 2 === 0) {
    ctx.fillStyle = "#E76F51";
  } else {
    ctx.fillStyle = "#F5C443";
  }
  ctx.fill();

  ctx.restore();
}`,
    },
    more: [
      "cos and sin are the two from the class everyone thought was pointless. Walk around a circle in equal steps and they hand you the x and y of each step. That is all the maths on this entire road - there is none after this stop.",
      "`translate` moves the pen to the centre, `rotate` turns the whole canvas a little, and the leaf is always drawn in the same place - the canvas does the arranging. `save` and `restore` put things back so the next petal starts clean.",
    ],
    links: [
      {
        label: "Polar coordinates, visually",
        href: "https://www.mathsisfun.com/polar-cartesian-coordinates.html",
        note: "angle + radius → x, y",
      },
      {
        label: "Generative Artistry",
        href: "https://generativeartistry.com/tutorials/",
        note: "short tutorials, huge idea supply",
      },
    ],
    aiPrompt:
      "A pookalam is one petal repeated around a circle. Explain how to work out where each petal goes, to somebody whose last maths class was in school. Include a 10-line example that places 12 petals in a ring, and explain the line that calculates the angle.",
    praise:
      "You wrote a loop with maths inside it. That is real programming - the same repeat-a-thing idea behind games, animations and most of what you will build later.",
    levelUp:
      "Swap the ellipse for a bezier petal (`moveTo` + two `bezierCurveTo`) and you get a real chethi petal instead of a leaf. Same loop, far better shape.",
    pop: "pop-purple",
    sprite: "git-nodes",
    minutes: "20 min",
  },
  {
    id: "rings-and-colour",
    day: "Day 4",
    title: "Rings, colour, taste",
    hook: "Your ring becomes a pookalam. This is the fun day.",
    hookNamed: "Your ring becomes a pookalam, {name}. This is the fun day.",
    steps: [
      "Same ring as yesterday, four times over. Each line of `rings` is one ring.",
      "A line is: how many petals, how far out, how long, how wide.",
      "Hit Run twice. `Math.random()` picks the colours, so every run is new.",
      "Add a line of your own. Delete one. Change the colours. Run after each.",
    ],
    form: "checklist",
    visual: "palette",
    code: {
      label: "four rings, random colours - hit Run twice",
      sandbox: true,
      snippet: `ctx.fillStyle = "#1A0826";            // the dark ground
ctx.fillRect(0, 0, W, H);

const colours = ["#E63946", "#F4A261", "#2A9D8F", "#F5C443", "#9C82D4"];

// one line per ring: petals, distance out, petal length, petal width
const rings = [
  [24, 150, 38, 13],
  [16, 108, 34, 17],
  [24, 74, 26, 9],
  [12, 40, 26, 15],
];

for (let r = 0; r < rings.length; r++) {
  const petals = rings[r][0];
  const radius = rings[r][1];
  const long = rings[r][2];
  const wide = rings[r][3];

  // one random colour for the whole ring - this is why every run differs
  const colour = colours[Math.floor(Math.random() * colours.length)];

  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate((i * 2 * Math.PI) / petals + r);   // + r nudges each ring round
    ctx.beginPath();
    ctx.ellipse(radius, 0, long, wide, 0, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
  }
}

// the lamp in the middle
ctx.beginPath();
ctx.arc(W / 2, H / 2, 20, 0, Math.PI * 2);
ctx.fillStyle = "#FFFFFF";
ctx.fill();`,
    },
    more: [
      "`Math.random()` is doing the same job as the Randomize button in the studio at the top of this page - your twenty lines and that whole panel are the same idea, and yours took an evening. Keeping the palette fixed and randomising only which ring gets which colour is why it still looks deliberate rather than like a paint accident.",
      "Everything that makes a pookalam is in that table: ring count, spacing, petal shape and colour. Adding a ring is one line, and that is the point - the code stays small while the picture gets complicated.",
      "Colour is where most entries are won and lost, and it is worth stealing rather than inventing: pull four colours off a photo of a real pookalam. Six rings is plenty - more rings is not the same as better.",
    ],
    links: [
      {
        label: "Coolors · palette generator",
        href: "https://coolors.co/",
        note: "steal a palette in 30 seconds",
      },
      {
        label: "MDN · ellipse()",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/ellipse",
        note: "the leaf shape, explained",
      },
    ],
    aiPrompt:
      "Here is my code that draws rings of petals: [paste yours]. Give me 5 small changes that would make it look more like a real Onam pookalam - petal shapes instead of dots, better colours, a border, something in the centre. Keep each change under 10 lines and explain it in plain words.",
    praise:
      "There is a pookalam on your screen and your code made it. Send it to someone. Seriously, right now.",
    levelUp:
      "Chevron outer border, a nilavilakku centre, `globalCompositeOperation` for petal overlap, or a seeded RNG so one program makes a different pookalam every run.",
    pop: "pop-pink",
    sprite: "muthukuda",
    payload: "studio",
    minutes: "one evening",
  },
  {
    id: "git",
    day: "Day 5",
    title: "Save your work with git",
    hook: "An undo button that never expires.",
    hookNamed: "{name} this undo button that never expires.",
    steps: [
      "Check you have it: `git --version`.",
      "In your project folder: `git init`.",
      '`git add .`, then `git commit -m "first pookalam"`.',
      "Do that again every time something works.",
    ],
    // No code block here on purpose - the terminal above *is* the commands.
    // Printing them twice was the stop reading as a manual.
    form: "terminal",
    more: [
      "git takes a snapshot of your folder whenever you ask. Each snapshot is a commit and you can return to any of them, forever. That is genuinely the whole idea - everything frightening about git is people arguing over branching strategies, which you can ignore this week.",
      "Ruined everything? `git checkout .` throws away changes since the last commit. That safety net is the entire reason to commit often instead of once at the end.",
    ],
    links: [
      {
        label: "GitHub · git cheat sheet",
        href: "https://education.github.com/git-cheat-sheet-education.pdf",
        note: "one page, print it",
      },
      {
        label: "Oh Shit, Git!?!",
        href: "https://ohshitgit.com/",
        note: "for when you break it",
      },
    ],
    aiPrompt:
      "Explain git to a complete beginner in under 150 words: what a commit is, what git add does, and the four commands I need to save a project. No branches, no merging, no jargon.",
    praise:
      "Your work is safe forever, and you can use git on every project after this one. That skill outlives Onam by about forty years.",
    levelUp:
      "Tag the commit that produced your final render and say so in the README. A judge being able to run the exact code behind the picture is worth real points.",
    pop: "pop-teal",
    sprite: "git-branch",
    minutes: "15 min",
  },
  {
    id: "github",
    day: "Day 5",
    title: "Push it up, with a LICENSE",
    hook: "A link you can paste into the form. Also your first open-source repo.",
    hookNamed: "A link you can paste into the form - and your first open-source repo.",
    steps: [
      "GitHub account → New repository → Public → tick nothing else.",
      "Paste the three commands GitHub shows you.",
      "Add file → new file → name it `LICENSE` → pick MIT from the templates.",
      "Add a README.md: how to run it, and what you were going for.",
    ],
    form: "terminal",
    code: {
      label: "GitHub prints these right after you create the repo",
      snippet: `git remote add origin https://github.com/YOUR-NAME/pookalam.git
git branch -M main
git push -u origin main`,
    },
    more: [
      "The LICENSE is not paperwork, it is the rule that makes this a FOSS event: without one nobody is legally allowed to use or learn from your code, and the entry is not valid. MIT, Apache 2.0, GPLv3, BSD and Unlicense all count.",
      "The README decides whether a judge sees your work or only a screenshot of it. Two honest lines beat a template with nothing filled in.",
    ],
    links: [
      {
        label: "GitHub · create a repo",
        href: "https://docs.github.com/en/get-started/quickstart/create-a-repo",
        note: "official, step by step",
      },
      {
        label: "choosealicense.com",
        href: "https://choosealicense.com/",
        note: "pick one in a minute",
      },
      {
        label: "makeareadme.com",
        href: "https://www.makeareadme.com/",
        note: "what to actually write",
      },
    ],
    aiPrompt:
      "Walk me through putting an existing folder on GitHub as a public repository, step by step, including adding an MIT LICENSE file and a short README. I have never used GitHub and I am on Windows.",
    praise:
      "You have a public open-source repository with your name on it. That link belongs on your CV from today.",
    levelUp:
      "A GitHub Action that regenerates the render on every push, output committed. Reproducibility is a judging pillar and almost nobody bothers.",
    pop: "pop-yellow",
    sprite: "octocat-garland",
    minutes: "20 min",
  },
  {
    id: "judging",
    day: "Day 6",
    title: "What the judges look at",
    hook: "Read this now, not at 11:50pm on Day 6.",
    hookNamed: "Read this now. Not at 11:50pm on Day 6.",
    steps: [
      "Square image - equal width and height, or the upload refuses it.",
      "No name, handle, watermark or logo anywhere in it.",
      "Public repo, with a LICENSE file in it.",
      "The picture has to be something your code made.",
    ],
    form: "swipe",
    more: [
      "Two of those are about the file you upload, and both are far easier to get right the first time than to redo at midnight while everyone else eats payasam.",
      "The pillars below are not a checklist to sweep. Nobody wins all five, and a simple pookalam with clean code and an honest README beats an elaborate one nobody can run.",
    ],
    links: [
      {
        label: "What open source means",
        href: "https://opensource.org/osd",
        note: "the definition your LICENSE points at",
      },
      {
        label: "choosealicense.com",
        href: "https://choosealicense.com/",
        note: "pick one in under a minute",
      },
    ],
    aiPrompt:
      "Here is my pookalam code and its output description: [paste yours]. Judge it honestly against these five criteria - visual quality, technical craft, originality, resemblance to a real pookalam, and how easily somebody could clone and run it. Tell me the two weakest ones and how to fix them.",
    praise: "You know exactly what is being judged. Nothing left on Day 6 can surprise you.",
    levelUp:
      "Originality is the pillar with the most room left in it. Everyone optimises polish; almost nobody submits a concept.",
    pop: "pop-blue",
    sprite: "nilavilakku",
    payload: "rules",
    minutes: "5 min",
  },
  {
    id: "submit",
    day: "Day 6",
    title: "Export a square PNG, submit",
    hook: "You're in the competition.",
    hookNamed: "{name}, you're in the competition.",
    steps: [
      "Make sure the canvas is square, then run the export line below.",
      "Give it a title - no names in it, voting is anonymous.",
      "Paste the repo link, attach the PNG, submit.",
      "Improve it afterwards. Edits stay open until Day 6 midnight.",
    ],
    form: "checklist",
    code: {
      label: "download your canvas as a PNG",
      snippet: `const a = document.createElement("a");
a.download = "pookalam.png";
a.href = c.toDataURL("image/png");
a.click();`,
    },
    more: [
      "Python turtle can save with `turtle.getcanvas().postscript(...)`, and an honest screenshot cropped square is completely fine too. Minimum 320×320, resized down to 1024, so bigger is better.",
      "A submitted average pookalam beats a magnificent one that missed the deadline by ten minutes. This happens to somebody every single year. Do not let it be you.",
    ],
    links: [
      {
        label: "MDN · canvas.toDataURL()",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL",
        note: "canvas → image file",
      },
    ],
    aiPrompt:
      "I made a pookalam with code and have to submit it as a square picture. How do I save what is on my canvas as a PNG at 2000x2000, and how do I check the file is exactly square before I upload it?",
    praise:
      "You entered a coding competition. A week ago you may not have written a single line of code, and now you have finished something and handed it in.",
    levelUp:
      "Render at 2000×2000 and let the downscale do your anti-aliasing. Costs nothing, reads visibly crisper beside a 600px screenshot.",
    pop: "pop-red",
    sprite: "floppy-onam",
    payload: "submit",
    minutes: "10 min",
  },
];

/**
 * Progress, kept in localStorage on purpose.
 *
 * Per device rather than per account, so it survives signing out and back in,
 * and so someone can read the whole road and tick stops off before they have
 * ever signed in. Nothing here is competitive, so there is nothing to gain by
 * faking it and no reason to spend a table on it.
 */

const KEY = "pookalam:road:v1";
const NOTES_KEY = "pookalam:road-notes:v1";
const RATINGS_KEY = "pookalam:road-ratings:v1";
const CHECKS_KEY = "pookalam:entry-checks:v1";

/** One try/catch for every stored value on this page. */
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? ((JSON.parse(raw) as T) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode. Everything here is a convenience, so losing it is fine.
  }
}

/**
 * Records come back shape-checked, not just parsed.
 *
 * Everything here is editable by hand in devtools, so a stored value is input
 * like any other: a note that came back as a number would be handed to a
 * textarea, and a rating that came back as an object would be compared with
 * `>=`. Anything that is not the expected primitive is dropped on read.
 */
function readRecord<T extends string | number>(key: string, kind: "string" | "number") {
  const raw = readJson<Record<string, unknown>>(key, {});
  const clean: Record<string, T> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw)) {
      if (typeof value === kind) clean[id] = value as T;
    }
  }
  return clean;
}

/** The scribble on the sticky note pinned to each stop, keyed by stop id. */
export function readRoadNotes(): Record<string, string> {
  return readRecord<string>(NOTES_KEY, "string");
}

export function writeRoadNotes(notes: Record<string, string>): void {
  writeJson(NOTES_KEY, notes);
}

/** "How did that go", 1-5, keyed by stop id. Nobody sees it but you. */
export function readRoadRatings(): Record<string, number> {
  return readRecord<number>(RATINGS_KEY, "number");
}

export function writeRoadRatings(ratings: Record<string, number>): void {
  writeJson(RATINGS_KEY, ratings);
}

/** The four disqualifying checks at the judging stop. */
export function readEntryChecks(): string[] {
  const value = readJson<string[]>(CHECKS_KEY, []);
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function writeEntryChecks(ids: string[]): void {
  writeJson(CHECKS_KEY, ids);
}

export function readRoadProgress(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    // Private mode, or someone edited the value by hand. Start from zero.
    return [];
  }
}

export function writeRoadProgress(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage is a convenience here; the road still works without it.
  }
}

export function clearRoadProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}

/**
 * Jump to a stop, honouring the reduced-motion setting.
 *
 * The links that call this are real `href="#id"` anchors underneath, so the
 * jump still happens without JS - this only upgrades it to a glide, which is
 * worth having on a page whose whole point is that it is one long journey.
 */
export function scrollToAnchor(id: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
