function normalizeNumericToken(token: string): string {
  const lastDot = token.lastIndexOf(".");
  const lastComma = token.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const groupingSeparator = decimalSeparator === "." ? "," : ".";
    return canonicalNumber(token.replaceAll(groupingSeparator, "").replace(decimalSeparator, "."));
  }

  const separator = lastDot >= 0 ? "." : lastComma >= 0 ? "," : undefined;
  if (!separator) {
    return canonicalNumber(token);
  }

  const parts = token.split(separator);
  const isGroupedInteger = parts.length > 2
    ? parts.slice(1).every((part) => part.length === 3)
    : parts[0].length <= 3 && parts[1].length === 3;

  return canonicalNumber(
    isGroupedInteger ? parts.join("") : `${parts.slice(0, -1).join("")}.${parts.at(-1)}`
  );
}

function canonicalNumber(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : value;
}

function withoutMarkdownPresentationNumbers(text: string): string {
  return text
    // Ordered-list markers are layout, not factual claims. Keep the rest of
    // each line so unsupported numbers inside the item are still detected.
    .replace(/^(\s{0,3})\d+[.)](?=\s+)/gm, "$1")
    // Models sometimes put list positions in a dedicated Markdown table
    // column. A cell containing only an integer is presentation metadata.
    .replace(/(^|\|)\s*\d+\s*(?=\|)/gm, "$1 ");
}

function sanitizeMarkdownValues(value: unknown): unknown {
  if (typeof value === "string") return withoutMarkdownPresentationNumbers(value);
  if (Array.isArray(value)) return value.map(sanitizeMarkdownValues);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeMarkdownValues(item)]));
  }
  return value;
}

function numericTokens(value: unknown, markdownOutput = false): Set<string> {
  const prepared = markdownOutput ? sanitizeMarkdownValues(value) : value;
  const text = typeof prepared === "string" ? prepared : JSON.stringify(prepared);
  // Metrics can contain approved values inside labels such as "48-72h"
  // or keys such as "atLeast72Hours". Only adjacent digits delimit a number.
  // Match locale-formatted grouped values before ordinary decimals.
  const matches = text.match(/(?<!\d)(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?!\d)/g) ?? [];
  return new Set(matches.map(normalizeNumericToken));
}

export function assertNumericallyGrounded(
  output: unknown,
  sourceContext: unknown
): void {
  const unsupported = unsupportedNumericClaims(output, sourceContext);
  if (unsupported.length > 0) {
    throw new Error(`AI output contains unsupported numbers: ${unsupported.join(", ")}`);
  }
}

export function unsupportedNumericClaims(
  output: unknown,
  sourceContext: unknown
): string[] {
  const allowed = numericTokens(sourceContext);
  const claimed = numericTokens(output, true);
  return [...claimed].filter((token) => !allowed.has(token));
}
