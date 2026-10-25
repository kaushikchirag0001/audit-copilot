"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const getSupabase = () => createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function deleteAccount() {
    if (!window.confirm("Delete your account and all linked audit data? This cannot be undone.")) return;
    setBusy(true); setError("");
    const supabase = getSupabase();
    const { error: deleteError } = await supabase.rpc("delete_my_account");
    if (deleteError) { setError(deleteError.message); setBusy(false); return; }
    await supabase.auth.signOut();
    router.replace("/auth");
  }
  return <main className="min-h-screen bg-[#f1f3f6] px-5 py-8 text-[#2b1635] sm:px-8 sm:py-12"><section className="mx-auto max-w-2xl"><button onClick={() => router.push("/")} className="mb-12 rounded-full border border-[#d1d4de] bg-white px-4 py-2 text-sm font-bold text-[#4b3656]">← Back to workspace</button><div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-red-600">Account control</p><h1 className="mt-2 text-3xl font-bold">Delete your account</h1><p className="mt-4 text-sm leading-7 text-[#6e6876]">This permanently removes your profile, documents, revisions, projects, audit records, chat messages, uploaded-file metadata, and linked storage records covered by the account policies.</p>{error && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Run the complete roadmap migration in Supabase first.</div>}<button onClick={deleteAccount} disabled={busy} className="mt-6 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Deleting..." : "Delete account permanently"}</button></div></section></main>;
}
