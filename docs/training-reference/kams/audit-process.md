# Audit: procedures, rules and who does what

This is the second of the two final audits (see [README](README.md), How it was made, step 10). It checks **procedures, rules, who does what, and the order of steps** on the reference pages. The other audit, [audit-numbers.md](audit-numbers.md), checks numbers, dates, prices, IDs and names.

**Method.** I picked claims of this kind from [README.md](README.md), [quiz-plan.md](quiz-plan.md), [gaps-and-conflicts.md](gaps-and-conflicts.md), [glossary.md](glossary.md) and the three topic pages. I traced each one to the item page it cites, and from there to the source:

- for 5.0 and 13.0, the transcript (with word confidences from `transcript.json`) and the frames;
- for 8.1 and 8.3, the PDF page images. I opened the images, not just the extracted text, so that arrows and boxes were read correctly.

Claims about how the reference was made were traced to `tools/training-analysis/prepare.py`, `.claude/workflows/analyze-training.js`, `tools/training-analysis/README.md` and the `analyze-training` skill. Each wrong claim was fixed where it appears.

**The trainer's accent.** The 5.0 trainer is a French speaker. I read his lines for what he means, not for how speech recognition spelled them. Before treating a 5.0 claim as wrong, I checked the word confidences. For example:

- "site" (67% sure) and "remanage" (73%) at [00:24] and [03:18] are recognition slips. The pages already correct them.
- The [02:22] line was heard clearly, at 89% to 99% per word. The problem there is the sentence's meaning, not his English, and one fix below corrects a page that blamed the transcription.

None of his rules turned out to be misread because of his accent.

## Result

| Claims checked | Correct | Fixed | Could not trace |
|---|---|---|---|
| 63 | 48 | 14 | 1 |

Each fixed claim is counted once, even when the fix was made in more than one place.

## Claims checked

Citations follow the rest of the reference: `5.0 [01:31]` = said at 1:31, `5.0 [00:44 t00044]` = on screen in frame t00044, `8.1 [p2]` = PDF page 2.

### README.md

