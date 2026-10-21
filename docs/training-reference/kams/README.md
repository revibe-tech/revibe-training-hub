# KAM training reference

A checked reference to the KAM training material: what each video or PDF teaches, step by step, with every fact tied to the moment it is said, the screen it is shown on, or the page it is printed on. Built on 21 Oct 2026.

## What this is and who it's for

This reference turns the training videos and PDFs in the "1. KAMs" Drive folder into pages you can read, search and check. For each item it follows the trainer step by step, lists the facts a KAM needs, and cites each fact to its source.

It is for:

- **New KAMs**, to learn what sellers are taught about cancellations, warranty claims and commitments.
- **The team lead and trainers**, to write quizzes and to decide which material to re-record, update or blur.

It does not replace the training. It says only what the material says, and it points out where the material is unclear or contradicts itself.

**Scope of this run.** This run is a pilot. It covers four items (5.0, 8.1, 8.3 and 13.0) and the new KAMs' onboarding notes. Other items in the folder are not in it yet. If a topic is missing here, the training may still cover it.

## Catalog

| Id | Title | Audience | Length or pages | Frames | Low-confidence words | Page | Topic |
|---|---|---|---|---|---|---|---|
| 5.0 | Cancellations (Seller) | Seller | 3:23 video | 16 | 10 of 519 | [5.0](items/5.0.md) | [5. Cancellations](topics/5-cancellations.md) |
| 8.1 | Warranties - Issues (Seller & KAMs) | Seller & KAM | 3-page PDF | 3 (one image per page) | n/a (no narration) | [8.1](items/8.1.md) | [8. Warranties](topics/8-warranties.md) |
| 8.3 | Warranties - Wrong Device (Seller & KAMs) | Seller & KAM | 1-page PDF | 1 (one image per page) | n/a (no narration) | [8.3](items/8.3.md) | [8. Warranties](topics/8-warranties.md) |
| 13.0 | Commitments | Not labelled (speaks to the seller as "you") | 1:01 video | 15 | 2 of 174, both confirmed on screen | [13.0](items/13.0.md) | [13. Commitments](topics/13-commitments.md) |

- **Transcripts:** [5.0](transcripts/5.0.md) and [13.0](transcripts/13.0.md). The PDFs have no narration, so they have no transcript.
- **Not in the catalog:** "KAM onboarding notes (Training Questions doc)", a 19-page PDF. It holds the new KAMs' notes and questions, not training, so it has no page of its own. [gaps-and-conflicts.md](gaps-and-conflicts.md) maps those questions to the items that answer them.

Pages that cover all items:

- [quiz-plan.md](quiz-plan.md): suggested questions per item, an order for new joiners, and the strongest scenario seeds.
- [gaps-and-conflicts.md](gaps-and-conflicts.md): contradictions, dated material, personal data on screen, the new KAMs' questions, and suggested fixes.
- [glossary.md](glossary.md): the terms the pages use, with sources.
- [audit-numbers.md](audit-numbers.md) and [audit-process.md](audit-process.md): what the two final auditors checked and fixed.
- `data/<id>/part-1.json`: the checked claims each item page was written from.

### Reading a page

Each item page has the same sections: Summary, Follow the trainer (one row per step: the screen, what the trainer does, what they say), What a KAM needs to know, Screens and tools shown, Terms, Quiz material, Problems found, and Checking log. Each topic page combines its items into one walkthrough, then covers the seller and KAM versions, rules and numbers, contradictions, and a quiz blueprint.

| Mark | Meaning |
|---|---|
| `[01:09]` | Said at 1:09 in the video |
| `[00:44 t00044]` | Shown on screen, in the frame taken at second 44 |
| `[p2]` | Printed on page 2 of the PDF |
| `5.0 [01:31]` | The same, on a topic or reference page, with the item id in front |
| `{word?}` | A word that speech recognition was unsure of |
| ★ | A fact a new KAM must know, good for a quiz |
| (unconfirmed) | The checkers were not fully confident in this fact |

## How it was made

