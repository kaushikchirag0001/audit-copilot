"use client";

import { FormEvent, useState } from "react";
import { MessageCircle, X, Send, Sparkles, RotateCcw } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AuditChatProps = {
  document: string;
  review: unknown;
  companyContext: string;
};

const suggestions = [
  "What should I show the auditor?",
  "Explain this document simply.",
  "What evidence is missing?",
  "What should I do first?",
];

export default function AuditChat({
  document,
  review,
  companyContext,
}: AuditChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi. I can explain this document, tell you what evidence an auditor may ask for, and help you decide what to do next.",
    },
  ]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();

    const question = message.trim();
    if (!question || busy) return;

    setMessage("");
    setError("");
    setMessages((current) => [
      ...current,
      { role: "user", content: question },
    ]);
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          document,
          review: review ? JSON.stringify(review) : "",
          companyContext,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The assistant could not answer.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer },
      ]);
    } catch (chatError) {
      setError(
        chatError instanceof Error
          ? chatError.message
          : "The assistant could not answer right now.",
      );
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        role: "assistant",
        content:
          "Chat cleared. Ask me what you want to understand or prepare next.",
      },
    ]);
    setError("");
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#1f6255] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(31,98,85,0.28)] transition hover:bg-[#174d43] hover:shadow-[0_12px_35px_rgba(31,98,85,0.38)]"
          aria-label="Open Audit AI chat"
        >
          <MessageCircle size={18} />
          <span className="hidden sm:inline">Chat with Audit AI</span>
          <span className="sm:hidden">AI Chat</span>
        </button>
      )}

      {isOpen && (
        <>
          <button
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-[#173b35]/20"
            aria-label="Close Audit AI chat"
          />

          <section className="fixed bottom-0 right-0 z-50 flex h-[min(720px,100vh)] w-full flex-col border-l border-[#dce7df] bg-white shadow-[-12px_0_40px_rgba(34,72,59,0.16)] sm:bottom-5 sm:right-5 sm:h-[min(680px,calc(100vh-40px))] sm:w-[430px] sm:rounded-3xl sm:border">
            <header className="flex items-center justify-between border-b border-[#e8efe9] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e5f1e9] text-[#1f6255]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#244c41]">
                    Chat with Audit AI
                  </h2>
                  <p className="text-[11px] text-[#81958b]">
                    Explanations, evidence, and next steps
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="rounded-lg p-2 text-[#81958b] hover:bg-[#f1f7f2] hover:text-[#1f6255]"
                  title="Clear chat"
                  aria-label="Clear chat"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-[#81958b] hover:bg-[#f1f7f2] hover:text-[#1f6255]"
                  title="Close chat"
                  aria-label="Close chat"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {!document && (
              <div className="mx-5 mt-4 rounded-xl bg-[#f7faf7] p-3 text-xs leading-5 text-[#71877c]">
                Create a document first for document-specific answers. You can still ask general audit questions.
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.map((chatMessage, index) => (
                <div
                  key={`${chatMessage.role}-${index}`}
                  className={`flex ${
                    chatMessage.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                      chatMessage.role === "user"
                        ? "bg-[#1f6255] text-white"
                        : "border border-[#dfe7df] bg-[#f7faf7] text-[#405d53]"
                    }`}
                  >
                    {chatMessage.content}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="text-sm text-[#81958b]">
                  Audit AI is thinking...
                </div>
              )}
            </div>

            <div className="border-t border-[#e8efe9] p-4">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setMessage(suggestion)}
                    className="shrink-0 rounded-full border border-[#d6e2d8] bg-[#fbfdfb] px-3 py-2 text-[11px] font-semibold text-[#477366] hover:border-[#71a58f]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Ask about your audit..."
                  className="min-w-0 flex-1 rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !message.trim()}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1f6255] text-white hover:bg-[#174d43] disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send size={17} />
                </button>
              </form>
            </div>
          </section>
        </>
      )}
    </>
  );
}
