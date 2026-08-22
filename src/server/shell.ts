"use server";

import { getCurrentUser } from "~/server/auth/service";
import { banMessage, describeBan } from "~/server/auth/bans";
import { getSettings } from "~/server/settings/service";
import { sharedRead } from "~/server/cache";
import type { AccessState, BanNoticeState } from "~/server/auth/actions";

/**
 * Everything the app shell needs, in one round trip.
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

interface ShellBase {
  closedBeta: boolean;
  communityLinks: CommunityLinks;
}

async function loadShellBase(): Promise<ShellBase> {
  const settings = await getSettings(SHELL_SETTING_KEYS).catch(() => new Map<string, unknown>());
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

  return {
    closedBeta,
    communityLinks: {
      mec2027: mec27,
      mec2028: mec28,
      mec2029: mec29,
      mec2030: mec30,
      general: generalWa,
    },
  };
}

export async function getShellData(): Promise<ShellData> {
  const [user, base] = await Promise.all([
    getCurrentUser().catch(() => null),
    sharedRead("shell:base", loadShellBase, 15_000),
  ]);

  if (!user) {
    return {
      me: null,
      access: {
        closedBeta: base.closedBeta,
        allowed: !base.closedBeta,
        signedIn: false,
      },
      ban: null,
      communityLinks: base.communityLinks,
    };
  }

  const privileged = user.role === "tester" || user.role === "admin";
  const access: AccessState = {
    closedBeta: base.closedBeta,
    allowed: !base.closedBeta || privileged,
    signedIn: true,
  };

  const ban = (() => {
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

  return { me: user, access, ban, communityLinks: base.communityLinks };
}
