import mammoth from "mammoth";
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".xls", ".txt", ".csv"]);

function extensionOf(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function limitText(text: string) {
  return text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim().slice(0, 30000);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please choose a file." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Please upload a file smaller than 5 MB." }, { status: 400 });
    }

    const extension = extensionOf(file.name);

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Supported files are PDF, DOCX, XLSX, XLS, TXT, and CSV." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (extension === ".pdf") {
      const result = await pdfParse(buffer);
      text = result.text;
    } else if (extension === ".docx") {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (extension === ".xlsx" || extension === ".xls") {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      text = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        return `SHEET: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}`;
      }).join("\n\n");
    } else {
      text = buffer.toString("utf8");
    }

    const extractedText = limitText(text);

    if (!extractedText) {
      return NextResponse.json(
        { error: "No readable text was found in that file." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      fileName: file.name,
      characters: extractedText.length,
      text: extractedText,
      truncated: text.length > extractedText.length,
    });
  } catch (error) {
    console.error("File extraction error:", error);
    return NextResponse.json(
      { error: "The file could not be read. Try another file format." },
      { status: 500 },
    );
  }
}
