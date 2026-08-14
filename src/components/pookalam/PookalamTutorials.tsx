import { Bot, Code2, Copy, Globe, Network, Sparkles, Terminal } from "lucide-solid";
import { For, createSignal } from "solid-js";

interface TutorialCategory {
  id: string;
  title: string;
  badge: string;
  icon: any;
  color: string;
  tagline: string;
  description: string;
  tips: string[];
  starterSnippet: string;
  language: string;
}

const TUTORIALS: TutorialCategory[] = [
  {
    id: "web",
    title: "Pure Web: HTML5 Canvas, SVG & CSS",
    badge: "Browser Native",
    icon: Globe,
    color: "var(--pop-yellow)",
    tagline: "No installation needed. Open any browser devtools and start drawing.",
    description:
      "The web is a playground for polar mathematics. Loop from 0 to 2π, convert angles into (x, y) coordinates with `cos` and `sin`, and draw layered petals with bezier curves or SVG path arcs!",
    tips: [
      "Use polar math: `x = cx + radius * Math.cos(angle)`, `y = cy + radius * Math.sin(angle)`",
      'SVG `<path>` elements with `d="M ... Q ... Z"` give ultra-crisp vector scaling',
      "CSS conic-gradients and `clip-path: polygon(...)` can create wild geometric illusions",
    ],
    starterSnippet: `// Quick HTML5 Canvas Petal Ring
const canvas = document.getElementById("pookalam");
const ctx = canvas.getContext("2d");
const cx = 300, cy = 300, petals = 12, r = 180;

for (let i = 0; i < petals; i++) {
  const angle = (i * 2 * Math.PI) / petals;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(r * 0.6, 0, r * 0.4, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = i % 2 === 0 ? "#F47C48" : "#FDC844";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}`,
    language: "javascript",
  },
  {
    id: "python",
    title: "Python: Turtle, Pygame & Matplotlib",
    badge: "The Classic Favourite",
    icon: Code2,
    color: "var(--pop-teal)",
    tagline: "The beginner-friendly legend taught on Mon.school and colleges.",
    description:
      "Python's `turtle` module makes radial drawing intuitive. Move forward, turn by an angle, repeat in a loop! Or use Matplotlib polar projection plots `plt.subplot(projection='polar')` for parametric floral equations.",
    tips: [
      "Mon.school sketches let you write and run Python turtle code directly online",
      "Use `turtle.tracer(0, 0)` for instant rendering of intricate 10,000-petal designs",
      "Polar rose equation: `r = a * cos(k * θ)` where `k` controls petal count!",
    ],
    starterSnippet: `import turtle
import math

t = turtle.Turtle()
turtle.bgcolor("#1F2937")
t.speed(0)
colors = ["#F47C48", "#FDC844", "#25A18E", "#8F5AF6"]

for layer in range(6):
    t.color(colors[layer % len(colors)])
    for i in range(16):
        t.circle(40 + layer * 25, 90)
        t.left(90)
        t.circle(40 + layer * 25, 90)
        t.left(360 / 16)

turtle.done()`,
    language: "python",
  },
  {
    id: "graphviz",
    title: "Graphviz: DOT Radial Graph Art",
    badge: "Hacker Special",
    icon: Network,
    color: "var(--pop-purple)",
    tagline: "Who said network topology diagrams can't be traditional flower carpets?",
    description:
      "Use Graphviz circular layout engines like `twopi` or `circo`! Define concentric rings of nodes connected by invisible or styled edges to produce intricate architectural graph pookalams.",
    tips: [
      "Use `layout=twopi` with `root=center` for radial symmetry",
      'Style nodes with `style=filled`, `shape=doublecircle`, `fillcolor="#FDC844"`',
      "Generate the DOT file using a simple Python or Bash script loop!",
    ],
    starterSnippet: `// pookalam.dot - Render with: twopi -Tpng pookalam.dot -o out.png
graph Pookalam {
  layout=twopi;
  root=center;
  bgcolor="#FBF3E4";
  node [style=filled, penwidth=2];

  center [label="⚙️ FOSS", fillcolor="#FDC844", shape=doublecircle];
  
  // Ring 1 (12 petals)
  subgraph ring1 {
    node [fillcolor="#F47C48", shape=hexagon];
    center -- { r1_0 r1_1 r1_2 r1_3 r1_4 r1_5 r1_6 r1_7 r1_8 r1_9 r1_10 r1_11 } [color="#1F2937"];
  }
}`,
    language: "dot",
  },
  {
    id: "shaders",
    title: "Creative Coding: p5.js & GLSL Shaders",
    badge: "GPU Powerhouse",
    icon: Sparkles,
    color: "var(--pop-pink)",
    tagline: "Push millions of pixels concurrently with trigonometric shaders.",
    description:
      "p5.js gives you an artistic canvas with matrix transforms (`push()`, `pop()`, `rotate()`). For GPU enthusiasts, write a Fragment Shader with Signed Distance Functions (SDFs) for infinite procedural zoom!",
    tips: [
      "In p5.js, `angleMode(DEGREES)` makes Onam radial symmetry super easy to calculate",
      "In GLSL, combine polar angle `atan(uv.y, uv.x)` with cosine waves for organic floral SDFs",
      "Add subtle time uniforms (`u_time`) for mesmerizing breathing animations!",
    ],
    starterSnippet: `// p5.js Sketch
function setup() {
  createCanvas(600, 600);
  angleMode(DEGREES);
  noLoop();
}

function draw() {
  background("#1F2937");
  translate(width/2, height/2);
  
  for (let r = 240; r > 20; r -= 40) {
    let petals = int(map(r, 20, 240, 6, 24));
    for (let a = 0; a < 360; a += 360 / petals) {
      push();
      rotate(a);
      fill(r % 80 === 0 ? "#FDC844" : "#F47C48");
      stroke("#1F2937");
      strokeWeight(2);
      ellipse(r, 0, r * 0.4, r * 0.15);
      pop();
    }
  }
}`,
    language: "javascript",
  },
  {
    id: "ai-hybrid",
    title: "AI + Code: Collaborative Generation",
    badge: "AI Allowed & Welcomed",
    icon: Bot,
    color: "var(--pop-yellow)",
    tagline: "Prompt LLMs for math formulas, refine the code, and make it your own.",
    description:
      "AI assistance is fully allowed! Ask Claude, Gemini, or ChatGPT to generate parametric Canvas or SVG functions for specific flower motifs (Thumba, Chemparathy, Shankhupushpam). Refine the logic, tweak parameters, and submit the executable script!",
    tips: [
      "Prompt for specific math concepts: 'Write a self-contained SVG generator with 6 concentric radial layers in Onam colors'",
      "Ask for modular functions: 'Create a function drawThumbaPetal(ctx, x, y, size, angle)'",
      "Always inspect and run the code locally before rendering your final snapshot",
    ],
    starterSnippet: `Prompt Idea for Claude / ChatGPT:
"Write a self-contained Python script using PIL / Pillow that generates 
a high-resolution 2000x2000 symmetric Onam Pookalam using polar coordinates. 
Include 5 concentric layers: 
1. Outer lotus petals (#F47C48)
2. Chevron sawtooth border (#25A18E)
3. Marigold diamond ring (#FDC844)
4. Inner tulip ring (#8F5AF6)
5. Center Nilavilakku emblem. Return only executable Python code."`,
    language: "markdown",
  },
  {
    id: "terminal",
    title: "Terminal ASCII & Esoteric Coding",
    badge: "Console Wizardry",
    icon: Terminal,
    color: "var(--pop-teal)",
    tagline: "For the CLI purists who live inside tmux, NeoVim, and raw ANSI codes.",
    description:
      "Create a CLI binary in Rust, C, Go, or Python that calculates character density and renders a full-color 24-bit ANSI Pookalam right in your terminal window.",
    tips: [
      "Use Truecolor ANSI escape sequence `\\x1b[38;2;R;G;Bm` for vibrant 16-million color terminal art",
      "Character density ramp ` .:-=+*#%@` works great for radial light gradients",
      "Share your terminal recording using tools like asciinema!",
    ],
    starterSnippet: `// Python ANSI Terminal Radial Flower
import math

W, H = 80, 40
colors = [(244, 124, 72), (253, 200, 68), (37, 161, 142)]

for y in range(H):
    row = ""
    for x in range(W):
        nx, ny = (x - W/2) / (W/4), (y - H/2) / (H/4)
        r = math.sqrt(nx*nx + ny*ny)
        theta = math.atan2(ny, nx)
        petal = math.cos(8 * theta)
        
        if r < 1.0 + 0.3 * petal:
            c = colors[int(r * len(colors)) % len(colors)]
            row += f"\\033[38;2;{c[0]};{c[1]};{c[2]}m🌸"
        else:
            row += "  "
    print(row)
print("\\033[0m")`,
    language: "python",
  },
];