| # | Where | Claim | Source traced | Result |
|---|---|---|---|---|
| 1 | How it was made, step 1; Using it to write quizzes, step 2 | The files for this run were downloaded into `training-work/`, and a frame can be opened at e.g. `training-work/items/5.0/frames/t00044.jpg` | Each item's `meta.json` and evidence pack paths: this pilot's work folder was a temporary session folder outside the repo | **Fixed.** Now says `training-work/` is the usual folder, that this pilot used a temporary one, and that frames must be prepared again to be opened |
| 2 | After the step list | "Steps 1 to 4 are done by `prepare.py`" | `prepare.py` takes `--src` with files already downloaded. Both `tools/training-analysis/README.md` (Pipeline, "1. Download: you or Claude in Chrome") and the skill (section 2) give the download to a person or Claude in Chrome | **Fixed.** Step 1 is done by hand; steps 2 to 4 are done by `prepare.py` |
| 3 | Step 2 | Words below 50% confidence are marked `{word?}`, doubtful lines ⚠. The language is forced to English and the model is primed with Revibe terms | `prepare.py`: `LOW_WORD = 0.5`, `LOW_SEGMENT`, `--language en`, `VOCAB` | Correct |
| 4 | Step 3 | A frame is kept when the screen settles after a real change, or after 20 s. A moving cursor alone doesn't count, and busy regions (the webcam) are ignored | `prepare.py`: `pick_frames`, `MAX_GAP = 20`, `MIN_CELLS = 3`, `MASK_MEDIAN` | Correct |
| 5 | Step 4 | At most 40 frames or 8 minutes per evidence pack | `prepare.py`: `CHUNK_FRAMES = 40`, `CHUNK_SECONDS = 480` | Correct |
| 6 | Steps 5 to 10 | Order: analyst per part → adversarial checker (removes or corrects, then re-reads to add what was missed) → writer → critic, with each finding re-checked before it is applied → topic pages → reference pages → two auditors | `analyze-training.js`: `doItem`, `verifyPrompt`, `fixPrompt`, the Reference and Audit phases | Correct |
| 7 | Run stats | "All 23 of its findings were checked against the evidence and applied" | Item pages, Checking log → Review: 5.0 6 applied, 8.1 5, 8.3 3, 13.0 9; none skipped | Correct |
| 8 | Limits, "The screen wins" | 5.0's "site" → "side", "Revive" → "Revibe" and "I remanage your disposal" → "I remain at your disposal" are given as examples of the screen showing the right word | 5.0 item page, Speech recognition fixes, Basis column. Only "Revibe" rests on the screen (URL at 5.0 [00:00 t00000]). "side" rests on his own "from your side" at 5.0 [01:09]. "remain at" rests on the French courtesy phrase. No frame shows either word | **Fixed.** Now says the screen comes first, then the trainer's own words or the plain sense of the sentence, and gives each example with its real basis |
| 9 | Limits, "Nothing is guessed" | "Where nothing on screen confirms a line, it stays marked as unclear" | The same fixes table: "side" and "remain at your disposal" are corrected without screen evidence, from the surrounding speech | **Fixed.** Now says "where neither the screen nor the surrounding speech settles what a line means" |
| 10 | Limits, "Nothing is guessed" | The 5.0 [02:22] line contradicts itself; the pages give the possible readings without choosing one | Transcript 5.0 [02:22] [02:31]; 5.0 item page, Unclear passages | Correct |
| 11 | Using it to write quizzes, step 6 (also quiz-plan "Before you write", and topic 8 How it works) | Issues (8.1) and wrong device (8.3) "share the first four steps but differ after the seller decides" | 8.1 [p1] Step 3: automatic AWB for "AE & ZA". 8.3 [p1] Step 3: automatic for "AE & Others" (Quiqup / DHL), and "Repair partner: always auto (SA = Naqel)". The steps are the same, but the pickup rules are not | **Fixed** in all three places. Both claim types go through the same four opening steps, but their Step 3 pickup rules differ, and their paths split after the seller decides |
| 12 | Refreshing the reference, step 2 | Running `prepare.py --only <ids>` redoes those items after a file changed | `prepare.py` reuses an existing `transcript.json` (line 276) and skips frame and page images that already exist (lines 223, 296), even with `--only`. A changed video would keep its old transcript | **Fixed.** Now says to delete `training-work/items/<id>/` first for a changed file |
| 13 | Catalog, Audience | 5.0 Seller; 8.1 and 8.3 Seller & KAM; 13.0 not labelled, speaks to the seller as "you" | File names in `meta.json`; 13.0 [00:05] "Open your seller performance dashboard" | Correct |
| 14 | Using it to write quizzes | Pierre asked for at most 20 questions per video, a mix of single and multiple answer, written by people | Found only in the workflow's quiz-plan prompt. His original request is not in the repo or the material | **Could not trace** to its original source |

### topics/5-cancellations.md

| # | Where | Claim | Source traced | Result |
|---|---|---|---|---|
| 15 | How it works, 1 | A customer cancels for one of two reasons: a change of mind, or a shipment delayed on the seller's side | 5.0 [00:14] [00:20] [00:24]. "site" is a recognition slip for "side" (67% sure); he says "from your side" at [01:09] | Correct |
| 16 | How it works, 2 | A cancelled order has a small purple bar on the left of its row | 5.0 [00:36]; t00036 shows the bar on row 65068-1 | Correct |
| 17 | How it works, 3 | While the order is on hold, the seller can't edit it or do anything else, and must first respond to the claim | 5.0 [00:44] [00:51]; t00044 banner "This order is currently on hold (about 1 hour ago)." | Correct |
| 18 | How it works, 4 and 5 | Order: open the order → Claims section (Type 'Cancellation', Stage 'To be cancelled') → click the Claim ID → the Claim Details tab with Mark valid / Mark Invalid | 5.0 [00:56]; t00044, t00056, t00076 | Correct |
| 19 | How it works, 6 | No response within 24 hours after the cancellation → treated as valid: order cancelled, customer refunded | 5.0 [01:09] [01:16] [01:22] | Correct |
| 20 | How it works, 7 (table) | UAE and South Africa at the Created stage: the seller must always accept | 5.0 [01:31] [01:38] | Correct |
| 21 | How it works, 7 (table) | UAE and South Africa at the quality check stage: may reject, then must ship within the next 24 hours | 5.0 [01:45] [01:53] [02:01] | Correct |
| 22 | How it works, 7 (table) | Saudi Arabia: may always reject, then must ship within the next 24 hours | 5.0 [02:01] [02:07] [02:15] | Correct |
| 23 | How it works, 9 | Rejecting needs a tracking ID; which countries this covers is ambiguous. In the demo, a UAE order with no tracking ID got the error and the 'Add tracking ID' pop-up | 5.0 [02:15] [02:22]; t00139; t00044 (Country United Arab Emirates); t00036 (Tracking ID '-') | Correct |
| 24 | How it works, 11 | (Unconfirmed) after rejection the order goes back to normal. This is said but not shown: at the end the claim is still Open and the purple bar is still on the row | 5.0 [02:40] [02:48]; t00202 | Correct |

