// Client-side helpers for uploaded training decks: file validation, PDF/PPTX
// extraction (page count + search text) and thumbnail generation.
// Used by components/UploadZone.js and components/ReuploadModal.js.

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ACCEPT_ATTR =
  'application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const THUMB_WIDTH = 720; // HQ source: cards show ~380px and Retina doubles it
const TEXT_PAGE_LIMIT = 50;

export function isPdfFile(file) {
  return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}

export function isPptxFile(file) {
  return !!file && (file.type === PPTX_MIME || /\.pptx$/i.test(file.name || ''));
}

/** Returns a friendly error message, or null when the file is OK to upload. */
export function validateDeckFile(file) {
  if (!file) return 'Please choose a file.';
  if (!isPdfFile(file) && !isPptxFile(file)) return 'Please upload a PDF or PPTX file.';
  if (file.size > MAX_FILE_BYTES) return 'File is too large. Maximum size is 50MB.';
  return null;
}

/** "Onboarding deck v2.pptx" → "Onboarding deck v2" */
export function displayNameFromFile(fileName = '') {
  return fileName.replace(/\.(pdf|pptx)$/i, '').replace(/[_]+/g, ' ').trim();
}

export function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let pdfjsPromise = null;
/** Lazily load pdf.js (kept out of the initial bundle) with the shared worker URL. */
export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

/**
 * Render one page of an open pdf.js document to a high-quality JPEG data URL.
 * PDFs are vector, so rendering large stays crisp.
 */
export async function renderPdfPageThumbnail(pdf, pageNumber = 1) {
  const page = await pdf.getPage(pageNumber);
  const scale = THUMB_WIDTH / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.9);
}

/* --------------------------------------------------------------------------
   Branded presentation thumbnail (PPTX decks have no renderable first page)
   -------------------------------------------------------------------------- */

function brandFontFamily() {
  if (typeof document === 'undefined') return 'Montserrat, system-ui, sans-serif';
  const fromNextFont = getComputedStyle(document.documentElement).getPropertyValue('--font-montserrat').trim();
  return `${fromNextFont ? `${fromNextFont}, ` : ''}Montserrat, "Segoe UI", system-ui, sans-serif`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

/**
 * Draw an on-brand 16:9 cover for a deck: brand gradient, category label,
 * wrapped title and the REVIBE wordmark. Returns a JPEG data URL.
 * @param {{ title?: string, category?: string, kind?: 'pptx'|'pdf'|'video'|'quiz' }} opts
 */
export async function generatePresentationThumbnail({ title = 'Untitled deck', category = 'General', kind = 'pptx' } = {}) {
  const W = 960;
  const H = 540;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const family = brandFontFamily();

  try {
    await Promise.all([
      document.fonts?.load(`800 56px ${family}`),
      document.fonts?.load(`900 26px ${family}`),
    ]);
  } catch {
    // Fall back to system fonts; the layout still works.
  }

  // 1. Brand gradient (magenta → purple → violet, 135°)
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#C82D8C');
  g.addColorStop(0.55, '#7F19A0');
  g.addColorStop(1, '#5019A0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 2. Soft decorative circles
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(W - 110, 90, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.arc(110, H + 20, 250, 0, Math.PI * 2);
  ctx.fill();

  const pad = 72;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';

  // 3. Category pill
  const label = String(category || 'General').toUpperCase().slice(0, 28);
  ctx.font = `700 20px ${family}`;
  const pillW = ctx.measureText(label).width + 48;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  roundRect(ctx, pad, 72, pillW, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, pad + 24, 101);

  // 4. Title (up to 3 lines)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-1px';
  ctx.font = `800 58px ${family}`;
  const lines = wrapLines(ctx, String(title || 'Untitled deck'), W - pad * 2, 3);
  const lineH = 68;
  const top = 230 + (3 - lines.length) * (lineH / 2);
  lines.forEach((line, i) => ctx.fillText(line, pad, top + i * lineH));

  // 5. Wordmark + kind label
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.font = `900 28px ${family}`;
  ctx.fillText('REVIBE', pad, H - 64);
  ctx.font = `700 18px ${family}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.textAlign = 'right';
  // 6. Videos get a play button and quizzes a tick instead (library cards already label them).
  if (kind === 'quiz') {
    const cx = W - pad - 44;
    const cy = 116;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7F19A0';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 19, cy + 1);
    ctx.lineTo(cx - 6, cy + 15);
    ctx.lineTo(cx + 20, cy - 13);
    ctx.stroke();
  } else if (kind !== 'video') {
    ctx.fillText(kind === 'pdf' ? 'TRAINING DECK' : 'PRESENTATION', W - pad, H - 66);
  } else {
    const cx = W - pad - 44;
    const cy = 116;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7F19A0';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 18);
    ctx.lineTo(cx + 20, cy);
    ctx.lineTo(cx - 12, cy + 18);
    ctx.closePath();
    ctx.fill();
  }

  return canvas.toDataURL('image/jpeg', 0.88);
}

/* --------------------------------------------------------------------------
   Extraction
   -------------------------------------------------------------------------- */

/**
 * Read a PDF/PPTX in the browser: page count, per-page text for search, and a
 * thumbnail (HQ render of page 1 for PDFs, branded cover for PPTX).
 * Extraction failures are logged and never block the upload (same as before).
 * @returns {Promise<{ pageCount: number, textContent: {page:number,text:string}[], thumbnailURL: string|null }>}
 */
export async function extractDeck(file, { title, category } = {}) {
  let pageCount = 0;
  const textContent = [];
  let thumbnailURL = null;

  try {
    if (isPdfFile(file)) {
      const pdfjsLib = await loadPdfjs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pageCount = pdf.numPages;

      for (let i = 1; i <= Math.min(pageCount, TEXT_PAGE_LIMIT); i++) {
        const page = await pdf.getPage(i);
        const textObj = await page.getTextContent();
        textContent.push({ page: i, text: textObj.items.map((item) => item.str).join(' ') });
      }

      try {
        thumbnailURL = await renderPdfPageThumbnail(pdf, 1);
      } catch (thumbErr) {
        console.warn('Failed to generate PDF thumbnail:', thumbErr);
      }
    } else if (isPptxFile(file)) {
      const { PptxRenderer } = await import('pptx-browser');
      const renderer = new PptxRenderer();
      try {
        await renderer.load(await file.arrayBuffer());
        pageCount = renderer.slideCount;
        const allExtracts = await renderer.extractAll();
        allExtracts.forEach((slide) => {
          textContent.push({ page: slide.index + 1, text: slide.text || '' });
        });
      } finally {
        renderer.destroy();
      }

      try {
        thumbnailURL = await generatePresentationThumbnail({
          title: title || displayNameFromFile(file.name),
          category,
          kind: 'pptx',
        });
      } catch (thumbErr) {
        console.warn('Failed to generate presentation thumbnail:', thumbErr);
      }
    }
  } catch (extractErr) {
    console.warn('Failed to extract text content:', extractErr);
  }

  return { pageCount, textContent, thumbnailURL };
}

/** Map storage/database errors to plain-English messages. */
export function describeUploadError(err, verb = 'Upload') {
  const msg = err?.message || '';
  if (err?.code === 'permission_denied' || msg.includes('permission')) {
    return `${verb} denied. Please check Supabase Storage permissions.`;
  }
  if (msg.includes('does not exist')) return 'Storage bucket is not configured. Please check Supabase setup.';
  if (msg.includes('row-level security')) return `${verb} denied by Supabase RLS policy.`;
  return `${verb} failed: ${msg || 'Unknown error. Check your Supabase/Firebase configuration.'}`;
}