export function PookalamTutorials() {
  const [activeId, setActiveId] = createSignal<string>("web");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);

  const activeTutorial = () => TUTORIALS.find((t) => t.id === activeId()) ?? TUTORIALS[0];

  const copyCode = (code: string, id: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div class="space-y-6">
      <div>
        <div class="inline-flex items-center gap-1.5 text-xs font-black uppercase px-2.5 py-0.5 rounded bg-[var(--pop-teal)] border-2 border-[var(--ink)] shadow-[2px_2px_0px_0px_var(--ink)] mb-1.5">
          <Code2 size={12} />
          <span>Starter Kit & Ideas</span>
        </div>
        <h2
          class="text-2xl sm:text-3xl font-black tracking-tight"
          style={{ "font-family": "var(--font-stack-display)" }}
        >
          Ways to Code a Pookalam
        </h2>
        <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
          Pick your favourite medium! Whether you love pure JavaScript, Python scripts, GPU shaders,
          Graphviz trees, or AI prompt engineering — here's how to kickstart your entry.
        </p>
      </div>

      {/* Tabs */}
      <div class="px-1 py-1.5 flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <For each={TUTORIALS}>
          {(t) => {
            const Icon = t.icon;
            const isSel = () => t.id === activeId();
            return (
              <button
                type="button"
                onClick={() => setActiveId(t.id)}
                class={`px-3.5 py-2 rounded-xl border-2 border-[var(--ink)] text-xs font-black shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                  isSel()
                    ? "bg-[var(--pop-yellow)] scale-105 shadow-[3px_3px_0px_0px_var(--ink)]"
                    : "bg-[var(--paper-2)] opacity-80 hover:opacity-100 hover:bg-[var(--paper)]"
                }`}
              >
                <Icon size={14} strokeWidth={2.5} />
                <span>{t.title.split(":")[0]}</span>
              </button>
            );
          }}
        </For>
      </div>

      {/* Active Tutorial Content Box */}
      <div class="card pop-teal space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-dashed border-[var(--ink)]/25 pb-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span
                class="badge text-[10px] font-black uppercase"
                style={{ "--pop": activeTutorial().color }}
              >
                {activeTutorial().badge}
              </span>
            </div>
            <h3 class="text-xl sm:text-2xl font-black">{activeTutorial().title}</h3>
            <p class="comment">{activeTutorial().tagline}</p>
          </div>
        </div>

        <p class="text-sm font-semibold leading-relaxed text-ink">{activeTutorial().description}</p>

        {/* Tips List */}
        <div class="space-y-2">
          <h4 class="text-xs font-black uppercase tracking-wider text-muted">
            Pro-Tips & Starter Concepts
          </h4>
          <ul class="grid gap-2 sm:grid-cols-3">
            <For each={activeTutorial().tips}>
              {(tip) => (
                <li class="card card-plain bg-surface p-3 text-xs font-bold leading-snug flex items-start gap-2">
                  <span class="text-[var(--pop-pink)] shrink-0 font-black">▸</span>
                  <span>{tip}</span>
                </li>
              )}
            </For>
          </ul>
        </div>

        {/* Code Snippet Box */}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black uppercase tracking-wider text-muted">
              Starter Recipe Code
            </span>
            <button
              type="button"
              onClick={() => copyCode(activeTutorial().starterSnippet, activeTutorial().id)}
              class="btn-ghost py-1.5 px-3 text-xs min-h-0"
            >
              <Copy size={12} strokeWidth={2.5} />
              <span>{copiedId() === activeTutorial().id ? "Copied!" : "Copy Code"}</span>
            </button>
          </div>

          <pre
            class="p-4 rounded bg-[#1F2937] text-white font-mono text-xs overflow-x-auto leading-relaxed inked"
            style={{ "tab-size": 2 }}
          >
            <code>{activeTutorial().starterSnippet}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
