import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://wqqexlsrxnlbhirzbbnh.supabase.co";
const fallbackKey = "sb_publishable_gWrnpDV4vdLgQlKonfItQw_AoHIqs5q";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || fallbackKey;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
