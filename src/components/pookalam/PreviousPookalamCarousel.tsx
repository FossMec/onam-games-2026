import { ChevronLeft, ChevronRight, Eye, Sparkles, X } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

export interface PreviousPookalam {
  id: string;
  name: string;
  src: string;
  highlight?: string;
}

const PREVIOUS_GALLERY: PreviousPookalam[] = [
  { id: "1", name: "Aditya Sailesh", src: "/previous-pookalam/Aditya-sailesh.jpg" },
  { id: "2", name: "Amith 1206", src: "/previous-pookalam/Amith1206.png" },
  {
    id: "3",
    name: "ElegantFalcon",
    src: "/previous-pookalam/ElegantFalcon.PNG",
    highlight: "Community Pick",
  },
  { id: "4", name: "Rahul Roy", src: "/previous-pookalam/Rahul-Roy-Hub.png" },
  { id: "5", name: "Shimil S Abraham", src: "/previous-pookalam/ShimilSAbraham.png" },
  { id: "6", name: "Vishruth S", src: "/previous-pookalam/Vishruth-S.png" },
  {
    id: "7",
    name: "Adithyaa Anilkumar",
    src: "/previous-pookalam/adithyaaanilkumar.png",
    highlight: "Top Algorithmic",
  },
  { id: "8", name: "Aishwarya TS", src: "/previous-pookalam/aishwaryats.PNG" },
  { id: "9", name: "Alaka AJ", src: "/previous-pookalam/alaka03aj.png" },
  { id: "10", name: "Aldrin Jenson", src: "/previous-pookalam/aldrinjenson.png" },
  { id: "11", name: "Ananya Nair", src: "/previous-pookalam/ananyanair.png" },
  { id: "12", name: "Aswanth AB", src: "/previous-pookalam/aswanthabam.png" },
  { id: "13", name: "Code Lover", src: "/previous-pookalam/code-lover636.png" },
  {
    id: "14",
    name: "Denin Paul",
    src: "/previous-pookalam/deninpaul.png",
    highlight: "Complex Math",
  },
  { id: "15", name: "Devan MEC", src: "/previous-pookalam/devan-MEC.PNG" },
  { id: "16", name: "Jahgath", src: "/previous-pookalam/jahgath.png" },
  { id: "17", name: "Jathulya", src: "/previous-pookalam/jathulya.png" },
  { id: "18", name: "Jemma MG", src: "/previous-pookalam/jemma-mg.png" },
  { id: "19", name: "Kuekuatsuuu", src: "/previous-pookalam/kuekuatsuuu.png" },
  { id: "20", name: "Lovebin", src: "/previous-pookalam/lovebin123.png" },
  { id: "21", name: "Malavika S Menon", src: "/previous-pookalam/malavikasmenon.png" },
  { id: "22", name: "Nikx Taco", src: "/previous-pookalam/nikxtaco.png" },
  { id: "23", name: "Raz", src: "/previous-pookalam/raz8153.png" },
  {
    id: "24",
    name: "Ritu Maria",
    src: "/previous-pookalam/ritumaria.png",
    highlight: "Crowd Favourite",
  },
  { id: "25", name: "Tom Thomas", src: "/previous-pookalam/tomthomasvempala.png" },
];

