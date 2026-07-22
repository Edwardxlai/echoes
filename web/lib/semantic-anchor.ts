/**
 * Stable semantic identity for generated content.
 *
 * Anchors are derived from the normalized core proposition rather than a node
 * position, so records and echoes survive reordering and template changes.
 */
export function normalizeAnchorText(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function fnv1a32(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Two independently seeded FNV-1a hashes form a stable 64-bit-compatible id. */
export function semanticAnchorId(coreProposition: string): string {
  const normalized = normalizeAnchorText(coreProposition);
  const source = normalized || coreProposition.trim();
  const high = fnv1a32(source, 0x811c9dc5);
  const low = fnv1a32(source, 0x9e3779b9);
  return `anchor_${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}`;
}
