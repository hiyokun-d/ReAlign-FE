"use client"

// Browser client. The session lives in cookies so server components see the same user.

import { createBrowserClient } from "@supabase/ssr"
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env"

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowser() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
  return client
}

/**
 * Prototype auth: an anonymous user per browser, so RLS works without a login screen.
 * Needs Authentication → Sign In / Providers → "Allow anonymous sign-ins" in Supabase.
 * Swap for real sign-in later; anonymous users can be upgraded with linkIdentity/updateUser.
 */
export async function ensureUser() {
  const supabase = getSupabaseBrowser()
  const { data } = await supabase.auth.getUser()
  if (data.user) return data.user
  const { data: signedIn, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signedIn.user!
}
