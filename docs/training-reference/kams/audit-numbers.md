# Audit: numbers, dates, prices, IDs and names

This audit traced 58 claims from the reference pages back to the evidence. The claims are numbers, dates, deadlines, prices, percentages, currencies, IDs and names. The pages checked were [README](README.md), [quiz-plan](quiz-plan.md), [gaps-and-conflicts](gaps-and-conflicts.md), [glossary](glossary.md) and the topic pages [5](topics/5-cancellations.md), [8](topics/8-warranties.md) and [13](topics/13-commitments.md). Each claim was followed to the item page it cites, then to the transcript, frame or PDF page in the pilot's work folder (`work/items/<id>/`, not committed).

**Result:** 53 correct, 3 fixed, 2 could not be traced to the training material.

## What was fixed

| Page | Was | Now | Why |
|---|---|---|---|
| README, Limits | "The model can also mishear a word with full confidence: ... 'on your site' with no mark" | No mark because the model was 67% sure of "site", above the 50% cut-off | `transcript.json` gives "site" a probability of 0.67 at 0:25.9. It was not marked because it cleared the 50% bar, but 67% is not full confidence. |
| Glossary, speech table | "created stage" / "quality check stage" "heard with full confidence" | "heard with high confidence (83% to 100% per word, so not marked)" | `transcript.json`: created 0.96, stage 1.00; quality 0.83, check 0.98, stage 1.00. |
| Topic 13, Contradictions (also item 13.0, Possibly out of date) | The "15 Oct, 15:49" save time cited to (13.0 [00:07]) only | Cited to [00:07 t00007] and [00:45 t00045] | The date is right, but the save time appears only on frame t00045. Frame t00007 shows only the countdown. |

## Spoken numbers and the trainer's accent

The trainer in 5.0 is a French speaker, and no frame in 5.0 shows the 24-hour rules. So the spoken numbers were checked against the speech recognition's own confidence:

- "24" is said three times, at 1:12, 2:03 and 2:14, each at 99% to 100%. "hours" is at 99% to 100% each time.
- "one hour" (0:47) is at 97% and 100%, and it matches the on-screen banner "about 1 hour ago".
- The country names are clear: "UAE" at 80% to 98%, "South Africa" at 98% to 99%, and "Saudi Arabia" at 59% to 100%. At 2:04, "Saudi" (59%) is the least certain, but "Arabia" in the same phrase is at 100%.
- 13.0's dates are all at 99% to 100%: "20th", "10th", "22nd" and "October". "6 {p?}.m." is the one weak spot ("p" at 18%), and the screen settles it as 18:00.

So the 24-hour rules and the round's dates aren't speech-recognition slips. The open question in 5.0 is still what the tracking-ID sentence at [02:22] means, not any number in it.

## Every claim checked

"Correct" means the claim matches the evidence character by character. Frames are `work/items/<id>/frames/tNNNNN.jpg`, and PDF pages are `work/items/<id>/pages/pNNN.png`.

### README

| # | Claim | Traced to | Result |
|---|---|---|---|
| 1 | 5.0 is a 3:23 video with 16 frames and 10 of 519 low-confidence words | `5.0/meta.json`: duration 203 s, frames 16, words 519, low_confidence_words 10. `transcript.md` has 10 `{word?}` marks | Correct |
| 2 | 13.0 is a 1:01 video with 15 frames and 2 of 174 low-confidence words | `13.0/meta.json`: 61 s, 15 frames, 174 words, 2 low-confidence | Correct |
| 3 | 8.1 is a 3-page PDF, 8.3 is a 1-page PDF, and the onboarding notes are 19 pages | `8.1/pages` p001–p003; `8.3/pages` p001; notes `meta.json` pages 19 | Correct |
| 4 | Words under 50% confidence are marked; the model is faster-whisper large-v3-turbo; it was primed with Revibe, Buybox, KAM and AED | `prepare.py` LOW_WORD = 0.5 and VOCAB; `meta.json` asr "faster-whisper:large-v3-turbo" | Correct |
| 5 | A frame is forced after 20 seconds; a pack holds at most 40 frames or 8 minutes | `prepare.py` MAX_GAP = 20, CHUNK_FRAMES = 40, CHUNK_SECONDS = 480 | Correct |
| 6 | "site" was misheard "with full confidence" | `5.0/transcript.json`: "site" p = 0.67 | **Fixed** (see above) |
| 7 | 13.0 window 20 Oct to 10 Nov 2026; close Thu 22 Oct 2026, 18:00 UAE time | 13.0 [00:00] [00:12] [00:17]; t00007 "Commitments · 20 Oct 2026 → 10 Nov 2026" and "Thu 22 Oct, 18:00 (UAE time)". 22 Oct 2026 is a Thursday | Correct |
| 8 | 5.0's policy was "just launched" around May 2025 | 5.0 [00:00]; t00044 Claim Date 2025-05-19T10:57:26.204Z; t00000 Confirmed Date 19/05/2025 | Correct |
| 9 | Suggested questions 3 + 20 + 14 + 1 = 38 | Topic blueprints 5, 8 and 13 | Correct |
| 10 | Run stats: facts 23/54/38/28, checked 66/117/74/68, removed 4/0/0/0, corrected 16/18/22/15, added 7/4/5/4; totals 143/325/4/71/20 | `data/<id>/part-1.json` (number of facts and the `audit` block) | Correct |
| 11 | Critic findings 6/5/3/9 = 23 | Review lists on the item pages: 6, 5, 3 and 9 entries | Correct |
| 12 | No critic finding was high severity ("(0)" for each item) | Only 8.3's Review gives severities (medium, low, low). The 5.0, 8.1 and 13.0 Reviews and the work folder don't record them | Could not trace for 5.0, 8.1, 13.0 |
| 13 | 75 of 325 claims removed or corrected, "about 1 in 4" | 4 + 71 = 75; 75 / 325 = 23% | Correct |

