"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Result = Record<string, unknown>;

export default function ResponseWorkbenchPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"finding" | "closure">("finding");
  const [input, setInput] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/audit-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, input, context }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare the response.");
      setResult(data.result as Result);
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : "Could not prepare the response."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!result) return;
    setSaving(true); setError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/auth"); return; }
    const title = String(result.title || (mode === "finding" ? "Finding response" : "Closure pack"));
    const table = mode === "finding" ? "finding_responses" : "closure_packs";
    const payload: Record<string, unknown> = mode === "finding" ? { user_id: userData.user.id, title, correction: String(result.correction || ""), root_cause: String(result.rootCause || ""), why_analysis: JSON.stringify(result.fiveWhy || []), fishbone_notes: JSON.stringify(result.fishbonePrompts || {}), corrective_action: String(result.correctiveAction || ""), evidence_list: JSON.stringify(result.evidenceList || []), effectiveness_check: String(result.effectivenessCheck || ""), method: "CAPA", status: "Draft" } : { user_id: userData.user.id, title, covering_letter: String(result.coveringLetter || ""), finding_summary: String(result.findingSummary || ""), evidence_index: JSON.stringify(result.evidenceIndex || []), status: "Draft" };
    const { error: insertError } = await supabase.from(table).insert(payload);
    if (insertError) setError(insertError.message); else setMessage("Saved to your account. Review the facts and add real evidence before submitting it.");
    setSaving(false);
  }

  return <main className="min-h-screen bg-[#f1f3f6] px-4 py-6 text-[#2b1635] sm:px-8 sm:py-10"><section className="mx-auto max-w-6xl"><header className="mb-8 flex flex-wrap items-center justify-between gap-4"><button onClick={() => router.push("/audit-tools")} className="flex items-center gap-3 text-left"><span className="rounded-full border border-[#d1d4de] bg-white px-3 py-2 text-lg font-bold">←</span><span><span className="block text-[17px] font-bold">Audit Copilot</span><span className="block text-[11px] uppercase tracking-[0.15em] text-[#817687]">Response workbench</span></span></button><button onClick={() => router.push("/audit-reports")} className="rounded-xl border border-[#d1d4de] bg-white px-4 py-2.5 text-sm font-bold text-[#4b3656]">Saved reports</button></header><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#817687]">Turn an audit issue into controlled action</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Finding response and closure pack</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6876]">Prepare a professional draft, then verify it against your actual records, owners, dates, and effectiveness evidence.</p></div><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm sm:p-7"><div className="flex gap-2"><button onClick={() => { setMode("finding"); setResult(null); }} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${mode === "finding" ? "bg-[#392047] text-white" : "border border-[#d9dbe4] text-[#4b3656]"}`}>Finding response</button><button onClick={() => { setMode("closure"); setResult(null); }} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${mode === "closure" ? "bg-[#392047] text-white" : "border border-[#d9dbe4] text-[#4b3656]"}`}>Closure pack</button></div><label className="mt-6 block"><span className="mb-2 block text-sm font-bold">What happened?</span><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={7} placeholder={mode === "finding" ? "Example: An internal audit found that calibration-status labels were missing from two micrometers." : "Example: Prepare a closure pack for three customer-audit findings. We have calibration records and revised training records."} className="w-full resize-y rounded-2xl border border-[#d9dbe4] px-4 py-3 text-sm outline-none focus:border-[#b77b0f]" /></label><label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Known facts and available evidence</span><textarea value={context} onChange={(event) => setContext(event.target.value)} rows={6} placeholder="List only facts you know. Mention unknown items as unknown; do not add passwords or personal data." className="w-full resize-y rounded-2xl border border-[#d9dbe4] px-4 py-3 text-sm outline-none focus:border-[#b77b0f]" /></label>{error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{message && <div className="mt-4 rounded-xl bg-[#f8edc9] px-4 py-3 text-sm text-[#7d560b]">{message}</div>}<div className="mt-5 flex gap-3"><button onClick={generate} disabled={busy || !input.trim()} className="rounded-xl bg-[#392047] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Preparing..." : "Prepare response"}</button>{result && <button onClick={save} disabled={saving} className="rounded-xl border border-[#d1b56c] bg-white px-5 py-3 text-sm font-bold text-[#4b3656] disabled:opacity-50">{saving ? "Saving..." : "Save draft"}</button>}</div>{result && <div className="mt-8 border-t border-[#e2eae3] pt-6"><h2 className="text-lg font-bold">Editable preparation draft</h2><div className="mt-4 space-y-3">{Object.entries(result).map(([key, value]) => <div key={key} className="rounded-2xl bg-[#f6f7fa] p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()}</p><pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4b3656]">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></div>)}</div></div>}</section><aside className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Important</p><h2 className="mt-1 text-xl font-bold">A response is not proof</h2><p className="mt-4 text-sm leading-6 text-[#6e6876]">A well-written corrective action does not prove that the action was implemented or effective. Add real records, dates, responsible roles, and verification results before sharing it with an auditor.</p><button onClick={() => router.push("/mock-audit")} className="mt-5 w-full rounded-xl border border-[#d1b56c] bg-white px-4 py-3 text-sm font-bold text-[#4b3656]">Practice answering an auditor</button></aside></div></section></main>;
}
