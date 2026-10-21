---
name: analyze-training
description: Build the checked training reference from the KAM training videos and PDFs in Pierre's "1. KAMs" Drive folder (or any training folder) - transcripts, frames, step-by-step walkthroughs, cited facts, quiz plan. Use when asked to analyze, transcribe or index training videos, or to refresh docs/training-reference.
---

# Analyze training material

Turns a folder of training videos and PDFs into `docs/training-reference/kams/`: one checked page per item, one per topic, a glossary, gaps and conflicts, and a quiz plan. Every claim cites a timestamp, a frame or a page. Read `tools/training-analysis/README.md` for how it works.

## 1. Check the tools

```bash
ffmpeg -version                    # macOS: brew install ffmpeg · Windows: winget install Gyan.FFmpeg (then open a new terminal)
python3 -m pip install -r tools/training-analysis/requirements.txt   # Windows: py -m pip ...
# Apple Silicon only, much faster transcription:
python3 -m pip install mlx-whisper
```

## 2. Get the files into `training-work/src/`

`training-work/` is git-ignored. Source folder: https://drive.google.com/drive/folders/12YP-QevTQ1Jj2crwPeandazzHVDObXbQ

- **With Claude in Chrome:** open the folder, select everything (Cmd/Ctrl+A), right-click → Download. Drive zips it (big folders come as several zips). Wait for the downloads to finish in the browser's downloads list.
- **Without it:** ask the user to do the same, and tell you where the zips landed.

Then unzip all of them into `training-work/src/` and list what's there. Compare it with the folder in Drive: every video, PDF and doc should be present, keeping the Drive file names (the leading numbers become item ids). Google Docs arrive as `.docx`, which is fine.

## 3. Prepare the evidence

Transcribes speech, picks frames where the screen changes, and writes evidence packs. It takes a while (on Apple Silicon with mlx-whisper, roughly 10-20 minutes per hour of video; on CPU, about real time), so run it in the background and check the log:

```bash
python3 tools/training-analysis/prepare.py --src training-work/src --work training-work > training-work/prepare.log 2>&1
```

It's resumable: re-running skips finished items. `--only 8.1 13.0` redoes specific items.

When it's done, spot-check before spending agents on it:
- `training-work/index.json`: every item is there, videos have frames and packs.
- Open two frames from a long video and one evidence pack: frames should be legible, and the transcript should read like the speech.
- Look at `low_confidence_words` per item. If one video is much worse than the rest, read its transcript: the audio may be poor, or the language wrong.

## 4. Run the analysis workflow

Read `training-work/workflow-args.json` and run the saved workflow with that object as `args`:

```
Workflow({ name: "analyze-training", args: <contents of training-work/workflow-args.json> })
```

It runs one analyst and one adversarial checker per evidence pack, then a writer, a critic and an evidence-checked fix per item, a page per topic, the reference pages, and two auditors. If it stops partway, resume it with `resumeFromRunId`.

## 5. Finish

- Read `docs/training-reference/kams/README.md`, then both `audit-*.md` files, and tell the user what the auditors found and fixed, and which items failed (if any).
- Commit `docs/training-reference/` on a branch. Never commit `training-work/`: it holds the videos and frames.
