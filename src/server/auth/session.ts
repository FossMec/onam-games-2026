import { useSession } from "@solidjs/start/http";
import { getServerEnv } from "~/server/env";
import { requestMemo } from "~/server/cache";

const SESSION_NAME = "og_session";

export interface AuthCookieData {
  sid?: string;
  deviceId?: string;
}

function getSecret(): string {
  const secret = getServerEnv("SESSION_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return secret;
}

async function getSessionManager() {
  return useSession<AuthCookieData>({
    name: SESSION_NAME,
    password: getSecret(),
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  });
}

export async function readAuthCookie(): Promise<AuthCookieData | null> {
  return requestMemo("auth:cookie", async () => {
    try {
      const session = await getSessionManager();
      return session.data.sid ? session.data : null;
    } catch {
      return null;
    }
  });
}

export async function writeAuthCookie(data: AuthCookieData): Promise<void> {
  const session = await getSessionManager();
  await session.update(data);
}

export async function clearAuthCookie(): Promise<void> {
  const session = await getSessionManager();
  await session.clear();
}
