"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Turn = { question: string; evaluation: string; strengths: string[]; evidenceNeeded: string[]; risk: string; followUp: string; score: number; finished: boolean };
type Project = { id: string; name: string };

export default function MockAuditPage() {
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [topic, setTopic] = useState("Control of nonconforming outputs");
  const [context, setContext] = useState("");
  const [answer, setAnswer] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/auth"); return; }
      const { data } = await supabase.from("audit_projects").select("id, name").order("created_at", { ascending: false });
      setProjects((data || []) as Project[]);
    }
    load();
  }, [router]);

  async function submitAnswer(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/mock-audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, answer, context, history: turns.map((turn, index) => `Question ${index + 1}: ${turn.question}\nEvaluation: ${turn.evaluation}\nFollow-up: ${turn.followUp}`).join("\n\n") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The mock audit could not continue.");
      const nextTurn = data.result as Turn;
      setTurns((current) => [...current, nextTurn]);
      setAnswer("");
      await saveMessages(nextTurn, answer);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "The mock audit could not continue."); }
    finally { setBusy(false); }
  }

  async function saveMessages(turn: Turn, userAnswer: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const rows = [{ user_id: userData.user.id, project_id: projectId || null, role: "user", content: userAnswer || "Start mock audit: " + topic }, { user_id: userData.user.id, project_id: projectId || null, role: "assistant", content: JSON.stringify(turn) }];
    const { error: saveError } = await supabase.from("chat_messages").insert(rows);
    if (saveError) setError(saveError.message); else setSaved(true);
  }

  const latest = turns[turns.length - 1];
  const average = turns.length ? Math.round(turns.reduce((sum, turn) => sum + (turn.score || 0), 0) / turns.length) : 0;

  return <main className="min-h-screen bg-[#f1f3f6] px-4 py-6 text-[#2b1635] sm:px-8 sm:py-10"><section className="mx-auto max-w-6xl">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><button onClick={() => router.push("/audit-tools")} className="flex items-center gap-3 text-left"><span className="rounded-full border border-[#d1d4de] bg-white px-3 py-2 text-lg font-bold">←</span><span><span className="block text-[17px] font-bold">Audit Copilot</span><span className="block text-[11px] uppercase tracking-[0.15em] text-[#817687]">Mock audit practice</span></span></button><button onClick={() => router.push("/audit-reports")} className="rounded-xl border border-[#d1d4de] bg-white px-4 py-2.5 text-sm font-bold text-[#4b3656]">Saved reports</button></header>
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#817687]">Practice before the auditor arrives</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Mock audit, in simple language</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6876]">Answer as if an auditor is speaking with you. Audit Copilot will explain what was strong, what evidence is missing, and what question may come next.</p></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]"><section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm sm:p-7"><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Audit topic</span><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Example: calibration control" className="w-full rounded-xl border border-[#d9dbe4] px-3 py-3 text-sm outline-none focus:border-[#b77b0f]" /></label><label><span className="mb-2 block text-sm font-bold">Save session to project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-xl border border-[#d9dbe4] bg-white px-3 py-3 text-sm"><option value="">No project selected</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div><label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Company context</span><textarea value={context} onChange={(event) => setContext(event.target.value)} rows={4} placeholder="Describe only facts you know: process, roles, records, and current problems." className="w-full rounded-2xl border border-[#d9dbe4] px-4 py-3 text-sm outline-none focus:border-[#b77b0f]" /></label><div className="mt-6 rounded-2xl bg-[#faf3dc] p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Auditor question</p><p className="mt-2 text-lg font-bold leading-8 text-[#4b3656]">{latest?.followUp || latest?.question || `Tell me how your company controls ${topic.toLowerCase()}.`}</p></div><form onSubmit={submitAnswer} className="mt-5"><label><span className="mb-2 block text-sm font-bold">Your answer</span><textarea required value={answer} onChange={(event) => setAnswer(event.target.value)} rows={7} placeholder="Answer in your own words. Mention the actual record or evidence you would show, if you have it." className="w-full resize-y rounded-2xl border border-[#d9dbe4] px-4 py-3 text-sm outline-none focus:border-[#b77b0f]" /></label><button disabled={busy || !answer.trim()} className="mt-4 rounded-xl bg-[#392047] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Evaluating..." : "Submit answer"}</button></form>{error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{saved && <div className="mt-4 rounded-xl bg-[#f8edc9] px-4 py-3 text-sm text-[#7d560b]">This turn was saved to your account{projectId ? " and project" : ""}.</div>}</section>
      <aside className="space-y-6"><section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Practice score</p><p className="mt-2 text-4xl font-bold text-[#76500a]">{average}%</p><p className="mt-2 text-xs leading-5 text-[#928a99]">This is only a practice indicator. It is not an audit result or certification decision.</p></section>{latest && <section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Latest feedback</p><span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${latest.risk === "High" ? "bg-red-50 text-red-700" : latest.risk === "Medium" ? "bg-amber-50 text-amber-700" : "bg-[#f2eef6] text-[#966712]"}`}>{latest.risk} risk</span><p className="mt-4 text-sm leading-6 text-[#4b3656]">{latest.evaluation}</p><h3 className="mt-5 text-sm font-bold">What was strong</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#6e6876]">{latest.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul><h3 className="mt-5 text-sm font-bold">Evidence to prepare</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#6e6876]">{latest.evidenceNeeded.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}</aside>
    </div>
  </section></main>;
}
