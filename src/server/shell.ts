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
export interface ShellData {
  me: Awaited<ReturnType<typeof getCurrentUser>>;
  access: AccessState;
  ban: BanNoticeState | null;
}

export async function getShellData(): Promise<ShellData> {
  /*
   * One session read feeds all four answers. `getCurrentUser` is memoised on
   * the request, so the reads below that also call it cost nothing extra.
   */
  const [user, closedBeta] = await Promise.all([
    readOrDegrade("shell.me", null, getCurrentUser),
    readOrDegrade("shell.closedBeta", true, () => readSetting<boolean>("access.closed_beta", true)),
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

  /*
   * The shortlist popup is deliberately *not* here. It is shown once per
   * browser and then dismissed into localStorage, which the server cannot
   * see - so folding it into the shell would keep reading that row on every
   * page for every entrant who dismissed it weeks ago. `ShortlistNotice` asks
   * for it only after it has checked that it has something to show.
   */
  return { me: user, access, ban };
}
