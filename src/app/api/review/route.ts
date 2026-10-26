import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const REVIEW_PROMPT = `You are the audit-quality reviewer for Audit Copilot.

Review the supplied manufacturing audit document as a strict internal auditor. Your job is not to rewrite the document. Identify whether it is useful for audit preparation and whether it contains unsupported claims.

Return ONLY valid JSON with this exact shape:
{
  "score": 0,
  "decision": "ready_for_internal_review",
  "summary": "short overall assessment",
  "criticalRisks": ["risk"],
  "missingEvidence": ["evidence item"],
  "missingInformation": ["information the company must provide"],
  "unsupportedAssumptions": ["assumption"],
  "correctiveActions": [
    {
      "finding": "short finding",
      "action": "specific action",
      "owner": "suggested role",
      "priority": "high"
    }
  ],
  "questionsForUser": ["question"]
}

Rules:
- score is an integer from 0 to 100.
- decision must be one of: ready_for_internal_review, needs_company_input, high_risk.
- Never say the company passes an audit.
- Never treat a procedure as proof that it is implemented.
- Never treat a listed record as proof that the record exists.
- Flag invented machine types, standards, tolerances, intervals, providers, approvals, names, dates, results, or signatures.
- Flag when the document confuses calibration of measuring equipment with maintenance or geometric verification of a machine.
- Flag references to standards that may not match the document subject.
- Be practical and concise.
- A document with many placeholders can still be useful, but it needs company input before approval.`;

function cleanJson(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const document = typeof body.document === "string" ? body.document.trim() : "";
    const provider = body.provider === "groq" ? "groq" : "gemini";

    if (!document) {
      return NextResponse.json({ error: "A document is required." }, { status: 400 });
    }

    if (document.length > 50000) {
      return NextResponse.json({ error: "The document is too long to review." }, { status: 400 });
    }

    const prompt = `${REVIEW_PROMPT}

DOCUMENT TO REVIEW:
${document}`;

    let raw = "";

    if (provider === "groq" && process.env.GROQ_API_KEY?.trim().replace(/[^\x00-\xFF]/g, "")) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY?.trim().replace(/[^\x00-\xFF]/g, "")}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          messages: [
            { role: "system", content: REVIEW_PROMPT },
            { role: "user", content: document },
          ],
        } ),
      });

      if (!response.ok) {
        throw new Error(`Groq review failed with status ${response.status}`);
      }

      const result = await response.json();
      raw = result.choices?.[0]?.message?.content || "";
    } else {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "your_gemini_api_key") {
        return NextResponse.json(
          { error: "No review model is configured on the server." },
          { status: 500 },
        );
      }

      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          maxOutputTokens: 2500,
        },
      });

      raw = result.text || "";
    }

    const review = JSON.parse(cleanJson(raw));

    return NextResponse.json({
      provider: provider === "groq" && process.env.GROQ_API_KEY?.trim().replace(/[^\x00-\xFF]/g, "") ? "groq" : "gemini",
      review,
    });
  } catch (error) {
    console.error("Audit review error:", error);
    return NextResponse.json(
      { error: "The audit review could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
