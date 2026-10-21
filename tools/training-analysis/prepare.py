#!/usr/bin/env python3
"""Turn downloaded training files into evidence packs for the analysis workflow.

For each video: a timestamped transcript (low-confidence words marked), the
frames where the screen actually changes, and evidence packs that interleave
the two in time order. For each PDF: page images plus extracted text. Agents
read the packs; every claim they make must cite a timestamp or a page.

    python3 prepare.py --src training-work/src --work training-work

Re-running skips items that are already done, so it can be stopped and resumed.
See README.md for the full run.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

VIDEO_EXT = {'.mp4', '.mov', '.m4v', '.webm', '.mkv'}
PDF_EXT = {'.pdf'}
TEXT_EXT = {'.md', '.txt', '.docx'}

# Spellings Whisper can't guess. Pierre narrates most videos with a French
# accent, so priming the vocabulary matters more than usual.
VOCAB = ('Revibe, KAM, KAMs, key account manager, Buybox, buy box, AppSheet, fulfillment, '
         'onboarding, refurbished, UAE, KSA, Saudi Arabia, South Africa, AED, SAR, ZAR, '
         'warranty, claims, cancellation, refund, ship back, seller, supplier, dashboard, '
         'order help, SKU, Excellent, Good, Fair, iPhone, Samsung, MacBook.')

LOW_WORD = 0.5      # word probability below this is marked {word?}
LOW_SEGMENT = -0.8  # segment avg_logprob below this is marked ⚠
PAUSE = 0.7         # seconds of silence that start a new transcript line
LINE_WORDS = 18     # longest transcript line, in words

# Frame selection, on 160x90 grayscale thumbnails split into 16x9 cells.
CELL = 10
CELL_CHANGED = 6        # mean abs diff for a cell to count as changed
MIN_CELLS = 3           # cells that must change (a moving cursor touches 1-2)
BIG_CELL = 20           # or one cell changes this much (a popup, a new value)
MASK_MEDIAN = 1.5       # cells this busy most of the time (webcam bubble) are ignored
MAX_GAP = 20            # seconds without a frame before one is forced
FRAME_WIDTH = 1568      # Claude reads images up to about this size

CHUNK_FRAMES = 40
CHUNK_SECONDS = 480
PDF_CHUNK_PAGES = 12


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def mmss(t):
    t = int(t)
    return f'{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}' if t >= 3600 else f'{t // 60:02d}:{t % 60:02d}'


def parse_name(path):
    """'8.2. Warranties - Wrong Device (Seller & KAMs).mp4' -> id 8.2, title, audience, flags."""
    stem = path.stem
    m = re.match(r'^(\d+(?:\.\d+)*)\.?\s+(.*)$', stem)
    item_id, title = (m.group(1), m.group(2)) if m else (re.sub(r'[^a-z0-9]+', '-', stem.lower()).strip('-'), stem)
    tags = ' '.join(re.findall(r'\(([^)]*)\)', title)).lower()
    kam, seller = 'kam' in tags, 'seller' in tags
    audience = 'Seller & KAM' if kam and seller else 'KAM' if kam else 'Seller' if seller else None
    flags = ['TBU (to be updated)'] if 'tbu' in tags.split() else []
    return item_id, title, audience, flags


# ---------- transcription ----------

def load_audio(video):
    pcm = run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(video), '-ac', '1', '-ar', '16000', '-f', 's16le', '-']).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768


class Transcriber:
    """faster-whisper everywhere; mlx-whisper instead on Apple Silicon when installed (much faster)."""

    def __init__(self, engine, model, language, vocab):
        self.language, self.prompt = language, vocab
        self.engine = engine
        if engine == 'auto':
            try:
                import mlx_whisper  # noqa: F401
                self.engine = 'mlx'
            except ImportError:
                self.engine = 'faster-whisper'
        if self.engine == 'mlx':
            self.model = (model if '/' in model else 'mlx-community/whisper-large-v3-turbo' if model == 'large-v3-turbo'
                          else f'mlx-community/whisper-{model}-mlx')
        else:
            from faster_whisper import WhisperModel
            self.model = WhisperModel(model, device='cpu', compute_type='int8')
        self.name = f'{self.engine}:{model}'

    def __call__(self, audio):
        # condition_on_previous_text=False stops one misheard phrase from snowballing;
        # VAD stops Whisper inventing text over silence.
        if self.engine == 'mlx':
            import mlx_whisper
            out = mlx_whisper.transcribe(audio, path_or_hf_repo=self.model, language=self.language,
                                         initial_prompt=self.prompt, word_timestamps=True,
                                         condition_on_previous_text=False)
            return [{'start': s['start'], 'end': s['end'], 'text': s['text'].strip(),
                     'avg_logprob': s.get('avg_logprob', 0.0), 'no_speech_prob': s.get('no_speech_prob', 0.0),
                     'words': [{'w': w['word'], 'start': w['start'], 'end': w['end'], 'p': w['probability']}
                               for w in s.get('words', [])]} for s in out['segments']]
        segs, _ = self.model.transcribe(audio, language=self.language, vad_filter=True, beam_size=5,
                                        word_timestamps=True, initial_prompt=self.prompt,
                                        condition_on_previous_text=False)
        return [{'start': s.start, 'end': s.end, 'text': s.text.strip(), 'avg_logprob': s.avg_logprob,
                 'no_speech_prob': s.no_speech_prob,
                 'words': [{'w': w.word, 'start': w.start, 'end': w.end, 'p': w.probability} for w in (s.words or [])]}
                for s in segs]


def lines_from(segs):
    """Re-split the transcript into short lines at sentence ends and pauses, so each
    line's timestamp is precise enough to cite. Words flow across Whisper's own
    segment breaks, which often fall mid-sentence. Low-confidence words become
    {word?}; a line with words from a doubtful segment ends in ⚠."""
    lines, cur, start, prev_end, doubtful = [], [], None, None, False

    def flush():
        nonlocal cur, doubtful
        if cur:
            lines.append({'start': start, 'text': ''.join(cur).strip() + (' ⚠' if doubtful else '')})
        cur, doubtful = [], False

    for seg in segs:
        if not seg['words']:
            flush()
            lines.append({'start': seg['start'], 'text': seg['text'] + (' ⚠' if seg['avg_logprob'] < LOW_SEGMENT else '')})
            prev_end = seg['end']
            continue
        for w in seg['words']:
            if cur and (w['start'] - prev_end > PAUSE or len(cur) >= LINE_WORDS):
                flush()
            if not cur:
                start = w['start']
            cur.append(w['w'] if w['p'] >= LOW_WORD else f" {{{w['w'].strip()}?}}")
            doubtful = doubtful or seg['avg_logprob'] < LOW_SEGMENT
            prev_end = w['end']
            if w['w'].rstrip().endswith(('.', '?', '!')):
                flush()
    flush()
    return lines


def write_transcript(item_dir, segs, meta, out):
    (item_dir / 'transcript.json').write_text(json.dumps(segs, indent=1), encoding='utf-8')
    lines = [f"# Transcript: {meta['id']} {meta['title']}", '',
             f"Speech recognition: {meta['asr']}, language forced to {meta['language']}. "
             '{word?} = low-confidence word. ⚠ = low-confidence line. '
             'Names, numbers and on-screen terms may be misheard: check them against the frames.', '']
    lines += [f"[{mmss(l['start'])}] {l['text']}" for l in lines_from(segs)]
    (item_dir / 'transcript.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{meta['id']}.md").write_text('\n'.join(lines) + '\n', encoding='utf-8')
    words = [w for s in segs for w in s['words']]
    meta['transcript'] = {
        'segments': len(segs),
        'words': len(words),
        'low_confidence_words': sum(1 for w in words if w['p'] < LOW_WORD),
        'low_confidence_segments': sum(1 for s in segs if s['avg_logprob'] < LOW_SEGMENT),
    }


# ---------- frames ----------

def thumbnails(video, duration):
    raw = run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(video), '-vf', 'fps=1,scale=160:90,format=gray',
               '-f', 'rawvideo', '-']).stdout
    th = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(np.float32)
    return th[: int(duration) + 1]


def cell_diff(a, b):
    return np.abs(a - b).reshape(90 // CELL, CELL, 160 // CELL, CELL).mean(axis=(1, 3))


def pick_frames(th):
    """Seconds worth keeping: the screen settles after a real change, or MAX_GAP passes."""
    n = len(th)
    if n == 0:
        return [], 0
    steps = np.stack([cell_diff(th[i], th[i + 1]) for i in range(n - 1)]) if n > 1 else np.zeros((1, 9, 16))
    busy = np.median(steps, axis=0) > MASK_MEDIAN  # webcam bubble, embedded video
    quiet = ~busy

    def changed(a, b):
        d = cell_diff(th[a], th[b])[quiet]
        return d.size and ((d > CELL_CHANGED).sum() >= MIN_CELLS or d.max() > BIG_CELL)

    keep, last, t = [0], 0, 1
    while t < n:
        if changed(last, t):
            s = t  # wait for scrolls and animations to finish, up to 3 s
            while s < min(t + 3, n - 1) and changed(s, s + 1):
                s += 1
            keep.append(s)
            last, t = s, s + 1
        elif t - last >= MAX_GAP:
            keep.append(t)
            last, t = t, t + 1
        else:
            t += 1
    if keep[-1] != n - 1:
        keep.append(n - 1)
    return sorted(set(keep)), int(busy.sum())


def export_frames(video, seconds, frame_dir):
    frame_dir.mkdir(parents=True, exist_ok=True)
    for s in seconds:
        out = frame_dir / f't{s:05d}.jpg'
        if not out.exists():
            run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', str(s), '-i', str(video), '-frames:v', '1',
                 '-vf', f"scale='min({FRAME_WIDTH},iw)':-2", '-q:v', '3', str(out)])


# ---------- evidence packs ----------

def chunk_bounds(seconds, duration):
    """Split at frame times so each chunk has <= CHUNK_FRAMES frames and <= CHUNK_SECONDS."""
    bounds, start, count = [], 0, 0
    for s in seconds:
        if count and (count >= CHUNK_FRAMES or s - start >= CHUNK_SECONDS):
            bounds.append((start, s))
            start, count = s, 0
        count += 1
    bounds.append((start, max(duration, start + 1)))
    return bounds


def video_packs(item_dir, meta, segs, seconds):
    packs = []
    bounds = chunk_bounds(seconds, meta['duration'])
    for n, (a, b) in enumerate(bounds, 1):
        frames = [s for s in seconds if a <= s < b] or [s for s in seconds if s == a]
        lines = [f"# Evidence pack: {meta['id']} {meta['title']} (part {n} of {len(bounds)}, {mmss(a)}–{mmss(b)})", '',
                 f"Audience: {meta['audience'] or 'not labelled'}. Video length {mmss(meta['duration'])}. "
                 f"Full transcript: {item_dir / 'transcript.md'}", '',
                 'Each FRAME line is a screenshot taken when the screen changed. Open every one with the Read tool. '
                 'Transcript lines follow the frame they were spoken over. '
                 '{word?} = low-confidence word, ⚠ = low-confidence line.', '']
        events = [(s, 0, f"### [{mmss(s)}] FRAME t{s:05d} → {item_dir / 'frames' / f't{s:05d}.jpg'}") for s in frames]
        events += [(l['start'], 1, f"[{mmss(l['start'])}] {l['text']}")
                   for l in lines_from(segs) if a <= l['start'] < b]
        lines += [e[2] for e in sorted(events, key=lambda e: (e[0], e[1]))]
        path = item_dir / f'pack-{n}.md'
        path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        packs.append({'n': n, 'start': a, 'end': b, 'frames': len(frames), 'path': str(path)})
    return packs


# ---------- items ----------

def do_video(src, item_dir, meta, transcriber, out):
    probe = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(src)]).stdout)
    meta['duration'] = int(float(probe['format']['duration']) + 0.5)
    v = next((s for s in probe['streams'] if s['codec_type'] == 'video'), {})
    meta['resolution'] = f"{v.get('width')}x{v.get('height')}"

    subs = [s for s in probe['streams'] if s['codec_type'] == 'subtitle']
    for i, s in enumerate(subs):  # embedded subtitle tracks, if the export kept any
        run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(src), '-map', f"0:{s['index']}", str(item_dir / f'subtitles-{i}.srt')])
    meta['subtitle_tracks'] = len(subs)

    if (item_dir / 'transcript.json').exists():
        segs = json.loads((item_dir / 'transcript.json').read_text(encoding='utf-8'))
    else:
        segs = transcriber(load_audio(src))
    meta['asr'], meta['language'] = transcriber.name, transcriber.language
    write_transcript(item_dir, segs, meta, out / 'transcripts')

    seconds, masked = pick_frames(thumbnails(src, meta['duration']))
    export_frames(src, seconds, item_dir / 'frames')
    meta['frames'], meta['masked_cells'] = len(seconds), masked
    meta['packs'] = video_packs(item_dir, meta, segs, seconds)


def do_pdf(src, item_dir, meta):
    import pymupdf
    doc = pymupdf.open(src)
    (item_dir / 'pages').mkdir(exist_ok=True)
    pages = []
    for i, page in enumerate(doc, 1):
        img = item_dir / 'pages' / f'p{i:03d}.png'
        if not img.exists():
            zoom = min(2.0, FRAME_WIDTH / max(page.rect.width, 1))
            page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(img)
        pages.append((i, img, page.get_text().strip()))
    meta['pages'] = len(pages)
    meta['packs'] = []
    for n, k in enumerate(range(0, len(pages), PDF_CHUNK_PAGES), 1):
        part = pages[k:k + PDF_CHUNK_PAGES]
        lines = [f"# Evidence pack: {meta['id']} {meta['title']} (pages {part[0][0]}–{part[-1][0]} of {len(pages)})", '',
                 f"Audience: {meta['audience'] or 'not labelled'}. Open every PAGE image with the Read tool: "
                 'the extracted text can miss tables, arrows and screenshots.', '']
        for i, img, text in part:
            lines += [f'### PAGE {i} → {img}', '', text or '(no extractable text: read the image)', '']
        path = item_dir / f'pack-{n}.md'
        path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        meta['packs'].append({'n': n, 'start': part[0][0], 'end': part[-1][0], 'frames': len(part), 'path': str(path)})


def docx_text(src):
    """Paragraph text of a .docx (Drive exports Google Docs this way), without extra dependencies."""
    import zipfile
    from xml.etree import ElementTree
    w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    root = ElementTree.fromstring(zipfile.ZipFile(src).read('word/document.xml'))
    return '\n\n'.join(''.join(t.text or '' for t in p.iter(f'{w}t')) for p in root.iter(f'{w}p')).strip()


def do_text(src, item_dir, meta):
    path = item_dir / 'pack-1.md'
    body = docx_text(src) if src.suffix.lower() == '.docx' else src.read_text(encoding='utf-8')
    path.write_text(f"# Evidence pack: {meta['id']} {meta['title']} (document)\n\n"
                    'Cite sections by their heading.\n\n' + body, encoding='utf-8')
    meta['packs'] = [{'n': 1, 'start': 0, 'end': 0, 'frames': 0, 'path': str(path)}]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--src', required=True, type=Path, help='folder with the downloaded videos, PDFs and notes')
    ap.add_argument('--work', required=True, type=Path, help='output folder (frames, transcripts, packs)')
    ap.add_argument('--out', default='docs/training-reference/kams', help='where the reference goes (transcripts are copied there)')
    ap.add_argument('--engine', default='auto', choices=['auto', 'faster-whisper', 'mlx'])
    ap.add_argument('--model', default='large-v3-turbo', help='Whisper model: small, medium, large-v3-turbo, large-v3')
    ap.add_argument('--language', default='en', help='forced, so an accent is never taken for another language')
    ap.add_argument('--vocab', default='', help='extra terms to prime the speech recognition with')
    ap.add_argument('--only', nargs='*', help='item ids to redo from scratch, e.g. 8.1 13.0')
    a = ap.parse_args()

    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg is missing. Install it first (macOS: brew install ffmpeg).')
    files = sorted(p for p in a.src.rglob('*') if p.is_file() and p.suffix.lower() in VIDEO_EXT | PDF_EXT | TEXT_EXT)
    if not files:
        sys.exit(f'No videos, PDFs or notes found in {a.src}.')

    transcriber = None
    index = []
    for src in files:
        item_id, title, audience, flags = parse_name(src)
        if a.only and item_id not in a.only:
            prev = a.work / 'items' / item_id / 'meta.json'
            if prev.exists():
                index.append(json.loads(prev.read_text(encoding='utf-8')))
            continue
        item_dir = (a.work / 'items' / item_id).resolve()
        if a.only and item_dir.exists():
            shutil.rmtree(item_dir)  # redo from scratch: transcript, frames, packs
        item_dir.mkdir(parents=True, exist_ok=True)
        done = item_dir / 'meta.json'
        if done.exists() and not a.only:
            index.append(json.loads(done.read_text(encoding='utf-8')))
            print(f'{item_id}: already prepared')
            continue
        ext = src.suffix.lower()
        kind = 'video' if ext in VIDEO_EXT else 'pdf' if ext in PDF_EXT else 'doc'
        role = 'training' if re.match(r'^\d', src.stem) else 'notes'
        meta = {'id': item_id, 'title': title, 'file': src.name, 'kind': kind, 'role': role,
                'audience': audience, 'flags': flags}
        print(f'{item_id}: {kind} {src.name}', flush=True)
        if kind == 'video':
            if transcriber is None:
                transcriber = Transcriber(a.engine, a.model, a.language, f'{VOCAB} {a.vocab}'.strip())
            do_video(src, item_dir, meta, transcriber, Path(a.out))
            t = meta['transcript']
            print(f"  {mmss(meta['duration'])}, {meta['frames']} frames, {len(meta['packs'])} packs, "
                  f"{t['low_confidence_words']}/{t['words']} low-confidence words", flush=True)
        elif kind == 'pdf':
            do_pdf(src, item_dir, meta)
        else:
            do_text(src, item_dir, meta)
        done.write_text(json.dumps(meta, indent=1), encoding='utf-8')
        index.append(meta)

    index.sort(key=lambda m: [int(x) if x.isdigit() else 0 for x in m['id'].split('.')] + [m['id']])
    (a.work / 'index.json').write_text(json.dumps(index, indent=1), encoding='utf-8')
    args = {'workDir': str(a.work.resolve()), 'outDir': a.out,
            'items': [{'id': m['id'], 'title': m['title'], 'kind': m['kind'], 'role': m.get('role', 'training'),
                       'audience': m['audience'],
                       'flags': m['flags'], 'duration': m.get('duration'), 'pages': m.get('pages'),
                       'packs': [p['path'] for p in m['packs']]} for m in index]}
    (a.work / 'workflow-args.json').write_text(json.dumps(args, indent=1), encoding='utf-8')
    print(f"\n{len(index)} items ready. Workflow args: {a.work / 'workflow-args.json'}")


if __name__ == '__main__':
    main()
