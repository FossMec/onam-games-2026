/**
 * The Open Source Tinder card pool. SERVER ONLY - `open` is the answer key and
 * must never reach the browser.
 *
 * Curated list of 25 canonical software tools with official brand marks.
 */

export interface TinderCard {
  id: string;
  name: string;
  /** True = OSI-approved open source licence. */
  open: boolean;
  category: string;
  /** The one-line verdict: which licence, and the punchline. */
  why: string;
  fact: string;
  tricky?: boolean;
}

export const TINDER_CARDS: readonly TinderCard[] = [
  // ---------------------------------------------------------------- open (14)
  {
    id: "gimp",
    name: "GIMP",
    open: true,
    category: "Design & Art",
    why: "GPL. Still named that, still free.",
    fact: "The GNU Image Manipulation Program, GPL since 1996 - older than most of the people complaining about its interface.",
  },
  {
    id: "vlc",
    name: "VLC",
    open: true,
    category: "Audio & Video",
    why: "GPL/LGPL. Plays literally anything.",
    fact: "The traffic cone that plays anything you throw at it. GPL/LGPL from VideoLAN, which began as a student project at École Centrale Paris.",
  },
  {
    id: "firefox",
    name: "Firefox",
    open: true,
    category: "Browser",
    why: "MPL. Mozilla's browser.",
    fact: "Mozilla's browser, and the last major engine that isn't Chromium. MPL-licensed and steered by a non-profit foundation.",
  },
  {
    id: "chromium",
    name: "Chromium",
    open: true,
    category: "Browser",
    why: "BSD. The open core Chrome is built on.",
    tricky: true,
    fact: "The open-source browser project Chrome is built from. BSD-licensed - Chromium is the free part; the branding, codecs and sync bolted on top are not.",
  },
  {
    id: "vim",
    name: "Vim",
    open: true,
    category: "Code Editor",
    why: "Vim Licence, GPL-compatible. You still can't quit.",
    fact: "Vi IMproved, 1991. Its licence is charityware - GPL-compatible, and it asks you to consider donating to children in Uganda.",
  },
  {
    id: "git",
    name: "Git",
    open: true,
    category: "Dev Tools",
    why: "GPL. Written to manage the kernel.",
    fact: "Linus wrote it in ten days in 2005, after the kernel lost access to a proprietary tool called BitKeeper. GPLv2 - you use it daily because something closed was taken away.",
  },
  {
    id: "dockerengine",
    name: "Docker Engine",
    open: true,
    category: "Dev Tools",
    why: "Apache 2.0. The engine is open.",
    tricky: true,
    fact: "The container runtime itself, Apache 2.0. The engine has always been open; it is the desktop app wrapped around it that isn't.",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    open: true,
    category: "Dev Tools",
    why: "PostgreSQL Licence. The elephant.",
    fact: "The database with the elephant. Its own permissive licence, no single corporate owner, and thirty years of people not regretting it.",
  },
  {
    id: "python",
    name: "Python",
    open: true,
    category: "Dev Tools",
    why: "PSF Licence.",
    fact: "Named after Monty Python, not the snake. The reference implementation has been open since 1991 under the permissive PSF licence.",
  },
  {
    id: "rust",
    name: "Rust",
    open: true,
    category: "Dev Tools",
    why: "MIT/Apache 2.0.",
    fact: "A systems language that catches memory bugs at compile time. Dual MIT/Apache 2.0, now governed by the Rust Foundation rather than Mozilla.",
  },
  {
    id: "react",
    name: "React",
    open: true,
    category: "Dev Tools",
    why: "MIT. Since 2017.",
    fact: "Meta's UI library. MIT only since 2017 - before that it carried a patent clause that got it banned from Apache projects until the backlash forced a relicence.",
  },
  {
    id: "signal",
    name: "Signal",
    open: true,
    category: "Comms",
    why: "AGPL/GPL. Client and server both.",
    tricky: true,
    fact: "Encrypted messaging where the client and the server are both published. GPL/AGPL, run by a non-profit living on donations.",
  },
  {
    id: "debian",
    name: "Debian",
    open: true,
    category: "Operating System",
    why: "DFSG / GPL. The universal operating system.",
    fact: "The rock-solid GNU/Linux distribution founded in 1993. 100% free software committed to the Debian Free Software Guidelines.",
  },
  {
    id: "godot",
    name: "Godot",
    open: true,
    category: "Game Dev",
    why: "MIT. Game engine, no royalties.",
    fact: "A game engine with no royalties, no seat fees and no revenue share, ever. MIT-licensed - which is exactly why so many studios moved to it in 2023.",
  },

  // --------------------------------------------------------- proprietary (11)
  {
    id: "photoshop",
    name: "Photoshop",
    open: false,
    category: "Design & Art",
    why: "Adobe. Rented, not owned.",
    fact: "Adobe's raster editor. Subscription-only since 2013: stop paying and it stops opening, which is the part people forget is a licence term.",
  },
  {
    id: "canva",
    name: "Canva",
    open: false,
    category: "Design & Art",
    why: "Proprietary.",
    fact: "Browser-based design for people who do not want a design tool. Proprietary and hosted.",
  },
  {
    id: "spotify",
    name: "Spotify",
    open: false,
    category: "Audio & Video",
    why: "Proprietary. Built on open source, gives none back.",
    fact: "Music streaming built on a mountain of open source, some of which they publish back - but the product itself is firmly closed.",
  },
  {
    id: "chrome",
    name: "Google Chrome",
    open: false,
    category: "Browser",
    why: "Chromium plus proprietary Google bits.",
    tricky: true,
    fact: "Chromium plus Google's additions - proprietary codecs, sync, DRM and branding. The base is open; the thing you installed is not.",
  },
  {
    id: "safari",
    name: "Safari",
    open: false,
    category: "Browser",
    why: "Apple. WebKit is open, Safari isn't.",
    tricky: true,
    fact: "Apple's browser. WebKit, the engine inside it, is open source; Safari itself is proprietary and ships only on Apple platforms.",
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    open: false,
    category: "Code Editor",
    why: "Microsoft's build ships under a proprietary licence.",
    tricky: true,
    fact: "Microsoft's build of VS Code. The source is MIT, but the binary you downloaded ships under a proprietary licence, with telemetry and a marketplace only it may use.",
  },
  {
    id: "dockerdesktop",
    name: "Docker Desktop",
    open: false,
    category: "Dev Tools",
    why: "Proprietary wrapper around the open engine.",
    tricky: true,
    fact: "The GUI, VM and updater wrapped around the open Docker Engine. Proprietary, and since 2021 it needs a paid licence at larger companies.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    open: false,
    category: "Comms",
    why: "Meta. Closed client, closed server.",
    tricky: true,
    fact: "Meta's messenger. It uses the open Signal Protocol for encryption, which is not the same as being open: client and server are both proprietary.",
  },
  {
    id: "discord",
    name: "Discord",
    open: false,
    category: "Comms",
    why: "Proprietary, despite what the API docs suggest.",
    tricky: true,
    fact: "Chat for communities and games. Proprietary - the public bot API makes it feel open, but neither client nor server is.",
  },
  {
    id: "windows",
    name: "Windows",
    open: false,
    category: "Operating System",
    why: "Microsoft. Come on.",
    fact: "Microsoft's desktop OS. Proprietary and licensed per device - you bought permission to run it, not a copy of it.",
  },
  {
    id: "unity",
    name: "Unity",
    open: false,
    category: "Game Dev",
    why: "Proprietary. You remember why.",
    fact: "A proprietary game engine. In 2023 it announced retroactive per-install fees, reversed course after a developer revolt, and taught an industry to read licences.",
  },
];
