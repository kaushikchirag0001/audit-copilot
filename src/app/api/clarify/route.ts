import { NextResponse } from "next/server";

type ClarificationQuestion = {
  id: string;
  question: string;
  reason: string;
  options: string[];
  allowCustom: boolean;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The clarification provider returned invalid JSON.");
  }
}

function fallbackQuestions(request: string, standard: string): ClarificationQuestion[] {
  const lower = request.toLowerCase();
  const subject = lower.includes("supplier") ? "supplier or external provider" : lower.includes("training") ? "training process" : lower.includes("maintenance") ? "maintenance process" : lower.includes("audit") ? "audit process" : "process or activity";
  return [
    { id: "purpose", question: `What should this document control in your ${subject}?`, reason: "This keeps the draft focused on the work you actually perform.", options: ["How the work is performed", "How the work is checked", "Both the work and its checks", "Not sure — use placeholders"], allowCustom: true },
    { id: "standard", question: "Which audit, customer, or standard should it support?", reason: "The evidence and terminology depend on the audit scope.", options: [standard || "ISO 9001:2015", "ISO 45001 safety audit", "Customer-specific audit", "Not sure — use placeholders"], allowCustom: true },
    { id: "current_method", question: "How is this currently handled at your company?", reason: "The draft should improve your real method rather than invent one.", options: ["We have a documented method", "People follow an informal method", "It is partly implemented", "It has not been defined yet"], allowCustom: true },
    { id: "evidence", question: "What records or evidence do you currently have?", reason: "An auditor will usually ask for objective evidence that the process operates.", options: ["Logs or registers", "Forms and completed records", "Approvals and training records", "Nothing available yet"], allowCustom: true },
    { id: "output", question: "What would be most useful to receive?", reason: "A procedure, checklist, form, and evidence plan have different formats.", options: ["Controlled procedure", "Checklist or audit tool", "Form, register, or template", "Complete audit-ready package"], allowCustom: true },
  ];
}

function normalizeQuestions(value: unknown): ClarificationQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((question, index) => {
    const item = question as Record<string, unknown>;
    return {
      id: clean(item.id) || `question_${index + 1}`,
      question: clean(item.question) || "Please provide more detail.",
      reason: clean(item.reason),
      options: Array.isArray(item.options) ? item.options.slice(0, 6).map(String) : [],
      allowCustom: Boolean(item.allowCustom),
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const documentRequest = clean(body.request);
    const companyName = clean(body.companyName);
    const products = clean(body.products);
    const role = clean(body.role) || "Quality manager";
    const standard = clean(body.standard) || "ISO 9001:2015";
    const previousAnswers = clean(body.previousAnswers);
    const uploadedContext = clean(body.uploadedContext).slice(0, 12000);

    if (!documentRequest) return NextResponse.json({ error: "Please describe the document you need." }, { status: 400 });
    if (/just\s+draft|draft\s+it|skip\s+questions/i.test(documentRequest)) return NextResponse.json({ ready: true, questions: [] });

    const groqKey = process.env.GROQ_API_KEY?.trim().replace(/[^\x00-\xFF]/g, "");
    if (groqKey) {
      const prompt = `You are the clarification assistant for Audit Copilot. Ask only the smallest number of questions needed to create a useful manufacturing audit document. Never assume CNC, calibration, suppliers, or any other subject unless the current request says so. Return only valid JSON with {"ready":boolean,"questions":[{"id":string,"question":string,"reason":string,"options":string[],"allowCustom":boolean}]}. Ask at most 5 questions. Use plain English for beginners. A question may be omitted when a [PLACEHOLDER] is safe. Never ask for passwords, API keys, secrets, or signatures. Current request: ${documentRequest}\nCompany: ${companyName || "not provided"}\nProducts/processes: ${products || "not provided"}\nRole: ${role}\nStandard: ${standard}\nPrevious answers: ${previousAnswers || "none"}\nUploaded reference summary: ${uploadedContext || "none"}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({ model: "openai/gpt-oss-120b", temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return JSON only." }, { role: "user", content: prompt }] }),
          signal: controller.signal,
        });
        if (response.ok) {
          const result = await response.json();
          const parsed = parseJsonObject(result.choices?.[0]?.message?.content || "{}");
          const questions = normalizeQuestions(parsed.questions);
          return NextResponse.json({ ready: Boolean(parsed.ready) || questions.length === 0, questions });
        }
      } finally { clearTimeout(timer); }
    }

    const broad = documentRequest.length < 90 || !/\b(procedure|work instruction|checklist|form|register|policy|report|matrix|plan|record|template)\b/i.test(documentRequest) || !previousAnswers;
    return NextResponse.json({ ready: !broad || Boolean(previousAnswers), questions: broad && !previousAnswers ? fallbackQuestions(documentRequest, standard) : [] });
  } catch (error) {
    console.error("Clarification error:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Questions could not be prepared. You can choose Just draft it." }, { status: 500 });
  }
}
