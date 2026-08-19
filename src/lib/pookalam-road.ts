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
    title: "Explore What's Possible",
    hook: "See how real students turned simple geometry into stunning flower carpets.",
    hookNamed: "See how real students turned simple geometry into stunning flower carpets, {name}.",
    steps: [
      "Browse the student gallery below — every design was generated purely with code.",
      "Notice how simple shapes (circles, ellipses, arcs) layer together to build intricate floral art.",
      "Remember: All submissions are judged anonymously on Day 7, so everyone competes on equal footing.",
    ],
    form: "checklist",
    more: [
      "A pookalam is a traditional Kerala pookalam: concentric rings of flower petals radiating outward from a central point. In Code-a-Pookalam, your code acts as the artist's hand, placing petals mathematically on a digital canvas.",
      "Day 7 voting is completely blind: two pookalams appear side by side without names, colleges, or profiles. First-year beginners and senior developers are judged purely by the beauty and originality of their artwork.",
    ],
    links: [
      {
        label: "Wikipedia · Pookkalam Tradition",
        href: "https://en.wikipedia.org/wiki/Pookkalam",
        note: "Cultural history and floral patterns",
      },
      {
        label: "The Coding Train · Creative Coding",
        href: "https://thecodingtrain.com/",
        note: "Fun beginner videos on creative mathematics",
      },
    ],
    aiPrompt:
      "I am a beginner student wanting to design an Onam flower carpet (pookalam) using code. Explain the basic anatomy of a pookalam (concentric rings, radial symmetry, petal shapes) and suggest 3 easy approaches for a beginner using HTML Canvas or Python.",
    praise:
      "Now you know what a coded pookalam looks like! Every single entry in last year's gallery was built step by step, just like you are doing today.",
    levelUp:
      "Spot a pattern or geometric idea that nobody tried last year — that unique twist is your winning entry.",
    pop: "pop-yellow",
    sprite: "concentric-pookalam",
    payload: "past-work",
    minutes: "5 min",
  },
  {
    id: "pick-a-tool",
    day: "Day 1",
    title: "Choose Your Creative Medium",
    hook: "Pick one language or tool that fits your skill level, and stick with it.",
    hookNamed: "Pick one language or tool that fits your skill level, {name}, and stick with it.",
    steps: [
      "Zero setup? Open any browser and code with HTML5 Canvas or SVG — no installation required.",
      "Know some Python? Use Python's built-in `turtle` module — visual, fast, and beginner-friendly.",
      "Into generative art? Try p5.js, GLSL Shaders, or Processing for advanced math and effects.",
      "Golden rule: Pick one tool today and stick with it throughout the week for the best results.",
    ],
    form: "checklist",
    more: [
      "Switching tools mid-week often slows down progress. The best results come from mastering the creative possibilities of one tool, whether that is pure browser Canvas, Python Turtle, or SVG paths.",
      "Any language or tool is valid as long as code generates your render. Whether you write in JavaScript, Python, C++, Rust, or GLSL, the judges evaluate the final rendered image and the reproducibility of your code.",
    ],
    links: [
      {
        label: "MDN · Canvas Tutorial",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial",
        note: "Start drawing in HTML5 Canvas from scratch",
      },
      {
        label: "Python Turtle Documentation",
        href: "https://docs.python.org/3/library/turtle.html",
        note: "Standard library visual drawing",
      },
      {
        label: "p5.js · Getting Started",
        href: "https://p5js.org/tutorials/get-started/",
        note: "Creative coding library for JavaScript",
      },
    ],
    aiPrompt:
      "I am a beginner wanting to make an algorithmic Onam pookalam. Compare HTML5 Canvas vs Python Turtle for a complete beginner, and provide a 10-line starter template for the one you recommend.",
    praise:
      "Tool selected! Deciding on your weapon of choice is step one — now let's draw your first shape.",
    levelUp:
      "Want an exotic challenge? Explore GLSL fragment shaders, Manim mathematical animations, or Graphviz radial diagrams for extra technical craft.",
    pop: "pop-teal",
    sprite: "terminal-star",
    payload: "tutorials",
    minutes: "10 min",
  },
  {
    id: "first-shape",
    day: "Day 2",
    title: "Draw Your First Shape",
    hook: "One line of code puts a circle on the screen. That is today's entire milestone.",
    hookNamed:
      "One line of code puts a circle on the screen, {name}. That is today's entire milestone.",
    steps: [
      "Look at the editor: `ctx.arc(x, y, radius, startAngle, endAngle)` defines a circle.",
      "Change the radius number `60` to `120` and click 'Run it' to watch it grow.",
      "Change the `ctx.fillStyle` color hex to `#5FBFA8` and click 'Run it' again.",
      "Congratulations! You just wrote and executed procedural graphic code.",
    ],
    form: "checklist",
    code: {
      label: "your first circle — edit the values and click Run",
      sandbox: true,
      snippet: `// ctx is your digital brush. W and H are the canvas width & height.
ctx.beginPath();
ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);  // (centerX, centerY, radius, 0, 360°)
ctx.fillStyle = "#F5C443";
ctx.fill();`,
    },
    more: [
      "Every complex flower carpet is built from fundamental 2D shapes: circles, ellipses, and curved paths. Once you know how to draw and color one circle, the rest of the pookalam is repeating shapes with mathematical precision.",
      "The exact same code runs in any standard web page or browser devtools console. If you make a typo, clicking 'Reset' restores the working snippet instantly.",
    ],
    links: [
      {
        label: "MDN · Drawing 2D Shapes",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes",
        note: "Circles, rectangles, and custom paths",
      },
    ],
    aiPrompt:
      "Explain how `ctx.arc(x, y, radius, 0, Math.PI * 2)` works in HTML5 Canvas to a beginner. How do I change its position, outline thickness, and fill color?",
    praise:
      "You just commanded the computer to draw a geometric shape! Every masterpiece on this site started with that exact line of code.",
    levelUp:
      "Try adding a stroke border with `ctx.strokeStyle = '#22202B'` and `ctx.lineWidth = 4` to give your circle a bold comic-book outline.",
    pop: "pop-blue",
    sprite: "pookalam-flower",
    minutes: "10 min",
  },
  {
    id: "make-it-round",
    day: "Day 3",
    title: "Create a Radial Petal Ring",
    hook: "Use a simple loop to place petals in a perfect 360° circle around the center.",
    hookNamed:
      "Use a simple loop to place petals in a perfect 360° circle around the center, {name}.",
    steps: [
      "A loop runs from 0 to `petals`. Each iteration rotates the canvas by `(2 * Math.PI) / petals`.",
      "Try changing `petals` to `6`, `18`, or `36` in the editor and click 'Run it'.",
      "Change `radius` to `70` or `140` to see how the ring contracts and expands.",
      "Notice how alternating colors with `i % 2 === 0` creates a two-tone floral pattern.",
    ],
    form: "checklist",
    visual: "petal-dial",
    code: {
      label: "12 petals in a radial ring — change values and click Run",
      sandbox: true,
      snippet: `const petals = 12;
const radius = 110;

for (let i = 0; i < petals; i++) {
  ctx.save();
  ctx.translate(W / 2, H / 2);              // Move origin to canvas center
  ctx.rotate((i * 2 * Math.PI) / petals);   // Rotate step-by-step around 360°

  ctx.beginPath();
  ctx.ellipse(radius, 0, 36, 14, 0, 0, Math.PI * 2);  // Petal ellipse: length & width

  if (i % 2 === 0) {
    ctx.fillStyle = "#E76F51";             // Chethi Orange
  } else {
    ctx.fillStyle = "#F5C443";             // Marigold Yellow
  }
  ctx.fill();

  ctx.restore();
}`,
    },
    more: [
      "Radial symmetry is the mathematical foundation of pookalam art. By using `ctx.translate` to center our coordinate system and `ctx.rotate` inside a loop, the computer handles all the trigonometry automatically.",
      "`ctx.save()` and `ctx.restore()` save the canvas state before rotation and restore it afterward, so each petal is drawn cleanly relative to the center.",
    ],
    links: [
      {
        label: "Visual Polar Coordinates Guide",
        href: "https://www.mathsisfun.com/polar-cartesian-coordinates.html",
        note: "Converting angles and radii into 2D coordinates",
      },
      {
        label: "Generative Artistry Tutorials",
        href: "https://generativeartistry.com/tutorials/",
        note: "Beginner-friendly radial art patterns",
      },
    ],
    aiPrompt:
      "Explain how `ctx.translate` and `ctx.rotate` work together inside a `for` loop in HTML5 Canvas to distribute 12 petal shapes evenly in a circle.",
    praise:
      "You wrote an algorithmic loop that generates radial floral geometry. That is real creative coding!",
    levelUp:
      "Replace `ctx.ellipse` with two quadratic bezier curves (`quadraticCurveTo`) to draw pointed lotus and jasmine petals.",
    pop: "pop-purple",
    sprite: "git-nodes",
    minutes: "20 min",
  },
  {
    id: "rings-and-colour",
    day: "Day 4",
    title: "Layer Multiple Rings & Colors",
    hook: "Stack concentric layers of petals with vibrant Onam colors to build your full flower carpet.",
    hookNamed:
      "Stack concentric layers of petals with vibrant Onam colors, {name}, to build your full carpet.",
    steps: [
      "Each entry in the `rings` array defines one layer: [petalCount, distance, length, width].",
      "Click 'Run it' multiple times — notice how random palette selection creates fresh combinations.",
      "Add a new ring definition to the array or customize petal dimensions.",
      "Incorporate authentic floral shades: Marigold Yellow, Saffron, Rose Pink, and Tulsi Green.",
    ],
    form: "checklist",
    visual: "palette",
    code: {
      label: "concentric pookalam layers — click Run to test new palettes",
      sandbox: true,
      snippet: `ctx.fillStyle = "#1A0826";            // Dark festive background
ctx.fillRect(0, 0, W, H);

const colours = ["#E63946", "#F4A261", "#2A9D8F", "#F5C443", "#9C82D4"];

// Ring specs: [petalCount, distanceFromCenter, petalLength, petalWidth]
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

  const colour = colours[r % colours.length];

  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate((i * 2 * Math.PI) / petals + r * 0.2); // Offset rotation per ring
    ctx.beginPath();
    ctx.ellipse(radius, 0, long, wide, 0, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
  }
}

// Center lamp (Nilavilakku glow)
ctx.beginPath();
ctx.arc(W / 2, H / 2, 20, 0, Math.PI * 2);
ctx.fillStyle = "#FFFFFF";
ctx.fill();`,
    },
    more: [
      "Layering concentric rings from outside-in or inside-out gives your pookalam depth. A solid dark background creates strong contrast that makes the flower petal colors pop.",
      "Curating a tight 4-to-5 color palette (e.g. warm golds, oranges, teal accents, and deep plum) produces far more professional results than using random rainbow hues.",
    ],
    links: [
      {
        label: "Coolors · Color Palette Generator",
        href: "https://coolors.co/",
        note: "Explore and pick harmonious color palettes",
      },
      {
        label: "MDN · Canvas Ellipse Method",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/ellipse",
        note: "Reference documentation for drawing ellipses",
      },
    ],
    aiPrompt:
      "Here is my pookalam code: [paste your snippet]. Suggest 3 curated traditional Onam color palettes with hex codes, and show how to add a decorative outer border ring.",
    praise: "Look at that! You have a complete, multi-layered pookalam generated entirely by code.",
    levelUp:
      "Add a geometric star motif, interlaced ribbons, or a nilavilakku flame in the center for high artistic points.",
    pop: "pop-pink",
    sprite: "muthukuda",
    payload: "studio",
    minutes: "one evening",
  },
  {
    id: "git",
    day: "Day 5",
    title: "Track Your Project with Git",
    hook: "Set up version control so your progress is safely saved at every milestone.",
    hookNamed:
      "Set up version control, {name}, so your progress is safely saved at every milestone.",
    steps: [
      "Verify git is installed in your terminal: `git --version`.",
      "Initialize your pookalam project repository: `git init`.",
      "Stage and save your first snapshot: `git add .` then `git commit -m 'Initial pookalam design'`.",
      "Make a new commit whenever you add a new ring, tweak colors, or polish a shape.",
    ],
    form: "terminal",
    more: [
      "Git takes point-in-time snapshots of your code. If an experimental change breaks your drawing, you can revert back to your last working commit instantly with zero data loss.",
      "Frequent, descriptive commits show judges your genuine creative development process and demonstrate good software engineering practice.",
    ],
    links: [
      {
        label: "GitHub · Git Cheat Sheet",
        href: "https://education.github.com/git-cheat-sheet-education.pdf",
        note: "Essential Git commands on one handy page",
      },
      {
        label: "Oh Shit, Git!?! Guide",
        href: "https://ohshitgit.com/",
        note: "Simple fixes for common Git mistakes",
      },
    ],
    aiPrompt:
      "Explain the 4 basic Git commands (`git init`, `git add .`, `git commit -m`, `git status`) to a student who has never used version control before. Keep it simple and clear.",
    praise:
      "Your project is version-controlled! Git is one of the most vital tools in all of software development, and you are using it like a pro.",
    levelUp:
      "Tag your final submission commit (`git tag v1.0.0`) so judges know exactly which revision produced your uploaded image.",
    pop: "pop-teal",
    sprite: "git-branch",
    minutes: "15 min",
  },
  {
    id: "github",
    day: "Day 5",
    title: "Publish to GitHub with a License",
    hook: "Publish your repository online with an open-source license to fulfill the competition criteria.",
    hookNamed: "Publish your repository online with an open-source license, {name}.",
    steps: [
      "Create a new Public repository on GitHub (or GitLab/Codeberg). Do not add extra files yet.",
      "Connect and push your local repository using GitHub's 3 terminal commands.",
      "Add a `LICENSE` file in the repo root (choose standard MIT, Apache 2.0, or GPLv3).",
      "Write a short `README.md` explaining what your code does and how judges can run it.",
    ],
    form: "terminal",
    code: {
      label: "run these in your terminal after creating the GitHub repository",
      snippet: `git remote add origin https://github.com/YOUR_USERNAME/pookalam-2026.git
git branch -M main
git push -u origin main`,
    },
    more: [
      "An open-source LICENSE is a strict requirement of the competition. It legally allows others to view, learn from, and run your code in true FOSS spirit. MIT or GPLv3 is recommended.",
      "A clean README explaining setup instructions (e.g. 'Open index.html in any browser' or 'Run python pookalam.py') ensures judges can reproduce your render effortlessly.",
    ],
    links: [
      {
        label: "GitHub · Create a Repo Guide",
        href: "https://docs.github.com/en/get-started/quickstart/create-a-repo",
        note: "Official step-by-step repository setup",
      },
      {
        label: "Choose an Open Source License",
        href: "https://choosealicense.com/",
        note: "Compare MIT, Apache 2.0, and GPLv3 in 1 minute",
      },
      {
        label: "Make a Clean README",
        href: "https://www.makeareadme.com/",
        note: "Template for documenting your project",
      },
    ],
    aiPrompt:
      "Generate a clean, beginner-friendly README.md template for an open-source Code-a-Pookalam submission. Include sections for Project Description, Technologies Used, How to Run, and License (MIT).",
    praise:
      "You have a live, public open-source project on GitHub with a real license. That is a permanent portfolio piece you can showcase on your resume!",
    levelUp:
      "Add GitHub Pages or a live web demo link so anyone can view and interact with your pookalam in one click.",
    pop: "pop-yellow",
    sprite: "octocat-garland",
    minutes: "20 min",
  },
  {
    id: "judging",
    day: "Day 6",
    title: "Verify Rules & Scoring Criteria",
    hook: "Review the 4 submission rules and 5 judging pillars before the Day 6 midnight deadline.",
    hookNamed:
      "Review the 4 submission rules and 5 judging pillars, {name}, before the Day 6 deadline.",
    steps: [
      "Check that your rendered image is strictly 1:1 square (e.g. 1024×1024 px).",
      "Ensure zero watermarks, names, handles, or signatures on the artwork (voting is blind).",
      "Verify that your GitHub repository is Public and contains an open-source LICENSE.",
      "Confirm that your source code is executable and directly produces the uploaded render.",
    ],
    form: "checklist",
    more: [
      "Submissions are evaluated on 5 key pillars: Visual Polish, Technical Craft, Originality, Real Pookalam Spirit, and Open-Source Quality. You don't need to master all 5 — pick your strengths and shine!",
      "Day 7 Community Voting uses an anonymous pairwise Elo ranking system. The community evaluates designs purely on artistic and visual merit without knowing the author.",
    ],
    links: [
      {
        label: "The Open Source Definition",
        href: "https://opensource.org/osd",
        note: "The principles behind open source software",
      },
    ],
    aiPrompt:
      "Here is my pookalam source code: [paste your code]. Critique my design against the 5 Code-a-Pookalam judging pillars (Visual Quality, Technical Craft, Originality, Cultural Closeness, and Documentation). What are 2 quick improvements I can make before submitting?",
    praise: "Pre-submission verification complete! Nothing can disqualify you now.",
    levelUp:
      "Focus on storytelling and originality — unique motifs, subtle procedural randomness, or clever symmetry will stand out in the Day 7 voting arena.",
    pop: "pop-blue",
    sprite: "nilavilakku",
    payload: "rules",
    minutes: "5 min",
  },
  {
    id: "submit",
    day: "Day 6",
    title: "Export Render & Submit",
    hook: "Save your high-resolution square image and submit your repository link to the competition.",
    hookNamed: "Save your high-resolution image and submit your repository link, {name}!",
    steps: [
      "Export your canvas or graphic as a square PNG file (1024×1024 or higher recommended).",
      "Head to the submit portal, paste your public repository URL, and upload the render image.",
      "Provide a catchy title and brief notes about your creative and algorithmic approach.",
      "Submit! You can continue making edits and improvements right up until Day 6 midnight.",
    ],
    form: "checklist",
    code: {
      label: "1-click snippet to download canvas as a square PNG",
      snippet: `const link = document.createElement("a");
link.download = "my-pookalam-2026.png";
link.href = canvas.toDataURL("image/png");
link.click();`,
    },
    more: [
      "In Python Turtle, export with `turtle.getcanvas().postscript(file='pookalam.ps')` or take a clean square screenshot.",
      "Submit early! Submissions can be updated anytime before the deadline. An early submission guarantees your spot in the review queue.",
    ],
    links: [
      {
        label: "MDN · canvas.toDataURL()",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL",
        note: "How to export an HTML5 Canvas to an image file",
      },
    ],
    aiPrompt:
      "How do I export an HTML5 Canvas drawing as a clean, high-resolution 1024x1024 PNG image in JavaScript without blurry edges?",
    praise:
      "You officially completed and submitted your Code-a-Pookalam entry! Celebrate what you've built — see you in the Day 7 Community Arena!",
    levelUp:
      "Share your open-source repository with friends and on social media using #OnamGames and #CodeAPookalam after voting concludes!",
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
