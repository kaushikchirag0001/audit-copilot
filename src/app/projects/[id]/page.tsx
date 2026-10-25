"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  audit_type: string | null;
  standard: string | null;
  audit_scope: string | null;
  audit_date: string | null;
  status: string;
};

type Evidence = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  owner: string | null;
  due_date: string | null;
};

type Finding = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  owner: string | null;
  due_date: string | null;
};

type Action = {
  id: string;
  action: string;
  owner: string | null;
  due_date: string | null;
  status: string;
};

function ProjectDetailPageContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [linkedCounts, setLinkedCounts] = useState({ documents: 0, files: 0, reports: 0, sessions: 0, closures: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [findingTitle, setFindingTitle] = useState("");
  const [findingSeverity, setFindingSeverity] = useState("Medium");
  const [actionText, setActionText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadWorkspace() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.replace("/auth");
        return;
      }

      const [projectResult, evidenceResult, findingsResult, actionsResult, documentsResult, filesResult, gapsResult, chatsResult, closuresResult] =
        await Promise.all([
          supabase
            .from("audit_projects")
            .select("id, name, audit_type, standard, audit_scope, audit_date, status")
            .eq("id", projectId)
            .single(),
          supabase
            .from("evidence_items")
            .select("id, title, description, status, owner, due_date")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
          supabase
            .from("audit_findings")
            .select("id, title, description, severity, status, owner, due_date")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
          supabase
            .from("corrective_actions")
            .select("id, action, owner, due_date, status")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
          supabase.from("project_documents").select("document_id").eq("project_id", projectId),
          supabase.from("uploaded_files").select("id").eq("project_id", projectId),
          supabase.from("gap_reports").select("id").eq("project_id", projectId),
          supabase.from("chat_messages").select("id").eq("project_id", projectId).eq("role", "assistant"),
          supabase.from("closure_packs").select("id").eq("project_id", projectId),
        ]);

      if (projectResult.error) {
        setError(projectResult.error.message);
      } else {
        setProject(projectResult.data as Project);
        setEvidence((evidenceResult.data || []) as Evidence[]);
        setFindings((findingsResult.data || []) as Finding[]);
        setActions((actionsResult.data || []) as Action[]);
        setLinkedCounts({ documents: documentsResult.data?.length || 0, files: filesResult.data?.length || 0, reports: gapsResult.data?.length || 0, sessions: chatsResult.data?.length || 0, closures: closuresResult.data?.length || 0 });
      }

      setLoading(false);
    }

    if (projectId) loadWorkspace();
  }, [projectId, router]);

  async function addEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!evidenceTitle.trim()) return;
    setSaving(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      router.replace("/auth");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("evidence_items")
      .insert({
        project_id: projectId,
        user_id: authData.user.id,
        title: evidenceTitle.trim(),
        status: "Missing",
      })
      .select("id, title, description, status, owner, due_date")
      .single();

    if (insertError) setError(insertError.message);
    else if (data) {
      setEvidence((current) => [data as Evidence, ...current]);
      setEvidenceTitle("");
    }

    setSaving(false);
  }

  async function addFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!findingTitle.trim()) return;
    setSaving(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      router.replace("/auth");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("audit_findings")
      .insert({
        project_id: projectId,
        user_id: authData.user.id,
        title: findingTitle.trim(),
        severity: findingSeverity,
        status: "Open",
      })
      .select("id, title, description, severity, status, owner, due_date")
      .single();

    if (insertError) setError(insertError.message);
    else if (data) {
      setFindings((current) => [data as Finding, ...current]);
      setFindingTitle("");
    }

    setSaving(false);
  }

  async function addAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionText.trim()) return;
    setSaving(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      router.replace("/auth");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("corrective_actions")
      .insert({
        project_id: projectId,
        user_id: authData.user.id,
        action: actionText.trim(),
        status: "Open",
      })
      .select("id, action, owner, due_date, status")
      .single();

    if (insertError) setError(insertError.message);
    else if (data) {
      setActions((current) => [data as Action, ...current]);
      setActionText("");
    }

    setSaving(false);
  }

  async function updateProjectStatus(status: string) {
    if (!project) return;

    const { error: updateError } = await supabase
      .from("audit_projects")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", project.id);

    if (updateError) setError(updateError.message);
    else setProject({ ...project, status });
  }

  async function updateEvidenceStatus(id: string, status: string) {
    const { error: updateError } = await supabase
      .from("evidence_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) setError(updateError.message);
    else setEvidence((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  async function updateFindingStatus(id: string, status: string) {
    const { error: updateError } = await supabase
      .from("audit_findings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) setError(updateError.message);
    else setFindings((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  async function updateActionStatus(id: string, status: string) {
    const { error: updateError } = await supabase
      .from("corrective_actions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) setError(updateError.message);
    else setActions((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f1f3f6] text-sm text-[#6e6876]">Loading audit workspace...</main>;
  }

  if (!project) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f1f3f6] text-sm text-red-700">{error || "Project not found."}</main>;
  }

  const evidenceComplete = evidence.filter((item) => item.status === "Verified" || item.status === "Not applicable").length;
  const findingsOpen = findings.filter((item) => item.status !== "Closed").length;
  const actionsComplete = actions.filter((item) => item.status === "Complete").length;
  const totalProgressItems = evidence.length + findings.length + actions.length;
  const completeProgressItems = evidenceComplete + findings.filter((item) => item.status === "Closed").length + actionsComplete;
  const progress = totalProgressItems ? Math.round((completeProgressItems / totalProgressItems) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#f1f3f6] px-5 py-8 text-[#2b1635] sm:px-8 sm:py-10">
      <section className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button onClick={() => router.push("/projects")} className="flex items-center gap-3 text-left">
            <span className="rounded-full border border-[#d1d4de] bg-white px-3 py-2 text-lg font-bold">←</span>
            <span>
              <span className="block text-[17px] font-bold">Audit Copilot</span>
              <span className="block text-[11px] uppercase tracking-[0.15em] text-[#817687]">Audit workspace</span>
            </span>
          </button>

          <select value={project.status} onChange={(event) => updateProjectStatus(event.target.value)} className="rounded-xl border border-[#d9dbe4] bg-white px-3 py-2.5 text-sm font-bold">
            <option>In preparation</option>
            <option>Ready for internal review</option>
            <option>Complete</option>
            <option>Archived</option>
          </select>
        </header>

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#817687]">{project.standard || "Standard not selected"}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{project.name}</h1>
          <p className="mt-3 text-sm leading-6 text-[#6e6876]">{project.audit_scope || "Define the audit scope in this workspace."}</p>
          <p className="mt-1 text-xs text-[#a29ba8]">{project.audit_date ? `Audit date: ${project.audit_date}` : "Audit date not set"}</p>
        </div>

        {error && <div className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Progress", `${progress}%`],
            ["Evidence", `${evidenceComplete}/${evidence.length}`],
            ["Open findings", String(findingsOpen)],
            ["Actions complete", `${actionsComplete}/${actions.length}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#d8dbe3] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">{label}</p>
              <p className="mt-2 text-2xl font-bold text-[#76500a]">{value}</p>
            </div>
          ))}
        </div>

        <section className="mb-6 rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Connected work</p><h2 className="mt-1 text-xl font-bold">Everything for this audit</h2><p className="mt-2 text-sm text-[#6e6876]">Open the related records without leaving your audit workspace.</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={() => router.push("/audit-reports")} className="rounded-xl border border-[#d1b56c] bg-white px-3 py-2 text-xs font-bold text-[#4b3656]">Reports</button><button onClick={() => router.push("/mock-audit")} className="rounded-xl border border-[#d1b56c] bg-white px-3 py-2 text-xs font-bold text-[#4b3656]">Mock audit</button><button onClick={() => router.push("/response-workbench")} className="rounded-xl border border-[#d1b56c] bg-white px-3 py-2 text-xs font-bold text-[#4b3656]">CAPA / closure</button></div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-5">{[["Documents", linkedCounts.documents], ["Files", linkedCounts.files], ["Gap reports", linkedCounts.reports], ["Mock turns", linkedCounts.sessions], ["Closure packs", linkedCounts.closures]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-[#f6f7fa] p-3"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#817687]">{label}</p><p className="mt-1 text-xl font-bold text-[#76500a]">{value}</p></div>)}</div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Evidence</p>
                <h2 className="mt-1 text-xl font-bold">What must be ready?</h2>
              </div>
              <span className="rounded-full bg-[#f2eef6] px-2.5 py-1 text-xs font-bold text-[#966712]">{evidence.length}</span>
            </div>

            <form onSubmit={addEvidence} className="mt-5 flex gap-2">
              <input value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} placeholder="Add required evidence" className="min-w-0 flex-1 rounded-xl border border-[#d9dbe4] px-3 py-2.5 text-sm outline-none focus:border-[#b77b0f]" />
              <button disabled={saving} className="rounded-xl bg-[#392047] px-3 py-2 text-sm font-bold text-white">+</button>
            </form>

            <div className="mt-5 space-y-3">
              {evidence.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f6f7fa] p-3">
                  <p className="text-sm font-bold text-[#4b3656]">{item.title}</p>
                  <select value={item.status} onChange={(event) => updateEvidenceStatus(item.id, event.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dbe4] bg-white px-2 py-2 text-xs">
                    <option>Missing</option>
                    <option>Requested</option>
                    <option>Uploaded</option>
                    <option>Verified</option>
                    <option>Not applicable</option>
                  </select>
                </div>
              ))}
              {evidence.length === 0 && <p className="text-sm leading-6 text-[#a29ba8]">Add the records an auditor should be able to see.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Findings</p>
            <h2 className="mt-1 text-xl font-bold">What needs attention?</h2>

            <form onSubmit={addFinding} className="mt-5 space-y-2">
              <input value={findingTitle} onChange={(event) => setFindingTitle(event.target.value)} placeholder="Add a gap or finding" className="w-full rounded-xl border border-[#d9dbe4] px-3 py-2.5 text-sm outline-none focus:border-[#b77b0f]" />
              <div className="flex gap-2">
                <select value={findingSeverity} onChange={(event) => setFindingSeverity(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#d9dbe4] bg-white px-2 py-2 text-xs">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
                <button disabled={saving} className="rounded-xl bg-[#392047] px-4 py-2 text-sm font-bold text-white">Add</button>
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {findings.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f6f7fa] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[#4b3656]">{item.title}</p>
                    <span className="text-[10px] font-bold uppercase text-[#91610c]">{item.severity}</span>
                  </div>
                  <select value={item.status} onChange={(event) => updateFindingStatus(item.id, event.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dbe4] bg-white px-2 py-2 text-xs">
                    <option>Open</option>
                    <option>In progress</option>
                    <option>Closed</option>
                    <option>Accepted</option>
                  </select>
                </div>
              ))}
              {findings.length === 0 && <p className="text-sm leading-6 text-[#a29ba8]">Record gaps discovered during preparation or an internal audit.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-[#d8dbe3] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#817687]">Corrective actions</p>
            <h2 className="mt-1 text-xl font-bold">What will you do next?</h2>

            <form onSubmit={addAction} className="mt-5 flex gap-2">
              <input value={actionText} onChange={(event) => setActionText(event.target.value)} placeholder="Add an action" className="min-w-0 flex-1 rounded-xl border border-[#d9dbe4] px-3 py-2.5 text-sm outline-none focus:border-[#b77b0f]" />
              <button disabled={saving} className="rounded-xl bg-[#392047] px-3 py-2 text-sm font-bold text-white">+</button>
            </form>

            <div className="mt-5 space-y-3">
              {actions.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f6f7fa] p-3">
                  <p className="text-sm font-bold text-[#4b3656]">{item.action}</p>
                  <select value={item.status} onChange={(event) => updateActionStatus(item.id, event.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dbe4] bg-white px-2 py-2 text-xs">
                    <option>Open</option>
                    <option>In progress</option>
                    <option>Complete</option>
                    <option>Overdue</option>
                  </select>
                </div>
              ))}
              {actions.length === 0 && <p className="text-sm leading-6 text-[#a29ba8]">Turn each important gap into a specific next action.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

    
export default function ProjectDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f1f3f6] text-sm text-[#6e6876]">
          Loading audit workspace...
        </main>
      }
    >
      <ProjectDetailPageContent />
    </Suspense>
  );
}
