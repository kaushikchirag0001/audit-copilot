import { createBrowserClient } from "@supabase/ssr";

function cleanHeaderValue(value: string | undefined) {
  return (value || "").trim().replace(/[^\x00-\xFF]/g, "");
}

export function createClient() {
  const url = cleanHeaderValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanHeaderValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return createBrowserClient(url, key);
}
