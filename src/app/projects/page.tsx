"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  audit_type: string | null;
  standard: string | null;
  audit_scope: string | null;
  audit_date: string | null;
  status: string;
  created_at: string;
};

export default function ProjectsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [auditType, setAuditType] = useState("ISO certification audit");
  const [standard, setStandard] = useState("ISO 9001:2015");
  const [scope, setScope] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProjects() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.replace("/auth");
        return;
      }

      const { data, error: queryError } = await supabase
        .from("audit_projects")
        .select("id, name, audit_type, standard, audit_scope, audit_date, status, created_at")
        .order("created_at", { ascending: false });

      if (queryError) setError(queryError.message);
      else setProjects((data || []) as Project[]);

      setLoading(false);
    }

    loadProjects();
  }, [router]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      router.replace("/auth");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("audit_projects")
      .insert({
        user_id: authData.user.id,
        name,
        audit_type: auditType,
        standard,
        audit_scope: scope || null,
        audit_date: auditDate || null,
      })
      .select("id, name, audit_type, standard, audit_scope, audit_date, status, created_at")
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setProjects((current) => [data as Project, ...current]);
      setName("");
      setScope("");
      setAuditDate("");
      setShowForm(false);
    }

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#f1f3f6] px-5 py-8 text-[#2b1635] sm:px-8 sm:py-12">
      <section className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center gap-3">
            <span className="rounded-full border border-[#d1d4de] bg-white px-3 py-2 text-lg font-bold">←</span>
            <span className="text-left">
              <span className="block text-[17px] font-bold">Audit Copilot</span>
              <span className="block text-[11px] uppercase tracking-[0.15em] text-[#817687]">Audit projects</span>
            </span>
          </button>

          <button
            onClick={() => setShowForm((current) => !current)}
            className="rounded-xl bg-[#392047] px-4 py-3 text-sm font-bold text-white hover:bg-[#281430]"
          >
            + New audit
          </button>
        </header>

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#817687]">Your audit workspaces</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Prepare for an audit with a clear plan</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6e6876]">
            Create one workspace for each audit. Keep documents, evidence, findings, and corrective actions together.
          </p>
        </div>

        {showForm && (
          <form onSubmit={createProject} className="mb-6 rounded-3xl border border-[#d8dbe3] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold">Start a new audit workspace</h2>
            <p className="mt-2 text-sm text-[#6e6876]">You can leave details blank and complete them later.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold" htmlFor="project-name">Audit name</label>
                <input id="project-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: ISO 9001 audit — November 2026" className="w-full rounded-xl border border-[#d9dbe4] px-3 py-3 text-sm outline-none focus:border-[#b77b0f]" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold" htmlFor="audit-type">Audit type</label>
                <select id="audit-type" value={auditType} onChange={(event) => setAuditType(event.target.value)} className="w-full rounded-xl border border-[#d9dbe4] bg-white px-3 py-3 text-sm">
                  <option>ISO certification audit</option>
                  <option>Internal audit</option>
                  <option>Customer audit</option>
                  <option>Supplier audit</option>
                  <option>Surveillance audit</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold" htmlFor="standard">Standard</label>
                <select id="standard" value={standard} onChange={(event) => setStandard(event.target.value)} className="w-full rounded-xl border border-[#d9dbe4] bg-white px-3 py-3 text-sm">
                  <option>ISO 9001:2015</option>
                  <option>ISO 45001:2018</option>
                  <option>ISO 14001:2015</option>
                  <option>IATF 16949</option>
                  <option>Customer-specific requirements</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold" htmlFor="audit-date">Audit date</label>
                <input id="audit-date" type="date" value={auditDate} onChange={(event) => setAuditDate(event.target.value)} className="w-full rounded-xl border border-[#d9dbe4] px-3 py-3 text-sm" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold" htmlFor="scope">Audit scope</label>
                <input id="scope" value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Example: CNC machining and final inspection" className="w-full rounded-xl border border-[#d9dbe4] px-3 py-3 text-sm" />
              </div>
            </div>

            {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <button disabled={saving} className="mt-6 rounded-xl bg-[#392047] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
              {saving ? "Creating..." : "Create audit workspace"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="rounded-3xl border border-[#d8dbe3] bg-white p-8 text-center text-sm text-[#6e6876]">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="rounded-3xl border border-[#d8dbe3] bg-white p-10 text-center">
            <div className="text-3xl text-[#a87514]">▣</div>
            <h2 className="mt-3 text-lg font-bold">No audit workspaces yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#928a99]">
              Start one audit workspace so your documents and evidence stay organized.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="rounded-3xl border border-[#d8dbe3] bg-white p-6 text-left shadow-sm transition hover:border-[#c8ab65]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold text-[#3a2446]">{project.name}</h2>
                  <span className="rounded-full bg-[#f2eef6] px-2.5 py-1 text-[11px] font-bold text-[#966712]">{project.status}</span>
                </div>
                <p className="mt-4 text-sm text-[#6e6876]">{project.standard || "Standard not selected"}</p>
                <p className="mt-1 text-sm text-[#6e6876]">{project.audit_scope || "Scope not defined yet"}</p>
                <p className="mt-4 text-xs text-[#a29ba8]">
                  {project.audit_date ? `Audit date: ${project.audit_date}` : "Audit date not set"}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
