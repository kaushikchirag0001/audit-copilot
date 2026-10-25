import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportServerError } from "@/lib/server-error";

const SYSTEM = `You are Audit Copilot, a careful manufacturing audit-preparation assistant.
Never claim a company passes an audit. Never invent evidence, records, approvals, names, dates, measurements, or results. Use [COMPANY INPUT REQUIRED] when information is missing. Do not reproduce copyrighted standard text. Distinguish a planned document from proof that a process is implemented. For regulatory work, tell the user to verify current legal requirements. Return only valid JSON.`;

const SHAPES: Record<string, string> = {
  gap: `{"title":"","summary":"","readinessScore":0,"items":[{"reference":"","requirement":"","classification":"Covered|Partially covered|Missing|Not applicable","evidenceFound":"","evidenceMissing":"","reason":"","suggestedFix":"","priority":"Low|Medium|High|Critical","owner":"","dueDate":""}]}`,
  readiness: `{"title":"","items":[{"category":"Document|Evidence|Record|People|Process|Other","item":"","whyItMatters":"","status":"Missing|Requested|Available|Verified|Not applicable","suggestedOwner":"","suggestedDueDate":""}]}`,
  mock: `{"title":"","questions":[{"question":"","whatTheAuditorIsChecking":"","evidenceToShow":"","commonWeakAnswer":"","followUpQuestion":""}]}`,
  finding: `{"title":"","correction":"","rootCause":"","fiveWhy":[""],"fishbonePrompts":{"people":"","method":"","machine":"","material":"","measurement":"","environment":""},"correctiveAction":"","evidenceList":[""],"effectivenessCheck":""}`,
  closure: `{"title":"","coveringLetter":"","findingSummary":"","evidenceIndex":[{"finding":"","evidence":"","owner":"","status":""}],"submissionChecklist":[""]}`,
  checklist: `{"title":"","auditPlan":{"scope":"","objectives":"","areas":[""],"auditDates":""},"checklist":[{"area":"","question":"","evidenceToSample":"","result":"Open"}],"reportSections":[""]}`,
  supplier: `{"title":"","checklist":[{"area":"","question":"","evidenceToRequest":"","score":"Not scored"}],"evaluationForm":[""],"correctiveActionRequest":"","followUpVerification":[""]}`,
};

function clean(value: string) {
  return value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "audit-tools", 12);
    if (!rate.allowed) return NextResponse.json({ error: "Too many audit-tool requests. Please wait and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const body = await request.json();
    const mode = typeof body.mode === "string" ? body.mode : "";
    const input = typeof body.input === "string" ? body.input.trim() : "";
    const context = typeof body.context === "string" ? body.context.trim() : "";
    if (!SHAPES[mode]) return NextResponse.json({ error: "Unknown audit tool." }, { status: 400 });
    if (!input) return NextResponse.json({ error: "Describe what you want to prepare." }, { status: 400 });
    if (input.length > 30000 || context.length > 50000) return NextResponse.json({ error: "The request is too large." }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "The audit assistant is not configured on the server." }, { status: 500 });
    const prompt = `${SYSTEM}\n\nTOOL: ${mode}\n\nCONTEXT:\n${context || "[COMPANY INPUT REQUIRED]"}\n\nREQUEST:\n${input}\n\nReturn JSON matching exactly:\n${SHAPES[mode]}`;
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({ model: "gemini-3.8-flash", contents: prompt, config: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 6000 } });
    return NextResponse.json({ mode, result: JSON.parse(clean(result.text || "")) });
  } catch (error) {
    await reportServerError("audit-tools", error);
    return NextResponse.json({ error: "The audit tool could not complete the request. Please try again." }, { status: 500 });
  }
}