### Topic 5. Cancellations

| # | Claim | Traced to | Result |
|---|---|---|---|
| 14 | Video length 3:23 | `5.0/meta.json` 203 s | Correct |
| 15 | Banner "This order is currently on hold (about 1 hour ago)." | t00044 banner; [00:44] "on hold since one hour" | Correct |
| 16 | Claim Type 'Cancellation', Stage 'To be cancelled', Subtype 'Change of mind' | t00044 Claims table; t00076 Stage, Status 'Open', Type | Correct |
| 17 | No response within 24 hours → treated as valid, order cancelled, customer refunded | [01:09] "within 24 hours after the order has been cancelled", [01:16] [01:22] | Correct |
| 18 | UAE & South Africa: Created → must accept; quality check → may reject, ship within 24 hours. Saudi Arabia: may always reject, ship within 24 hours | [01:31] to [02:15] | Correct |
| 19 | Error "Tracking ID is required to mark the claim as invalid" on a UAE order with no tracking ID | t00139 toast; t00044 and t00076 Country 'United Arab Emirates'; t00000 Tracking ID '-' | Correct |
| 20 | Demo claim dated 2025-05-19 | t00044 Claim Date | Correct |

### Topic 8. Warranties

| # | Claim | Traced to | Result |
|---|---|---|---|
| 21 | Within 1 year with no misuse → original seller; after 1 year or misuse declared → Revibe Repair Partner (RC+) | 8.1 p1 banner and "Which repair supplier?" box | Correct |
| 22 | Pickup couriers: AE = Quiqup, Others = DHL, repair partner in SA = Naqel | 8.3 p1, Step 3 | Correct |
| 23 | Ship-back in AE & ZA: AWB by Revibe, 30 AED deducted from the seller; SA seller creates and pays | 8.1 p2, "SHIP-BACK COST" | Correct |
| 24 | Lab Invalid, ZA & SA: customer pays shipping, Stripe code entered once paid, 90 days to pay | 8.1 p2, "Lab final decision" box | Correct |
| 25 | RC+ covers repairs up to 1,500 AED; above it the customer pays (cost − 1,500 AED); not paid → no repair, shipped back, RC+ cancelled | 8.1 p3 banner, "≤ 1,500 AED" and "> 1,500 AED" boxes | Correct |
| 26 | Lab collection is AE only; Quiqup AWB auto-created | 8.1 p2 ③ | Correct |
| 27 | 8.1 has 48 ★ facts and "about 25 key rules" | `items/8.1.md`: 48 ★ facts; 24 bullets under Rules and policies, so 25 is a fair estimate | Correct |
| 28 | 8.3 keep-out cites "fact 18 for SA" | `items/8.3.md` ★ fact 18 is the Under QC / SA visibility fact | Correct |
| 29 | Topic total 34 (20 + 14); area weights add up to 20 and 14 | Topic 8 blueprint | Correct |

### Topic 13. Commitments

