# Training analysis

Turns training videos and PDFs into a checked reference in `docs/training-reference/`: what each video teaches, step by step as the trainer does it, with every fact cited to a timestamp, a frame or a page. It's the source for writing quizzes and for deciding which material to update.

In Claude Code, run `/analyze-training` and follow it. This page explains what happens.

## Pipeline

| Step | Who | What |
|---|---|---|
| 1. Download | you or Claude in Chrome | Drive folder → `training-work/src/` (git-ignored) |
| 2. `prepare.py` | your machine | Transcript, frames, evidence packs per item |
| 3. Analyze | 1 agent per evidence pack | Follows the trainer, extracts facts, cites every one |
| 4. Verify | 1 agent per pack | Treats every claim as wrong until a frame or transcript line shows it; sweeps for anything missed |
| 5. Write | 1 agent per item | Page from checked claims only |
| 6. Critique and fix | 2 agents per item | Independent review against the sources; each fix is re-checked before it's applied |
| 7. Topics | 1 agent per topic | Process across videos, seller vs KAM version, quiz blueprint |
| 8. Reference | 4 agents | README, glossary, gaps and conflicts, quiz plan |
| 9. Audit | 2 agents | Trace claims in the summaries back to transcripts and frames, fix what's wrong |

Steps 3 to 9 are the saved workflow `.claude/workflows/analyze-training.js`.

## What `prepare.py` does

- **Transcript.** Whisper with the language forced to English, so a French accent is never taken for French, and primed with Revibe terms (Buybox, AppSheet, KAM, AED…). Words the model is unsure of are marked `{word?}` and doubtful lines `⚠`, so agents treat them as unconfirmed. On Pierre's 5.0 video, `medium` was clearly better than `small` (it gets "cancellation" and "refunded" right where `small` hears "consolation" and "refounded"); the default is `large-v3-turbo`. Both models still hear "Revibe" as "Revive", which is why agents check names and numbers against the screen.
- **Frames.** One thumbnail per second; a frame is kept when the screen settles after a real change (several regions change, or one changes a lot), or every 20 seconds regardless. Regions that change all the time, like the webcam bubble, are ignored when deciding. Kept frames are exported at up to 1568 px wide.
- **Evidence packs.** Frames and transcript lines in time order, at most 40 frames or 8 minutes per pack, so one agent can open every frame in its pack.
- **PDFs.** Every page as an image plus its extracted text. **Docs** (`.md`, `.txt`, `.docx`) become a pack as-is; the workflow uses them as context for the gaps review.

Outputs per item in `training-work/items/<id>/`: `transcript.md` and `.json` (segments, word timings, confidences), `frames/t<seconds>.jpg`, `pack-<n>.md`, `meta.json`. A copy of each transcript is not committed; frame names carry the second they were taken, so citations like `[03:15 t00195]` stay meaningful even if frames are regenerated.

## Options

```
--model large-v3-turbo   # or medium (faster on CPU), large-v3 (slowest, most accurate)
--engine auto            # mlx-whisper on Apple Silicon if installed, else faster-whisper
--vocab "Hamza Bashir"   # extra names and terms to prime transcription with
--only 8.1 13.0          # redo specific items
```

## Limits

- Speech recognition still makes mistakes on names and numbers. Agents prefer what's on screen and log every correction, but a misheard word with nothing on screen to check it against stays marked as unconfirmed.
- Frames are taken when the screen changes, so a cursor pointing at something without anything changing can be missed. Narration usually covers it.
- The reference says only what the material says. Gaps in the material show up as gaps, not filled in.
