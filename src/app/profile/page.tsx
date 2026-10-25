"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const auditTypes = [
  "Certification audit",
  "Internal audit",
  "Customer audit",
  "Supplier audit",
  "Process audit",
  "Product audit",
  "Regulatory inspection",
];

type ProfileForm = {
  fullName: string;
  companyName: string;
  role: string;
  siteLocation: string;
  mainProducts: string;
  mainProcesses: string;
  employeeCount: string;
  departments: string;
  applicableStandards: string;
  numberingScheme: string;
  revisionFormat: string;
  retentionPeriod: string;
  upcomingAuditType: string;
  upcomingAuditDate: string;
  auditorName: string;
  auditScope: string;
  customerRequirements: string;
};

const emptyProfile: ProfileForm = {
  fullName: "",
  companyName: "",
  role: "Quality manager",
  siteLocation: "",
  mainProducts: "",
  mainProcesses: "",
  employeeCount: "",
  departments: "",
  applicableStandards: "ISO 9001:2015",
  numberingScheme: "",
  revisionFormat: "",
  retentionPeriod: "",
  upcomingAuditType: "Certification audit",
  upcomingAuditDate: "",
  auditorName: "",
  auditScope: "",
  customerRequirements: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.replace("/auth");
        return;
      }

      setEmail(authData.user.email || "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "full_name, company_name, role, site_location, main_products, main_processes, employee_count, departments, applicable_standards, numbering_scheme, revision_format, retention_period, upcoming_audit_type, upcoming_audit_date, auditor_name, audit_scope, customer_requirements"
        )
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
      }

      if (profile) {
        setForm({
          fullName: profile.full_name || "",
          companyName: profile.company_name || "",
          role: profile.role || "Quality manager",
          siteLocation: profile.site_location || "",
          mainProducts: profile.main_products || "",
          mainProcesses: profile.main_processes || "",
          employeeCount: profile.employee_count || "",
          departments: profile.departments || "",
          applicableStandards: profile.applicable_standards || "ISO 9001:2015",
          numberingScheme: profile.numbering_scheme || "",
          revisionFormat: profile.revision_format || "",
          retentionPeriod: profile.retention_period || "",
          upcomingAuditType: profile.upcoming_audit_type || "Certification audit",
          upcomingAuditDate: profile.upcoming_audit_date || "",
          auditorName: profile.auditor_name || "",
          auditScope: profile.audit_scope || "",
          customerRequirements: profile.customer_requirements || "",
        });
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

    const { error: saveError } = await supabase.from("profiles").upsert({
      id: authData.user.id,
      full_name: form.fullName || null,
      company_name: form.companyName || null,
      role: form.role,
      language: "English",
      site_location: form.siteLocation || null,
      main_products: form.mainProducts || null,
      main_processes: form.mainProcesses || null,
      employee_count: form.employeeCount || null,
      departments: form.departments || null,
      applicable_standards: form.applicableStandards || null,
      numbering_scheme: form.numberingScheme || null,
      revision_format: form.revisionFormat || null,
      retention_period: form.retentionPeriod || null,
      upcoming_audit_type: form.upcomingAuditType || null,
      upcoming_audit_date: form.upcomingAuditDate || null,
      auditor_name: form.auditorName || null,
      audit_scope: form.auditScope || null,
      customer_requirements: form.customerRequirements || null,
      updated_at: new Date().toISOString(),
    });

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage("Profile saved. Audit Copilot will reuse these details in future drafts.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] text-sm text-[#71877c]">
        Loading company profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#173b35] sm:px-8 sm:py-10">
      <section className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
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

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/projects")}
              className="rounded-full border border-[#cfddd3] bg-white px-4 py-2 text-sm font-semibold text-[#315e53]"
            >
              Audit projects
            </button>
            <button
              onClick={() => router.push("/history")}
              className="rounded-full border border-[#cfddd3] bg-white px-4 py-2 text-sm font-semibold text-[#315e53]"
            >
              Document history
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-[0_12px_35px_rgba(34,72,59,0.06)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#87a096]">
            Reused in future drafts, reviews, and gap reports
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">
            Your company profile
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#71877c]">
            Add only what you know. Unknown details can remain blank. The assistant will ask
            for important missing information before creating an audit document.
          </p>

          <form onSubmit={saveProfile} className="mt-8 space-y-8">
            <section>
              <h2 className="text-lg font-bold">Company information</h2>
              <p className="mt-1 text-sm text-[#71877c]">
                This helps the assistant write documents that match your real organization.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Account email"
                  value={email}
                  readOnly
                  help="Your login email cannot be changed here."
                />
                <Field
                  label="Your name or job title"
                  value={form.fullName}
                  onChange={(value) => updateField("fullName", value)}
                  placeholder="Example: Priya Sharma, Quality Manager"
                />
                <Field
                  label="Company name"
                  value={form.companyName}
                  onChange={(value) => updateField("companyName", value)}
                  placeholder="Example: ABC Precision Components"
                />
                <SelectField
                  label="Primary role"
                  value={form.role}
                  onChange={(value) => updateField("role", value)}
                  options={[
                    "Quality manager",
                    "Production manager",
                    "Internal auditor",
                    "Consultant",
                    "Company owner",
                    "Other",
                  ]}
                />
                <Field
                  label="Site location"
                  value={form.siteLocation}
                  onChange={(value) => updateField("siteLocation", value)}
                  placeholder="City, country, or plant name"
                />
                <Field
                  label="Approximate employee count"
                  value={form.employeeCount}
                  onChange={(value) => updateField("employeeCount", value)}
                  placeholder="Example: 35"
                />
                <TextField
                  label="Main products"
                  value={form.mainProducts}
                  onChange={(value) => updateField("mainProducts", value)}
                  placeholder="Example: CNC-machined aluminium parts"
                />
                <TextField
                  label="Main manufacturing processes"
                  value={form.mainProcesses}
                  onChange={(value) => updateField("mainProcesses", value)}
                  placeholder="Example: CNC turning, milling, inspection, packing"
                />
                <TextField
                  label="Departments"
                  value={form.departments}
                  onChange={(value) => updateField("departments", value)}
                  placeholder="Example: Production, Quality, Purchasing, Stores"
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold">Audit information</h2>
              <p className="mt-1 text-sm text-[#71877c]">
                Use the exact standard or customer checklist whenever possible.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Applicable standards and editions"
                  value={form.applicableStandards}
                  onChange={(value) => updateField("applicableStandards", value)}
                  placeholder="Example: ISO 9001:2015, IATF 16949"
                />
                <SelectField
                  label="Upcoming audit type"
                  value={form.upcomingAuditType}
                  onChange={(value) => updateField("upcomingAuditType", value)}
                  options={auditTypes}
                />
                <Field
                  label="Expected audit date"
                  type="date"
                  value={form.upcomingAuditDate}
                  onChange={(value) => updateField("upcomingAuditDate", value)}
                />
                <Field
                  label="Auditor or auditing organization"
                  value={form.auditorName}
                  onChange={(value) => updateField("auditorName", value)}
                  placeholder="Example: Customer quality team or certification body"
                />
                <TextField
                  label="Main audit scope"
                  value={form.auditScope}
                  onChange={(value) => updateField("auditScope", value)}
                  placeholder="Example: CNC production and final inspection at Plant 1"
                />
                <TextField
                  label="Customer or special requirements"
                  value={form.customerRequirements}
                  onChange={(value) => updateField("customerRequirements", value)}
                  placeholder="Paste short requirements or describe them"
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold">Document-control rules</h2>
              <p className="mt-1 text-sm text-[#71877c]">
                These details help generated documents fit your existing system.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field
                  label="Document numbering scheme"
                  value={form.numberingScheme}
                  onChange={(value) => updateField("numberingScheme", value)}
                  placeholder="Example: QP-PR-001"
                />
                <Field
                  label="Revision format"
                  value={form.revisionFormat}
                  onChange={(value) => updateField("revisionFormat", value)}
                  placeholder="Example: Rev 00 or 1.0"
                />
                <Field
                  label="Record-retention period"
                  value={form.retentionPeriod}
                  onChange={(value) => updateField("retentionPeriod", value)}
                  placeholder="Example: 3 years"
                />
              </div>
            </section>

            <div className="rounded-2xl border border-[#d9e9dc] bg-[#f2faf3] px-4 py-3 text-sm leading-6 text-[#477366]">
              Audit Copilot will not invent company evidence. If information is missing, it
              will use a clear placeholder and tell you what must be confirmed.
            </div>

            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {message && <div className="rounded-xl bg-[#e8f5eb] px-4 py-3 text-sm text-[#287052]">{message}</div>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#1f6255] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#174d43] disabled:opacity-60"
            >
              {saving ? "Saving profile..." : "Save company profile"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  help,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73] ${
          readOnly ? "bg-[#f7faf7] text-[#71877c]" : ""
        }`}
      />
      {help && <span className="mt-1 block text-xs text-[#8a9d93]">{help}</span>}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#d6e2d8] bg-white px-3 py-3 text-sm outline-none focus:border-[#3b8a73]"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
