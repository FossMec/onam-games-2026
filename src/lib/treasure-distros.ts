export interface DistroInfo {
  id: string;
  name: string;
  tagline: string;
  svgPath: string;
  color: string;
  popColor: string;
  tierScore: number;
}

export const RANKED_DISTROS: readonly DistroInfo[] = [
  {
    id: "arch",
    name: "Arch Linux",
    tagline: "Rolling release · 'I use Arch BTW'",
    svgPath: "/images/treasures/arch.svg",
    color: "#1793D1",
    popColor: "var(--pop-blue)",
    tierScore: 100,
  },
  {
    id: "gentoo",
    name: "Gentoo",
    tagline: "Source compiling · Extreme optimization",
    svgPath: "/images/treasures/gentoo.svg",
    color: "#54487A",
    popColor: "var(--pop-purple)",
    tierScore: 95,
  },
  {
    id: "nixos",
    name: "NixOS",
    tagline: "Declarative · Reproducible pure bliss",
    svgPath: "/images/treasures/nixos.svg",
    color: "#5277C3",
    popColor: "var(--pop-teal)",
    tierScore: 90,
  },
  {
    id: "void",
    name: "Void Linux",
    tagline: "Independent · XBPS & runit speed",
    svgPath: "/images/treasures/void.svg",
    color: "#478061",
    popColor: "var(--pop-teal)",
    tierScore: 85,
  },
  {
    id: "debian",
    name: "Debian",
    tagline: "The Universal Operating System",
    svgPath: "/images/treasures/debian.svg",
    color: "#D70A53",
    popColor: "var(--pop-red)",
    tierScore: 80,
  },
  {
    id: "slackware",
    name: "Slackware",
    tagline: "The oldest surviving Linux distro",
    svgPath: "/images/treasures/slackware.svg",
    color: "#22395B",
    popColor: "var(--pop-blue)",
    tierScore: 75,
  },
  {
    id: "kali",
    name: "Kali Linux",
    tagline: "Offensive security & penetration testing",
    svgPath: "/images/treasures/kali.svg",
    color: "#2777C0",
    popColor: "var(--pop-purple)",
    tierScore: 70,
  },
  {
    id: "alpine",
    name: "Alpine Linux",
    tagline: "Lightweight, security-oriented musl libc",
    svgPath: "/images/treasures/alpine.svg",
    color: "#0D597F",
    popColor: "var(--pop-teal)",
    tierScore: 65,
  },
  {
    id: "fedora",
    name: "Fedora",
    tagline: "Leading edge freedom & innovation",
    svgPath: "/images/treasures/fedora.svg",
    color: "#294172",
    popColor: "var(--pop-blue)",
    tierScore: 60,
  },
  {
    id: "opensuse",
    name: "openSUSE",
    tagline: "The chameleon · Tumbleweed rolling",
    svgPath: "/images/treasures/opensuse.svg",
    color: "#73BA25",
    popColor: "var(--pop-teal)",
    tierScore: 55,
  },
  {
    id: "manjaro",
    name: "Manjaro",
    tagline: "Friendly Arch-based rolling desktop",
    svgPath: "/images/treasures/manjaro.svg",
    color: "#35BF5C",
    popColor: "var(--pop-teal)",
    tierScore: 50,
  },
  {
    id: "popos",
    name: "Pop!_OS",
    tagline: "COSMIC desktop · Creator powerhouse",
    svgPath: "/images/treasures/popos.svg",
    color: "#48B9C7",
    popColor: "var(--pop-yellow)",
    tierScore: 40,
  },
  {
    id: "mint",
    name: "Linux Mint",
    tagline: "Cinnamon elegance · Just works",
    svgPath: "/images/treasures/mint.svg",
    color: "#87CF3E",
    popColor: "var(--pop-yellow)",
    tierScore: 30,
  },
  {
    id: "ubuntu",
    name: "Ubuntu",
    tagline: "Linux for human beings · The classic",
    svgPath: "/images/treasures/ubuntu.svg",
    color: "#E95420",
    popColor: "var(--pop-pink)",
    tierScore: 20,
  },
  {
    id: "redhat",
    name: "Red Hat Enterprise",
    tagline: "Enterprise Linux standard bearer",
    svgPath: "/images/treasures/redhat.svg",
    color: "#EE0000",
    popColor: "var(--pop-red)",
    tierScore: 10,
  },
];

const DIFFICULTY_ORDER: Record<string, number> = {
  hard: 3,
  medium: 2,
  easy: 1,
  first: 0,
};

/**
 * Maps any N questions to the top N Linux distro logos.
 * Harder questions are mapped to higher-tier distros (Arch, Gentoo, NixOS, etc.)
 * so S-tier logos are always assigned to the hardest puzzles regardless of counts.
 */
export function mapQuestionsToDistros<T extends { id: string; difficulty: string }>(
  questions: T[],
): Map<string, DistroInfo> {
  const sorted = [...questions].sort((a, b) => {
    const diffA = DIFFICULTY_ORDER[a.difficulty] ?? 1;
    const diffB = DIFFICULTY_ORDER[b.difficulty] ?? 1;
    return diffB - diffA;
  });

  const mapping = new Map<string, DistroInfo>();
  sorted.forEach((q, idx) => {
    const distro = RANKED_DISTROS[idx % RANKED_DISTROS.length];
    mapping.set(q.id, distro);
  });

  return mapping;
}

export function getDistroForQuestionIndex(index: number): DistroInfo {
  return RANKED_DISTROS[index % RANKED_DISTROS.length];
}
