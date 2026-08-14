import { X } from "lucide-solid";
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

      {/* Infinite Seamless Scrolling Marquee without hover transform/scale or shadows */}
      <div class="relative w-full overflow-hidden py-2 select-none [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
        <div class="pookalam-marquee flex gap-4">
          <For each={[...PREVIOUS_GALLERY, ...PREVIOUS_GALLERY]}>
            {(item) => (
              <div
                class="shrink-0 w-56 sm:w-64 card card-plain bg-surface-2 p-0 overflow-hidden flex flex-col cursor-pointer"
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
                <div class="p-2.5 border-t border-[length:var(--ink-w)] border-[var(--ink)] flex items-center justify-between gap-2 bg-surface">
                  <p class="font-extrabold text-xs sm:text-sm truncate">{item.name}</p>
                  <span class="badge text-[9px] uppercase font-bold text-muted shrink-0">
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
            class="relative max-w-2xl w-full card pop-yellow space-y-4 p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between border-b border-[length:var(--ink-w)] border-[var(--ink)] pb-3">
              <div>
                <h3 class="text-xl font-black">{selectedItem()!.name}</h3>
                <p class="comment">Past Code-a-Pookalam Submission</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                class="w-8 h-8 rounded bg-surface-2 inked grid place-items-center hover:bg-[var(--pop-yellow)] transition-colors cursor-pointer"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div class="rounded overflow-hidden bg-[#1F2937] inked p-4 flex items-center justify-center max-h-[60vh]">
              <img
                src={selectedItem()!.src}
                alt={`Pookalam by ${selectedItem()!.name}`}
                class="max-h-[55vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
