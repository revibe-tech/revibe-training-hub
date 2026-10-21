// Splits a material's extracted page text ({ page, text }[], from extractDeck)
// into retrieval chunks. Slides are short, so most pages are one chunk; long
// pages are cut on word boundaries with some overlap so a step list keeps its
// context across the cut.

const MAX_CHARS = 1500;
const OVERLAP_CHARS = 200;
const MIN_CHARS = 20; // blank or near-empty pages only add noise

// PDF.js returns wide letter-spacing inside one text item as single spaces
// ("YO U R", "Q U E U E"), while real word gaps are their own " " items.
// Squash those, or slide titles (often the key words) can't be searched.
function unspace(segment) {
  const tokens = segment.trim().split(' ');
  if (tokens.length < 3 || tokens.some((t) => !t)) return segment;
  const singles = tokens.filter((t) => t.length === 1).length;
  const caps = !/[a-z]/.test(segment);
  const spaced = (caps && singles >= 2 && tokens.every((t) => t.length <= 2))
    || (caps && singles >= 3 && singles / tokens.length >= 0.6 && tokens.every((t) => t.length <= 3)) // "S TAT U S E S"
    || (tokens.length >= 4 && singles === tokens.length);
  return spaced ? tokens.join('') : segment;
}

/** One page's text from PDF.js text items (getTextContent().items). */
export function pageText(items = []) {
  let out = '';
  let prev = null;
  for (const item of items) {
    const str = unspace(item.str || '');
    // Word gaps are usually " " items; a jump with no space item still splits words.
    if (prev && str && out && !/\s$/.test(out) && !/^\s/.test(str) && item.transform && prev.transform) {
      const size = Math.abs(item.height || prev.height) || 10;
      const sameLine = Math.abs(item.transform[5] - prev.transform[5]) < size * 0.5;
      if (!sameLine || item.transform[4] - (prev.transform[4] + (prev.width || 0)) > size * 0.15) out += ' ';
    }
    out += str;
    if (item.hasEOL) out += '\n';
    if (str.trim()) prev = item;
  }
  return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

/**
 * Page text, cleaned for search. Text extracted before pageText joined every
 * item with a space, so there item boundaries are runs of 2+ spaces.
 */
export function cleanPageText(text) {
  return String(text || '').split(/ {2,}|\n/).map(unspace).join(' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?)])(?= |$)/g, '$1') // "Issue , wrong" from the same join
    .trim();
}

export function chunkPages(pages = []) {
  const chunks = [];
  for (const { page, text } of pages) {
    const clean = cleanPageText(text);
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
