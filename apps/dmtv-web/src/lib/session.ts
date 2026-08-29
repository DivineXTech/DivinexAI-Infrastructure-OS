import "server-only";
import { cookies } from "next/headers";

const CREATOR_COOKIE = "dmtv_creator_session";
const FAN_COOKIE = "dmtv_fan_session";

/**
 * Stands in for a real Supabase Auth session in this vertical slice: no
 * live Supabase project is wired up here, so identity is carried in a
 * plain JSON cookie instead of a verified JWT. Swapping in
 * `supabase.auth.getUser()` for these two functions is the only change
 * needed to move to real auth -- every RLS policy and service-layer call
 * downstream already keys off the same `userId`/`organizationId` shape.
 */
export interface CreatorSession {
  userId: string;
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  creatorId: string;
  handle: string;
  displayName: string;
}

export interface FanSession {
  fanUserId: string;
  displayName: string;
}

export async function getCreatorSession(): Promise<CreatorSession | null> {
  const store = await cookies();
  const raw = store.get(CREATOR_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CreatorSession;
  } catch {
    return null;
  }
}

export async function setCreatorSession(session: CreatorSession): Promise<void> {
  const store = await cookies();
  store.set(CREATOR_COOKIE, JSON.stringify(session), { httpOnly: true, path: "/", sameSite: "lax" });
}

export async function getFanSession(): Promise<FanSession | null> {
  const store = await cookies();
  const raw = store.get(FAN_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FanSession;
  } catch {
    return null;
  }
}

export async function setFanSession(session: FanSession): Promise<void> {
  const store = await cookies();
  store.set(FAN_COOKIE, JSON.stringify(session), { httpOnly: true, path: "/", sameSite: "lax" });
}
