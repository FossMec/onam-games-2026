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
  /** Shown on the results recap — the teaching moment. */
  why: string;
  tricky?: boolean;
}

export const TINDER_CARDS: readonly TinderCard[] = [
  // ---------------------------------------------------------------- open
  { id: "blender", name: "Blender", open: true, why: "GPL. The whole 3D suite, free." },
  { id: "gimp", name: "GIMP", open: true, why: "GPL. Still named that, still free." },
  { id: "krita", name: "Krita", open: true, why: "GPL. Painting app, KDE project." },
  { id: "inkscape", name: "Inkscape", open: true, why: "GPL. Vector graphics." },
  { id: "audacity", name: "Audacity", open: true, why: "GPL. Audio editor." },
  { id: "obs", name: "OBS Studio", open: true, why: "GPL. Every streamer uses it." },
  { id: "vlc", name: "VLC", open: true, why: "GPL/LGPL. Plays literally anything." },
  { id: "firefox", name: "Firefox", open: true, why: "MPL. Mozilla's browser." },
  {
    id: "chromium",
    name: "Chromium",
    open: true,
    why: "BSD. The open core Chrome is built on.",
    tricky: true,
  },
  {
    id: "libreoffice",
    name: "LibreOffice",
    open: true,
    why: "MPL. The office suite that isn't Office.",
  },
  { id: "godot", name: "Godot", open: true, why: "MIT. Game engine, no royalties." },
  {
    id: "signal",
    name: "Signal",
    open: true,
    why: "AGPL/GPL. Client and server both.",
    tricky: true,
  },
  { id: "postgres", name: "PostgreSQL", open: true, why: "PostgreSQL Licence. The elephant." },
  { id: "linux", name: "Linux kernel", open: true, why: "GPLv2. Obviously." },
  { id: "git", name: "Git", open: true, why: "GPL. Written to manage the kernel." },
  { id: "python", name: "Python", open: true, why: "PSF Licence." },
  { id: "nodejs", name: "Node.js", open: true, why: "MIT." },
  { id: "react", name: "React", open: true, why: "MIT. Since 2017." },
  { id: "kubernetes", name: "Kubernetes", open: true, why: "Apache 2.0. CNCF." },
  { id: "ansible", name: "Ansible", open: true, why: "GPL." },
  { id: "jenkins", name: "Jenkins", open: true, why: "MIT. The build server that never dies." },
  { id: "nextcloud", name: "Nextcloud", open: true, why: "AGPL. Self-hosted Dropbox." },
  { id: "thunderbird", name: "Thunderbird", open: true, why: "MPL. Email, still alive." },
  { id: "kdenlive", name: "Kdenlive", open: true, why: "GPL. Video editor." },
  { id: "handbrake", name: "HandBrake", open: true, why: "GPL. Video transcoder." },
  { id: "sevenzip", name: "7-Zip", open: true, why: "LGPL. The one that opens everything." },
  { id: "notepadpp", name: "Notepad++", open: true, why: "GPL." },
  { id: "wireshark", name: "Wireshark", open: true, why: "GPL. Packet sniffing." },
  { id: "neovim", name: "Neovim", open: true, why: "Apache 2.0." },
  {
    id: "vscodium",
    name: "VSCodium",
    open: true,
    why: "MIT. VS Code without the Microsoft build.",
    tricky: true,
  },
  {
    id: "dockerengine",
    name: "Docker Engine",
    open: true,
    why: "Apache 2.0. The engine is open.",
    tricky: true,
  },
  { id: "nginx", name: "nginx", open: true, why: "BSD." },
  { id: "mastodon", name: "Mastodon", open: true, why: "AGPL." },
  { id: "jitsi", name: "Jitsi Meet", open: true, why: "Apache 2.0. Video calls, self-hostable." },
  { id: "fdroid", name: "F-Droid", open: true, why: "GPL. Only ships free software." },
  { id: "keepassxc", name: "KeePassXC", open: true, why: "GPL. Offline password manager." },
  { id: "rust", name: "Rust", open: true, why: "MIT/Apache 2.0." },
  { id: "vim", name: "Vim", open: true, why: "Vim Licence, GPL-compatible. You still can't quit." },

  // --------------------------------------------------------- proprietary
  { id: "photoshop", name: "Photoshop", open: false, why: "Adobe. Rented, not owned." },
  { id: "figma", name: "Figma", open: false, why: "Proprietary and cloud-locked." },
  {
    id: "notion",
    name: "Notion",
    open: false,
    why: "Proprietary. Your notes live on their server.",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    open: false,
    why: "Free as in beer. Not as in freedom.",
    tricky: true,
  },
  { id: "slack", name: "Slack", open: false, why: "Salesforce. Very proprietary." },
  {
    id: "discord",
    name: "Discord",
    open: false,
    why: "Proprietary, despite what the API docs suggest.",
    tricky: true,
  },
  { id: "zoom", name: "Zoom", open: false, why: "Proprietary." },
  {
    id: "spotify",
    name: "Spotify",
    open: false,
    why: "Proprietary. Built on open source, gives none back.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    open: false,
    why: "Meta. Closed client, closed server.",
    tricky: true,
  },
  {
    id: "chrome",
    name: "Google Chrome",
    open: false,
    why: "Chromium plus proprietary Google bits.",
    tricky: true,
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    open: false,
    why: "Microsoft's build ships under a proprietary licence.",
    tricky: true,
  },
  { id: "windows", name: "Windows", open: false, why: "Microsoft. Come on." },
  {
    id: "macos",
    name: "macOS",
    open: false,
    why: "Apple. Darwin is open; macOS is not.",
    tricky: true,
  },
  { id: "sketch", name: "Sketch", open: false, why: "Proprietary, Mac only." },
  { id: "miro", name: "Miro", open: false, why: "Proprietary whiteboard." },
  {
    id: "postman",
    name: "Postman",
    open: false,
    why: "Proprietary, and it wants you logged in.",
    tricky: true,
  },
  {
    id: "sublime",
    name: "Sublime Text",
    open: false,
    why: "Proprietary. That dialog never stops.",
  },
  {
    id: "dockerdesktop",
    name: "Docker Desktop",
    open: false,
    why: "Proprietary wrapper around the open engine.",
    tricky: true,
  },
  { id: "unity", name: "Unity", open: false, why: "Proprietary. You remember why." },
  { id: "canva", name: "Canva", open: false, why: "Proprietary." },
  { id: "onepassword", name: "1Password", open: false, why: "Proprietary." },
  { id: "raycast", name: "Raycast", open: false, why: "Proprietary launcher." },
  { id: "illustrator", name: "Illustrator", open: false, why: "Adobe again." },
  { id: "premiere", name: "Premiere Pro", open: false, why: "Adobe, still." },
  { id: "msoffice", name: "Microsoft Office", open: false, why: "Proprietary." },
  { id: "gdocs", name: "Google Docs", open: false, why: "Proprietary and cloud-only." },
  { id: "dropbox", name: "Dropbox", open: false, why: "Proprietary." },
  { id: "trello", name: "Trello", open: false, why: "Atlassian. Proprietary." },
  { id: "jira", name: "Jira", open: false, why: "Atlassian. Proprietary, and you know it." },
  { id: "teams", name: "Microsoft Teams", open: false, why: "Proprietary." },
  { id: "tiktok", name: "TikTok", open: false, why: "Proprietary. Extremely." },
  { id: "arc", name: "Arc", open: false, why: "Proprietary browser on a Chromium base." },
  {
    id: "safari",
    name: "Safari",
    open: false,
    why: "Apple. WebKit is open, Safari isn't.",
    tricky: true,
  },
  { id: "finalcut", name: "Final Cut Pro", open: false, why: "Apple. Proprietary." },
  { id: "tableau", name: "Tableau", open: false, why: "Salesforce. Proprietary." },
];