| # | Claim | Traced to | Result |
|---|---|---|---|
| 30 | 1:01 video with no audience label | `13.0/meta.json` 61 s, audience null | Correct |
| 31 | Window 20 Oct 2026 → 10 Nov 2026 (the year is on screen only) | [00:00] "from the 20th of October to the 10th of November"; t00007 heading | Correct |
| 32 | Submissions close Thu 22 Oct, 18:00 (6 PM) UAE time | [00:12] [00:17]; t00007, t00012 and t00017 "Thu 22 Oct, 18:00 (UAE time)"; t00012 caption "6 PM"; t00049 "Submit before Thu 22 Oct, 6 PM (UAE time)" | Correct |
| 33 | Table "UAE & South Africa · 19 devices open", price column "YOUR PRICE (AED)" | t00020 | Correct |
| 34 | iphone-12 · 64 GB · Good suggested 495 / 245 | t00020 | Correct |
| 35 | Typed 480 / 200 → bar "AED 96,000"; iphone-14 · 128 GB · Good filled 865 / 225 | t00032, t00034 | Correct |
| 36 | "Your offer: 2 devices, 425 units, AED 290,625"; 865 × 225 = 194,625 | t00034, t00039; 480 × 200 = 96,000 and 96,000 + 194,625 = 290,625 | Correct |
| 37 | Black 120 against 200: "Colours add up to 120, not 200.", red "120 / 200", "1 line to fix", totals 1 device, 225 units; then Black 120 + White 50 + Purple 30 = "200 / 200" | t00039, t00043 | Correct |
| 38 | Countdown and "15 Oct, 15:49" save time date the recording | t00007 "7d 02:10:57" (= 15 Oct 15:49:03 before the 22 Oct 18:00 close); t00045 "Saved ✓ 15 Oct, 15:49" | **Fixed** citation (see above) |
| 39 | 17 ★ facts on the item page | `items/13.0.md` ★ list | Correct |

### Glossary

| # | Claim | Traced to | Result |
|---|---|---|---|
| 40 | Demo Claim ID xtCJK8 | t00076 Claim ID field; t00044 link | Correct |
| 41 | SKU for iphone-12 · 64 GB · Good in Black: 010113-060101 | t00039, zoomed. The other colours on the item page also match: White 010113-060201, Purple 010113-060801, Blue 010113-061101, Lime Green 010113-060701, Red 010113-060901 | Correct |
| 42 | Seller Performance tabs: Performance, Score, Score analysis, Claims management, Price recommendations, Commitments, Payment | t00007 | Correct |
| 43 | Stage names "heard with full confidence" | `5.0/transcript.json` (83% to 100%) | **Fixed** (see above) |
| 44 | "6 {p?}.m." means 18:00 (6 PM) UAE time | [00:12]; t00007, t00012 | Correct |
| 45 | 30 AED ship-back deduction and 1,500 AED RC+ cap | 8.1 p2, p3 | Correct |

### Gaps and conflicts

| # | Claim | Traced to | Result |
|---|---|---|---|
| 46 | The deadline (22 Oct 2026) is the day after the reference was built (21 Oct 2026) | README build date; t00007 | Correct |
| 47 | Counts: 4 contradictions, 9 tensions, 20 questions (0 fully, 3 partly, 17 not covered), 27 fixes (5 + 15 + 7) | Rows in the page's own tables | Correct |
| 48 | D6: countdown "7d 02:10:57" and save time "15 Oct, 15:49" | t00007, t00045 | Correct |
| 49 | Personal data frames: P1 t00044 then t00052–t00202; P3 tab first seen at 1:16 (t00076), behind the pop-up t00139–t00160 (2:19 to 2:40) | `5.0/frames` list | Correct |
| 50 | Seller trading name 'Hamza Bashir Trading' | t00044 (Original Supplier, Supplier), t00076 | Correct |
| 51 | Bookmarks 'Series B', 'Cash appart', 'Interactive Brokers' | t00000 bookmarks bar | Correct |
| 52 | Notes pages 1 to 10 are three KAMs' notes, pages 11 to 19 are the final draft, and p13 groups the gaps into 8 areas | Notes p1, p5 and p8 (one author per header), p11 "Final draft", p13 table rows 1 to 8 | Correct |
| 53 | Boxes are delivered on Wednesdays; sellers can request again the following week | Notes p7, p16 | Correct |
| 54 | N1: "cancellation" is transcribed with full confidence at [01:04] and [01:45] | `5.0/transcript.json`: 0.99 and 1.00 | Correct |

### Quiz plan

| # | Claim | Traced to | Result |
|---|---|---|---|
| 55 | ★ facts 16 + 48 + 36 + 17 = 117 | ★ lists on the four item pages | Correct |
| 56 | Videos get 4 questions, PDFs get 34; 17 multiple-answer candidates (4, 6, 4, 3) | Arithmetic; the page's own table | Correct |
| 57 | 12 topic picks among the 20 seeds, and the seed numbers under "Seeds not picked" (5.0 seeds 6, 7, 8; 8.1 seeds 3, 5; 8.3 seeds 1, 2, 7; 13.0 seeds 1, 3, 7, 8) | "(topic pick)" marks; Scenario seeds on the item pages | Correct |
| 58 | "Pierre asked for at most 20 questions per video" (also README) | Not in any transcript, frame or page. It is stated in the workflow brief, `.claude/workflows/analyze-training.js` | Could not trace to the material |

## Not reproduced here

The 5.0 frames show a customer's name, email, phone number and Dubai address. This audit checked them only to confirm what the gaps page says is visible (P1 to P3). It doesn't repeat them.
