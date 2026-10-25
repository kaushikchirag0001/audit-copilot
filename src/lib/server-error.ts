export async function reportServerError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown server error";
  const safeMessage = message.replace(/(api[_-]?key|authorization|bearer|token|password)\s*[:=]\s*\S+/gi, "$1=[REDACTED]").slice(0, 1000);
  console.error(`[${scope}] ${safeMessage}`);
  const webhook = process.env.ERROR_MONITORING_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, message: safeMessage, timestamp: new Date().toISOString() }) });
  } catch {
    // Monitoring failure must never break the user request.
  }
}
