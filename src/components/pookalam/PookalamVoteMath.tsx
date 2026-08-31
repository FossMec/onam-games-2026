export function PookalamVoteMath() {
  return (
    <section class="rounded-lg border-2 border-[var(--ink)] bg-[var(--paper-2)] p-3.5 text-xs space-y-3">
      <div class="space-y-1 border-b border-[var(--ink)]/20 pb-2">
        <p class="m-0 text-sm font-extrabold text-[var(--ink)]">Final Day 7 scoring algorithm</p>
        <p class="m-0 text-xs text-muted">
          The final standings use a global weighted Bradley–Terry maximum-likelihood fit, converted
          to a familiar Elo scale.
        </p>
      </div>

      <ol class="m-0 list-decimal space-y-2 pl-5 text-muted leading-relaxed">
        <li>
          Each shortlisted pookalam starts at <strong class="text-[var(--ink)]">γ = 1.0</strong>,
          which is <strong class="text-[var(--ink)]">1200 Elo</strong>. Votes from banned voters are
          excluded; normal eligible votes have weight 1.0, while votes from accounts created at or
          after the Day 7 cutoff have weight 0.05.
        </li>
        <li>
          For every pair, the model combines all votes into weighted wins{" "}
          <code class="font-mono text-[var(--ink)]">wᵢⱼ</code> and total comparisons{" "}
          <code class="font-mono text-[var(--ink)]">nᵢⱼ = wᵢⱼ + wⱼᵢ</code>.
        </li>
        <li>
          It repeatedly updates every entry using the Minorization–Maximization step below, with{" "}
          <code class="font-mono text-[var(--ink)]">ε = 0.0001</code>, then normalizes the geometric
          mean of all γ values to 1.
        </li>
      </ol>

      <div class="overflow-x-auto rounded bg-[var(--paper-3)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--ink)]">
        <code>
          Wᵢ = Σⱼ wᵢⱼ
          <br />
          γᵢ ← (Wᵢ + ε) / (Σⱼ nᵢⱼ / (γᵢ + γⱼ) + ε)
          <br />
          Eloᵢ = 1200 + 400 × log₁₀(γᵢ)
        </code>
      </div>

      <p class="m-0 text-muted leading-relaxed">
        The fit runs for up to 50 rounds (or stops when it converges). Final rank is sorted by the
        rounded Elo score; any approved moderation adjustment is applied afterward. Wins and matches
        shown on the board are supporting counts, not a replacement for the model score.
      </p>
    </section>
  );
}
