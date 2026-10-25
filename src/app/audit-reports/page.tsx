"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downloadExcel, downloadPdf, downloadWord } from "@/lib/export-document";

type GapItem = { reference?: string; requirement?: string; classification?: string; evidenceFound?: string; evidenceMissing?: string; reason?: string; suggestedFix?: string; priority?: string; owner?: string; dueDate?: string };
type RecordItem = { id: string; title?: string; name?: string; status?: string; created_at?: string; summary?: string; readiness_score?: number; method?: string; project_id?: string | null; storage_path?: string; items?: GapItem[] };

export default function AuditReportsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<RecordItem[]>([]);
  const [files, setFiles] = useState<RecordItem[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/auth"); return; }
      const [gaps, findings, closures, checklists, uploaded] = await Promise.all([
        supabase.from("gap_reports").select("id, title, status, created_at, summary, readiness_score, project_id, items").order("created_at", { ascending: false }),
        supabase.from("finding_responses").select("id, title, status, created_at, method, project_id").order("created_at", { ascending: false }),
        supabase.from("closure_packs").select("id, title, status, created_at, project_id").order("created_at", { ascending: false }),
        supabase.from("audit_checklists").select("id, title, status, created_at, checklist_type, project_id").order("created_at", { ascending: false }),
        supabase.from("uploaded_files").select("id, file_name, storage_path, status, created_at, project_id").order("created_at", { ascending: false }),
      ]);
      const firstError = gaps.error || findings.error || closures.error || checklists.error || uploaded.error;
      if (firstError) setError(firstError.message);
      const parseItems = (value: unknown): GapItem[] => { if (Array.isArray(value)) return value as GapItem[]; if (typeof value === "string") { try { return JSON.parse(value) as GapItem[]; } catch { return []; } } return []; };
      setItems([
        ...(gaps.data || []).map((item) => ({ ...item, name: "Gap report", items: parseItems(item.items) })),
        ...(findings.data || []).map((item) => ({ ...item, name: "Finding response" })),
        ...(closures.data || []).map((item) => ({ ...item, name: "Closure pack" })),
        ...(checklists.data || []).map((item) => ({ ...item, name: "Checklist" })),
      ] as RecordItem[]);
      setFiles((uploaded.data || []).map((item) => ({ ...item, title: item.file_name })) as RecordItem[]);
      setLoading(false);
    }
    load();
  }, [router]);

  const gaps = useMemo(() => items.filter((item) => item.name === "Gap report"), [items]);
  const visibleItems = filter === "All" ? items : items.filter((item) => item.name === filter);

  async function fixGap(report: RecordItem, gap: GapItem) {
    if (!report.project_id) { setError("Select a project when creating a gap report before using Fix this."); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/auth"); return; }
    const severity = gap.priority === "Critical" ? "Critical" : gap.priority === "High" ? "High" : gap.priority === "Low" ? "Low" : "Medium";
    const { data: finding, error: findingError } = await supabase.from("audit_findings").insert({ user_id: userData.user.id, project_id: report.project_id, title: `${gap.reference || "Gap"}: ${gap.requirement || "Missing requirement"}`, description: `${gap.reason || "Gap identified by the report."}\nEvidence missing: ${gap.evidenceMissing || "[COMPANY INPUT REQUIRED]"}`, severity, status: "Open", source: "Gap report" }).select("id").single();
    if (findingError || !finding) { setError(findingError?.message || "Could not create finding."); return; }
    const { error: actionError } = await supabase.from("corrective_actions").insert({ user_id: userData.user.id, project_id: report.project_id, finding_id: finding.id, action: gap.suggestedFix || "Define and implement a corrective action, then collect objective evidence.", status: "Open" });
    if (actionError) setError(actionError.message); else setError("Gap converted into an open finding and corrective action in the project.");
  }

  async function downloadFile(file: RecordItem) {
    if (!file.storage_path) return;
    const { data, error: signedError } = await supabase.storage.from("audit-files").createSignedUrl(file.storage_path, 300);
    if (signedError || !data?.signedUrl) setError(signedError?.message || "Could not create a download link."); else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function deleteFile(file: RecordItem) {
    if (!window.confirm(`Delete ${file.title || "this file"}? This cannot be undone.`)) return;
    if (file.storage_path) await supabase.storage.from("audit-files").remove([file.storage_path]);
    const { error: deleteError } = await supabase.from("uploaded_files").delete().eq("id", file.id);
    if (deleteError) setError(deleteError.message); else setFiles((current) => current.filter((item) => item.id !== file.id));
  }
  function exportRecord(item: RecordItem, format: "word" | "pdf" | "excel") {
    const content = `${item.name}\n\n${item.title}\n\n${item.summary || ""}\n\n${JSON.stringify(item.items || [], null, 2)}`;
    if (format === "word") void downloadWord(item.title || "audit-report", content);
    if (format === "pdf") downloadPdf(item.title || "audit-report", content);
    if (format === "excel") downloadExcel(item.title || "audit-report", content);
  }

  return <main className="min-h-screen bg-[#f1f3f6] px-4 py-6 text-[#2b1635] sm:px-8 sm:py-10"><section className="mx-auto max-w-7xl"><header className="mb-8 flex flex-wrap items-center justify-between gap-4"><button onClick={() => router.push("/")} className="flex items-center gap-3 text-left"><span className="rounded-full border border-[#d1d4de] bg-white px-3 py-2 text-lg font-bold">←</span><span><span className="block text-[17px] font-bold">Audit Copilot</span><span className="block text-[11px] uppercase tracking-[0.15em] text-[#817687]">Saved audit work</span></span></button><button onClick={() => router.push("/audit-tools")} className="rounded-xl bg-[#392047] px-4 py-2.5 text-sm font-bold text-white">Open audit tools</button></header><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#817687]">Your saved preparation records</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Audit reports and files</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6876]">Filter, export, and convert report gaps into project findings and corrective actions.</p></div>{error && <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{loading ? <div className="rounded-3xl border border-[#d8dbe3] bg-white p-8 text-center text-sm text-[#6e6876]">Loading saved audit work...</div> : <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Reports</p><h2 className="mt-1 text-xl font-bold">Generated preparation records</h2></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-[#d9dbe4] bg-white px-3 py-2 text-sm"><option>All</option><option>Gap report</option><option>Finding response</option><option>Closure pack</option><option>Checklist</option></select></div><div className="mt-5 space-y-4">{visibleItems.map((item) => <article key={`${item.name}-${item.id}`} className="rounded-2xl border border-[#e2eae3] bg-[#f9fcf9] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#817687]">{item.name}</p><h3 className="mt-1 font-bold text-[#4b3656]">{item.title || "Untitled record"}</h3></div><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#966712]">{item.status || "Saved"}</span></div>{item.summary && <p className="mt-3 text-sm leading-6 text-[#6e6876]">{item.summary}</p>}{typeof item.readiness_score === "number" && <p className="mt-3 text-sm font-bold text-[#76500a]">Internal readiness indicator: {item.readiness_score}%</p>}<p className="mt-3 text-xs text-[#a29ba8]">{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => exportRecord(item, "word")} className="rounded-lg border border-[#d1b56c] bg-white px-3 py-2 text-xs font-bold text-[#4b3656]">Word</button><button onClick={() => exportRecord(item, "pdf")} className="rounded-lg border border-[#d1b56c] bg-white px-3 py-2 text-xs font-bold text-[#4b3656]">PDF</button><button onClick={() => exportRecord(item, "excel")} className="rounded-lg border border-[#d1b56c] bg-white px-3 py-2 text-xs font-bold text-[#4b3656]">Excel</button></div>{item.name === "Gap report" && item.items && item.items.length > 0 && <div className="mt-4 space-y-3 border-t border-[#e2eae3] pt-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Clause-by-clause gaps</p>{item.items.map((gap, index) => <div key={index} className="rounded-xl border border-[#d8dbe3] bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[11px] font-bold text-[#817687]">{gap.reference || "Requirement"}</p><p className="mt-1 text-sm font-bold text-[#4b3656]">{gap.requirement || "Requirement not named"}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${gap.classification === "Missing" ? "bg-red-50 text-red-700" : gap.classification === "Partially covered" ? "bg-amber-50 text-amber-700" : "bg-[#f2eef6] text-[#966712]"}`}>{gap.classification || "Review"}</span></div><p className="mt-2 text-xs leading-5 text-[#6e6876]">{gap.reason || gap.evidenceMissing || "Review company evidence."}</p>{gap.classification !== "Covered" && gap.classification !== "Not applicable" && <button onClick={() => fixGap(item, gap)} className="mt-3 rounded-lg bg-[#392047] px-3 py-2 text-xs font-bold text-white">Fix this → finding + action</button>}</div>)}</div>}</article>)}{visibleItems.length === 0 && <Empty text="No matching generated records yet." />}</div></section><section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Private source material</p><h2 className="mt-1 text-xl font-bold">Uploaded files</h2><div className="mt-5 space-y-3">{files.map((file) => <article key={file.id} className="rounded-2xl bg-[#f6f7fa] p-3"><p className="text-sm font-bold text-[#4b3656]">{file.title}</p><p className="mt-1 text-xs text-[#6e6876]">{file.status || "Reference"}</p><p className="mt-1 text-[11px] text-[#a29ba8]">{file.created_at ? new Date(file.created_at).toLocaleString() : ""}</p><div className="mt-3 flex gap-2"><button onClick={() => downloadFile(file)} className="rounded-lg border border-[#d1b56c] bg-white px-3 py-2 text-xs font-bold text-[#4b3656]">Download</button><button onClick={() => deleteFile(file)} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600">Delete</button></div></article>)}{files.length === 0 && <Empty text="No uploaded files yet." />}</div></section></div>}</section></main>;
}
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#d7d6df] px-4 py-8 text-center text-sm leading-6 text-[#928a99]">{text}</div>; }
