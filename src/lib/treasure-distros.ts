export interface DistroInfo {
  id: string;
  name: string;
  tagline: string;
  svgPath: string;
  color: string;
  popColor: string;
  tierScore: number;
  whatIsIt: string;
  specialPower: string;
  whoIsItFor: string;
  storyParagraphs: string[];
}

export const RANKED_DISTROS: readonly DistroInfo[] = [
  {
    id: "ubuntu",
    name: "Ubuntu",
    tagline: "Linux for human beings · The classic",
    svgPath: "/images/treasures/ubuntu.svg",
    color: "#E95420",
    popColor: "var(--pop-pink)",
    tierScore: 10,
    whatIsIt:
      "Ubuntu is the world's most popular Linux operating system for beginners. Launched in 2004, its mission is simple: make using a computer free, friendly, and accessible to everyone on Earth without needing to be a tech wizard.",
    specialPower:
      "Everything works right out of the box. It has an easy app store just like your smartphone, great hardware support, and a massive friendly community where every question you could ever have is already answered.",
    whoIsItFor:
      "Students, beginners exploring Linux for the first time, everyday computer users, and developers building modern web applications.",
    storyParagraphs: [
      "The word 'Ubuntu' comes from an ancient African philosophy that translates to 'humanity towards others' — the belief that we grow together by sharing with our community.",
      "Before Ubuntu, installing Linux required lots of technical command-line setup. Ubuntu changed the tech world forever by packaging free software into a beautiful, easy installer that anyone can use.",
      "Today, Ubuntu powers the majority of cloud servers on the internet and even runs systems aboard the International Space Station!",
    ],
  },
  {
    id: "mint",
    name: "Linux Mint",
    tagline: "Cinnamon elegance · Just works",
    svgPath: "/images/treasures/mint.svg",
    color: "#87CF3E",
    popColor: "var(--pop-yellow)",
    tierScore: 20,
    whatIsIt:
      "Linux Mint is designed to feel instantly comfortable and familiar to anyone who has used Windows. It features a classic start menu, taskbar, and desktop icons so you can get straight to work without feeling lost.",
    specialPower:
      "It respects your peace of mind. Unlike commercial systems, Mint never shows you pop-up ads, never tracks what you do, and never forces your computer to restart in the middle of your work.",
    whoIsItFor:
      "People switching over from Windows or Mac, students, office workers, and anyone who wants a reliable computer that just works smoothly.",
    storyParagraphs: [
      "When other operating systems started removing traditional desktop menus in favor of tablet-like screens, the creators of Linux Mint built the 'Cinnamon' desktop to protect the traditional, fast desktop workflow people love.",
      "Mint comes packed with helpful built-in tools, including a safe update manager and a system snapshot tool (Timeshift) that lets you easily undo mistakes.",
      "It is completely community-funded by voluntary donations, meaning its only priority is making computers enjoyable for its users.",
    ],
  },
  {
    id: "fedora",
    name: "Fedora",
    tagline: "Leading edge freedom & innovation",
    svgPath: "/images/treasures/fedora.svg",
    color: "#294172",
    popColor: "var(--pop-blue)",
    tierScore: 30,
    whatIsIt:
      "Fedora is the testing ground of the future for open-source software. Supported by Red Hat, it brings brand-new computer technologies and modern software updates to your fingertips months before other systems get them.",
    specialPower:
      "It is always the first to adopt modern computing standards—like super-smooth touchpad gestures, modern sound systems, and cutting-edge desktop designs—while strictly championing 100% free software.",
    whoIsItFor:
      "Software developers, college students learning programming, and tech enthusiasts who love having the newest tools before anyone else.",
    storyParagraphs: [
      "Fedora operates under four core pillars: Freedom, Friends, Features, and First. It strongly believes in contributing all its improvements back to the global open-source community rather than keeping secrets.",
      "Linux creator Linus Torvalds has famously used Fedora on his own main computers to develop the Linux kernel.",
      "It also develops modern 'unbreakable' operating systems where updates are installed as atomic snapshots that can be rolled back instantly if anything goes wrong.",
    ],
  },
  {
    id: "opensuse",
    name: "openSUSE",
    tagline: "The chameleon · Tumbleweed rolling",
    svgPath: "/images/treasures/opensuse.svg",
    color: "#73BA25",
    popColor: "var(--pop-teal)",
    tierScore: 40,
    whatIsIt:
      "Born in Germany in 1992 and represented by a friendly green chameleon mascot, openSUSE is celebrated worldwide for rock-solid engineering, automated quality testing, and stability.",
    specialPower:
      "Its built-in 'Time Machine' recovery power. If an update ever causes a problem, you can literally turn back the clock at boot time to how your computer was 10 minutes ago and keep working without panic.",
    whoIsItFor:
      "Developers, power users, and anyone who wants constant bleeding-edge software updates without the fear of their system breaking.",
    storyParagraphs: [
      "openSUSE uses an automated testing laboratory called 'openQA'. Before any software update is shipped to users, virtual computers automatically boot up and visually test the desktop to make sure no bugs slip through.",
      "It includes a powerful control center called YaST, which lets you easily configure complex networking, firewalls, and storage settings through a clear menu.",
      "Its Open Build Service helps programmers across the world compile their software for all different Linux versions from a single webpage.",
    ],
  },
  {
    id: "debian",
    name: "Debian",
    tagline: "The Universal Operating System",
    svgPath: "/images/treasures/debian.svg",
    color: "#D70A53",
    popColor: "var(--pop-red)",
    tierScore: 50,
    whatIsIt:
      "Known as 'The Mother of Linux Distros', Debian is a massive, completely non-profit community project that has been running since 1993. It is the rock-solid foundation that powers Ubuntu, Kali, Mint, and hundreds more.",
    specialPower:
      "Legendary, unbreakable stability. Debian tests its software for years before approving it, making it so dependable that it almost never crashes.",
    whoIsItFor:
      "Web servers, scientific supercomputers, software developers, and anyone who wants a computer that runs reliably for years without needing maintenance.",
    storyParagraphs: [
      "Debian is not owned by any company. It is run entirely by thousands of passionate volunteer developers around the globe who vote democratically on project leaders and policies.",
      "Its strict Free Software Guidelines were so well-written that they became the official definition used worldwide for Open Source Software.",
      "Because of its rock-solid reliability, Debian runs on mission-critical medical equipment, research satellites, and web servers worldwide.",
    ],
  },
  {
    id: "alpine",
    name: "Alpine Linux",
    tagline: "Lightweight, security-oriented musl libc",
    svgPath: "/images/treasures/alpine.svg",
    color: "#0D597F",
    popColor: "var(--pop-teal)",
    tierScore: 60,
    whatIsIt:
      "Alpine is an ultra-tiny, feather-light Linux system. While a standard Windows or Mac installation takes 20,000 to 50,000 Megabytes of space, Alpine is so compact it fits in just 5 Megabytes!",
    specialPower:
      "Because it is microscopic, Alpine boots in fractions of a second and uses almost zero computer memory. It has built-in security protections against hackers and memory attacks.",
    whoIsItFor:
      "Cloud engineers, website backend developers, smart Internet-of-Things (IoT) gadgets, routers, and lightweight container applications.",
    storyParagraphs: [
      "Whenever you use a modern web app like Discord, Spotify, or Netflix, the cloud servers behind the scenes are likely spinning up thousands of tiny Alpine Linux containers in seconds.",
      "Alpine achieved its tiny footprint by stripping out all unneeded complexity and keeping only the absolute essentials needed to run programs fast.",
      "Its package installer is blazingly fast, installing full programming tools and languages in less than a second.",
    ],
  },
  {
    id: "kali",
    name: "Kali Linux",
    tagline: "Offensive security & penetration testing",
    svgPath: "/images/treasures/kali.svg",
    color: "#2777C0",
    popColor: "var(--pop-purple)",
    tierScore: 70,
    whatIsIt:
      "Kali Linux is the ultimate digital Swiss Army knife for cybersecurity and ethical hacking. It comes loaded with over 600 specialized tools used to test if computer systems, websites, and Wi-Fi networks are secure.",
    specialPower:
      "Security researchers use Kali to think like an attacker: finding security vulnerabilities in computer networks and fixing them before malicious criminals can exploit them.",
    whoIsItFor:
      "Ethical hackers, cybersecurity students, defense researchers, and IT security auditors.",
    storyParagraphs: [
      "Kali is famously featured in cybersecurity movies and TV shows like 'Mr. Robot' because of its authentic real-world security toolkit.",
      "It features an 'Undercover Mode' that instantly changes the desktop theme to look like ordinary Windows so ethical hackers can work in public places without drawing attention.",
      "It also runs on smartphones (Kali NetHunter) and tiny credit-card-sized computers for portable security audits.",
    ],
  },
  {
    id: "void",
    name: "Void Linux",
    tagline: "Independent · XBPS & runit speed",
    svgPath: "/images/treasures/void.svg",
    color: "#478061",
    popColor: "var(--pop-teal)",
    tierScore: 80,
    whatIsIt:
      "Void Linux is an independent, lightning-fast operating system built from scratch with zero bloat. It starts up almost instantly and stays snappy even on older laptops.",
    specialPower:
      "It refuses to follow the crowd. While most operating systems have become heavy and complicated, Void uses clean, minimalist tools that let you feel every ounce of speed your computer hardware has to offer.",
    whoIsItFor:
      "Minimalists, speed lovers, programmers, and anyone looking to breathe fresh, fast life into older laptops.",
    storyParagraphs: [
      "Void was created from scratch by a former NetBSD developer who wanted to build a simple, clean operating system following classic UNIX philosophy: do one thing and do it well.",
      "Its custom package manager (XBPS) installs and updates software at microsecond speeds, faster than almost any other operating system.",
      "Void lets the user remain in full control of their system without background telemetry or hidden automated services running without permission.",
    ],
  },
  {
    id: "nixos",
    name: "NixOS",
    tagline: "Declarative · Reproducible pure bliss",
    svgPath: "/images/treasures/nixos.svg",
    color: "#5277C3",
    popColor: "var(--pop-teal)",
    tierScore: 90,
    whatIsIt:
      "NixOS is a revolutionary operating system where your entire computer setup—all your apps, settings, wallpapers, and code tools—is described in a single human-readable recipe file.",
    specialPower:
      "If you buy a new computer or share your configuration with a friend, you simply hand them your recipe file. In minutes, the new machine configures itself to look and behave 100% identically. Every update is completely reversible with zero fear of breaking things.",
    whoIsItFor:
      "Computer science students, advanced programmers, and anyone who wants an invincible computer setup that can be restored anywhere in minutes.",
    storyParagraphs: [
      "In traditional operating systems, installing two different versions of the same software can cause messy conflicts. NixOS isolates every single app in its own unique cryptographic folder, completely preventing conflicts.",
      "Every time you make a change or update your system, NixOS creates a new 'generation' snapshot in your boot menu. If a graphic driver ever fails, you can simply select the previous generation at boot and keep working.",
      "It is rapidly becoming one of the most exciting tools in modern computer science for building reproducible development environments.",
    ],
  },
  {
    id: "arch",
    name: "Arch Linux",
    tagline: "Rolling release · 'I use Arch BTW'",
    svgPath: "/images/treasures/arch.svg",
    color: "#1793D1",
    popColor: "var(--pop-blue)",
    tierScore: 100,
    whatIsIt:
      "Arch Linux is the ultimate DIY (Do-It-Yourself) operating system. You start with a blank terminal screen and personally choose every single window manager, theme, and program that gets installed.",
    specialPower:
      "Total freedom and zero bloat. There are no pre-installed apps or background services you didn't personally choose. You get brand-new software updates the exact day developers release them.",
    whoIsItFor:
      "Curious tinkerers, programmers, power users, and anyone who wants to truly learn how computer operating systems work from the inside out.",
    storyParagraphs: [
      "Installing Arch Linux is considered a rite of passage for aspiring developers because it teaches you about disk partitioning, kernels, drivers, and system architecture step by step.",
      "The Arch User Repository (AUR) is the largest community software library in the world, allowing you to install almost any piece of software created for Linux with a simple command.",
      "The Arch Wiki is universally respected across the entire tech industry as one of the most comprehensive knowledge bases on computer software in existence.",
    ],
  },
  {
    id: "gentoo",
    name: "Gentoo",
    tagline: "Source compiling · Extreme optimization",
    svgPath: "/images/treasures/gentoo.svg",
    color: "#54487A",
    popColor: "var(--pop-purple)",
    tierScore: 95,
    whatIsIt:
      "Gentoo is the custom racecar of operating systems. Instead of downloading pre-built software, your computer compiles every single program directly from raw source code specifically tailored for your exact processor.",
    specialPower:
      "Extreme performance and customizability. You can strip out every single feature or library you don't need, making your programs run with maximum possible CPU speed and efficiency.",
    whoIsItFor:
      "Hardware hackers, performance enthusiasts, compiler researchers, and programmers who want complete control over their hardware.",
    storyParagraphs: [
      "Named after the Gentoo penguin (the fastest swimming penguin on Earth), this system lets you toggle 'USE flags' to decide exactly what code gets compiled into your applications.",
      "Google used Gentoo as the initial foundation when developing ChromeOS for Chromebooks because of its extreme flexibility and lightweight nature.",
      "It gives programmers a deep, intimate understanding of how compilers turn human-written code into machine instructions.",
    ],
  },
  {
    id: "slackware",
    name: "Slackware",
    tagline: "The oldest surviving Linux distro",
    svgPath: "/images/treasures/slackware.svg",
    color: "#22395B",
    popColor: "var(--pop-blue)",
    tierScore: 75,
    whatIsIt:
      "Created in 1993 by Patrick Volkerding, Slackware is the oldest actively maintained Linux distribution in existence. It is built on classic UNIX simplicity, transparency, and stability.",
    specialPower:
      "No mystery automation. Everything in Slackware is configured through clean, human-readable text files that you can inspect and edit yourself, giving you 100% control with zero unexpected behavior.",
    whoIsItFor:
      "UNIX purists, veteran system administrators, and students who want to experience the authentic roots of modern computing.",
    storyParagraphs: [
      "Slackware avoids complicated graphical control panels, opting for pure text scripts that show you exactly what your computer is doing at every moment.",
      "It has run continuously for over 30 years while staying true to its original philosophy of simplicity and user responsibility.",
      "Learning Slackware gives students a timeless foundation in how operating systems have functioned since the dawn of the internet.",
    ],
  },
  {
    id: "popos",
    name: "Pop!_OS",
    tagline: "COSMIC desktop · Creator powerhouse",
    svgPath: "/images/treasures/popos.svg",
    color: "#48B9C7",
    popColor: "var(--pop-yellow)",
    tierScore: 35,
    whatIsIt:
      "Built by computer company System76, Pop!_OS is designed specifically for gamers, creators, programmers, and STEM students who want a fast, productive, and beautiful workspace.",
    specialPower:
      "Smart automatic window tiling that organizes your coding editors, notes, and browser side-by-side automatically, plus built-in support for dedicated gaming graphics cards.",
    whoIsItFor:
      "Gamers, video creators, computer science students, and programmers who want high productivity with zero setup headache.",
    storyParagraphs: [
      "Pop!_OS comes with dedicated installers for NVIDIA and AMD graphics, making PC gaming and 3D modeling work seamlessly without driver struggles.",
      "Its creators are currently building the 'COSMIC' desktop entirely in Rust — a modern, ultra-fast, and memory-safe programming language.",
      "It includes full-disk security encryption by default to keep your personal data and projects safe wherever you travel.",
    ],
  },
  {
    id: "manjaro",
    name: "Manjaro",
    tagline: "Friendly Arch-based rolling desktop",
    svgPath: "/images/treasures/manjaro.svg",
    color: "#35BF5C",
    popColor: "var(--pop-teal)",
    tierScore: 45,
    whatIsIt:
      "Manjaro takes the incredible speed, flexibility, and vast software library of Arch Linux and wraps it in a friendly, easy-to-use desktop that anyone can install in minutes.",
    specialPower:
      "It automatically detects your graphics cards and Wi-Fi chips with zero manual setup, and tests software updates for extra stability before delivering them to your computer.",
    whoIsItFor:
      "Gamers, students, and everyday desktop users who want the newest software updates without having to build an operating system from scratch.",
    storyParagraphs: [
      "Manjaro includes an intuitive visual software center where you can install thousands of free apps, games, and creative tools with a single click.",
      "Its hardware detection tools make switching between different graphics drivers or Linux kernel versions as easy as flipping a switch.",
      "It offers pre-configured editions with beautiful desktop environments like KDE Plasma and Xfce.",
    ],
  },
  {
    id: "redhat",
    name: "Red Hat Enterprise",
    tagline: "Enterprise Linux standard bearer",
    svgPath: "/images/treasures/redhat.svg",
    color: "#EE0000",
    popColor: "var(--pop-red)",
    tierScore: 15,
    whatIsIt:
      "Red Hat is the industrial titan of open source. It is the operating system trusted by major banks, airlines, stock exchanges, and supercomputers across the globe.",
    specialPower:
      "Extreme commercial reliability and 10-year support guarantees. Red Hat demonstrated to the global business world that free and open-source software could outperform expensive proprietary systems.",
    whoIsItFor:
      "Enterprise cloud architects, server engineers, and datacenter administrators managing critical internet infrastructure.",
    storyParagraphs: [
      "Red Hat proved that sharing software code openly can create a multi-billion dollar business by providing enterprise support while giving code back to the public.",
      "It pioneered modern internet server standards, including container tools and advanced security mechanisms that protect servers from cyberattacks.",
      "Thousands of major online services you use every day rely on Red Hat infrastructure behind the scenes.",
    ],
  },
];

const DIFFICULTY_ORDER: Record<string, number> = {
  hard: 3,
  medium: 2,
  easy: 1,
  first: 0,
};

export function mapQuestionsToDistros<T extends { id: string; difficulty: string }>(
  questions: T[],
): Map<string, DistroInfo> {
  const sorted = [...questions].sort((a, b) => {
    const diffA = DIFFICULTY_ORDER[a.difficulty] ?? 1;
    const diffB = DIFFICULTY_ORDER[b.difficulty] ?? 1;
    return diffA - diffB;
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
