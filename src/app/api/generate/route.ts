import { NextResponse } from "next/server";
import { validateDocument } from "@/lib/document-validator";

export const maxDuration = 60;

const SYSTEM_INSTRUCTION = `You are Audit Copilot, an assistant for manufacturing quality and audit documentation.
Create a practical, editable first draft. Never invent company-specific evidence, results, approvals, names, dates, IDs, or signatures. Use clear [PLACEHOLDER] markers for missing facts. Do not reproduce copyrighted standard text. If a standard is mentioned, refer to relevant clauses only when reasonably confident.
Every draft must contain:
1. A title.
2. A document control table with document number, revision, standard and edition, effective date, prepared by, reviewed by, and approved by.
3. Appropriate sections for the document type.
4. Realistic simple tables when useful.
5. A section titled "Audit Evidence Needed" listing the objective records, labels, logs, training records, approvals, or other evidence a real auditor may ask to see. Never claim that evidence exists.
6. A section titled "Implementation Checklist" with manual checkboxes. Every item must begin unchecked as [ ].
7. A section titled "Audit Readiness Matrix" with columns Requirement, Company process, Required evidence, Owner, and Status. Use "Not started" as the default status.
8. A section titled "Assumptions made in this draft".
9. This disclaimer exactly: "AI DRAFT — Review, complete, and approve this document before use."

Clearly distinguish requirements, company-defined methods, assumptions, placeholders, and evidence still to be created. Never mark an item complete automatically. Never invent company-specific evidence, results, approvals, names, dates, IDs, or signatures. Use clear [PLACEHOLDER] markers for missing facts. Do not reproduce copyrighted standard text. If a standard is mentioned, refer to relevant clauses only when reasonably confident.
Use plain professional language suitable for a small or medium-sized manufacturing company. Keep the draft practical and concise enough to review. Return only the document draft, not commentary about your process.`;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/[^\x00-\xFF]/g, "");

    if (!apiKey || apiKey === "your_gemini_api_key") {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const requestText =
      typeof body.request === "string" ? body.request.trim() : "";
    const companyName =
      typeof body.companyName === "string" ? body.companyName.trim() : "";
    const products =
      typeof body.products === "string" ? body.products.trim() : "";
    const previousAnswers =
      typeof body.previousAnswers === "string" ? body.previousAnswers.trim() : "";
    const uploadedContext =
      typeof body.uploadedContext === "string" ? body.uploadedContext.trim().slice(0, 30000) : "";
    const role =
      typeof body.role === "string" ? body.role : "Quality manager";
    const language =
      typeof body.language === "string" ? body.language : "English";
    const standard =
      typeof body.standard === "string" ? body.standard : "ISO 9001:2015";

    if (!requestText) {
      return NextResponse.json(
        { error: "Please describe the document you need." },
        { status: 400 },
      );
    }

    if (requestText.length > 4000) {
      return NextResponse.json(
        { error: "Please keep the request under 4,000 characters." },
        { status: 400 },
      );
    }

    const prompt = `${SYSTEM_INSTRUCTION}

IMPORTANT REQUEST-SPECIFIC RULES:
- The current user request below is authoritative and must control the document subject, process, industry, and examples.
- Do not reuse the CNC calibration example or any previous request unless the current user explicitly asks for it.
- Before drafting, silently identify the requested document type and write only for that request.
- If the request is about suppliers, write a supplier document; if it is about training, write a training document; if it is about maintenance, write a maintenance document, and so on.

User role: ${role}
Output language: ${language}
Applicable standard: ${standard}
Company name: ${companyName || "[COMPANY NAME NOT PROVIDED]"}
Products or processes: ${products || "[PRODUCTS OR PROCESSES NOT PROVIDED]"}
Document request: ${requestText}
Additional user answers: ${previousAnswers || "[none]"}
Uploaded reference material:
${uploadedContext || "[none uploaded]"}
Use uploaded material as reference context only. Do not treat it as proof that records or processes actually exist. Do not claim that an uploaded draft is approved or current.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let providerResponse: Response | null = null;
    try {
      providerResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 5000 },
          }),
          signal: controller.signal,
        },
      );
    } catch (providerError) {
      console.error("Gemini request failed:", providerError instanceof Error ? providerError.message : "unknown error");
    } finally {
      clearTimeout(timeout);
    }

    if (!providerResponse || !providerResponse.ok) {
      const providerBody = providerResponse ? await providerResponse.text() : "Gemini request timed out";
      console.error("Gemini provider rejected request:", providerResponse?.status || "timeout", providerBody.slice(0, 500));
      const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim().replace(/[^\x00-\xFF]/g, "");
      if (deepseekKey) {
        try {
          const fallback = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekKey}` },
            body: JSON.stringify({ model: "deepseek-chat", temperature: 0.2, messages: [{ role: "system", content: "Return only the requested audit document. Follow the user's current subject exactly. Never reuse a CNC example unless requested." }, { role: "user", content: prompt }] }),
          });
          if (fallback.ok) {
            const fallbackData = await fallback.json();
            const fallbackDocument = fallbackData.choices?.[0]?.message?.content?.trim();
            if (fallbackDocument) return NextResponse.json({ document: fallbackDocument, quality: validateDocument(fallbackDocument), provider: "fallback" });
          }
        } catch (fallbackError) {
          console.error("Fallback generation failed:", fallbackError instanceof Error ? fallbackError.message : "unknown error");
        }
      }
      return NextResponse.json({ error: "The document provider is temporarily unavailable. Please try again in a moment." }, { status: 503 });
    }

    const providerData = await providerResponse.json();
    const document = providerData.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!document) {
      return NextResponse.json(
        { error: "The AI returned an empty draft. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ document, quality: validateDocument(document) });
  } catch (error) {
    console.error("Gemini generation error:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      {
        error:
          "The document could not be generated right now. Please try again.",
      },
      { status: 500 },
    );
  }
}
