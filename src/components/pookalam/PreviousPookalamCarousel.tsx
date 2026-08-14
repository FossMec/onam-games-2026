import { Sparkles, X } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

export interface PreviousPookalam {
  id: string;
  name: string;
  src: string;
}

const PREVIOUS_GALLERY: PreviousPookalam[] = [
  { id: "1", name: "Aditya Sailesh", src: "/previous-pookalam/Aditya-sailesh.jpg" },
  { id: "2", name: "Amith 1206", src: "/previous-pookalam/Amith1206.png" },
  { id: "3", name: "ElegantFalcon", src: "/previous-pookalam/ElegantFalcon.PNG" },
  { id: "4", name: "Rahul Roy", src: "/previous-pookalam/Rahul-Roy-Hub.png" },
  { id: "5", name: "Shimil S Abraham", src: "/previous-pookalam/ShimilSAbraham.png" },
  { id: "6", name: "Vishruth S", src: "/previous-pookalam/Vishruth-S.png" },
  { id: "7", name: "Adithyaa Anilkumar", src: "/previous-pookalam/adithyaaanilkumar.png" },
  { id: "8", name: "Aishwarya TS", src: "/previous-pookalam/aishwaryats.PNG" },
  { id: "9", name: "Alaka AJ", src: "/previous-pookalam/alaka03aj.png" },
  { id: "10", name: "Aldrin Jenson", src: "/previous-pookalam/aldrinjenson.png" },
  { id: "11", name: "Ananya Nair", src: "/previous-pookalam/ananyanair.png" },
  { id: "12", name: "Aswanth AB", src: "/previous-pookalam/aswanthabam.png" },
  { id: "13", name: "Code Lover", src: "/previous-pookalam/code-lover636.png" },
  { id: "14", name: "Denin Paul", src: "/previous-pookalam/deninpaul.png" },
  { id: "15", name: "Devan MEC", src: "/previous-pookalam/devan-MEC.PNG" },
  { id: "16", name: "Jahgath", src: "/previous-pookalam/jahgath.png" },
  { id: "17", name: "Jathulya", src: "/previous-pookalam/jathulya.png" },
  { id: "18", name: "Jemma MG", src: "/previous-pookalam/jemma-mg.png" },
  { id: "19", name: "Kuekuatsuuu", src: "/previous-pookalam/kuekuatsuuu.png" },
  { id: "20", name: "Lovebin", src: "/previous-pookalam/lovebin123.png" },
  { id: "21", name: "Malavika S Menon", src: "/previous-pookalam/malavikasmenon.png" },
  { id: "22", name: "Nikx Taco", src: "/previous-pookalam/nikxtaco.png" },
  { id: "23", name: "Raz", src: "/previous-pookalam/raz8153.png" },
  { id: "24", name: "Ritu Maria", src: "/previous-pookalam/ritumaria.png" },
  { id: "25", name: "Tom Thomas", src: "/previous-pookalam/tomthomasvempala.png" },
];

export function PreviousPookalamCarousel() {
  const [selectedItem, setSelectedItem] = createSignal<PreviousPookalam | null>(null);

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedItem(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <div class="space-y-4">
      <style>{`
        @keyframes pookalamInfiniteScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .pookalam-marquee {
          display: flex;
          width: max-content;
          animation: pookalamInfiniteScroll 150s linear infinite;
        }
      `}</style>

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <div class="inline-flex items-center gap-1.5 text-xs font-black uppercase px-2.5 py-0.5 rounded bg-[var(--pop-yellow)] border-2 border-[var(--ink)] shadow-[2px_2px_0px_0px_var(--ink)] mb-1.5">
            <Sparkles size={12} />
            <span>Community Gallery</span>
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
      </div>

      {/* Infinite Seamless Scrolling Marquee without hover transform/scale */}
      <div class="relative w-full overflow-hidden py-2 select-none [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
        <div class="pookalam-marquee flex gap-4">
          <For each={[...PREVIOUS_GALLERY, ...PREVIOUS_GALLERY]}>
            {(item) => (
              <div
                class="shrink-0 w-60 sm:w-68 rounded-xl bg-[var(--paper-2)] border-3 border-[var(--ink)] shadow-[4px_4px_0px_0px_var(--ink)] overflow-hidden flex flex-col cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                {/* Image Frame */}
                <div class="relative aspect-square w-full bg-[#1F2937] overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={item.src}
                    alt={`Coded Pookalam by ${item.name}`}
                    loading="lazy"
                    class="w-full h-full object-contain"
                  />
                </div>

                {/* Card Footer */}
                <div class="p-3 border-t-2 border-[var(--ink)] flex items-center justify-between gap-2 bg-[var(--paper)]">
                  <p class="font-extrabold text-sm truncate">{item.name}</p>
                  <span class="text-[9px] font-mono uppercase font-bold text-[var(--ink-soft)] px-1.5 py-0.5 rounded bg-[var(--paper-2)] border border-[var(--ink)]/20 shrink-0">
                    Submission
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
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
                  Past Code-a-Pookalam Submission
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                class="w-8 h-8 rounded-lg bg-[var(--paper-2)] border-2 border-[var(--ink)] grid place-items-center hover:bg-[var(--pop-yellow)] transition-colors cursor-pointer"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div class="rounded-xl overflow-hidden bg-[#1F2937] border-2 border-[var(--ink)] p-4 flex items-center justify-center max-h-[60vh]">
              <img
                src={selectedItem()!.src}
                alt={`Pookalam by ${selectedItem()!.name}`}
                class="max-h-[55vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