### topics/13-commitments.md

| # | Where | Claim | Source traced | Result |
|---|---|---|---|---|
| 25 | How it works, 2 | Path: Seller Performance → Commitments tab, between Price recommendations and Payment. The clicks are not shown | 13.0 [00:05]; t00007 (tab already selected) | Correct |
| 26 | How it works, 6 and 7 | For each device, type your own price and quantity or click "Use suggested". Leave unwanted devices empty; only filled devices count | 13.0 [00:28] [00:33]; t00007 bullets; t00032, t00034 | Correct |
| 27 | How it works, 8 | The colour split is optional but must add up. If it doesn't: red quantity field, error, red "120 / 200", "1 line to fix", and the device drops out of the totals (1 device, 225 units). It counts again at "200 / 200" | 13.0 [00:36] [00:38]; t00039, t00043 | Correct |
| 28 | How it works, 9 | Order of save states: "Nothing saved yet." → "Unsaved changes" → click "Save my offer" → "Saved ✓ <date, time>" | 13.0 [00:41]; t00007, t00034, t00043, t00045 | Correct |
| 29 | How it works, 10 | The offer can be changed as often as you like until submissions close; every version is kept in "Saved versions" | 13.0 [00:43] [00:46]; t00007 bullet 3; t00045 | Correct |
| 30 | How it works, 11 | After the close, **Revibe** reviews the offers and confirms the accepted commitments with the seller. Saving is not acceptance | t00007 bullet 4 ("After the close, Revibe reviews the offers and confirms the accepted commitments with you.") | Correct |
| 31 | How it works, 12 | Accepted commitments are locked in the buybox at the seller's price for the whole window, until the quantity is sold | 13.0 [00:48] [00:53]; t00049 | Correct |

### topics/8-warranties.md

