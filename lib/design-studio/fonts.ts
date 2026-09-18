/**
 * Closed, approved internal font list (section 6) — no arbitrary
 * user-supplied font uploads or external font URLs, so there's nothing
 * here that could load a remote resource or an unvetted file.
 */
export const APPROVED_FONTS = [
  { key: "sans", label: "Sans Serif", cssFamily: "ui-sans-serif, system-ui, sans-serif" },
  { key: "serif", label: "Serif", cssFamily: "ui-serif, Georgia, serif" },
  { key: "mono", label: "Monospace", cssFamily: "ui-monospace, SFMono-Regular, monospace" },
  { key: "display_bold", label: "Bold Display", cssFamily: "Impact, Haettenschweiler, sans-serif" },
  { key: "script", label: "Script", cssFamily: "cursive" },
] as const;

export type ApprovedFontKey = (typeof APPROVED_FONTS)[number]["key"];

export function fontCssFamily(fontKey: string | null): string {
  return APPROVED_FONTS.find((f) => f.key === fontKey)?.cssFamily ?? APPROVED_FONTS[0].cssFamily;
}
