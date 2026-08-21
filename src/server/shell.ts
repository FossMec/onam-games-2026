"use server";

import { getCurrentUser } from "~/server/auth/service";
import { banMessage, describeBan } from "~/server/auth/bans";
import { readSetting } from "~/server/settings/service";
import { readOrDegrade } from "~/server/degrade";
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

export async function getShellData(): Promise<ShellData> {
  /*
   * One session read feeds all four answers. `getCurrentUser` is memoised on
   * the request, so the reads below that also call it cost nothing extra.
   */
  const [user, closedBeta, mec27, mec28, mec29, mec30, generalWa] = await Promise.all([
    readOrDegrade("shell.me", null, getCurrentUser),
    readOrDegrade("shell.closedBeta", true, () => readSetting<boolean>("access.closed_beta", true)),
    readOrDegrade("shell.mec27", "", () =>
      readSetting<string>("social.whatsapp_group_mec_2027", ""),
    ),
    readOrDegrade("shell.mec28", "", () =>
      readSetting<string>("social.whatsapp_group_mec_2028", ""),
    ),
    readOrDegrade("shell.mec29", "", () =>
      readSetting<string>("social.whatsapp_group_mec_2029", ""),
    ),
    readOrDegrade("shell.mec30", "", () =>
      readSetting<string>("social.whatsapp_group_mec_2030", ""),
    ),
    readOrDegrade("shell.generalWa", "", () =>
      readSetting<string>("social.whatsapp_group_link", ""),
    ),
  ]);

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