| # | Where | Claim | Source traced | Result |
|---|---|---|---|---|
| 32 | How it works, 1 | Within 1 year with no misuse → the original seller repairs. After 1 year, or misuse declared by the customer → the Revibe Repair Partner (RC+), and the original seller doesn't see the claim | 8.1 [p1] banner and "Which repair supplier?"; 8.1 [p3] Route B | Correct |
| 33 | How it works, 3 (Step 2) | The agent checks the claim and requests missing documents; not provided → Cancelled; complete → Pending Collection; for issues, the repair supplier is assigned | 8.1 [p1] Step 2; 8.3 [p1] Step 2 | Correct |
| 34 | How it works, 4 (Step 3 table) | Automatic AWB for AE & ZA (8.1) and AE & Others with Quiqup / DHL (8.3); the seller creates it manually in SA; always automatic for a repair partner (SA = Naqel) | 8.1 [p1]; 8.3 [p1] | Correct |
| 35 | How it works, 5 | Status order: Pending → Pending Collection → Under Collection → In Transit → Under QC. The seller sees the claim once the courier delivers | 8.1 [p1] Steps 1 to 4 | Correct |
| 36 | How it works, 4 | Collection failed: the agent asks the customer about a new AWB. Yes → new AWB (automatic in AE & ZA, by the seller in SA) → Under collection; No → Cancelled | 8.1 [p1] "If the pickup fails" box | Correct |
| 37 | How it works, 6 | Valid issue: Under repair → the seller clicks "Repair finished" → Ship back under collection → Shipped back → Delivered. In SA the seller creates and pays the AWB; in AE & ZA Revibe makes it and 30 AED is deducted | 8.1 [p2] VALID panel | Correct |
| 38 | How it works, 6 | Valid issue, delivery failed: the customer refuses → the agent asks → Yes: the seller pays a new AWB; No: Device disposed | 8.1 [p2] DELIVERY FAILED box | Correct |
| 39 | How it works, 6 | Valid wrong device: the seller confirms stock. Available → correct device shipped; not available → automated refund charged to the seller (actual cost), case closed | 8.3 [p1] VALID box | Correct |
| 40 | How it works, 7 | Invalid issue: reason + proof → Invalid claim → agent review. Agrees → Lab (AE only; outside AE the agent's confirmation is final). Challenges → Valid with a rationale: "Seller must cover" → Under revision → the seller re-marks → the agent reviews again (Invalid → Lab); "Misuse but customer has RC+" → seller quotation | 8.1 [p2] INVALID panel ① ② and OUTSIDE AE box | Correct |
| 41 | How it works, 7 | Invalid wrong device: good proof → Lab; rejected → re-marked Valid → replacement or refund; repair partner → no Lab, Revibe decides | 8.3 [p1] "Revibe checks proof" box | Correct |
| 42 | How it works, 7 | Lab collection (AE): Pending lab collection, a Quiqup AWB is auto-created and **the seller** hands the device to Quiqup → In transit to lab → Lab under QC | 8.1 [p2] ③ | Correct |
| 43 | How it works, 8 | Route A order: the seller marks Invalid (misuse) → the agent marks "Misuse but customer has RC+" → the original seller quotes and repairs, and Revibe covers the cost | 8.1 [p3] Route A | Correct |
| 44 | How it works, 8 | Quotation: the repairer enters the price → Seller quotation review → agent approval (No → back to quotation; Yes → cost check). ≤ 1,500 AED: Revibe covers it. > 1,500 AED: Pending customer payment; not paid → no repair, shipped back, RC+ cancelled | 8.1 [p3] QUOTATION and the two cost boxes | Correct |
| 45 | How it works, 9 | Failed ship-back: "If the customer refuses, the device is disposed of" (8.1 [p2] [p3]; 8.3 [p1]) | Only 8.1 [p2]'s Valid path names the customer. 8.1 [p3] says "refused → device disposed", and 8.3 [p1] says "refused → device sent to disposal", with no one named. 8.3's ship-back may go to the seller (after Lab Valid) | **Fixed.** Now says "if that is refused", and that only 8.1's Valid path names the customer |
| 46 | Seller version vs KAM version | The action tags read as seller actions, but 8.3 notes the page doesn't say this outright | 8.1 [p1], 8.3 [p1]; 8.3 item page, Unclear passages | Correct |

### glossary.md

| # | Where | Claim | Source traced | Result |
|---|---|---|---|---|
| 47 | Device disposed | "8.1's Lab Invalid outcome has no disposal step" | 8.1 [p2] Lab Invalid box ends "Delivery failed → new attempt, or Device disposed" | **Fixed.** 8.1 disposes of the device after a failed ship-back. It gives no outcome for non-payment, beyond the 90 days to pay in ZA & SA |
| 48 | Revibe agent / Revibe Agent Check | 8.1: "The agent then assigns the repair supplier" | 8.1 [p1] Step 2: "Once complete, the repair supplier is assigned." The sentence is passive and names no one | **Fixed.** Now says the supplier is assigned, and that the page doesn't say by whom |
| 49 | Revibe agent / Revibe Agent Check | "On both pages the agent also reviews Invalid claims" | 8.1 [p2] "② Revibe agent review"; 8.3 [p1] says "Revibe checks proof" / "Revibe Review", with no agent named | **Fixed.** Now says the agent reviews Invalid claims in 8.1, while 8.3 says only "Revibe" |
| 50 | Saved versions | An expandable list "under the offer bar" | t00045: the list sits inside the offer bar, below "Last saved …" (the glossary's own "Your offer" entry also puts it in the bar) | **Fixed.** Now says "in the offer bar, below the 'Last saved' line" |
| 51 | Under revision / Seller must cover | The agent challenges with "Seller must cover" → Under revision → the seller marks Valid or Invalid again → the agent reviews again → still Invalid → Lab | 8.1 [p2] ② | Correct |
| 52 | Mark valid / Mark VALID (5.0) | Required for UAE and South Africa at the Created stage; applies automatically after 24 hours without a response | 5.0 [01:09] [01:16] [01:31] [01:38] | Correct |
| 53 | On hold | The trainer says the seller can't edit the order or do anything with it until they respond to the claim | 5.0 [00:44] [00:51] | Correct |
| 54 | Collection failed | 8.3 does not cover a failed pickup | 8.3 [p1]: no collection-failed box | Correct |
| 55 | Quiqup / DHL / Naqel | 8.1 names Quiqup for lab collection (the seller hands the device over); 8.3 names it for the AE pickup | 8.1 [p2] ③; 8.3 [p1] Step 3 | Correct |

### gaps-and-conflicts.md

| # | Where | Claim | Source traced | Result |
|---|---|---|---|---|
| 56 | C1 | 8.1 limits the Lab to AE ("No Lab yet" outside); 8.3 sends good proof to the Lab with no market limit, except for a repair partner | 8.1 [p2] "③ Lab collection (AE only)" and OUTSIDE AE box; 8.3 [p1] | Correct |
| 57 | C3 | Issues: a challenged Invalid with "Seller must cover" goes to Under revision. Wrong device: rejected proof is re-marked Valid, with no revision step | 8.1 [p2]; 8.3 [p1] | Correct |
| 58 | W5 | In SA the seller creates the pickup AWB at Step 3, but Step 4 says the seller sees the claim once the courier delivers | 8.1 [p1]; 8.3 [p1] | Correct (see row 63 for the item page this cites) |
| 59 | Q15, warranty claims | To contest, the seller marks INVALID with proof, Revibe reviews it, and "The Lab makes the final decision" | 8.1 [p2]: the agent can challenge and mark the claim Valid; only "Agrees → device sent to the Lab". 8.3 [p1]: "Proof rejected → re-marked Valid"; "Repair partner: no Lab, Revibe decides" | **Fixed.** Now says the Lab decides only if Revibe agrees with the seller. Otherwise the claim is marked Valid, and for a repair partner Revibe decides |

### quiz-plan.md

| # | Where | Claim | Source traced | Result |
|---|---|---|---|---|
| 60 | Before you write | "Where the meaning of a line is unclear (5.0 [02:22] [02:38]), the transcription is the problem" | `transcript.json`: every word at [02:22] was heard with 89% to 99% confidence, so the sentence itself is what's unclear (the README, the topic page and gaps F6 all say so). At [02:38], "link" (88%) may be a mishearing | **Fixed.** Now says not to test either line. At [02:22] the words were heard clearly but the sentence contradicts itself; at [02:38] "link" may be misheard. This no longer blames the transcription, or him, for a line he phrased ambiguously |
| 61 | Seeds 1, 7, 8, 12 | Seed 1: purple bar → on hold → Claim ID → Claim Details → Mark valid / Invalid. Seed 7: SA collection failed → the agent asks → the seller creates a new AWB → Under collection; No → Cancelled. Seed 8: AE Invalid agreed → Pending lab collection → Quiqup, handed over by the seller → Lab Valid: refund, device back to the seller. Seed 12: only SA needs the seller to book the pickup | 5.0 [00:36 t00036] [00:44] [00:56 t00056] [01:16 t00076]; 8.1 [p1] [p2]; 8.3 [p1] | Correct |
| 62 | Seeds 17, 20; suggested order | Seed 17: saving ≠ acceptance. Seed 20: changes allowed until submissions close, every version kept. Suggested order: follow the folder numbering, since nothing in the material asks for another | t00007 bullets 3 and 4; 13.0 [00:43] [00:46]; t00045. The material has no ordering instruction; the trainer only recommends rewatching the orders app video (5.0 [03:00] [03:07]) | Correct |

### Item page wording found while tracing

| # | Where | Claim | Source traced | Result |
|---|---|---|---|---|
| 63 | [items/8.1.md](items/8.1.md), Unclear passages (cited by gaps W5) | "Step 4 says the seller can see the claim **only** once the courier delivers it" | 8.1 [p1] Step 4: "Once the Courier Company delivers the seller can see the claim". There is no "only", and 8.3's critic had already rejected the same wording (8.3 item page, Review 1) | **Fixed.** "only" removed, and the page now notes that the PDF doesn't say it |

## Notes for the team

- **The tracking-ID rule in 5.0 is still open.** The audit doesn't change it, because it can't be settled from the material. The pauses in the audio (1.1 s after "Saudi Arabia orders only," and again after "UAE and South Africa orders.") fit reading (a) on the item page. However, the demo shows a UAE order being asked for a tracking ID. Ask the trainer.
- **`prepare.py --only`** reuses an item's old transcript and images. The README now gives the workaround (delete the item's folder first). The same "redoes specific items" wording is in `tools/training-analysis/README.md` and the `analyze-training` skill, which are outside this audit.
