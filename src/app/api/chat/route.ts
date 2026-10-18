import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const CHAT_RULES = `You are Audit Copilot, a friendly audit-preparation assistant for beginners in manufacturing.

Answer the user's question in simple, practical English. Use the supplied document and review context when available.

You can explain:
- What a document section means
- What an auditor may ask
- What evidence the company should collect
- What a missing record means
- What corrective action to take
- The difference between a procedure, form, register, record, and evidence

Rules:
- Never claim that the company passes an audit.
- Never claim that evidence exists unless the user explicitly provided it.
- Never invent names, dates, signatures, results, certificates, tolerances, intervals, approvals, or records.
- If information is missing, say so and ask a short follow-up question.
- If the user asks for a document change, describe the change and offer to regenerate the draft.
- Distinguish ISO 9001 quality controls from ISO 45001 safety controls.
- Do not reproduce copyrighted standard text.
- Recommend review and approval by the user's company.
- Keep answers concise, clear, and useful.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const document = typeof body.document === "string" ? body.document.slice(0, 40000) : "";
    const review = typeof body.review === "string" ? body.review.slice(0, 12000) : "";
    const companyContext = typeof body.companyContext === "string" ? body.companyContext.slice(0, 12000) : "";

    if (!message) {
      return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
    }

    const prompt = `${CHAT_RULES}

COMPANY CONTEXT:
${companyContext || "[not provided]"}

CURRENT DOCUMENT:
${document || "[no document selected]"}

AUDIT REVIEW:
${review || "[no review completed]"}

USER QUESTION:
${message}`;

    if (process.env.DEEPSEEK_API_KEY) {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-flash",
          temperature: 0.2,
          messages: [
            { role: "system", content: CHAT_RULES },
            { role: "user", content: prompt },
          ],
        } ),
      });

      if (response.ok) {
        const result = await response.json();
        const answer = result.choices?.[0]?.message?.content?.trim();

        if (answer) {
          return NextResponse.json({ answer });
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_gemini_api_key") {
      return NextResponse.json(
        { error: "The chat assistant is not configured on the server." },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 1800,
      },
    });

    const answer = result.text?.trim();

    if (!answer) {
      return NextResponse.json(
        { error: "The assistant returned an empty answer." },
        { status: 502 },
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Audit chat error:", error);
    return NextResponse.json(
      { error: "The assistant could not answer right now. Please try again." },
      { status: 500 },
    );
  }
}
