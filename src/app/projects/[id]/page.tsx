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

      const [projectResult, evidenceResult, findingsResult, actionsResult] =
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
        ]);

      if (projectResult.error) {
        setError(projectResult.error.message);
      } else {
        setProject(projectResult.data as Project);
        setEvidence((evidenceResult.data || []) as Evidence[]);
        setFindings((findingsResult.data || []) as Finding[]);
        setActions((actionsResult.data || []) as Action[]);
      }

      setLoading(false);
    }

    if (projectId) loadWorkspace();
  }, [projectId, router, supabase]);

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
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] text-sm text-[#71877c]">Loading audit workspace...</main>;
  }

  if (!project) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] text-sm text-red-700">{error || "Project not found."}</main>;
  }

  const evidenceComplete = evidence.filter((item) => item.status === "Verified" || item.status === "Not applicable").length;
  const findingsOpen = findings.filter((item) => item.status !== "Closed").length;
  const actionsComplete = actions.filter((item) => item.status === "Complete").length;
  const totalProgressItems = evidence.length + findings.length + actions.length;
  const completeProgressItems = evidenceComplete + findings.filter((item) => item.status === "Closed").length + actionsComplete;
  const progress = totalProgressItems ? Math.round((completeProgressItems / totalProgressItems) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#173b35] sm:px-8 sm:py-10">
      <section className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button onClick={() => router.push("/projects")} className="flex items-center gap-3 text-left">
            <span className="rounded-full border border-[#cfddd3] bg-white px-3 py-2 text-lg font-bold">←</span>
            <span>
              <span className="block text-[17px] font-bold">Audit Copilot</span>
              <span className="block text-[11px] uppercase tracking-[0.15em] text-[#769087]">Audit workspace</span>
            </span>
          </button>

          <select value={project.status} onChange={(event) => updateProjectStatus(event.target.value)} className="rounded-xl border border-[#d6e2d8] bg-white px-3 py-2.5 text-sm font-bold">
            <option>In preparation</option>
            <option>Ready for internal review</option>
            <option>Complete</option>
            <option>Archived</option>
          </select>
        </header>

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#87a096]">{project.standard || "Standard not selected"}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{project.name}</h1>
          <p className="mt-3 text-sm leading-6 text-[#71877c]">{project.audit_scope || "Define the audit scope in this workspace."}</p>
          <p className="mt-1 text-xs text-[#9aa9a1]">{project.audit_date ? `Audit date: ${project.audit_date}` : "Audit date not set"}</p>
        </div>

        {error && <div className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Progress", `${progress}%`],
            ["Evidence", `${evidenceComplete}/${evidence.length}`],
            ["Open findings", String(findingsOpen)],
            ["Actions complete", `${actionsComplete}/${actions.length}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#dfe7df] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#87a096]">{label}</p>
              <p className="mt-2 text-2xl font-bold text-[#2d6c5b]">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#87a096]">Evidence</p>
                <h2 className="mt-1 text-xl font-bold">What must be ready?</h2>
              </div>
              <span className="rounded-full bg-[#eef7ef] px-2.5 py-1 text-xs font-bold text-[#39745e]">{evidence.length}</span>
            </div>

            <form onSubmit={addEvidence} className="mt-5 flex gap-2">
              <input value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} placeholder="Add required evidence" className="min-w-0 flex-1 rounded-xl border border-[#d6e2d8] px-3 py-2.5 text-sm outline-none focus:border-[#3b8a73]" />
              <button disabled={saving} className="rounded-xl bg-[#1f6255] px-3 py-2 text-sm font-bold text-white">+</button>
            </form>

            <div className="mt-5 space-y-3">
              {evidence.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f7faf7] p-3">
                  <p className="text-sm font-bold text-[#315e53]">{item.title}</p>
                  <select value={item.status} onChange={(event) => updateEvidenceStatus(item.id, event.target.value)} className="mt-2 w-full rounded-lg border border-[#d6e2d8] bg-white px-2 py-2 text-xs">
                    <option>Missing</option>
                    <option>Requested</option>
                    <option>Uploaded</option>
                    <option>Verified</option>
                    <option>Not applicable</option>
                  </select>
                </div>
              ))}
              {evidence.length === 0 && <p className="text-sm leading-6 text-[#9aa9a1]">Add the records an auditor should be able to see.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#87a096]">Findings</p>
            <h2 className="mt-1 text-xl font-bold">What needs attention?</h2>

            <form onSubmit={addFinding} className="mt-5 space-y-2">
              <input value={findingTitle} onChange={(event) => setFindingTitle(event.target.value)} placeholder="Add a gap or finding" className="w-full rounded-xl border border-[#d6e2d8] px-3 py-2.5 text-sm outline-none focus:border-[#3b8a73]" />
              <div className="flex gap-2">
                <select value={findingSeverity} onChange={(event) => setFindingSeverity(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#d6e2d8] bg-white px-2 py-2 text-xs">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
                <button disabled={saving} className="rounded-xl bg-[#1f6255] px-4 py-2 text-sm font-bold text-white">Add</button>
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {findings.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f7faf7] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[#315e53]">{item.title}</p>
                    <span className="text-[10px] font-bold uppercase text-[#94651b]">{item.severity}</span>
                  </div>
                  <select value={item.status} onChange={(event) => updateFindingStatus(item.id, event.target.value)} className="mt-2 w-full rounded-lg border border-[#d6e2d8] bg-white px-2 py-2 text-xs">
                    <option>Open</option>
                    <option>In progress</option>
                    <option>Closed</option>
                    <option>Accepted</option>
                  </select>
                </div>
              ))}
              {findings.length === 0 && <p className="text-sm leading-6 text-[#9aa9a1]">Record gaps discovered during preparation or an internal audit.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#87a096]">Corrective actions</p>
            <h2 className="mt-1 text-xl font-bold">What will you do next?</h2>

            <form onSubmit={addAction} className="mt-5 flex gap-2">
              <input value={actionText} onChange={(event) => setActionText(event.target.value)} placeholder="Add an action" className="min-w-0 flex-1 rounded-xl border border-[#d6e2d8] px-3 py-2.5 text-sm outline-none focus:border-[#3b8a73]" />
              <button disabled={saving} className="rounded-xl bg-[#1f6255] px-3 py-2 text-sm font-bold text-white">+</button>
            </form>

            <div className="mt-5 space-y-3">
              {actions.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f7faf7] p-3">
                  <p className="text-sm font-bold text-[#315e53]">{item.action}</p>
                  <select value={item.status} onChange={(event) => updateActionStatus(item.id, event.target.value)} className="mt-2 w-full rounded-lg border border-[#d6e2d8] bg-white px-2 py-2 text-xs">
                    <option>Open</option>
                    <option>In progress</option>
                    <option>Complete</option>
                    <option>Overdue</option>
                  </select>
                </div>
              ))}
              {actions.length === 0 && <p className="text-sm leading-6 text-[#9aa9a1]">Turn each important gap into a specific next action.</p>}
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
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] text-sm text-[#71877c]">
          Loading audit workspace...
        </main>
      }
    >
      <ProjectDetailPageContent />
    </Suspense>
  );
}
