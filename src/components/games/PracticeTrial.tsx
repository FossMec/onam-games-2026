import { CheckCircle2 } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { Confetti } from "~/components/art/Confetti";
import { JigsawGame } from "./JigsawGame";
import { JumpGame } from "./JumpGame";
import { TinderGame } from "./TinderGame";
import { VallamGame } from "./VallamGame";
import { WendGame } from "./WendGame";

export interface InteractiveTrialProps {
  gameType: string;
  onCleared?: () => void;
}

export function InteractiveTrial(props: InteractiveTrialProps) {
  const [cleared, setCleared] = createSignal(false);
  const [resetKey, setResetKey] = createSignal(0);

  const handleFinish = () => {
    setCleared(true);
    props.onCleared?.();
  };

  const restart = () => {
    setCleared(false);
    setResetKey((k) => k + 1);
  };

  return (
    <div class="relative w-full rounded border-2 border-ink bg-paper-3 p-3 space-y-2 overflow-hidden shadow-inner">
      <div class="flex items-center justify-between gap-2 border-b-2 border-ink/20 pb-1.5">
        <div class="flex items-center gap-1.5">
          <span class="badge text-[10px] font-black" style={{ "--pop": "var(--pop-teal)" }}>
            Mini Trial
          </span>
          <span class="text-[11px] font-bold text-muted">Client-side practice</span>
        </div>
        <button
          type="button"
          class="btn-ghost text-[10px] font-black py-0.5 px-2.5 h-6 bg-paper hover:bg-paper-2"
          onClick={restart}
        >
          Reset
        </button>
      </div>

      <div class="relative flex justify-center items-center w-full min-h-[220px]">
        <Show when={resetKey() >= 0}>
          {/* 1. MAVELI JUMP */}
          <Show when={props.gameType === "jump"}>
            <div class="w-full max-w-[280px]">
              <JumpGame
                view={{
                  kind: "jump",
                  seed: `trial-seed-${resetKey()}`,
                  fps: 60,
                  maxFrames: 1800,
                }}
                targetY={500}
                onFinish={handleFinish}
              />
            </div>
          </Show>

          {/* 2. ESCAPE THE VALLAM */}
          <Show when={props.gameType === "unblock"}>
            <div class="w-full max-w-[280px]">
              <VallamGame
                view={{
                  kind: "vallam",
                  size: 4,
                  exitRow: 1,
                  par: 2,
                  boats: [
                    { id: 0, r: 1, c: 0, len: 2, horizontal: true },
                    { id: 1, r: 0, c: 2, len: 2, horizontal: false },
                  ],
                }}
                onFinish={handleFinish}
              />
            </div>
          </Show>

          {/* 3. OPEN SOURCE TINDER */}
          <Show when={props.gameType === "tinder"}>
            <div class="w-full max-w-[280px]">
              <TinderGame
                slug="tinder"
                attemptToken="trial-token"
                cards={[
                  { id: "linux", name: "Linux (Tux)", category: "Operating System" },
                  { id: "iphone", name: "Apple iOS / iPhone", category: "Mobile Platform" },
                ]}
                onCheck={async (slice) => {
                  const answers: Record<string, { open: boolean; why: string; fact: string }> = {
                    linux: {
                      open: true,
                      why: "GPLv2 Licensed",
                      fact: "The world's most famous open source operating system kernel, represented by Tux.",
                    },
                    iphone: {
                      open: false,
                      why: "Proprietary Commercial OS",
                      fact: "Apple's closed-source mobile operating system and ecosystem.",
                    },
                  };
                  const wrong: { id: string; open: boolean; why: string; fact: string }[] = [];
                  const wrongIds: string[] = [];
                  for (const d of slice) {
                    const ans = answers[d.id];
                    if (ans && ans.open !== d.open) {
                      wrongIds.push(d.id);
                      wrong.push({ id: d.id, open: ans.open, why: ans.why, fact: ans.fact });
                    }
                  }
                  return { wrongIds, wrong };
                }}
                onFinish={handleFinish}
              />
            </div>
          </Show>

          {/* 4. POOKALAM JIGSAW */}
          <Show when={props.gameType === "jigsaw"}>
            <div class="w-full max-w-[280px]">
              <JigsawGame
                view={{
                  kind: "jigsaw",
                  cols: 2,
                  rows: 2,
                  imageUrl: "/images/memes/sudo-mkdir-pookalam.webp",
                  hEdges: [
                    [
                      { dir: 1, offset: 0.5, neck: 0.12, head: 0.2, skew: 0 },
                      { dir: -1, offset: 0.46, neck: 0.12, head: 0.2, skew: 0 },
                    ],
                  ],
                  vEdges: [
                    [{ dir: -1, offset: 0.52, neck: 0.12, head: 0.2, skew: 0 }],
                    [{ dir: 1, offset: 0.48, neck: 0.12, head: 0.2, skew: 0 }],
                  ],
                  scatter: [
                    { id: 0, x: 0.1, y: 0.1 },
                    { id: 1, x: 1.3, y: 0.2 },
                    { id: 2, x: 0.2, y: 1.3 },
                    { id: 3, x: 1.4, y: 1.4 },
                  ],
                }}
                startedAt={Date.now()}
                onFinish={handleFinish}
              />
            </div>
          </Show>

          {/* 5. WORD WEND */}
          <Show when={props.gameType === "wend"}>
            <div class="w-full max-w-[280px]">
              <WendGame
                view={{
                  kind: "wend",
                  size: 3,
                  grid: [
                    ["F", "O", "S"],
                    ["U", "X", "S"],
                    ["N", "I", "L"],
                  ],
                  wordLengths: [4, 5],
                  openCells: 9,
                }}
                onTrace={async (cells) => {
                  const grid = [
                    ["F", "O", "S"],
                    ["U", "X", "S"],
                    ["N", "I", "L"],
                  ];
                  const word = cells.map((c) => grid[c.r]?.[c.c] ?? "").join("");
                  return ["FOSS", "LINUX"].includes(word) ? word : null;
                }}
                onFinish={handleFinish}
              />
            </div>
          </Show>
        </Show>
      </div>

      <Show when={cleared()}>
        <div class="p-2 rounded border-2 border-ink bg-pop-teal text-ink text-center text-xs font-extrabold animate-sheet-in flex items-center justify-center gap-1.5">
          <Confetti seed="trial-win" count={4} />
          <CheckCircle2 size={16} strokeWidth={2.5} class="shrink-0" />
          <span>Practice Cleared! You're ready for the real run.</span>
        </div>
      </Show>
    </div>
  );
}
