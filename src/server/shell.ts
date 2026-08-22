import { getCurrentUser } from "~/server/auth/service";
import { banMessage, describeBan } from "~/server/auth/bans";
import { getSettings } from "~/server/settings/service";
import type { AccessState, BanNoticeState } from "~/server/auth/actions";

/**
 * Everything the app shell needs, in one round trip.
 *
 * `Nav`, `BanNotice`, `ShortlistNotice` and `BetaGate` are mounted on every
 * route and each used to fetch for itself, so a single client-side navigation
 * cost four separate `POST /_server` calls before the page's own data was even
 * requested. They are all derived from the same session read, so asking four
 * times was four times the latency for no extra information.
 *
 * Composed here rather than in the browser so the answer arrives as one
 * payload. The pieces still degrade independently - a shell that cannot read
 * the ban table must still render the header.
 */
export interface CommunityLinks {
  mec2027: string;
  mec2028: string;
  mec2029: string;
  mec2030: string;
  general: string;
}

export interface ShellData {
  me: Awaited<ReturnType<typeof getCurrentUser>>;
  access: AccessState;
  ban: BanNoticeState | null;
  communityLinks: CommunityLinks;
}

const SHELL_SETTING_KEYS = [
  "access.closed_beta",
  "social.whatsapp_group_mec_2027",
  "social.whatsapp_group_mec_2028",
  "social.whatsapp_group_mec_2029",
  "social.whatsapp_group_mec_2030",
  "social.whatsapp_group_link",
];

export async function getShellData(): Promise<ShellData> {
  const [user, settings] = await Promise.all([
    getCurrentUser().catch(() => null),
    getSettings(SHELL_SETTING_KEYS).catch(() => new Map<string, unknown>()),
  ]);

  const closedBeta = settings.get("access.closed_beta") !== false;
  const mec27 =
    typeof settings.get("social.whatsapp_group_mec_2027") === "string"
      ? (settings.get("social.whatsapp_group_mec_2027") as string)
      : "";
  const mec28 =
    typeof settings.get("social.whatsapp_group_mec_2028") === "string"
      ? (settings.get("social.whatsapp_group_mec_2028") as string)
      : "";
  const mec29 =
    typeof settings.get("social.whatsapp_group_mec_2029") === "string"
      ? (settings.get("social.whatsapp_group_mec_2029") as string)
      : "";
  const mec30 =
    typeof settings.get("social.whatsapp_group_mec_2030") === "string"
      ? (settings.get("social.whatsapp_group_mec_2030") as string)
      : "";
  const generalWa =
    typeof settings.get("social.whatsapp_group_link") === "string"
      ? (settings.get("social.whatsapp_group_link") as string)
      : "";

  const privileged = user?.role === "tester" || user?.role === "admin";
  const access: AccessState = {
    closedBeta,
    allowed: !closedBeta || privileged,
    signedIn: !!user,
  };

  const ban = (() => {
    if (!user) return null;
    const state = describeBan(user);
    if (state.level === 0) return null;
    return {
      level: state.level,
      needsAck: state.needsAck,
      blocksPlay: state.blocksPlay,
      until: state.until?.toISOString() ?? null,
      message: banMessage(state),
    };
  })();

  const communityLinks: CommunityLinks = {
    mec2027: mec27,
    mec2028: mec28,
    mec2029: mec29,
    mec2030: mec30,
    general: generalWa,
  };

  return { me: user, access, ban, communityLinks };
}
