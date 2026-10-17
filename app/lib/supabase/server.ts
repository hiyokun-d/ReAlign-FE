// Server client for server components and route handlers. Reads the user from cookies.

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env"

export async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        // Server components can't set cookies; proxy.ts refreshes the session instead.
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {}
      },
    },
  })
}
