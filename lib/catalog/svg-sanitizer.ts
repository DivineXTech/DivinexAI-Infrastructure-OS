/**
 * Conservative, denylist-based SVG sanitizer. Pure string transform — no
 * DOM, no external dependency — deliberately simple so its behavior is
 * easy to unit-test and reason about. This is NOT a full XML-aware
 * parser; it is a defense-in-depth pass over a file that must already
 * look like a well-formed `<svg>` document. See docs/ARTWORK_SECURITY.md
 * "SVG sanitization — what this does and does not guarantee" for the
 * honest limitations of a regex-based approach vs. a real allowlist
 * parser, and why this is the pragmatic choice for this phase.
 *
 * Never trust the file extension or the client-claimed MIME type — this
 * function only accepts input that structurally looks like an SVG
 * document and rejects (`safe: false`) anything else.
 */

const DANGEROUS_TAG_PATTERNS: RegExp[] = [
  /<script[\s\S]*?<\/script\s*>/gi,
  /<foreignObject[\s\S]*?<\/foreignObject\s*>/gi,
  /<iframe[\s\S]*?<\/iframe\s*>/gi,
  /<embed\b[^>]*\/?>/gi,
  /<object[\s\S]*?<\/object\s*>/gi,
  /<animate[\s\S]*?\/?>(?:<\/animate\s*>)?/gi,
];

const DANGEROUS_ATTRIBUTE_PATTERNS: RegExp[] = [
  // on* event handler attributes, either quote style.
  /\son\w+\s*=\s*"[^"]*"/gi,
  /\son\w+\s*=\s*'[^']*'/gi,
  // javascript: URIs in any attribute value.
  /javascript:[^"']*/gi,
];

const SVG_DOCUMENT_PATTERN = /^\s*(<\?xml[\s\S]*?\?>\s*)?(<!DOCTYPE[\s\S]*?>\s*)?<svg[\s\S]*<\/svg>\s*$/i;

export type SvgSanitizeResult = {
  safe: boolean;
  sanitized: string;
  removedPatternNames: string[];
};

export function sanitizeSvgMarkup(rawSvg: string): SvgSanitizeResult {
  const trimmed = rawSvg.trim();
  if (!SVG_DOCUMENT_PATTERN.test(trimmed)) {
    return { safe: false, sanitized: "", removedPatternNames: ["not a well-formed <svg> document"] };
  }

  let sanitized = trimmed;
  const removedPatternNames: string[] = [];

  for (const pattern of DANGEROUS_TAG_PATTERNS) {
    if (pattern.test(sanitized)) {
      removedPatternNames.push(pattern.source);
      sanitized = sanitized.replace(pattern, "");
    }
  }
  for (const pattern of DANGEROUS_ATTRIBUTE_PATTERNS) {
    if (pattern.test(sanitized)) {
      removedPatternNames.push(pattern.source);
      sanitized = sanitized.replace(pattern, "");
    }
  }

  // Strip any href/xlink:href that isn't a same-document fragment
  // reference (#id) — blocks remote resource loading and data: URIs that
  // could smuggle scripts.
  sanitized = sanitized.replace(/\b(xlink:href|href)\s*=\s*"(?!#)[^"]*"/gi, '$1=""');
  sanitized = sanitized.replace(/\b(xlink:href|href)\s*=\s*'(?!#)[^']*'/gi, "$1=''");

  return { safe: true, sanitized, removedPatternNames };
}
