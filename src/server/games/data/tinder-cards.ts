/**
 * The Open Source Tinder card pool. SERVER ONLY — `open` is the answer key and
 * must never reach the browser.
 *
 * Selection rules, because a wrong label in a ranked competition is worse than
 * an easy deck:
 *   - Only projects whose licensing is unambiguous and stable.
 *   - No recently-relicensed projects (Redis, Terraform, Elasticsearch,
 *     MongoDB, HashiCorp tooling). Their status has moved in the last few
 *     years and would be both contentious and easy to get wrong.
 *   - No split-personality projects where the honest answer is "it depends"
 *     (IntelliJ Community vs Ultimate, Telegram client vs server).
 *
 * `tricky` marks the pairs that punish assuming the brand rather than reading
 * the name — Chromium vs Chrome, VSCodium vs VS Code, Docker Engine vs Docker
 * Desktop. Every deck is guaranteed a few of these.
 */

export interface TinderCard {
  id: string;
  name: string;
  /** True = OSI-approved open source licence. */
  open: boolean;
  /**
   * What kind of thing it is. PUBLIC — this ships to the browser as the card's
   * "bio" line, so every category must appear on both sides of the deck.
   * "Browser" covers Firefox and Chrome; "Code Editor" covers VSCodium and VS
   * Code. A category that only ever appeared on open projects would be a free
   * answer, which is exactly the bug this comment exists to prevent.
   */
  category: string;
  /** Shown on the results recap — the teaching moment. */
  why: string;
  tricky?: boolean;
}

