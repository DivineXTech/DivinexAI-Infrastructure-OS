/**
 * Dependency-free image-dimension + transparency extraction from raw
 * bytes. No `sharp`/`image-size` package is available in this project, so
 * this reads just enough of each format's binary header to answer "how
 * big is this, and does it have an alpha channel" — the two facts
 * lib/catalog/artwork-quality.ts's DPI/transparency warnings need. Pure
 * function of bytes in, no I/O.
 *
 * This is intentionally minimal, not a general-purpose image parser — see
 * docs/ARTWORK_SECURITY.md for what it does and does not guarantee (e.g.
 * WebP transparency detection is best-effort for the lossy+alpha case).
 */

export type ImageInfo = {
  widthPx: number;
  heightPx: number;
  hasTransparency: boolean | null;
};

function readPng(bytes: Uint8Array): ImageInfo | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33) return null;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== signature[i]) return null;
  }
  const widthPx = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
  const heightPx = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
  const colorType = bytes[25];
  // Color type 4 (grayscale+alpha) and 6 (truecolor+alpha) always carry
  // transparency; other color types depend on an optional tRNS chunk,
  // which this minimal reader doesn't scan for (defaults to null/unknown
  // rather than guessing).
  const hasTransparency = colorType === 4 || colorType === 6 ? true : null;
  return { widthPx, heightPx, hasTransparency };
}

function readJpeg(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame && offset + 9 <= bytes.length) {
      const heightPx = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const widthPx = (bytes[offset + 7] << 8) | bytes[offset + 8];
      // JPEG has no alpha channel, full stop.
      return { widthPx, heightPx, hasTransparency: false };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebp(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 30) return null;
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!isRiff || !isWebp) return null;

  const fourCc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourCc === "VP8X") {
    const hasAlpha = (bytes[20] & 0x10) !== 0;
    const widthPx = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
    const heightPx = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
    return { widthPx, heightPx, hasTransparency: hasAlpha };
  }
  if (fourCc === "VP8L") {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const widthPx = (((b1 & 0x3f) << 8) | b0) + 1;
    const heightPx = (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) + 1;
    const hasAlpha = (b3 & 0x10) !== 0;
    return { widthPx, heightPx, hasTransparency: hasAlpha };
  }
  if (fourCc === "VP8 ") {
    // Lossy simple format never carries alpha.
    const widthPx = ((bytes[26] | (bytes[27] << 8)) & 0x3fff);
    const heightPx = ((bytes[28] | (bytes[29] << 8)) & 0x3fff);
    return { widthPx, heightPx, hasTransparency: false };
  }
  return null;
}

/** SVG has no fixed pixel dimensions — width/height (or viewBox, as a
 * fallback) are read as a text-based best effort. Transparency defaults
 * to true (vector graphics with no explicit background typically render
 * transparent), which is a heuristic, not a certainty. */
function readSvg(text: string): ImageInfo | null {
  const widthMatch = text.match(/<svg[^>]*\swidth\s*=\s*"([\d.]+)/i);
  const heightMatch = text.match(/<svg[^>]*\sheight\s*=\s*"([\d.]+)/i);
  if (widthMatch && heightMatch) {
    return { widthPx: Math.round(parseFloat(widthMatch[1])), heightPx: Math.round(parseFloat(heightMatch[1])), hasTransparency: true };
  }
  const viewBoxMatch = text.match(/viewBox\s*=\s*"[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/i);
  if (viewBoxMatch) {
    return { widthPx: Math.round(parseFloat(viewBoxMatch[1])), heightPx: Math.round(parseFloat(viewBoxMatch[2])), hasTransparency: true };
  }
  return null;
}

export function readImageInfo(
  bytes: Uint8Array,
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml" | "image/webp",
): ImageInfo | null {
  switch (mimeType) {
    case "image/png":
      return readPng(bytes);
    case "image/jpeg":
      return readJpeg(bytes);
    case "image/webp":
      return readWebp(bytes);
    case "image/svg+xml":
      return readSvg(new TextDecoder().decode(bytes));
  }
}
