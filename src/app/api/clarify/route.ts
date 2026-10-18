import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type ClarificationQuestion = {
  id: string;
  question: string;
  reason: string;
  options: string[];
  allowCustom: boolean;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_gemini_api_key") {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const documentRequest =
      typeof body.request === "string" ? body.request.trim() : "";
    const companyName =
      typeof body.companyName === "string" ? body.companyName.trim() : "";
    const products =
      typeof body.products === "string" ? body.products.trim() : "";
    const role =
      typeof body.role === "string" ? body.role : "Quality manager";
    const standard =
      typeof body.standard === "string" ? body.standard : "ISO 9001:2015";
    const previousAnswers =
      typeof body.previousAnswers === "string" ? body.previousAnswers : "";

    if (!documentRequest) {
      return NextResponse.json(
        { error: "Please describe the document you need." },
        { status: 400 },
      );
    }

    const normalizedRequest = documentRequest.toLowerCase();
    const justDraft = /just\s+draft|draft\s+it|skip\s+questions/.test(normalizedRequest);
    const hasEquipmentSubject = /\b(cnc|machine|equipment|instrument|gauge|cmm|measuring|calibration|turning|milling|grinding|inspection|supplier|training|nonconformance|corrective action|document control)\b/.test(normalizedRequest);
    const hasSpecificOutput = /\b(procedure|work instruction|checklist|form|register|policy|report|matrix|plan|record)\b/.test(normalizedRequest);
    const isBroadRequest = documentRequest.length < 100 || !hasEquipmentSubject || !hasSpecificOutput;

    if (isBroadRequest && !justDraft && !previousAnswers) {
      return NextResponse.json({
        ready: false,
        questions: [
          {
            id: "document_subject",
            question: "What exactly should the document control?",
            reason: "This prevents us from confusing machine accuracy, measuring equipment, maintenance, and safety controls.",
            options: [
              "CNC machine accuracy and geometry",
              "Measuring instruments used to inspect parts",
              "Both machine accuracy and measuring instruments",
              "Another process or equipment",
            ],
            allowCustom: true,
          },
          {
            id: "audit_standard",
            question: "Which audit or standard applies?",
            reason: "The evidence and clause references depend on the audit scope.",
            options: [
              "ISO 9001 quality audit",
              "ISO 45001 safety audit",
              "IATF 16949 automotive audit",
              "Customer-specific audit",
              "Not sure — use placeholders",
            ],
            allowCustom: true,
          },
          {
            id: "equipment_type",
            question: "What equipment or process is involved?",
            reason: "We will not assume a machine type or measurement system.",
            options: [
              "CNC milling",
              "CNC turning",
              "CMM or inspection equipment",
              "Other manufacturing process",
              "Not applicable",
            ],
            allowCustom: true,
          },
          {
            id: "verification_method",
            question: "How is it currently verified or controlled?",
            reason: "This helps the draft match your actual operation.",
            options: [
              "Internal team",
              "OEM or service provider",
              "External calibration laboratory",
              "Not yet defined",
            ],
            allowCustom: true,
          },
          {
            id: "desired_output",
            question: "What do you want to create?",
            reason: "A procedure, register, form, and audit checklist have different structures.",
            options: [
              "Controlled procedure",
              "Checklist",
              "Register or log",
              "Form or record template",
              "Complete audit package",
            ],
            allowCustom: true,
          },
        ],
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are the clarification step of Audit Copilot, a manufacturing audit-document assistant.

Decide whether the request has enough information to create a useful first draft.
Ask questions only when missing information would materially change the document. Do not ask for information that can safely be represented with a [PLACEHOLDER]. Ask no more than 5 questions and no more than 3 rounds.

Return ONLY valid JSON with this exact shape:
{
  "ready": true or false,
  "questions": [
    {
      "id": "short_snake_case_id",
      "question": "short question",
      "reason": "one short reason",
      "options": ["option 1", "option 2"],
      "allowCustom": true or false
    }
  ]
}

Rules:
- If ready is true, questions must be [].
- If the user says "just draft it", ready must be true.
- Prefer 2 to 5 useful tap-to-answer options.
- Never ask for passwords, API keys, confidential secrets, or signatures.
- Do not provide the document in this response.
- The final document will be reviewed and approved by the company.

Document request: ${documentRequest}
Company name: ${companyName || "[not provided]"}
Products or processes: ${products || "[not provided]"}
User role: ${role}
Applicable standard: ${standard}
Previous answers: ${previousAnswers || "[none]"}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        maxOutputTokens: 1200,
      },
    });

    const raw = response.text?.trim() || "";
    const parsed = JSON.parse(raw) as {
      ready?: boolean;
      questions?: ClarificationQuestion[];
    };

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.slice(0, 5).map((question, index) => ({
          id: String(question.id || `question_${index + 1}`),
          question: String(question.question || "Please provide more detail."),
          reason: String(question.reason || ""),
          options: Array.isArray(question.options)
            ? question.options.slice(0, 6).map(String)
            : [],
          allowCustom: Boolean(question.allowCustom),
        }))
      : [];

    return NextResponse.json({
      ready: Boolean(parsed.ready) || questions.length === 0,
      questions,
    });
  } catch (error) {
    console.error("Clarification error:", error);
    return NextResponse.json(
      { error: "Questions could not be prepared. You can choose Just draft it." },
      { status: 500 },
    );
  }
}
