import { Download, MessageSquare, RefreshCw, Search } from "lucide-solid";
import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { getFeedbackListAction, getFeedbackSummaryAction } from "~/server/feedback/actions";
import type { FeedbackWithUserInfo } from "~/server/feedback/service";

export function FeedbackTab() {
  const [feedbacks, setFeedbacks] = createSignal<FeedbackWithUserInfo[]>([]);
  const [total, setTotal] = createSignal(0);
  const [mec30Count, setMec30Count] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [batchFilter, setBatchFilter] = createSignal<string>("all");
  const [searchQuery, setSearchQuery] = createSignal("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, summaryRes] = await Promise.all([
        getFeedbackListAction({
          batch: batchFilter() === "all" ? undefined : batchFilter(),
          limit: 100,
        }),
        getFeedbackSummaryAction(),
      ]);
      setFeedbacks(listRes.items);
      setTotal(listRes.total);
      setMec30Count(summaryRes.mec30Count);
    } catch (err) {
      console.error("[admin feedback] load error:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void loadData();
  });

  createEffect(() => {
    batchFilter();
    void loadData();
  });

  const filteredItems = () => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) return feedbacks();
    return feedbacks().filter((item) => {
      return (
        (item.userName && item.userName.toLowerCase().includes(q)) ||
        (item.userEmail && item.userEmail.toLowerCase().includes(q)) ||
        (item.enjoyedGames && item.enjoyedGames.toLowerCase().includes(q)) ||
        (item.favoriteThing && item.favoriteThing.toLowerCase().includes(q)) ||
        (item.changesNextYear && item.changesNextYear.toLowerCase().includes(q)) ||
        (item.codePookalamExperience && item.codePookalamExperience.toLowerCase().includes(q)) ||
        (item.codePookalamRoadmap && item.codePookalamRoadmap.toLowerCase().includes(q)) ||
        (item.openSourceLearning && item.openSourceLearning.toLowerCase().includes(q)) ||
        (item.nextEventSuggestions && item.nextEventSuggestions.toLowerCase().includes(q)) ||
        (item.communityPookalamExperience &&
          item.communityPookalamExperience.toLowerCase().includes(q)) ||
        (item.additionalNotes && item.additionalNotes.toLowerCase().includes(q))
      );
    });
  };

  const exportJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(feedbacks(), null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `onam-games-feedback-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

  return (
    <div class="space-y-5">
      {/* Header with Stats & Export */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2
            class="text-xl font-black m-0 text-[var(--ink)]"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Community Feedback & Workshop Wishlists
          </h2>
          <p class="text-xs font-semibold text-[var(--ink-soft)] m-0">
            Real feedback and suggestions submitted by players and students.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="badge font-black text-xs" style={{ "--pop": "var(--pop-yellow)" }}>
            {total()} Responses
          </div>
          <div class="badge font-black text-xs" style={{ "--pop": "var(--pop-teal)" }}>
            {mec30Count()} from Batch '30
          </div>
          <button
            type="button"
            onClick={exportJson}
            disabled={feedbacks().length === 0}
            class="px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 border-[var(--ink)] bg-[var(--paper-2)] hover:bg-[var(--paper-3)] text-[var(--ink)] cursor-pointer inline-flex items-center gap-1.5 transition-all"
          >
            <Download size={13} strokeWidth={2.5} />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            class="p-1.5 rounded-lg border-2 border-[var(--ink)] bg-[var(--paper-2)] hover:bg-[var(--paper-3)] text-[var(--ink)] cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw size={14} class={loading() ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <For
            each={[
              { id: "all", label: "All Batches" },
              { id: "30", label: "Batch '30" },
              { id: "29", label: "Batch '29" },
              { id: "28", label: "Batch '28" },
              { id: "27", label: "Batch '27" },
              { id: "<=26", label: "<= '26" },
              { id: "other", label: "Other" },
            ]}
          >
            {(b) => (
              <button
                type="button"
                onClick={() => setBatchFilter(b.id)}
                class={`px-2.5 py-1 rounded text-xs font-black border transition-all cursor-pointer whitespace-nowrap ${
                  batchFilter() === b.id
                    ? "bg-[var(--pop-yellow)] text-[var(--ink)] border-[var(--ink)]"
                    : "bg-[var(--paper-2)] text-[var(--ink-soft)] border-[var(--ink-soft)]/30 hover:border-[var(--ink)]"
                }`}
              >
                {b.label}
              </button>
            )}
          </For>
        </div>

        <div class="relative w-full sm:w-64 shrink-0">
          <Search
            size={14}
            class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search keywords..."
            class="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none"
          />
        </div>
      </div>

      {/* Loading state */}
      <Show when={loading() && feedbacks().length === 0}>
        <div class="p-8 text-center text-xs font-bold text-[var(--ink-soft)]">
          <RefreshCw size={20} class="animate-spin mx-auto mb-2" />
          Loading community responses…
        </div>
      </Show>

      {/* Empty State */}
      <Show when={!loading() && filteredItems().length === 0}>
        <div class="card card-plain p-10 text-center space-y-2">
          <MessageSquare size={32} class="mx-auto text-[var(--ink-soft)]" />
          <p class="font-bold text-sm text-[var(--ink-soft)] m-0">
            No feedback matching your filters yet.
          </p>
        </div>
      </Show>

      {/* Cards list */}
      <div class="space-y-4">
        <For each={filteredItems()}>
          {(fb) => (
            <div
              class="card p-4 sm:p-5 space-y-3.5"
              style={{
                background: "var(--paper-2)",
                border: "var(--ink-w-bold) solid var(--ink)",
              }}
            >
              {/* User Bar */}
              <div class="flex items-center justify-between gap-3 pb-2.5 border-b border-[var(--ink-soft)]/20 flex-wrap">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full overflow-hidden border-2 border-[var(--ink)] bg-[var(--pop-yellow)] flex items-center justify-center text-xs font-black shrink-0">
                    <Show
                      when={fb.userAvatar}
                      fallback={fb.userName ? fb.userName.charAt(0).toUpperCase() : "U"}
                    >
                      <img
                        src={fb.userAvatar!}
                        alt={fb.userName || "User"}
                        class="w-full h-full object-cover"
                      />
                    </Show>
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-extrabold text-sm text-[var(--ink)]">
                        {fb.userName || "Anonymous Guest"}
                      </span>
                      <Show when={fb.batch}>
                        <span
                          class="badge text-[10px] font-black"
                          style={{
                            "--pop": fb.batch === "30" ? "var(--pop-teal)" : "var(--paper-3)",
                          }}
                        >
                          {fb.batch === "30" ? "Batch '30 (1st Year)" : `Batch '${fb.batch}`}
                        </span>
                      </Show>
                    </div>
                    <Show when={fb.userEmail}>
                      <span class="text-[11px] font-medium text-[var(--ink-soft)] block">
                        {fb.userEmail}
                      </span>
                    </Show>
                  </div>
                </div>

                <div class="text-[10px] font-mono font-bold text-[var(--ink-soft)]">
                  {fmt(fb.updatedAt || fb.createdAt)}
                </div>
              </div>

              {/* Feedback Points Grid */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <Show when={fb.enjoyedGames}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1">
                    <span class="font-black text-[var(--ink-soft)] uppercase text-[10px] block">
                      Enjoyed Onam Games:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.enjoyedGames}
                    </p>
                  </div>
                </Show>

                <Show when={fb.favoriteThing}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1">
                    <span class="font-black text-[var(--ink-soft)] uppercase text-[10px] block">
                      Favorite Thing:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.favoriteThing}
                    </p>
                  </div>
                </Show>

                <Show when={fb.changesNextYear}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1">
                    <span class="font-black text-[var(--ink-soft)] uppercase text-[10px] block">
                      Changes / Next Year:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.changesNextYear}
                    </p>
                  </div>
                </Show>

                <Show when={fb.nextEventSuggestions}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1">
                    <span class="font-black text-[var(--pop-teal-deep)] uppercase text-[10px] block">
                      Next Workshop / Event Wishlist:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.nextEventSuggestions}
                    </p>
                  </div>
                </Show>

                <Show when={fb.codePookalamExperience}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1">
                    <span class="font-black text-[var(--ink-soft)] uppercase text-[10px] block">
                      Code-a-Pookalam:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.codePookalamExperience}
                    </p>
                  </div>
                </Show>

                <Show when={fb.codePookalamRoadmap}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1">
                    <span class="font-black text-[var(--ink-soft)] uppercase text-[10px] block">
                      1-Week Roadmap:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.codePookalamRoadmap}
                    </p>
                  </div>
                </Show>

                <Show when={fb.openSourceLearning}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1">
                    <span class="font-black text-[var(--ink-soft)] uppercase text-[10px] block">
                      Open Source Learning & FOSS:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.openSourceLearning}
                    </p>
                  </div>
                </Show>

                <Show when={fb.communityPookalamExperience}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1">
                    <span class="font-black text-[var(--ink-soft)] uppercase text-[10px] block">
                      Community Pookalam / Games:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.communityPookalamExperience}
                    </p>
                  </div>
                </Show>

                <Show when={fb.additionalNotes}>
                  <div class="p-2.5 rounded bg-[var(--paper)] border border-[var(--ink)] space-y-1 md:col-span-2">
                    <span class="font-black text-[var(--ink-soft)] uppercase text-[10px] block">
                      Additional Notes:
                    </span>
                    <p class="font-bold text-[var(--ink)] leading-snug m-0 whitespace-pre-line">
                      {fb.additionalNotes}
                    </p>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