export const TINDER_CARDS: readonly TinderCard[] = [
  // ---------------------------------------------------------------- open
  {
    id: "blender",
    name: "Blender",
    open: true,
    category: "3D Suite",
    why: "GPL. The whole 3D suite, free.",
  },
  {
    id: "gimp",
    name: "GIMP",
    open: true,
    category: "Image Editor",
    why: "GPL. Still named that, still free.",
  },
  {
    id: "krita",
    name: "Krita",
    open: true,
    category: "Painting",
    why: "GPL. Painting app, KDE project.",
  },
  {
    id: "inkscape",
    name: "Inkscape",
    open: true,
    category: "Vector Art",
    why: "GPL. Vector graphics.",
  },
  {
    id: "audacity",
    name: "Audacity",
    open: true,
    category: "Audio Editor",
    why: "GPL. Audio editor.",
  },
  {
    id: "obs",
    name: "OBS Studio",
    open: true,
    category: "Streaming",
    why: "GPL. Every streamer uses it.",
  },
  {
    id: "vlc",
    name: "VLC",
    open: true,
    category: "Media Player",
    why: "GPL/LGPL. Plays literally anything.",
  },
  {
    id: "firefox",
    name: "Firefox",
    open: true,
    category: "Browser",
    why: "MPL. Mozilla's browser.",
  },
  {
    id: "chromium",
    name: "Chromium",
    open: true,
    category: "Browser",
    why: "BSD. The open core Chrome is built on.",
    tricky: true,
  },
  {
    id: "libreoffice",
    name: "LibreOffice",
    open: true,
    category: "Office Suite",
    why: "MPL. The office suite that isn't Office.",
  },
  {
    id: "godot",
    name: "Godot",
    open: true,
    category: "Game Engine",
    why: "MIT. Game engine, no royalties.",
  },
  {
    id: "signal",
    name: "Signal",
    open: true,
    category: "Messaging",
    why: "AGPL/GPL. Client and server both.",
    tricky: true,
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    open: true,
    category: "Database",
    why: "PostgreSQL Licence. The elephant.",
  },
  {
    id: "linux",
    name: "Linux kernel",
    open: true,
    category: "Operating System",
    why: "GPLv2. Obviously.",
  },
  {
    id: "git",
    name: "Git",
    open: true,
    category: "Version Control",
    why: "GPL. Written to manage the kernel.",
  },
  { id: "python", name: "Python", open: true, category: "Language", why: "PSF Licence." },
  { id: "nodejs", name: "Node.js", open: true, category: "Runtime", why: "MIT." },
  { id: "react", name: "React", open: true, category: "UI Library", why: "MIT. Since 2017." },
  {
    id: "kubernetes",
    name: "Kubernetes",
    open: true,
    category: "Orchestration",
    why: "Apache 2.0. CNCF.",
  },
  { id: "ansible", name: "Ansible", open: true, category: "Automation", why: "GPL." },
  {
    id: "jenkins",
    name: "Jenkins",
    open: true,
    category: "CI Server",
    why: "MIT. The build server that never dies.",
  },
  {
    id: "nextcloud",
    name: "Nextcloud",
    open: true,
    category: "Cloud Storage",
    why: "AGPL. Self-hosted Dropbox.",
  },
  {
    id: "thunderbird",
    name: "Thunderbird",
    open: true,
    category: "Email",
    why: "MPL. Email, still alive.",
  },
  {
    id: "kdenlive",
    name: "Kdenlive",
    open: true,
    category: "Video Editor",
    why: "GPL. Video editor.",
  },
  {
    id: "handbrake",
    name: "HandBrake",
    open: true,
    category: "Transcoder",
    why: "GPL. Video transcoder.",
  },
  {
    id: "sevenzip",
    name: "7-Zip",
    open: true,
    category: "Archiver",
    why: "LGPL. The one that opens everything.",
  },
  { id: "notepadpp", name: "Notepad++", open: true, category: "Text Editor", why: "GPL." },
  {
    id: "wireshark",
    name: "Wireshark",
    open: true,
    category: "Network Tool",
    why: "GPL. Packet sniffing.",
  },
  { id: "neovim", name: "Neovim", open: true, category: "Text Editor", why: "Apache 2.0." },
  {
    id: "vscodium",
    name: "VSCodium",
    open: true,
    category: "Code Editor",
    why: "MIT. VS Code without the Microsoft build.",
    tricky: true,
  },
  {
    id: "dockerengine",
    name: "Docker Engine",
    open: true,
    category: "Containers",
    why: "Apache 2.0. The engine is open.",
    tricky: true,
  },
  { id: "nginx", name: "nginx", open: true, category: "Web Server", why: "BSD." },
  { id: "mastodon", name: "Mastodon", open: true, category: "Social Network", why: "AGPL." },
  {
    id: "jitsi",
    name: "Jitsi Meet",
    open: true,
    category: "Video Calls",
    why: "Apache 2.0. Video calls, self-hostable.",
  },
  {
    id: "fdroid",
    name: "F-Droid",
    open: true,
    category: "App Store",
    why: "GPL. Only ships free software.",
  },
  {
    id: "keepassxc",
    name: "KeePassXC",
    open: true,
    category: "Password Manager",
    why: "GPL. Offline password manager.",
  },
  { id: "rust", name: "Rust", open: true, category: "Language", why: "MIT/Apache 2.0." },
  {
    id: "vim",
    name: "Vim",
    open: true,
    category: "Text Editor",
    why: "Vim Licence, GPL-compatible. You still can't quit.",
  },

  // --------------------------------------------------------- proprietary
  {
    id: "photoshop",
    name: "Photoshop",
    open: false,
    category: "Image Editor",
    why: "Adobe. Rented, not owned.",
  },
  {
    id: "figma",
    name: "Figma",
    open: false,
    category: "Design Tool",
    why: "Proprietary and cloud-locked.",
  },
  {
    id: "notion",
    name: "Notion",
    open: false,
    category: "Notes",
    why: "Proprietary. Your notes live on their server.",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    open: false,
    category: "Notes",
    why: "Free as in beer. Not as in freedom.",
    tricky: true,
  },
  {
    id: "slack",
    name: "Slack",
    open: false,
    category: "Team Chat",
    why: "Salesforce. Very proprietary.",
  },
  {
    id: "discord",
    name: "Discord",
    open: false,
    category: "Team Chat",
    why: "Proprietary, despite what the API docs suggest.",
    tricky: true,
  },
  { id: "zoom", name: "Zoom", open: false, category: "Video Calls", why: "Proprietary." },
  {
    id: "spotify",
    name: "Spotify",
    open: false,
    category: "Music",
    why: "Proprietary. Built on open source, gives none back.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    open: false,
    category: "Messaging",
    why: "Meta. Closed client, closed server.",
    tricky: true,
  },
  {
    id: "chrome",
    name: "Google Chrome",
    open: false,
    category: "Browser",
    why: "Chromium plus proprietary Google bits.",
    tricky: true,
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    open: false,
    category: "Code Editor",
    why: "Microsoft's build ships under a proprietary licence.",
    tricky: true,
  },
  {
    id: "windows",
    name: "Windows",
    open: false,
    category: "Operating System",
    why: "Microsoft. Come on.",
  },
  {
    id: "macos",
    name: "macOS",
    open: false,
    category: "Operating System",
    why: "Apple. Darwin is open; macOS is not.",
    tricky: true,
  },
  {
    id: "sketch",
    name: "Sketch",
    open: false,
    category: "Design Tool",
    why: "Proprietary, Mac only.",
  },
  { id: "miro", name: "Miro", open: false, category: "Whiteboard", why: "Proprietary whiteboard." },
  {
    id: "postman",
    name: "Postman",
    open: false,
    category: "API Client",
    why: "Proprietary, and it wants you logged in.",
    tricky: true,
  },
  {
    id: "sublime",
    name: "Sublime Text",
    open: false,
    category: "Text Editor",
    why: "Proprietary. That dialog never stops.",
  },
  {
    id: "dockerdesktop",
    name: "Docker Desktop",
    open: false,
    category: "Containers",
    why: "Proprietary wrapper around the open engine.",
    tricky: true,
  },
  {
    id: "unity",
    name: "Unity",
    open: false,
    category: "Game Engine",
    why: "Proprietary. You remember why.",
  },
  { id: "canva", name: "Canva", open: false, category: "Design Tool", why: "Proprietary." },
  {
    id: "onepassword",
    name: "1Password",
    open: false,
    category: "Password Manager",
    why: "Proprietary.",
  },
  {
    id: "raycast",
    name: "Raycast",
    open: false,
    category: "Launcher",
    why: "Proprietary launcher.",
  },
  {
    id: "illustrator",
    name: "Illustrator",
    open: false,
    category: "Vector Art",
    why: "Adobe again.",
  },
  {
    id: "premiere",
    name: "Premiere Pro",
    open: false,
    category: "Video Editor",
    why: "Adobe, still.",
  },
  {
    id: "msoffice",
    name: "Microsoft Office",
    open: false,
    category: "Office Suite",
    why: "Proprietary.",
  },
  {
    id: "gdocs",
    name: "Google Docs",
    open: false,
    category: "Office Suite",
    why: "Proprietary and cloud-only.",
  },
  { id: "dropbox", name: "Dropbox", open: false, category: "Cloud Storage", why: "Proprietary." },
  {
    id: "trello",
    name: "Trello",
    open: false,
    category: "Project Board",
    why: "Atlassian. Proprietary.",
  },
  {
    id: "jira",
    name: "Jira",
    open: false,
    category: "Issue Tracker",
    why: "Atlassian. Proprietary, and you know it.",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    open: false,
    category: "Team Chat",
    why: "Proprietary.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    open: false,
    category: "Short Video",
    why: "Proprietary. Extremely.",
  },
  {
    id: "arc",
    name: "Arc",
    open: false,
    category: "Browser",
    why: "Proprietary browser on a Chromium base.",
  },
  {
    id: "safari",
    name: "Safari",
    open: false,
    category: "Browser",
    why: "Apple. WebKit is open, Safari isn't.",
    tricky: true,
  },
  {
    id: "finalcut",
    name: "Final Cut Pro",
    open: false,
    category: "Video Editor",
    why: "Apple. Proprietary.",
  },
  {
    id: "tableau",
    name: "Tableau",
    open: false,
    category: "Analytics",
    why: "Salesforce. Proprietary.",
  },
];