export function PreviousPookalamCarousel() {
  let scrollContainerRef: HTMLDivElement | undefined;
  const [selectedItem, setSelectedItem] = createSignal<PreviousPookalam | null>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef) return;
    const amount = direction === "left" ? -320 : 320;
    scrollContainerRef.scrollBy({ left: amount, behavior: "smooth" });
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedItem(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <div class="inline-flex items-center gap-1.5 text-xs font-black uppercase px-2.5 py-0.5 rounded bg-[var(--pop-yellow)] border-2 border-[var(--ink)] shadow-[2px_2px_0px_0px_var(--ink)] mb-1.5">
            <Sparkles size={12} />
            <span>Community Hall of Fame</span>
          </div>
          <h2
            class="text-2xl sm:text-3xl font-black tracking-tight"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Previous Coded Pookalams
          </h2>
          <p class="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
            Real geometric & algorithmic pookalams created by students and hackers from past
            editions!
          </p>
        </div>

        {/* Navigation Buttons */}
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => scroll("left")}
            class="w-9 h-9 rounded-lg bg-[var(--paper-2)] border-2 border-[var(--ink)] grid place-items-center hover:bg-[var(--pop-yellow)] transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--ink)] active:translate-y-0.5"
            aria-label="Previous pookalams"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            class="w-9 h-9 rounded-lg bg-[var(--paper-2)] border-2 border-[var(--ink)] grid place-items-center hover:bg-[var(--pop-yellow)] transition-all cursor-pointer shadow-[2px_2px_0px_0px_var(--ink)] active:translate-y-0.5"
            aria-label="Next pookalams"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={(el) => (scrollContainerRef = el)}
        class="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin select-none"
        style={{
          "scrollbar-width": "thin",
          "scrollbar-color": "var(--ink) var(--paper-2)",
        }}
      >
        <For each={PREVIOUS_GALLERY}>
          {(item) => (
            <div
              class="snap-start shrink-0 w-64 sm:w-72 rounded-xl bg-[var(--paper-2)] border-3 border-[var(--ink)] shadow-[5px_5px_0px_0px_var(--ink)] overflow-hidden flex flex-col group cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-[7px_7px_0px_0px_var(--ink)]"
              onClick={() => setSelectedItem(item)}
            >
              {/* Image Frame */}
              <div class="relative aspect-square w-full bg-[#1F2937] overflow-hidden flex items-center justify-center p-2">
                <img
                  src={item.src}
                  alt={`Coded Pookalam by ${item.name}`}
                  loading="lazy"
                  class="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                />

                <Show when={item.highlight}>
                  <div class="absolute top-2 left-2 px-2 py-0.5 rounded bg-[var(--pop-yellow)] border border-[var(--ink)] text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_var(--ink)]">
                    {item.highlight}
                  </div>
                </Show>

                {/* Hover overlay hint */}
                <div class="absolute inset-0 bg-[var(--ink)]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-black">
                  <Eye size={16} />
                  <span>Expand Art</span>
                </div>
              </div>

              {/* Card Footer */}
              <div class="p-3 border-t-2 border-[var(--ink)] flex items-center justify-between gap-2 bg-[var(--paper)]">
                <p class="font-extrabold text-sm truncate">{item.name}</p>
                <span class="text-[10px] uppercase font-bold text-[var(--ink-soft)] shrink-0">
                  Past Winner
                </span>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Lightbox / Modal for full preview */}
      <Show when={selectedItem()}>
        <div
          class="fixed inset-0 z-50 bg-[var(--ink)]/75 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => setSelectedItem(null)}
        >
          <div
            class="relative max-w-2xl w-full rounded-2xl bg-[var(--paper)] border-4 border-[var(--ink)] shadow-[8px_8px_0px_0px_var(--ink)] p-4 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between border-b-2 border-[var(--ink)] pb-3">
              <div>
                <h3 class="text-xl font-black">{selectedItem()!.name}</h3>
                <p class="text-xs font-bold text-[var(--ink-soft)]">
                  Previous Code-a-Pookalam Submission
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                class="w-8 h-8 rounded-lg bg-[var(--paper-2)] border-2 border-[var(--ink)] grid place-items-center hover:bg-[var(--pop-red)] hover:text-white transition-colors cursor-pointer shadow-[2px_2px_0px_0px_var(--ink)]"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <div class="aspect-square w-full max-h-[65vh] bg-[#1F2937] rounded-xl border-2 border-[var(--ink)] overflow-hidden flex items-center justify-center p-3">
              <img
                src={selectedItem()!.src}
                alt={selectedItem()!.name}
                class="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
