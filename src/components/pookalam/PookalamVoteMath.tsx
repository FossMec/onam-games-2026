export function PookalamVoteMath() {
  return (
    <div class="rounded-lg bg-[var(--paper-2)] border-2 border-[var(--ink)] p-3.5 space-y-3 text-xs">
      <div class="space-y-1 pb-1 border-b border-[var(--ink)]/20">
        <p class="font-extrabold text-sm text-[var(--ink)] m-0">Bradley-Terry Elo Ranking</p>
        <p class="text-muted text-xs m-0">
          Global maximum likelihood pairwise evaluation with Bayesian consensus scoring.
        </p>
      </div>

      <div class="p-2.5 bg-[var(--paper-3)] rounded border border-[var(--ink)]/20 space-y-1">
        <div class="flex items-center gap-1.5">
          <span class="badge text-[9px] py-0.5 px-1.5 font-mono font-bold bg-[var(--pop-yellow)] border border-[var(--ink)]">
            NOTICE • 8:00 PM IST, AUG 30
          </span>
        </div>
        <p class="text-[11px] leading-relaxed m-0 text-muted">
          Following detected attempts to manipulate the leaderboard, manipulating accounts have been
          banned and the scoring formula has been updated to protect fair play. The complete
          mathematical formulation will be revealed and open-sourced after the event concludes.
        </p>
      </div>

      <ul class="space-y-1.5 pl-4 list-disc text-muted text-xs leading-relaxed">
        <li>Every pookalam starts at an identical baseline of 1200 Elo.</li>
        <li>
          Final standings are computed via Bradley-Terry Maximum Likelihood estimation across all
          community matchups.
        </li>
        <li>Voters are ranked by agreement with the final community consensus.</li>
      </ul>
    </div>
  );
}
