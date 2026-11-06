import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ROLES, canAccess, type Role, type SectionKey } from "./roles";
import { FORBIDDEN_PATH, INACTIVE_PATH, LOGIN_PATH } from "./redirect";

const profileSchema = z.object({
  id: z.uuid(),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(ROLES),
  is_active: z.boolean(),
});

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
};

export const PROFILE_COLUMNS = "id, full_name, email, role, is_active";

export function toProfile(row: unknown): Profile {
  const p = profileSchema.parse(row);
  return {
    id: p.id,
    fullName: p.full_name || p.email || "Utilisateur",
    email: p.email ?? "",
    role: p.role,
    isActive: p.is_active,
  };
}

/**
 * Current user's profile, or null when signed out / no profile.
 * Deduplicated per request with React cache().
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // getClaims() verifies the JWT; never trust getSession() on the server.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  return data ? toProfile(data) : null;
});

/** Signed-in AND active user, otherwise redirects. */
export async function requireActiveProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    // Signed in without a profile is treated like an inactive account.
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    redirect(data?.claims?.sub ? INACTIVE_PATH : LOGIN_PATH);
  }
  if (!profile.isActive) redirect(INACTIVE_PATH);
  return profile;
}

/** Active user allowed to access the given section, otherwise redirects. */
export async function requireSection(section: SectionKey): Promise<Profile> {
  const profile = await requireActiveProfile();
  if (!canAccess(profile.role, section)) redirect(FORBIDDEN_PATH);
  return profile;
}

/** Active user with one of the given roles, otherwise redirects. */
export async function requireRole(roles: readonly Role[]): Promise<Profile> {
  const profile = await requireActiveProfile();
  if (!roles.includes(profile.role)) redirect(FORBIDDEN_PATH);
  return profile;
}
