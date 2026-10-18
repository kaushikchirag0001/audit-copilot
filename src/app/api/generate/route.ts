import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { validateDocument } from "@/lib/document-validator";


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
    const apiKey = process.env.GEMINI_API_KEY;

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

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${SYSTEM_INSTRUCTION}

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

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        temperature: 0.25,
        maxOutputTokens: 5000,
      },
    });

    const document = response.text?.trim();

    if (!document) {
      return NextResponse.json(
        { error: "The AI returned an empty draft. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ document, quality: validateDocument(document) });
  } catch (error) {
    console.error("Gemini generation error:", error);
    return NextResponse.json(
      {
        error:
          "The document could not be generated right now. Please try again.",
      },
      { status: 500 },
    );
  }
}
