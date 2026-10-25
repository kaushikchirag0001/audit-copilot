import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportServerError } from "@/lib/server-error";

const RULES = `You are Audit Copilot conducting a beginner-friendly manufacturing mock audit. Never claim the company passes. Never invent evidence or results. Distinguish a procedure from proof that it is implemented. Ask for objective evidence when the user gives only a verbal answer. Use simple English. Return only valid JSON in this shape: {"question":"","evaluation":"","strengths":[""],"evidenceNeeded":[""],"risk":"Low|Medium|High","followUp":"","score":0,"finished":false}. score is an internal practice score from 0 to 100, not a certification result. Set finished true only when the user has answered the current question and no essential follow-up is needed.`;

function clean(value: string) { return value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim(); }

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "mock-audit", 15);
    if (!rate.allowed) return NextResponse.json({ error: "Too many mock-audit requests. Please wait and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const body = await request.json();
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    const history = typeof body.history === "string" ? body.history.slice(0, 30000) : "";
    const context = typeof body.context === "string" ? body.context.slice(0, 20000) : "";
    if (!topic) return NextResponse.json({ error: "Choose an audit topic first." }, { status: 400 });
    if (topic.length > 3000 || answer.length > 12000) return NextResponse.json({ error: "The mock-audit response is too long." }, { status: 400 });
    const prompt = `${RULES}\n\nAUDIT TOPIC:\n${topic}\n\nCOMPANY CONTEXT:\n${context || "[not provided]"}\n\nPREVIOUS SESSION:\n${history || "No answer yet. Ask the first practical auditor question."}\n\nCURRENT USER ANSWER:\n${answer || "[no answer yet]"}`;
    let raw = "";
    if (process.env.DEEPSEEK_API_KEY?.trim().replace(/[^\x00-\xFF]/g, "")) {
      const response = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY?.trim().replace(/[^\x00-\xFF]/g, "")}` }, body: JSON.stringify({ model: "deepseek-chat", temperature: 0.1, messages: [{ role: "system", content: RULES }, { role: "user", content: prompt }] }) });
      if (response.ok) { const result = await response.json(); raw = result.choices?.[0]?.message?.content || ""; }
    }
    if (!raw) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "The audit assistant is not configured on the server." }, { status: 500 });
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({ model: "gemini-3.8-flash", contents: prompt, config: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 2200 } });
      raw = result.text || "";
    }
    return NextResponse.json({ result: JSON.parse(clean(raw)) });
  } catch (error) {
    await reportServerError("mock-audit", error);
    return NextResponse.json({ error: "The mock audit could not continue. Please try again." }, { status: 500 });
  }
}
