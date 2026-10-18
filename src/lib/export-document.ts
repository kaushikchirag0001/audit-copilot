import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

function safeName(title: string) {
  return (
    title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "audit-document"
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadWord(title: string, content: string) {
  const paragraphs = content.split(/\n/).map((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return new Paragraph({ text: "" });
    }

    if (trimmed.startsWith("# ")) {
      return new Paragraph({
        text: trimmed.replace(/^# /, ""),
        heading: HeadingLevel.TITLE,
      });
    }

    if (trimmed.startsWith("## ")) {
      return new Paragraph({
        text: trimmed.replace(/^## /, ""),
        heading: HeadingLevel.HEADING_1,
      });
    }

    if (trimmed.startsWith("### ")) {
      return new Paragraph({
        text: trimmed.replace(/^### /, ""),
        heading: HeadingLevel.HEADING_2,
      });
    }

    return new Paragraph({
      children: [
        new TextRun({
          text: line.replace(/\*\*/g, "").replace(/`/g, ""),
          bold: line.includes("**"),
        }),
      ],
      spacing: { after: 100 },
    });
  });

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(blob, `${safeName(title)}.docx`);
}

export function downloadPdf(title: string, content: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const lines = content
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .split("\n");

  let y = margin;

  for (const line of lines) {
    const isHeading = /^#{1,3}\s/.test(line.trim());
    const fontSize = isHeading ? (line.startsWith("# ") ? 16 : 12) : 9;
    const fontStyle = isHeading ? "bold" : "normal";

    pdf.setFont("helvetica", fontStyle);
    pdf.setFontSize(fontSize);

    const wrapped = pdf.splitTextToSize(
      line.replace(/^#{1,3}\s/, "") || " ",
      usableWidth,
    );

    for (const wrappedLine of wrapped) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }

      pdf.text(wrappedLine, margin, y);
      y += isHeading ? 18 : 13;
    }

    y += isHeading ? 5 : 2;
  }

  pdf.save(`${safeName(title)}.pdf`);
}

export function downloadExcel(title: string, content: string) {
  const rows = content.split("\n").map((line) => [line]);
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Audit Copilot document"],
    ["Title", title],
    [],
    ...rows,
  ]);

  worksheet["!cols"] = [{ wch: 110 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Document");
  XLSX.writeFile(workbook, `${safeName(title)}.xlsx`);
}
