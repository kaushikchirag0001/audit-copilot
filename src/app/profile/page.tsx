"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("Quality manager");
  const [language, setLanguage] = useState("English");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.replace("/auth");
        return;
      }

      setEmail(authData.user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, company_name, role, language")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profile) {
        setFullName(profile.full_name || "");
        setCompanyName(profile.company_name || "");
        setRole(profile.role || "Quality manager");
        setLanguage(profile.language || "English");
      }

      setLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      router.replace("/auth");
      return;
    }

    const { error: saveError } = await supabase
      .from("profiles")
      .upsert({
        id: authData.user.id,
        full_name: fullName || null,
        company_name: companyName || null,
        role,
        language: "English",
        updated_at: new Date().toISOString(),
      });

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage("Profile saved. New drafts can use these company details.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] text-sm text-[#71877c]">
        Loading profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#173b35] sm:px-8 sm:py-12">
      <section className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f6255] text-lg font-bold text-white">
              A
            </div>
            <div className="text-left">
              <div className="text-[17px] font-bold">Audit Copilot</div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#769087]">
                Company profile
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push("/history")}
            className="rounded-full border border-[#cfddd3] bg-white px-4 py-2 text-sm font-semibold text-[#315e53]"
          >
            Document history
          </button>
        </div>

        <div className="rounded-3xl border border-[#dfe7df] bg-white p-6 shadow-[0_12px_35px_rgba(34,72,59,0.06)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#87a096]">
            Reused in future drafts
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">
            Your company profile
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#71877c]">
            Save stable information here so the AI can produce more specific drafts without asking for it every time.
          </p>

          <form onSubmit={saveProfile} className="mt-7 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold">Account email</label>
              <div className="rounded-xl border border-[#e2eae3] bg-[#f7faf7] px-3 py-3 text-sm text-[#71877c]">
                {email}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="fullName">
                Your name or job title
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Example: Priya Sharma, Quality Manager"
                className="w-full rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="companyName">
                Company name
              </label>
              <input
                id="companyName"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Example: ABC Precision Components"
                className="w-full rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="role">
                Primary role
              </label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="w-full rounded-xl border border-[#d6e2d8] bg-white px-3 py-3 text-sm outline-none"
              >
                <option>Quality manager</option>
                <option>Production manager</option>
                <option>Internal auditor</option>
                <option>Consultant</option>
                <option>Other</option>
              </select>
            </div>

            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {message && <div className="rounded-xl bg-[#e8f5eb] px-4 py-3 text-sm text-[#287052]">{message}</div>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#1f6255] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#174d43] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save company profile"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
