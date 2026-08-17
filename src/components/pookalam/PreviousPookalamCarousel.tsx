import { X } from "lucide-solid";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { pookalamFull, pookalamThumb } from "~/lib/img";

export interface PreviousPookalam {
  id: string;
  name: string;
  src: string;
  thumb: string;
}

const PREVIOUS_GALLERY: PreviousPookalam[] = [
  {
    id: "1",
    name: "Aditya Sailesh",
    src: pookalamFull("Aditya-sailesh.webp"),
    thumb: pookalamThumb("Aditya-sailesh.webp"),
  },
  {
    id: "2",
    name: "Amith 1206",
    src: pookalamFull("Amith1206.webp"),
    thumb: pookalamThumb("Amith1206.webp"),
  },
  {
    id: "3",
    name: "ElegantFalcon",
    src: pookalamFull("ElegantFalcon.webp"),
    thumb: pookalamThumb("ElegantFalcon.webp"),
  },
  {
    id: "4",
    name: "Rahul Roy",
    src: pookalamFull("Rahul-Roy-Hub.webp"),
    thumb: pookalamThumb("Rahul-Roy-Hub.webp"),
  },
  {
    id: "5",
    name: "Shimil S Abraham",
    src: pookalamFull("ShimilSAbraham.webp"),
    thumb: pookalamThumb("ShimilSAbraham.webp"),
  },
  {
    id: "6",
    name: "Vishruth S",
    src: pookalamFull("Vishruth-S.webp"),
    thumb: pookalamThumb("Vishruth-S.webp"),
  },
  {
    id: "7",
    name: "Adithyaa Anilkumar",
    src: pookalamFull("adithyaaanilkumar.webp"),
    thumb: pookalamThumb("adithyaaanilkumar.webp"),
  },
  {
    id: "8",
    name: "Aishwarya TS",
    src: pookalamFull("aishwaryats.webp"),
    thumb: pookalamThumb("aishwaryats.webp"),
  },
  {
    id: "9",
    name: "Alaka AJ",
    src: pookalamFull("alaka03aj.webp"),
    thumb: pookalamThumb("alaka03aj.webp"),
  },
  {
    id: "10",
    name: "Aldrin Jenson",
    src: pookalamFull("aldrinjenson.webp"),
    thumb: pookalamThumb("aldrinjenson.webp"),
  },
  {
    id: "11",
    name: "Ananya Nair",
    src: pookalamFull("ananyanair.webp"),
    thumb: pookalamThumb("ananyanair.webp"),
  },
  {
    id: "12",
    name: "Aswanth AB",
    src: pookalamFull("aswanthabam.webp"),
    thumb: pookalamThumb("aswanthabam.webp"),
  },
  {
    id: "13",
    name: "Code Lover",
    src: pookalamFull("code-lover636.webp"),
    thumb: pookalamThumb("code-lover636.webp"),
  },
  {
    id: "14",
    name: "Denin Paul",
    src: pookalamFull("deninpaul.webp"),
    thumb: pookalamThumb("deninpaul.webp"),
  },
  {
    id: "15",
    name: "Devan MEC",
    src: pookalamFull("devan-MEC.webp"),
    thumb: pookalamThumb("devan-MEC.webp"),
  },
  {
    id: "16",
    name: "Jahgath",
    src: pookalamFull("jahgath.webp"),
    thumb: pookalamThumb("jahgath.webp"),
  },
  {
    id: "17",
    name: "Jathulya",
    src: pookalamFull("jathulya.webp"),
    thumb: pookalamThumb("jathulya.webp"),
  },
  {
    id: "18",
    name: "Jemma MG",
    src: pookalamFull("jemma-mg.webp"),
    thumb: pookalamThumb("jemma-mg.webp"),
  },
  {
    id: "19",
    name: "Kuekuatsuuu",
    src: pookalamFull("kuekuatsuuu.webp"),
    thumb: pookalamThumb("kuekuatsuuu.webp"),
  },
  {
    id: "20",
    name: "Lovebin",
    src: pookalamFull("lovebin123.webp"),
    thumb: pookalamThumb("lovebin123.webp"),
  },
  {
    id: "21",
    name: "Malavika S Menon",
    src: pookalamFull("malavikasmenon.webp"),
    thumb: pookalamThumb("malavikasmenon.webp"),
  },
  {
    id: "22",
    name: "Nikx Taco",
    src: pookalamFull("nikxtaco.webp"),
    thumb: pookalamThumb("nikxtaco.webp"),
  },
  {
    id: "23",
    name: "Raz",
    src: pookalamFull("raz8153.webp"),
    thumb: pookalamThumb("raz8153.webp"),
  },
  {
    id: "24",
    name: "Ritu Maria",
    src: pookalamFull("ritumaria.webp"),
    thumb: pookalamThumb("ritumaria.webp"),
  },
  {
    id: "25",
    name: "Tom Thomas",
    src: pookalamFull("tomthomasvempala.webp"),
    thumb: pookalamThumb("tomthomasvempala.webp"),
  },
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
                    src={item.thumb}
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
