import { For } from "solid-js";

export interface MathSection {
  title: string;
  badge: string;
  formula: string;
  details: string[];
}

export const VOTE_MATH_SECTIONS: MathSection[] = [
  {
    title: "1. Artwork Standings (Head-to-Head Elo)",
    badge: "K = 32",
    formula: "ΔR = 32 × (1 − P_expected),  where P_expected = 1 / (1 + 10^((R_opp − R_you)/400))",
    details: [
      "Every pookalam starts at an identical baseline of 1200 Elo.",
      "Equal weight for all votes: K is a constant 32, so every voter has the exact same rating impact from day start to close.",
      "Points are conserved: The winner gains +ΔR and the loser loses exactly −ΔR (zero-sum).",
      "Upsets yield bigger swings: Defeating a higher-rated favourite earns a larger rating jump than winning an expected matchup.",
    ],
  },
  {
    title: "2. Voters' Accuracy Leaderboard",
    badge: "Fair Agreement",
    formula: "Accuracy (%) = [(Agreed Votes + 1) / (Total Votes Cast + 2)] × 100",
    details: [
      "Measures agreement with the community consensus: You earn +1.0 point each time you pick the entry that finishes higher in final standings (+0.5 for ties).",
      "Equal weighting: Every matchup you judge contributes 1 full vote of weight, whether judged early or late.",
      "Bayesian smoothing: 2 neutral prior votes (+1/+2) prevent lucky 3-vote streaks from topping the board.",
      "Qualifying target: Requires n·log₂(n) × 60% votes (approx. 21 votes for 10 entries) to appear on the official voters' board.",
    ],
  },
  {
    title: "3. Smart & Balanced Pairing",
    badge: "Matchmaking",
    formula: "Pair Weight = InfoWeight × Exposure × Novelty + ε",
    details: [
      "Novelty = 1 / (1 + TimesJudged): Prioritizes fresh, less-judged matchups so all pairs across the pool get even coverage.",
      "Exposure = √(12 / (12 + Matches)): Pulls brand-new or under-seen entries into matches quickly to give everyone fair visibility.",
      "InfoWeight = 0.12 + 0.88 × 4p(1−p): Keeps attention on close, informative matchups while guaranteeing every pair stays reachable.",
    ],
  },
];

export function PookalamVoteMath() {
  return (
    <div class="rounded-lg bg-[var(--paper-2)] border-2 border-[var(--ink)] p-3.5 space-y-4 text-xs">
      <div class="space-y-1 pb-1 border-b border-[var(--ink)]/20">
        <p class="font-extrabold text-sm text-[var(--ink)] m-0">The Mathematics of Elo Voting</p>
        <p class="text-muted text-xs m-0">
          Transparent, zero-sum pairwise Elo ranking with equal vote weighting and Bayesian
          consensus scoring.
        </p>
      </div>

      <For each={VOTE_MATH_SECTIONS}>
        {(section) => (
          <div class="space-y-2 bg-[var(--paper-1)]/60 rounded p-2.5 border border-[var(--ink)]/15">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="font-black text-[var(--ink)] text-xs">{section.title}</span>
              <span class="badge text-[10px] py-0.5 px-2 font-mono font-bold bg-[var(--paper-3)] border border-[var(--ink)]">
                {section.badge}
              </span>
            </div>

            <div class="p-2 bg-[var(--paper-3)] rounded border border-[var(--ink)]/20 overflow-x-auto">
              <code class="font-mono text-[11px] font-bold text-[var(--ink)] leading-snug whitespace-nowrap sm:whitespace-normal">
                {section.formula}
              </code>
            </div>

            <ul class="space-y-1 pl-4 list-disc text-muted text-[11px] leading-relaxed">
              <For each={section.details}>{(detail) => <li>{detail}</li>}</For>
            </ul>
          </div>
        )}
      </For>
    </div>
  );
}
