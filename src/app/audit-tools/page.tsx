"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const tools = [
  ["gap", "Gap report", "Compare a procedure or checklist with audit criteria."],
  ["readiness", "Readiness checklist", "List documents and evidence the auditor will ask for."],
  ["mock", "Mock audit", "Practice auditor questions for a process or clause."],
  ["finding", "Finding response", "Prepare correction, root cause, CAPA, and evidence."],
  ["closure", "Closure pack", "Prepare a covering letter, evidence index, and submission checklist."],
  ["checklist", "Auditor checklist", "Build an internal, customer, process, product, or regulatory checklist."],
  ["supplier", "Supplier audit kit", "Prepare a supplier checklist, evaluation, and follow-up request."],
] as const;

type ToolKey = (typeof tools)[number][0];
type Result = Record<string, unknown>;

export default function AuditToolsPage() {
  const router = useRouter();
  const getSupabase = () => createClient();
  const [tool, setTool] = useState<ToolKey>("gap");
  const [input, setInput] = useState("");
  const [context, setContext] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [savedId, setSavedId] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(() => tools.find(([key]) => key === tool), [tool]);

  useEffect(() => {
    async function load() {
      const supabase = getSupabase();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/auth"); return; }
      const { data } = await supabase.from("audit_projects").select("id, name").order("created_at", { ascending: false });
      setProjects((data || []) as { id: string; name: string }[]);
    }
    load();
  }, [router]);

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Files must be 10 MB or smaller."); return; }
    setFileBusy(true); setError("");
    try {
      const supabase = getSupabase();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/auth"); return; }
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "File extraction failed.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${userData.user.id}/${projectId || "unassigned"}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("audit-files").upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw new Error(`Secure file storage failed: ${uploadError.message}`);
      const { error: metadataError } = await supabase.from("uploaded_files").insert({ user_id: userData.user.id, project_id: projectId || null, file_name: file.name, storage_path: storagePath, file_type: file.type || null, file_size: file.size, extracted_text: data.text || "", status: "Reference" });
      if (metadataError) throw new Error(`File record could not be saved: ${metadataError.message}`);

      setFileName(data.fileName || file.name);
      setContext((current) => `${current}\n\nSOURCE FILE: ${data.fileName || file.name}\n${data.text || ""}`.trim());
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "File extraction failed.");
    } finally { setFileBusy(false); }
  }

  async function runTool() {
    setBusy(true); setError(""); setSavedId("");
    try {
      const response = await fetch("/api/audit-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: tool, input, context }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The tool could not complete.");
      setResult(data.result as Result);
    } catch (toolError) { setError(toolError instanceof Error ? toolError.message : "The tool could not complete."); }
    finally { setBusy(false); }
  }

  async function saveResult() {
    if (!result) return;
    setSaving(true); setError("");
    const supabase = getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/auth"); return; }
    const userId = userData.user.id;
    const title = String(result.title || `${selected?.[1]} — ${new Date().toLocaleDateString()}`);
    let table = "audit_checklists"; let payload: Record<string, unknown> = { user_id: userId, project_id: projectId || null, title, audit_type: tool };
    if (tool === "gap") { table = "gap_reports"; payload = { user_id: userId, project_id: projectId || null, title, summary: String(result.summary || ""), readiness_score: Number(result.readinessScore || 0), items: JSON.stringify(result.items || []), status: "Complete" }; }
    else if (tool === "readiness") { table = "readiness_items"; const items = Array.isArray(result.items) ? result.items : []; const rows = items.map((item) => ({ user_id: userId, project_id: projectId, title: String((item as Result).item || "Readiness item"), category: String((item as Result).category || "Other"), description: String((item as Result).whyItMatters || ""), status: String((item as Result).status || "Missing"), owner: String((item as Result).suggestedOwner || "") || null, due_date: String((item as Result).suggestedDueDate || "") || null })); const { error: insertError } = await supabase.from(table).insert(rows); if (insertError) setError(insertError.message); else setSavedId("readiness"); setSaving(false); return; }
    else if (tool === "finding") { table = "finding_responses"; payload = { user_id: userId, project_id: projectId || null, title, correction: String(result.correction || ""), root_cause: String(result.rootCause || ""), why_analysis: JSON.stringify(result.fiveWhy || []), fishbone_notes: JSON.stringify(result.fishbonePrompts || {}), corrective_action: String(result.correctiveAction || ""), evidence_list: JSON.stringify(result.evidenceList || []), effectiveness_check: String(result.effectivenessCheck || ""), method: "CAPA", status: "Draft" }; }
    else if (tool === "closure") { table = "closure_packs"; payload = { user_id: userId, project_id: projectId, title, covering_letter: String(result.coveringLetter || ""), finding_summary: String(result.findingSummary || ""), evidence_index: JSON.stringify(result.evidenceIndex || []), status: "Draft" }; }
    else { payload.items = JSON.parse(JSON.stringify(result)); payload.checklist_type = tool === "supplier" ? "Supplier" : "Internal"; }
    const { data, error: insertError } = await supabase.from(table).insert(payload).select("id").single();
    if (insertError) setError(insertError.message); else setSavedId(data?.id || "saved");
    setSaving(false);
  }

  return <main className="min-h-screen bg-[#f1f3f6] px-4 py-6 text-[#2b1635] sm:px-8 sm:py-10"><section className="mx-auto max-w-7xl">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><button onClick={() => router.push("/")} className="flex items-center gap-3 text-left"><span className="rounded-full border border-[#d1d4de] bg-white px-3 py-2 text-lg font-bold">←</span><span><span className="block text-[17px] font-bold">Audit Copilot</span><span className="block text-[11px] uppercase tracking-[0.15em] text-[#817687]">Audit tools</span></span></button><div className="flex gap-2"><button onClick={() => router.push("/audit-reports")} className="rounded-xl border border-[#d1d4de] bg-white px-4 py-2.5 text-sm font-bold text-[#4b3656]">Saved reports</button><button onClick={() => router.push("/projects")} className="rounded-xl border border-[#d1d4de] bg-white px-4 py-2.5 text-sm font-bold text-[#4b3656]">Audit projects</button></div></header>
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#817687]">Roadmap toolkit</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Prepare for the audit, one proof at a time</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6876]">Upload your own material, choose a tool, review the result, and save it to the related audit project. This is preparation support, not certification.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => router.push("/mock-audit")} className="rounded-xl border border-[#d1b56c] bg-white px-4 py-2.5 text-sm font-bold text-[#4b3656]">Practice with a mock auditor →</button><button onClick={() => router.push("/response-workbench")} className="rounded-xl border border-[#d1b56c] bg-white px-4 py-2.5 text-sm font-bold text-[#4b3656]">Prepare a finding response →</button></div></div>
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]"><nav className="space-y-2">{tools.map(([key, name, description]) => <button key={key} onClick={() => { setTool(key); setResult(null); setSavedId(""); setError(""); }} className={`w-full rounded-2xl border p-4 text-left transition ${tool === key ? "border-[#c18a18] bg-[#f8efcf]" : "border-[#d8dbe3] bg-white hover:border-[#d2c3a0]"}`}><span className="block text-sm font-bold">{name}</span><span className="mt-1 block text-xs leading-5 text-[#6e6876]">{description}</span></button>)}</nav>
    <section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold">{selected?.[1]}</h2><p className="mt-2 text-sm leading-6 text-[#6e6876]">{selected?.[2]}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold">Save to project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-xl border border-[#d9dbe4] bg-white px-3 py-3 text-sm"><option value="">No project selected</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-bold">Upload source document</span><input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={uploadFile} className="w-full rounded-xl border border-[#d9dbe4] bg-white px-3 py-2.5 text-sm" />{fileBusy && <span className="mt-1 block text-xs text-[#6e6876]">Reading file...</span>}{fileName && <span className="mt-1 block text-xs text-[#966712]">Loaded: {fileName}</span>}</label></div>
      <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">What do you want to prepare?</span><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={6} placeholder={placeholderFor(tool)} className="w-full resize-y rounded-2xl border border-[#d9dbe4] px-4 py-3 text-sm outline-none focus:border-[#b77b0f]" /></label>
      <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Company, project, standard, and source context</span><textarea value={context} onChange={(event) => setContext(event.target.value)} rows={7} placeholder="Paste company facts, audit scope, standard, findings, or extracted document text. Leave unknown facts blank." className="w-full resize-y rounded-2xl border border-[#d9dbe4] px-4 py-3 text-sm outline-none focus:border-[#b77b0f]" /></label>
      <div className="mt-4 rounded-2xl border border-[#e5dfcc] bg-[#faf3dc] px-4 py-3 text-xs leading-5 text-[#66506f]">The assistant uses [COMPANY INPUT REQUIRED] instead of inventing evidence. Review every result before sharing it with an auditor.</div>
      {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {savedId && <div className="mt-4 rounded-xl bg-[#f8edc9] px-4 py-3 text-sm text-[#7d560b]">Saved successfully to your account{projectId ? " and selected project" : ""}.</div>}
      <div className="mt-5 flex flex-wrap gap-3"><button onClick={runTool} disabled={busy || !input.trim() || fileBusy} className="rounded-xl bg-[#392047] px-5 py-3 text-sm font-bold text-white hover:bg-[#281430] disabled:opacity-50">{busy ? "Preparing..." : `Prepare ${selected?.[1]}`}</button>{result && <button onClick={saveResult} disabled={saving || (tool !== "readiness" && !projectId && ["closure"].includes(tool))} className="rounded-xl border border-[#d1b56c] bg-white px-5 py-3 text-sm font-bold text-[#4b3656] disabled:opacity-50">{saving ? "Saving..." : "Save result"}</button>}</div>
      {result && <ResultView result={result} />}
    </section></div>
  </section></main>;
}

function ResultView({ result }: { result: Result }) { return <div className="mt-8 border-t border-[#e2eae3] pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Prepared result</h3>{typeof result.readinessScore === "number" && <span className="rounded-full bg-[#f8efcf] px-3 py-1 text-sm font-bold text-[#966712]">Internal readiness indicator: {result.readinessScore}%</span>}</div><div className="mt-4 space-y-3">{Object.entries(result).map(([key, value]) => <div key={key} className="rounded-2xl bg-[#f6f7fa] p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()}</p><pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4b3656]">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></div>)}</div><p className="mt-4 text-xs leading-5 text-[#928a99]">Check the facts, add real evidence, assign owners and due dates, then use the saved project as your working audit record.</p></div>; }

function placeholderFor(tool: ToolKey) { const values: Record<ToolKey, string> = { gap: "Review our calibration procedure against ISO 9001:2015 and identify missing evidence.", readiness: "Create a readiness checklist for our certification audit covering production and final inspection.", mock: "Run a mock audit for control of nonconforming outputs in our CNC machining process.", finding: "Write a CAPA response for missing calibration-status labels found during an internal audit.", closure: "Prepare a closure pack for three customer-audit findings due next month.", checklist: "Build an internal process-audit checklist for incoming inspection and supplier control.", supplier: "Create a supplier audit kit for a heat-treatment supplier against our quality requirements." }; return values[tool]; }