1. **Source files.** The videos and PDFs were downloaded from Drive into a local work folder (`training-work/`, which git ignores), keeping the Drive file names. The leading number of each file name becomes the item id.
2. **Speech recognition, with low-confidence words marked.** Each video was transcribed with Whisper (faster-whisper, large-v3-turbo). The language was forced to English, so the trainer's French accent is never taken for French. The model was also primed with Revibe terms (Revibe, Buybox, KAM, AED and others). Words the model was less than 50% sure of are marked `{word?}`. Lines with low overall confidence would be marked ⚠, but there were none in this run. These marks tell every later agent not to rely on those words unless the screen or the surrounding speech confirms them.
3. **Frames taken whenever the screen changes.** The tool compares one thumbnail per second and keeps a frame when the screen settles after a real change, or after 20 seconds without one. A moving cursor alone doesn't count as a change. Regions that change all the time, like the trainer's webcam image, are ignored. Each frame is named after its second, so t00044 is 0:44. Each PDF page is kept as an image, with its text.
4. **Evidence packs.** Frames and transcript lines in time order, at most 40 frames or 8 minutes per pack. Each pack is one "part". Every item in this run fit in one part.
5. **One agent per part follows the trainer.** It opens every frame or page, rebuilds what the trainer does step by step, and extracts the facts, each with a citation. It may not fill gaps from general knowledge. Anything only implied is marked "Implied:" with low confidence.
6. **An adversarial checker per part.** A second agent treats every claim as wrong until a frame, a transcript line or a page shows it. It checks numbers, dates, IDs and names character by character. It removes or corrects what the evidence doesn't support, then reads the pack again to add anything missed.
7. **A writer per item** writes the item page from the checked claims only.
8. **An independent critic per page.** A fresh agent re-reads the transcript minute by minute, or the PDF page by page, and reports what is wrong, unsupported or missing. Because the critic can be wrong too, another agent checks each finding against the evidence before applying it. The result is under "Checking log → Review" on each item page.
9. **Topic and reference pages.** One agent per topic combines its items. Then come this page, the glossary, the gaps and conflicts page and the quiz plan.
10. **Two final auditors.** Each one traces at least 25 claims on the topic and reference pages back to the transcripts, frames and PDF pages. One checks numbers, dates, prices, IDs and names. The other checks procedures, rules and who does what. They fix errors where they appear and log every claim in their audit file.

Steps 1 to 4 are done by `tools/training-analysis/prepare.py`. Steps 5 to 10 are the saved workflow `.claude/workflows/analyze-training.js`. More detail: [tools/training-analysis/README.md](../../../tools/training-analysis/README.md).

## Limits

### Speech recognition and the French accent

The trainer in 5.0 is a French speaker, and speech recognition sometimes mishears his accented English. The reference tries to be fair to him: it reads his sentences for what he means, quotes his words exactly, and says so when the meaning is not certain.

- **The `{word?}` marks don't catch everything.** They only show words the model knew it was unsure of. The model can also mishear a word with full confidence: in 5.0, "on your side" came out as "on your site" with no mark (5.0 [00:24]). So the low-confidence count is a minimum, not a count of errors.
- **The screen wins.** Where the screen shows the right word or number, the pages use the screen and log the correction in the item's "Speech recognition fixes" table. Examples from 5.0: "site" → "side", "Revive" → "Revibe", and the closing "I remanage your disposal" → "I remain at your disposal" (French "je reste à votre disposition").
- **Nothing is guessed.** Where nothing on screen confirms a line, it stays marked as unclear. The main case is 5.0 [02:22], about which countries need a tracking ID to reject a cancellation. The sentence contradicts itself, so the pages give the possible readings without choosing one. **Confirm this with the trainer.**
- **13.0 is clear.** Only 2 words were marked, and the screen confirms both.
- **There are no subtitles.** Neither video has a subtitle track, so speech recognition is the only written record of what is said.

### Frames are sampled when the screen changes

A frame is kept only when the screen changes, or after 20 seconds without a change. A cursor pointing at something, or a click that falls between two frames, can be missed. The pages say so when this happens. For example, in 13.0 the click on "Use suggested" falls between two frames, so the page says the field was "most likely" filled that way. 5.0 has 16 frames over 3:23, and 13.0 has 15 over 1:01.

### Nothing beyond the material

The agents were told not to fill gaps from general knowledge of e-commerce, logistics or Revibe. Where the material is silent, the pages say it is not covered. Examples:

- what happens if a seller rejects a cancellation but doesn't ship within 24 hours (5.0);
- who pays for the SA pickup AWB (8.1, 8.3);
- the Saudi Arabia commitments table, which is mentioned but never shown (13.0).

The PDFs don't expand AE, ZA, SA, "Others" or AWB, so the pages don't either.

### Other limits

- **The demo screens may not be what sellers see.** 5.0 was filmed on the admin dashboard (stage-admin.revibe.me). A seller's screens may differ, for example in which buttons the Claim Details tab shows.
- **Some content is dated.** 5.0 describes a policy "just launched" around May 2025. 13.0 shows one commitment round: the window runs from 20 Oct to 10 Nov 2026, and submissions close on Thu 22 Oct 2026 at 18:00 UAE time, so these dates expire with that round. 8.1 says there is "No Lab yet" outside AE, which may have changed.
- **The checks are done by agents too.** Checkers, critics and auditors reduce errors, but they can't guarantee there are none. Before a fact goes into a quiz or a message to sellers, open its citation.

## Using it to write quizzes

Pierre asked for at most 20 questions per video, mixing single-answer and multiple-answer questions, and written by people. This reference supplies the material. It doesn't write the questions.

