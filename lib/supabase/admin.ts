import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "./env";

/**
 * Service-role client: BYPASSES Row Level Security.
 * Only used for Supabase Auth admin operations (creating and banning users),
 * and only after the caller has been verified as an active owner.
 * Never import this from a Client Component ("server-only" enforces it).
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  const { url } = supabasePublicEnv();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
