"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DocumentRow = {
  id: string;
  title: string;
  request: string;
  content: string;
  document_type: string | null;
  standard: string | null;
  created_at: string;
  updated_at: string;
};

function downloadText(document: DocumentRow) {
  const blob = new Blob([document.content], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${document.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "audit-document"}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocuments() {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.replace("/auth");
        return;
      }

      const { data, error: queryError } = await supabase
        .from("documents")
        .select("id, title, request, content, document_type, standard, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (queryError) {
        setError(queryError.message);
      } else {
        setDocuments((data || []) as DocumentRow[]);
      }

      setLoading(false);
    }

    loadDocuments();
  }, [router, supabase]);

  async function deleteDocument(id: string) {
    const confirmed = window.confirm(
      "Delete this saved document? This action cannot be undone.",
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError("");

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setDocuments((current) => current.filter((document) => document.id !== id));
    }

    setDeletingId(null);
  }

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return documents;

    return documents.filter((document) =>
      [document.title, document.request, document.content, document.standard]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [documents, search]);

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#173b35]">
      <header className="border-b border-[#dfe7df] bg-[#fbfcfa]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="rounded-full border border-[#cfddd3] bg-white px-3 py-2 text-lg font-bold text-[#315e53] hover:border-[#1f6255]"
              aria-label="Back to workspace"
            >
              ←
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-3"
            >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f6255] text-lg font-bold text-white">
              A
            </div>
            <div className="text-left">
              <div className="text-[17px] font-bold tracking-tight">Audit Copilot</div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#769087]">
                Document history
              </div>
            </div>
            </button>
          </div>

          <button
            onClick={() => router.push("/")}
            className="rounded-full border border-[#cfddd3] bg-white px-4 py-2 text-sm font-semibold text-[#315e53]"
          >
            New document
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#87a096]">
            Your workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
            Saved documents
          </h1>
          <p className="mt-2 text-[#6c7e76]">
            Search and download drafts created in your account.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, request, standard, or document text..."
            className="min-w-0 flex-1 rounded-2xl border border-[#d6e2d8] bg-white px-4 py-3 text-sm outline-none focus:border-[#3b8a73] focus:ring-4 focus:ring-[#dff0e5]"
          />
          <div className="rounded-2xl bg-[#e5f1e9] px-4 py-3 text-center text-sm font-bold text-[#2d6c5b]">
            {filteredDocuments.length} document{filteredDocuments.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading && (
          <div className="rounded-3xl border border-[#dfe7df] bg-white p-8 text-center text-sm text-[#71877c]">
            Loading your documents...
          </div>
        )}

        {error && (
          <div className="rounded-3xl bg-red-50 p-5 text-sm text-red-700">
            Could not load your documents: {error}
          </div>
        )}

        {!loading && !error && filteredDocuments.length === 0 && (
          <div className="rounded-3xl border border-[#dfe7df] bg-white p-10 text-center">
            <div className="text-3xl text-[#5a917e]">▤</div>
            <h2 className="mt-3 text-lg font-bold">
              {documents.length ? "No matching documents" : "No saved documents yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#81958b]">
              {documents.length
                ? "Try a different search term."
                : "Create your first audit document and it will appear here."}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {filteredDocuments.map((document) => (
            <article
              key={document.id}
              className="rounded-3xl border border-[#dfe7df] bg-white p-5 shadow-[0_8px_25px_rgba(34,72,59,0.04)] sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-[#244c41]">
                    {document.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#71877c]">
                    {document.request}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-[#eef7ef] px-3 py-1 font-semibold text-[#39745e]">
                      {document.standard || "Standard not specified"}
                    </span>
                    <span className="rounded-full bg-[#f1f5f1] px-3 py-1 text-[#71877c]">
                      {new Date(document.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => downloadText(document)}
                    className="rounded-xl bg-[#1f6255] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#174d43]"
                  >
                    Download TXT
                  </button>
                  <button
                    onClick={() => deleteDocument(document.id)}
                    disabled={deletingId === document.id}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Delete document"
                  >
                    {deletingId === document.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>

              <details className="mt-5 border-t border-[#edf1ed] pt-4">
                <summary className="cursor-pointer text-sm font-bold text-[#477366]">
                  Preview document
                </summary>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#fbfdfb] p-4 font-serif text-xs leading-6 text-[#304941]">
                  {document.content}
                </pre>
              </details>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