1. **Start with [quiz-plan.md](quiz-plan.md)** for the numbers and the order. Then read the Quiz blueprint on the topic page, then the Quiz material on the item page (the ★ facts and scenario seeds).
2. **Check every source.** Build each question from a ★ fact and open its citation: the row on the item page, the transcript line, or the PDF page. For on-screen facts, the frame is in the work folder, e.g. `training-work/items/5.0/frames/t00044.jpg`. Frames are not committed.
3. **Leave out anything uncertain.** Skip facts marked (unconfirmed), anything listed under Contradictions or Unclear passages, and anything a blueprint says to leave out or "keep out until clarified". In this run that includes:
   - which countries need a tracking ID to reject a cancellation (5.0);
   - the ZA & SA rule that the customer pays the ship-back, with 90 days to pay, after a Lab Invalid (8.1);
   - whether the Lab applies outside AE (8.1 and 8.3 disagree);
   - the currency of the Saudi Arabia commitments table (13.0).
4. **Use the corrected wording.** If a question quotes the trainer, use the "Should be" column of the Speech recognition fixes table, not the raw transcript. Test the rule, not his phrasing.
5. **Test the process, not one-off dates.** Write 13.0's dates as "in the round shown", or leave them out.
6. **Name the claim type in warranty questions.** Issues (8.1) and wrong device (8.3) share the first four steps but differ after the seller decides.

The topic blueprints suggest these numbers:

| Item | Suggested questions | Basis |
|---|---|---|
| 5.0 | 3 | About one per minute of a 3:23 video |
| 8.1 | 20 | One per key rule, capped at 20 |
| 8.3 | 14 | One per key rule |
| 13.0 | 1 | About one per minute; the page has 17 ★ facts to rotate through for a question bank |
| **Total** | **38** | |

## Using it to update the material

- **Start with [gaps-and-conflicts.md](gaps-and-conflicts.md).** It lists contradictions, dated material, personal data on screen, the new KAMs' open questions, and a suggested fix for each.
- **Go through "Problems found" on each item page** for the details: speech recognition fixes, unclear passages, possibly out-of-date material, and personal data on screen.
- **Main points from this run:**
  - **5.0:** confirm the tracking-ID line at [02:22] with the trainer, and clarify it in the video or a note. Check that the 24-hour and country/stage rules still apply. Before sellers see the video, blur the customer's name, email, phone number and address and the seller's trading name, which appear on many frames, and crop the browser bookmarks bar.
  - **8.1 and 8.3:** decide whether the Lab applies outside AE and who pays the ship-back after a Lab Invalid, then make the two PDFs agree. 8.1's "No Lab yet" may be out of date.
  - **13.0:** the dates belong to one round and expire after it. The rest of the process doesn't depend on them.

### Refreshing the reference after the material changes

Follow the `analyze-training` skill (`/analyze-training` in Claude Code):

1. Put the new or changed files in `training-work/src/`, keeping their Drive names.
2. Run `python3 tools/training-analysis/prepare.py --src training-work/src --work training-work --only <ids>` to redo just those items. If the model keeps mishearing a name or term, add it with `--vocab "..."`.
3. Spot-check a frame or two and the transcript, especially the low-confidence words.
4. Run the `analyze-training` workflow with `training-work/workflow-args.json`, then read the two audit files.
5. Commit `docs/training-reference/` only. Never commit `training-work/`: it holds the videos and frames.

## Run stats

Every item was analysed in full (1 of 1 part each), and no item failed. The critic raised no high-severity issues. All 23 of its findings were checked against the evidence and applied. Each one is listed under "Checking log → Review" on its item page.

| Item | Parts | Facts kept | Claims checked | Removed | Corrected | Added by checker | Critic findings (high) |
|---|---|---|---|---|---|---|---|
| [5.0](items/5.0.md) | 1 of 1 | 23 | 66 | 4 | 16 | 7 | 6 (0) |
| [8.1](items/8.1.md) | 1 of 1 | 54 | 117 | 0 | 18 | 4 | 5 (0) |
| [8.3](items/8.3.md) | 1 of 1 | 38 | 74 | 0 | 22 | 5 | 3 (0) |
| [13.0](items/13.0.md) | 1 of 1 | 28 | 68 | 0 | 15 | 4 | 9 (0) |
| **Total** | **4 of 4** | **143** | **325** | **4** | **71** | **20** | **23 (0)** |

- **Facts kept:** facts left after the adversarial check.
- **Claims checked:** every step, fact, screen, term and problem the checker tested against the evidence.
- **Removed / Corrected / Added:** what the checker deleted as unsupported, reworded to match the evidence, or added in its sweep for missed content.
- **Critic findings:** issues the independent critic raised on the finished page.

Of the 325 claims checked, 75 (about 1 in 4) were removed or corrected before they reached a page. All 4 removals were in 5.0, and none of them came from a misheard word (see its Checking log). The results of the two final audits are in [audit-numbers.md](audit-numbers.md) and [audit-process.md](audit-process.md).
