"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downloadExcel, downloadPdf, downloadWord } from "@/lib/export-document";
import { Clock3, PanelLeft, Trash2, X } from "lucide-react";
import AuditChat from "@/components/AuditChat";

type Question = {
  id: string;
  question: string;
  reason: string;
  options: string[];
  allowCustom: boolean;
};

type Quality = {
  passed: boolean;
  checks: { label: string; passed: boolean }[];
  placeholderCount: number;
};

type RecentDocument = {
  id: string;
  title: string;
  created_at: string;
};

type DraftProject = {
  id: string;
  name: string;
  standard: string | null;
  status: string;
};

type AuditReview = {
  score: number;
  decision: string;
  summary: string;
  criticalRisks: string[];
  missingEvidence: string[];
  missingInformation: string[];
  unsupportedAssumptions: string[];
  correctiveActions: { finding: string; action: string; owner: string; priority: string }[];
  questionsForUser: string[];
};

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [request, setRequest] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [products, setProducts] = useState("");
  const [standard, setStandard] = useState("ISO 9001:2015");
  const [role, setRole] = useState("Quality manager");
  const [language, setLanguage] = useState("English");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedContext, setUploadedContext] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [document, setDocument] = useState("");
  const [quality, setQuality] = useState<Quality | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [clarificationRound, setClarificationRound] = useState(0);
  const [screen, setScreen] = useState<"request" | "questions" | "working" | "result">("request");

  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [auditReview, setAuditReview] = useState<AuditReview | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [projects, setProjects] = useState<DraftProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [deletingRecentId, setDeletingRecentId] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkspace() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      setUserEmail(session?.user.email ?? null);

      if (session) {
        const [documentsResult, profileResult, projectsResult] = await Promise.all([
          supabase
            .from("documents")
            .select("id, title, created_at")
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("profiles")
            .select("company_name, role")
            .eq("id", session.user.id)
            .maybeSingle(),
          supabase
            .from("audit_projects")
            .select("id, name, standard, status")
            .neq("status", "Archived")
            .order("created_at", { ascending: false }),
        ]);

        setRecentDocuments((documentsResult.data || []) as RecentDocument[]);
        setProjects((projectsResult.data || []) as DraftProject[]);

        if (profileResult.data) {
          setCompanyName(profileResult.data.company_name || "");
          setRole(profileResult.data.role || "Quality manager");
        }
      }
    }

    loadWorkspace();
  }, [supabase.auth]);

  function setAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) return;

    setIsUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The file could not be read.");
      }

      setUploadedFileName(result.fileName);
      setUploadedContext(result.text);
    } catch (error) {
      setUploadedFileName("");
      setUploadedContext("");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The file could not be read.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function startDraft() {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      router.push("/auth");
      return;
    }

    if (!request.trim()) {
      setErrorMessage("Please describe the document you need first.");
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const response = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request,
          companyName,
          products,
          role,
          standard,
          previousAnswers: "",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        await generateDocument("");
        return;
      }

      if (result.ready || !result.questions?.length) {
        await generateDocument("");
        return;
      }

      setQuestions(result.questions);
      setClarificationRound((round) => round + 1);
      setScreen("questions");
    } catch {
      await generateDocument("");
    } finally {
      setIsBusy(false);
    }
  }

  async function answerQuestions() {
    const answerText = questions
      .map((question) => `${question.question}: ${answers[question.id] || "[not provided]"}`)
      .join("\n");

    setIsBusy(true);
    setErrorMessage("");

    try {
      await generateDocument(answerText);
    } finally {
      setIsBusy(false);
    }
  }

  async function generateDocument(previousAnswers: string) {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      router.push("/auth");
      return;
    }

    setScreen("working");
    setErrorMessage("");
    setSaveMessage("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request,
          companyName,
          products,
          role,
          language,
          standard,
          previousAnswers,
          uploadedContext,
          projectContext: selectedProjectId
            ? projects.find((project) => project.id === selectedProjectId)?.name || ""
            : "",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The document could not be generated.");
      }

      setDocument(result.document);
      setQuality(result.quality ?? null);
      setScreen("result");

      const title =
        result.document
          .split("\n")
          .find((line: string) => line.trim())
          ?.trim() || "Untitled document";

      const { error: saveError } = await supabase.from("documents").insert({
        user_id: data.session.user.id,
        title: title.slice(0, 180),
        request,
        content: result.document,
        document_type: "Procedure",
        standard,
        project_id: selectedProjectId || null,
      });

      await supabase
        .from("profiles")
        .update({
          company_name: companyName || null,
          role,
          language,
        })
        .eq("id", data.session.user.id);

      setSaveMessage(
        saveError
          ? "Draft created, but it could not be saved to your account."
          : "Draft created and saved to your account.",
      );
    } catch (error) {
      setScreen("request");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The document could not be generated. Please try again.",
      );
    }
  }

  async function deleteRecentDocument(id: string) {
    const confirmed = window.confirm(
      "Delete this saved document? This action cannot be undone.",
    );

    if (!confirmed) return;

    setDeletingRecentId(id);
    setErrorMessage("");

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setErrorMessage(deleteError.message);
    } else {
      setRecentDocuments((current) =>
        current.filter((recent) => recent.id !== id),
      );
    }

    setDeletingRecentId(null);
  }

  function documentTitle() {
    return document.split("\n").find((line) => line.trim())?.trim() || "audit-document";
  }

  async function reviewDraft() {
    setIsReviewing(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, provider: "gemini" }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The audit review failed.");
      }

      setAuditReview(result.review);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The audit review failed.",
      );
    } finally {
      setIsReviewing(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUserEmail(null);
    router.push("/auth");
  }

  function newDraft() {
    setIsHistoryOpen(false);
    setRequest("");
    setQuestions([]);
    setAnswers({});
    setDocument("");
    setQuality(null);
    setSaveMessage("");
    setErrorMessage("");
    setScreen("request");
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#173b35]">
      <header className="border-b border-[#dfe7df] bg-[#fbfcfa]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f6255] text-lg font-bold text-white">A</div>
            <div>
              <div className="text-[17px] font-bold tracking-tight">Audit Copilot</div>
              <div className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-[#769087] sm:block">
                Manufacturing documents
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsHistoryOpen((current) => !current)}
            className="group flex items-center gap-2 rounded-xl border border-[#cfddd3] bg-white px-3 py-2 text-sm font-bold text-[#315e53] shadow-sm transition hover:border-[#8fb49d] hover:bg-[#f7fbf7]"
            aria-label={isHistoryOpen ? "Close document history" : "Open document history"}
            title={isHistoryOpen ? "Close history" : "Open history"}
          >
            <PanelLeft size={17} strokeWidth={2} />
            <span className="hidden sm:inline">History</span>
          </button>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-[#6e8179] sm:inline">Free plan</span>
            {userEmail ? (
              <button onClick={signOut} className="rounded-full border border-[#cfddd3] bg-white px-4 py-2 font-semibold text-[#315e53]">
                Sign out
              </button>
            ) : (
              <button onClick={() => router.push("/auth")} className="rounded-full border border-[#cfddd3] bg-white px-4 py-2 font-semibold text-[#315e53]">
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-3 pb-10 pt-4 sm:px-6 sm:pt-8 lg:px-8">
        {isHistoryOpen && (
          <button
            aria-label="Close history"
            onClick={() => setIsHistoryOpen(false)}
            className="fixed inset-0 z-40 bg-[#173b35]/20 backdrop-blur-[2px] md:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex h-screen w-80 shrink-0 flex-col border-r border-[#dfe7df] bg-white p-4 shadow-[0_8px_25px_rgba(34,72,59,0.14)] transition-transform duration-300 ease-out md:static md:z-auto md:h-auto md:min-h-[680px] md:rounded-3xl md:border md:shadow-[0_8px_25px_rgba(34,72,59,0.05)] ${
            isHistoryOpen
              ? "translate-x-0"
              : "-translate-x-full md:pointer-events-none md:-translate-x-6 md:opacity-0"
          }`}
        >
            <div className="mb-3 flex items-center justify-between md:hidden">
              <p className="text-sm font-bold text-[#315e53]">Document history</p>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-lg p-2 text-[#71877c] transition hover:bg-[#f1f7f2] hover:text-[#1f6255]"
                aria-label="Close history"
              >
                <X size={17} />
              </button>
            </div>

            <button
              onClick={newDraft}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f6255] px-4 py-3 text-sm font-bold text-white hover:bg-[#174d43]"
            >
              <span className="text-lg">+</span> New document
            </button>

            <div className="mt-6 flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-[#87a096]">
                <Clock3 size={14} />
                Recent documents
              </p>
              <span className="rounded-full bg-[#eef7ef] px-2 py-1 text-[10px] font-bold text-[#39745e]">
                {recentDocuments.length}
              </span>
            </div>

            <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {recentDocuments.length === 0 ? (
                <p className="px-2 py-4 text-xs leading-5 text-[#9aa9a1]">
                  Your generated documents will appear here.
                </p>
              ) : (
                recentDocuments.map((recent) => (
                  <div
                    key={recent.id}
                    className="group flex items-center gap-1 rounded-xl px-2 py-1 transition hover:bg-[#f1f7f2]"
                  >
                    <button
                      onClick={() => router.push("/history")}
                      className="min-w-0 flex-1 py-2 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-[#315e53]">
                        {recent.title}
                      </p>
                      <p className="mt-1 text-[11px] text-[#9aa9a1]">
                        {new Date(recent.created_at).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      onClick={() => deleteRecentDocument(recent.id)}
                      disabled={deletingRecentId === recent.id}
                      className="rounded-lg p-2 text-[#9aa9a1] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                      title="Delete document"
                      aria-label={`Delete ${recent.title}`}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => router.push("/history")}
              className="mt-4 border-t border-[#edf1ed] pt-4 text-left text-sm font-bold text-[#477366] hover:text-[#1f6255]"
            >
              View all history →
            </button>
          </aside>

        <section className="min-w-0 flex-1">
        <div className="mb-8 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e5f1e9] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-[#27705e]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3c9a71]" />
            Your audit document workspace
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl">
            {screen === "questions" ? "A few details will improve your draft" : "What document do you need today?"}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[#6c7e76] sm:text-lg">
            {screen === "questions"
              ? "Answer what you know. You can skip anything and draft immediately."
              : "Describe it in plain words. We will create a practical first draft for your company to review."}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="mb-5 rounded-2xl border border-[#dfe7df] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#87a096]">
                Audit workspace
              </p>
              <p className="mt-1 text-sm font-semibold text-[#315e53]">
                Link this draft to an audit project
              </p>
              <p className="mt-1 text-xs leading-5 text-[#81958b]">
                This keeps documents, evidence, findings, and actions together.
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                className="min-w-0 rounded-xl border border-[#d6e2d8] bg-white px-3 py-2.5 text-sm sm:min-w-[240px]"
              >
                <option value="">No project selected</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="shrink-0 rounded-xl border border-[#cbdccf] bg-white px-3 py-2.5 text-xs font-bold text-[#477366] hover:border-[#8fb49d]"
              >
                Manage
              </button>
            </div>
          </div>
        </section>

        <AuditChat
          document={document}
          review={auditReview}
          companyContext={`${companyName}\n${products}\nRole: ${role}\nStandard: ${standard}\nUploaded reference: ${uploadedFileName}`}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-[0_12px_35px_rgba(34,72,59,0.06)] sm:p-7">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#87a096]">
                  {screen === "questions" ? `Step 2 · Round ${clarificationRound}` : "Step 1"}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {screen === "questions" ? "Help us get it right" : "Tell us what to draft"}
                </h2>
              </div>
              <div className="rounded-xl bg-[#f0f6f1] px-3 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#7c978b]">Plan</div>
                <div className="text-sm font-bold text-[#2d6c5b]">Free</div>
              </div>
            </div>

            {screen !== "questions" && (
              <>
                <label className="mb-2 block text-sm font-bold text-[#31544b]" htmlFor="request">
                  Your document request
                </label>
                <textarea
                  id="request"
                  value={request}
                  onChange={(event) => setRequest(event.target.value)}
                  placeholder="Example: Calibration procedure for our CNC machine shop before a customer audit"
                  className="min-h-32 w-full resize-none rounded-2xl border border-[#d6e2d8] bg-[#fbfdfb] p-4 text-[15px] leading-6 outline-none placeholder:text-[#a2b1a9] focus:border-[#3b8a73] focus:ring-4 focus:ring-[#dff0e5]"
                />

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold" htmlFor="companyName">Company name <span className="font-normal text-[#9aa9a1]">(optional)</span></label>
                    <input id="companyName" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Example: ABC Precision Components" className="w-full rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73]" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold" htmlFor="products">Products or processes <span className="font-normal text-[#9aa9a1]">(optional)</span></label>
                    <input id="products" value={products} onChange={(event) => setProducts(event.target.value)} placeholder="Example: CNC turning, milling, and final inspection" className="w-full rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73]" />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-dashed border-[#bfd4c4] bg-[#f7faf7] p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-xl text-[#4b8873]">↑</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#315e53]">Add company reference material</p>
                      <p className="mt-1 text-xs leading-5 text-[#81958b]">
                        Upload a PDF, Word, Excel, CSV, or text file. Maximum 5 MB. The text is used only for this draft.
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.docx,.xlsx,.xls,.txt,.csv"
                        onChange={(event) => handleFileUpload(event.target.files?.[0])}
                        disabled={isUploading}
                        className="mt-3 block w-full text-xs text-[#477366] file:mr-3 file:rounded-lg file:border-0 file:bg-[#dfeee2] file:px-3 file:py-2 file:font-bold file:text-[#2d6c5b] hover:file:bg-[#d4e9d9]"
                      />
                      {isUploading && (
                        <p className="mt-2 text-xs font-semibold text-[#477366]">Reading file...</p>
                      )}
                      {uploadedFileName && !isUploading && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#e6f3e9] px-3 py-2 text-xs text-[#2d6c5b]">
                          <span className="truncate font-semibold">{uploadedFileName}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedFileName("");
                              setUploadedContext("");
                            }}
                            className="shrink-0 font-bold underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold" htmlFor="role">Your role</label>
                    <select id="role" value={role} onChange={(event) => setRole(event.target.value)} className="w-full rounded-xl border border-[#d6e2d8] bg-white px-3 py-3 text-sm outline-none">
                      <option>Quality manager</option>
                      <option>Production manager</option>
                      <option>Internal auditor</option>
                      <option>Consultant</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold" htmlFor="language">Output language</label>
                    <div id="language" className="w-full rounded-xl border border-[#d6e2d8] bg-[#f7faf7] px-3 py-3 text-sm font-semibold text-[#315e53]">
                      English
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-bold" htmlFor="standard">Applicable standard</label>
                  <select id="standard" value={standard} onChange={(event) => setStandard(event.target.value)} className="w-full rounded-xl border border-[#d6e2d8] bg-white px-3 py-3 text-sm outline-none">
                    <option>ISO 9001:2015</option>
                    <option>ISO 14001:2015</option>
                    <option>ISO 45001:2018</option>
                    <option>Customer-specific audit</option>
                  </select>
                </div>

                <div className="mt-5 rounded-2xl bg-[#f7faf7] p-4 text-sm leading-5 text-[#71877c]">
                  We ask only for details that materially improve the document. You can always choose <strong>Just draft it</strong>.
                </div>

                <button onClick={startDraft} disabled={isBusy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f6255] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#174d43] disabled:opacity-60">
                  {isBusy ? "Checking what is needed..." : "Draft my document"}
                  {!isBusy && <span className="text-lg">→</span>}
                </button>
              </>
            )}

            {screen === "questions" && (
              <>
                <div className="space-y-5">
                  {questions.map((question) => (
                    <div key={question.id} className="rounded-2xl border border-[#e0e9e1] bg-[#fbfdfb] p-4">
                      <p className="text-sm font-bold leading-6">{question.question}</p>
                      {question.reason && <p className="mt-1 text-xs leading-5 text-[#81958b]">{question.reason}</p>}
                      <div className="mt-3 grid gap-2">
                        {question.options.map((option) => (
                          <button
                            key={option}
                            onClick={() => setAnswer(question.id, option)}
                            className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                              answers[question.id] === option
                                ? "border-[#3b8a73] bg-[#e6f3e9] font-bold text-[#246650]"
                                : "border-[#d6e2d8] bg-white hover:border-[#71a58f]"
                            }`}
                          >
                            {answers[question.id] === option ? "✓ " : ""}{option}
                          </button>
                        ))}
                      </div>
                      {question.allowCustom && (
                        <input
                          value={answers[question.id] || ""}
                          onChange={(event) => setAnswer(question.id, event.target.value)}
                          placeholder="Or type your own answer"
                          className="mt-2 w-full rounded-xl border border-[#d6e2d8] px-3 py-2.5 text-sm outline-none focus:border-[#3b8a73]"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <button onClick={answerQuestions} disabled={isBusy} className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[#1f6255] px-5 py-4 text-sm font-bold text-white disabled:opacity-60">
                  {isBusy ? "Creating your draft..." : "Continue to draft"}
                </button>
                <button onClick={() => generateDocument("User selected Just draft it without answering additional questions.")} disabled={isBusy} className="mt-3 w-full rounded-2xl border border-[#cbdccf] bg-white px-5 py-3 text-sm font-bold text-[#477366]">
                  Just draft it
                </button>
              </>
            )}

            {screen === "working" && (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#dcebe0] border-t-[#1f6255]" />
                <h3 className="mt-5 text-lg font-bold">Creating your audit draft...</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[#81958b]">
                  We are applying your answers and preparing evidence guidance. This may take a little while.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[#dfe7df] bg-[#edf3ee] p-3 shadow-[0_12px_35px_rgba(34,72,59,0.05)] sm:p-4">
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#87a096]">Step 3</p>
                <h2 className="mt-1 text-xl font-bold">Your document</h2>
              </div>
              {screen === "result" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadWord(documentTitle(), document)}
                    className="rounded-xl border border-[#cbdccf] bg-white px-3 py-2 text-xs font-bold text-[#477366] hover:border-[#1f6255]"
                  >
                    Word
                  </button>
                  <button
                    onClick={() => downloadPdf(documentTitle(), document)}
                    className="rounded-xl border border-[#cbdccf] bg-white px-3 py-2 text-xs font-bold text-[#477366] hover:border-[#1f6255]"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => downloadExcel(documentTitle(), document)}
                    className="rounded-xl border border-[#cbdccf] bg-white px-3 py-2 text-xs font-bold text-[#477366] hover:border-[#1f6255]"
                  >
                    Excel
                  </button>
                </div>
              )}
            </div>

            {screen === "result" && document && (
              <button
                onClick={reviewDraft}
                disabled={isReviewing}
                className="mb-3 w-full rounded-2xl border border-[#b8d1bf] bg-[#f7fbf7] px-5 py-3 text-sm font-bold text-[#2d6c5b] transition hover:border-[#1f6255] disabled:opacity-60"
              >
                {isReviewing
                  ? "Reviewing for audit risks..."
                  : "Review draft before download"}
              </button>
            )}

            {auditReview && screen === "result" && (
              <div className="mb-3 rounded-2xl border border-[#d7e1d8] bg-white p-4 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#789087]">
                      Audit readiness review
                    </p>
                    <p className="mt-1 font-bold text-[#315e53]">{auditReview.summary}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                    auditReview.score >= 80
                      ? "bg-[#e4f4e8] text-[#277052]"
                      : "bg-[#fff3df] text-[#9a681c]"
                  }`}>
                    {auditReview.score}/100 · {auditReview.decision.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-bold text-[#315e53]">Missing evidence</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[#71877c]">
                      {auditReview.missingEvidence.slice(0, 6).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-bold text-[#315e53]">Missing information</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[#71877c]">
                      {auditReview.missingInformation.slice(0, 6).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {auditReview.correctiveActions.length > 0 && (
                  <div className="mt-4 border-t border-[#edf1ed] pt-4">
                    <p className="font-bold text-[#315e53]">Recommended corrective actions</p>
                    <div className="mt-2 space-y-2">
                      {auditReview.correctiveActions.slice(0, 5).map((action, index) => (
                        <div
                          key={`${action.finding}-${index}`}
                          className="rounded-xl bg-[#fbfdfb] p-3 text-xs leading-5 text-[#71877c]"
                        >
                          <strong className="text-[#315e53]">
                            {action.priority.toUpperCase()}:
                          </strong>{" "}
                          {action.action}{" "}
                          <span className="text-[#9aa9a1]">
                            Owner: {action.owner}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {quality && screen === "result" && (
              <div className="mb-3 rounded-2xl border border-[#d7e1d8] bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#789087]">Draft quality check</p>
                    <p className="mt-1 text-sm font-bold text-[#315e53]">
                      {quality.passed ? "Required audit sections found" : "Review missing sections before download"}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-[#e4f4e8] px-3 py-1 text-xs font-bold text-[#277052]">
                    {quality.checks.filter((check) => check.passed).length}/{quality.checks.length} checks passed
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quality.checks.map((check) => (
                    <span key={check.label} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${check.passed ? "bg-[#eef7ef] text-[#39745e]" : "bg-[#fff3df] text-[#9a681c]"}`}>
                      {check.passed ? "✓" : "!"} {check.label}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[#81958b]">
                  {quality.placeholderCount} placeholder{quality.placeholderCount === 1 ? "" : "s"} require company review.
                </p>
              </div>
            )}

            <div className="min-h-[540px] rounded-2xl border border-[#d7e1d8] bg-white p-6 shadow-sm sm:p-9">
              {screen === "result" && document ? (
                <div className="whitespace-pre-wrap font-serif text-[13px] leading-6 text-[#304941] sm:text-sm">
                  {document}
                </div>
              ) : (
                <div className="flex min-h-[470px] flex-col items-center justify-center text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf3eb] text-3xl text-[#5a917e]">▤</div>
                  <h3 className="text-lg font-bold text-[#3e5f54]">
                    {screen === "working" ? "Generating your document..." : "Your draft will appear here"}
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-[#8a9c93]">
                    {screen === "working" ? "The AI is preparing the procedure, evidence list, and readiness matrix." : "Start with a document request on the left."}
                  </p>
                </div>
              )}
            </div>

            {saveMessage && screen === "result" && (
              <div className="mt-3 rounded-xl bg-[#e8f5eb] px-4 py-3 text-sm text-[#287052]">{saveMessage}</div>
            )}

            {screen === "result" && (
              <button onClick={newDraft} className="mt-3 w-full rounded-2xl border border-[#cbdccf] bg-white px-5 py-3 text-sm font-bold text-[#477366]">
                Create another document
              </button>
            )}
          </section>
        </div>
        </section>
      </div>
    </main>
  );
}
