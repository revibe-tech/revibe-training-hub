// Splits a material's extracted page text ({ page, text }[], from extractDeck)
// into retrieval chunks. Slides are short, so most pages are one chunk; long
// pages are cut on word boundaries with some overlap so a step list keeps its
// context across the cut.

const MAX_CHARS = 1500;
const OVERLAP_CHARS = 200;
const MIN_CHARS = 20; // blank or near-empty pages only add noise

export function chunkPages(pages = []) {
  const chunks = [];
  for (const { page, text } of pages) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!Number.isInteger(page) || clean.length < MIN_CHARS) continue;

    let start = 0;
    let chunkIndex = 0;
    while (start < clean.length) {
      let end = Math.min(start + MAX_CHARS, clean.length);
      if (end < clean.length) {
        const cut = clean.lastIndexOf(' ', end);
        if (cut > start + MAX_CHARS / 2) end = cut;
      }
      chunks.push({ page, chunkIndex: chunkIndex++, content: clean.slice(start, end).trim() });
      if (end >= clean.length) break;

      start = Math.max(end - OVERLAP_CHARS, start + 1);
      const space = clean.indexOf(' ', start);
      if (space !== -1 && space < end) start = space + 1;
    }
  }
  return chunks;
}
