export type DocumentQuality = {
  passed: boolean;
  checks: { label: string; passed: boolean }[];
  placeholderCount: number;
};

const requiredSections = [
  { label: "Document control", patterns: ["document control"] },
  { label: "Purpose", patterns: ["purpose"] },
  { label: "Scope", patterns: ["scope"] },
  { label: "Responsibilities", patterns: ["responsibilit"] },
  { label: "Procedure or requirements", patterns: ["procedure", "requirements"] },
  { label: "Records", patterns: ["records", "retained documented information"] },
  { label: "Audit evidence", patterns: ["audit evidence"] },
  { label: "Implementation checklist", patterns: ["implementation checklist"] },
  { label: "Audit readiness matrix", patterns: ["audit readiness matrix"] },
  { label: "Assumptions", patterns: ["assumptions made"] },
  { label: "AI disclaimer", patterns: ["ai draft"] },
];

export function validateDocument(document: string): DocumentQuality {
  const normalized = document.toLowerCase();

  const checks = requiredSections.map(({ label, patterns }) => ({
    label,
    passed: patterns.some((pattern) => normalized.includes(pattern)),
  }));

  const placeholderCount = (document.match(/\[([^\]]+)\]/g) || []).length;

  return {
    passed: checks.every((check) => check.passed),
    checks,
    placeholderCount,
  };
}
