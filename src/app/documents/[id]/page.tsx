"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DocumentRow = { id: string; title: string; request: string; content: string; standard: string | null; status: string; updated_at: string };
type Revision = { id: string; revision_number: number; content: string; change_summary: string | null; created_at: string };

function EditorContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const supabase = createClient();
  const [document, setDocument] = useState<DocumentRow | null>(null);
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [compareId, setCompareId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/auth"); return; }
      const [documentResult, revisionResult] = await Promise.all([
        supabase.from("documents").select("id, title, request, content, standard, status, updated_at").eq("id", documentId).single(),
        supabase.from("document_revisions").select("id, revision_number, content, change_summary, created_at").eq("document_id", documentId).order("revision_number", { ascending: false }),
      ]);
      if (documentResult.error) setError(documentResult.error.message);
      if (documentResult.data) { setDocument(documentResult.data as DocumentRow); setContent(documentResult.data.content || ""); setStatus(documentResult.data.status || "Draft"); }
      if (revisionResult.error) setError(revisionResult.error.message);
      setRevisions((revisionResult.data || []) as Revision[]);
      setLoading(false);
    }
    if (documentId) load();
  }, [documentId, router]);

  async function saveRevision(nextStatus = status, restoredContent = content) {
    if (!document) return;
    setSaving(true); setError(""); setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/auth"); return; }
    const nextNumber = revisions.length ? Math.max(...revisions.map((item) => item.revision_number)) + 1 : 1;
    const { error: documentError } = await supabase.from("documents").update({ content: restoredContent, status: nextStatus, updated_at: new Date().toISOString() }).eq("id", document.id);
    if (documentError) { setError(documentError.message); setSaving(false); return; }
    const { data: revision, error: revisionError } = await supabase.from("document_revisions").insert({ document_id: document.id, user_id: userData.user.id, revision_number: nextNumber, content: restoredContent, change_summary: summary || (nextStatus === "Approved" ? "Approved after review" : "Edited document") }).select("id, revision_number, content, change_summary, created_at").single();
    if (revisionError) setError(revisionError.message);
    else { setRevisions((current) => [revision as Revision, ...current]); setDocument({ ...document, content: restoredContent, status: nextStatus, updated_at: new Date().toISOString() }); setStatus(nextStatus); setSummary(""); setMessage(`Revision ${nextNumber} saved.`); }
    setSaving(false);
  }

  function restoreRevision(revision: Revision) { setContent(revision.content); setMessage(`Revision ${revision.revision_number} loaded into the editor. Save it to create a new revision.`); }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#f1f3f6] text-sm text-[#6e6876]">Loading document editor...</main>;
  if (!document) return <main className="flex min-h-screen items-center justify-center bg-[#f1f3f6] text-sm text-red-700">{error || "Document not found."}</main>;
  const compared = revisions.find((item) => item.id === compareId);

  return <main className="min-h-screen bg-[#f1f3f6] px-4 py-6 text-[#2b1635] sm:px-8 sm:py-10"><section className="mx-auto max-w-7xl">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><button onClick={() => router.push("/history")} className="flex items-center gap-3 text-left"><span className="rounded-full border border-[#d1d4de] bg-white px-3 py-2 text-lg font-bold">←</span><span><span className="block text-[17px] font-bold">Audit Copilot</span><span className="block text-[11px] uppercase tracking-[0.15em] text-[#817687]">Document editor</span></span></button><div className="flex gap-2"><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-[#d9dbe4] bg-white px-3 py-2 text-sm font-bold"><option>Draft</option><option>Needs input</option><option>Reviewed</option><option>Approved</option><option>Archived</option></select><button onClick={() => saveRevision()} disabled={saving} className="rounded-xl bg-[#392047] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save revision"}</button></div></header>
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#817687]">{document.standard || "Standard not specified"}</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">{document.title}</h1><p className="mt-2 text-sm text-[#6e6876]">{document.request}</p></div>
    {error && <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{message && <div className="mb-5 rounded-xl bg-[#f8edc9] px-4 py-3 text-sm text-[#7d560b]">{message}</div>}
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]"><section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Edit document</h2><span className="rounded-full bg-[#f2eef6] px-3 py-1 text-xs font-bold text-[#966712]">{status}</span></div><textarea value={content} onChange={(event) => setContent(event.target.value)} className="mt-5 min-h-[680px] w-full resize-y rounded-2xl border border-[#d9dbe4] p-5 font-mono text-sm leading-6 outline-none focus:border-[#b77b0f]" /><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What changed in this revision?" className="min-w-0 flex-1 rounded-xl border border-[#d9dbe4] px-3 py-3 text-sm outline-none focus:border-[#b77b0f]" /><button onClick={() => saveRevision("Approved")} disabled={saving} className="rounded-xl border border-[#d1b56c] bg-white px-4 py-3 text-sm font-bold text-[#4b3656] disabled:opacity-50">Save and approve</button></div><p className="mt-4 text-xs leading-5 text-[#928a99]">Review all placeholders and evidence statements before approval. Approval here is your internal status only and is not certification.</p></section>
      <aside className="space-y-6"><section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Revision history</p><h2 className="mt-1 text-xl font-bold">Versions</h2><div className="mt-4 space-y-2">{revisions.map((revision) => <div key={revision.id} className="rounded-2xl bg-[#f6f7fa] p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-[#4b3656]">Revision {revision.revision_number}</p><button onClick={() => restoreRevision(revision)} className="text-xs font-bold text-[#966712]">Restore</button></div><p className="mt-1 text-xs text-[#6e6876]">{revision.change_summary || "Edited document"}</p><p className="mt-1 text-[11px] text-[#a29ba8]">{new Date(revision.created_at).toLocaleString()}</p></div>)}{revisions.length === 0 && <p className="text-sm text-[#928a99]">Your first save will create revision 1.</p>}</div></section><section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Compare</p><h2 className="mt-1 text-xl font-bold">Compare with a revision</h2><select value={compareId} onChange={(event) => setCompareId(event.target.value)} className="mt-4 w-full rounded-xl border border-[#d9dbe4] bg-white px-3 py-3 text-sm"><option value="">Choose a revision</option>{revisions.map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.revision_number}</option>)}</select>{compared && <div className="mt-4"><p className="text-xs font-bold text-[#817687]">Selected revision preview</p><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#f6f7fa] p-3 text-xs leading-5 text-[#4b3656]">{compared.content}</pre></div>}</section></aside>
    </div>
  </section></main>;
}

export default function DocumentEditorPage() { return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#f1f3f6] text-sm text-[#6e6876]">Loading document editor...</main>}><EditorContent /></Suspense>; }
