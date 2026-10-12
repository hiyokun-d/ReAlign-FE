// Supabase is optional while prototyping: without these, lib/data.ts serves mock data.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""

export const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("your-project-ref") && SUPABASE_KEY.length > 0
