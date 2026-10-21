# Gaps and conflicts

This page covers the four items in this pilot: [5.0 Cancellations](items/5.0.md), [8.1 Warranties - Issues](items/8.1.md), [8.3 Warranties - Wrong Device](items/8.3.md) and [13.0 Commitments](items/13.0.md). For those items, it lists:

- where the material contradicts itself;
- what looks out of date;
- what personal data is on screen;
- which of the new KAMs' onboarding questions the material answers;
- what to fix.

It uses only the item pages, the topic pages ([5. Cancellations](topics/5-cancellations.md), [8. Warranties](topics/8-warranties.md), [13. Commitments](topics/13-commitments.md)) and the new KAMs' onboarding notes, a 19-page PDF called "KAM onboarding notes (Training Questions doc)".

**Citations** follow the rest of the reference:

- `5.0 [01:31]` means said at 1:31 in the video.
- `5.0 [00:44 t00044]` means shown on screen, in the frame taken at 0:44.
- `8.1 [p2]` means printed on page 2 of the PDF.
- `Notes [p6]` means page 6 of the onboarding notes PDF.

Each finding has an id (C1, W1, N1, D1, P1, Q1). Section 5 uses these ids to tie each fix to its finding.

**About the trainer's accent.** The trainer in 5.0 is a French speaker, and speech recognition misheard some of his English (5.0 item page, Speech recognition fixes). This page doesn't count those mishearings as contradictions. They are listed separately in [1.3](#13-not-contradictions-speech-recognition-slips-in-50) so nobody mistakes them for conflicting rules. Only one line has a meaning that stays unclear: which countries need a tracking ID to reject a cancellation (W1). The fix is to confirm the rule with him and add it as a caption. Nothing about how he speaks needs changing.

## At a glance

- **Contradictions between items:** 4, all between the two warranty PDFs (C1–C4). The biggest is whether the Lab exists outside AE. None between the two videos.
- **Tensions within one item:** 9 (W1–W9). The most important is the tracking-ID line in 5.0 (W1).
- **Out of date:** 5.0's policy dates from about May 2025 (D1), and 8.1 says "No Lab yet" (D2). 13.0's dates belong to one round: its deadline is 22 Oct 2026, the day after this reference was built, and the window ends on 10 Nov 2026 (D3–D6).
- **Personal data on screen:** only in 5.0. It shows a customer's name, email, phone number and Dubai address, plus a seller's trading name (P1–P4). Blur them before sellers see the video.
- **New KAMs' questions:** 20. None is fully answered by these four items, 3 are partly answered and 17 are not covered (Q1–Q20).
- **Fixes:** 27 suggestions (F1–F27): 5 blur or crop, 15 to change the existing items and 7 for new material.

## 1. Contradictions

### 1.1 Between items

**Between the two videos (5.0 and 13.0), or between a video and the PDFs:** none found. The videos cover cancellations and commitments, and neither repeats a rule from the warranty PDFs.

**Between the two warranty PDFs (8.1 and 8.3):**

| # | Point | 8.1 Issues says | 8.3 Wrong device says | Status |
|---|---|---|---|---|
| C1 | Is there a Lab outside AE? | Lab collection is "AE only". Outside AE there is "No Lab yet", so the agent's confirmation of the seller's Invalid is final (8.1 [p2]) | Good proof sends the device to the Lab for the final decision, with no market limit. The only exception is a repair partner: no Lab, and Revibe decides (8.3 [p1]) | The pages disagree for a wrong-device dispute in SA, ZA or Others. 8.1's "No Lab yet" may be the dated side (D2), so either page could be out of date. Confirm with the trainer. Until then, don't quiz on the Lab for markets other than AE. |
| C2 | Who pays the ship-back after Lab Invalid | In AE, Revibe ships the device back. In ZA & SA, the customer pays the shipping fees (a Stripe code is entered once paid) and has 90 days to pay. 8.1 doesn't say what happens after the 90 days (8.1 [p2]) | The device is shipped to the customer if they pay and disposed of if they don't. There is no market split (8.3 [p1]) | An AE Lab Invalid is shipped back by Revibe under 8.1 but paid for by the customer under 8.3. The claim types differ, so this may be intended, but neither page says so. 8.1 also conflicts with itself: its ZA & SA rule sits under a Lab that it says doesn't exist outside AE. 8.1 keeps this rule out of the quiz until it is clarified. |
| C3 | Revibe rejects the seller's Invalid | The agent marks the claim Valid with a rationale. With "Seller must cover", it goes to Under revision: the seller marks it Valid or Invalid again, and the agent reviews it again (8.1 [p2]) | Rejected proof is re-marked Valid and goes to replacement or refund. There is no revision step (8.3 [p1]) | This is probably a deliberate difference between claim types, but neither page says so. Name the claim type in any question. |
| C4 | Markets where the pickup AWB is created automatically | "AE & ZA" (8.1 [p1]) | "AE & Others" (AE = Quiqup, Others = DHL) (8.3 [p1]) | Not strictly a contradiction: 8.3 doesn't say which markets count as "Others", or whether ZA is one of them. Don't mix the two labels in one question. Neither PDF expands AE, ZA, SA or AWB. |

### 1.2 Within one item (said vs shown, and lines that contradict themselves)

| # | Item | One side | Other side | Status |
|---|---|---|---|---|
| W1 | 5.0 | "This you will have to do it for Saudi Arabia orders only, for UAE and South Africa orders." The sentence contradicts itself (5.0 [02:22]) | On screen, Mark Invalid on a UAE order with no tracking ID gave the error "Tracking ID is required to mark the claim as invalid" and opened an 'Add tracking ID' pop-up (5.0 [02:19 t00139] [00:44 t00044] [00:00 t00000]) | This is most likely his French phrasing, not two conflicting policies. The item page gives three possible readings: (a) a tracking ID is needed for Saudi Arabia orders only, and for UAE & South Africa you just press Mark Invalid if the tracking ID is already on the order; (b) all three countries need it; (c) UAE & South Africa don't need it. The next line, "you won't need to put tracking ID link", is also garbled, and "link" may be a mishearing (5.0 [02:38]). **Confirm with the trainer.** Keep it out of quizzes until then. |
| W2 | 5.0 | The trainer says an on-hold order cannot be edited (5.0 [00:44]) | The order panel header shows an 'Edit' button while the on-hold banner is displayed (5.0 [00:44 t00044] [00:52 t00052]) | This may be because the demo is on the admin dashboard, stage-admin.revibe.me (5.0 [00:00 t00000]). The video doesn't show what happens if a seller tries to edit. |
| W3 | 5.0 | Said: once a cancellation is marked invalid, the order appears again as a normal order that can be edited (5.0 [02:40] [02:48]) | Shown: the rejection is never completed. At the end, the claim is still Open and the row still has its purple bar (5.0 [03:22 t00202]) | Said but not shown, so it stays unconfirmed. |
| W4 | 8.1 | Valid claim, failed delivery: "Yes → seller pays a new AWB", with no market split (8.1 [p2]) | Ship-back in AE & ZA: Revibe makes the AWB and 30 AED is deducted from the seller (8.1 [p2]) | It is unclear how an AE or ZA seller "pays" a new AWB. It is also unclear whether ZA sellers are charged 30 AED or a local amount. |
| W5 | 8.1, 8.3 | Step 3: in SA, the seller creates the pickup AWB manually (8.1 [p1]; 8.3 [p1]) | Step 4: the seller can see the claim once the Courier Company delivers (8.1 [p1]; 8.3 [p1]) | Neither page says how or where an SA seller sees the claim in time to create the AWB. Also open: who pays for the SA pickup AWB (8.1 [p1]). |
| W6 | 8.3 | The scope banner says the claim is "under warranty" (8.3 [p1]) | The same banner says "no warranty-period check" (8.3 [p1]) | The page doesn't say how these fit together, or whether any other time limit applies. Don't teach that wrong-device claims have no time limit. |
| W7 | 13.0 | The commitment window starts on 20 Oct (13.0 [00:00] [00:07 t00007]) | Submissions close later, on 22 Oct at 18:00, and Revibe confirms accepted commitments only after the close (13.0 [00:12] [00:07 t00007]) | The video doesn't say when accepted commitments start to apply in the buybox. |
| W8 | 13.0 | Closing narration: "Submit your offer before the 22nd of October" (13.0 [00:57]) | The slide, the countdown and the earlier narration all give Thu 22 Oct, 18:00 (6 PM) UAE time (13.0 [00:12] [00:12 t00012] [00:49 t00049]) | The closing line drops the time. This is a wording slip, not a speech-recognition error, because the 13.0 narration is clear. Use 18:00 UAE time on the 22nd. |
| W9 | 13.0 | The tab says "Prices are in AED, like your buybox quotes" (13.0 [00:07 t00007]) | The Saudi Arabia table is mentioned but never shown (13.0 [00:18]) | Not a contradiction, but unconfirmed: the video doesn't show whether the Saudi Arabia table also uses AED. |

### 1.3 Not contradictions: speech-recognition slips in 5.0

**N1.** The lines below were misheard because of the trainer's accented English. The 5.0 item page already corrects them. None of them changes a rule, and none needs re-recording.

| Time | Speech recognition heard | Read as | Basis |
|---|---|---|---|
| 5.0 [00:24] | "on your site the shipment is delayed" | "on your side ..." | The same speaker's "from your side" is transcribed correctly at [01:09]. This slip had no low-confidence mark, so the `{word?}` marks don't catch every mishearing. |
| 5.0 [02:15] | "mark the {cancellation?} as being invalid" | "cancellation" | The same phrase is transcribed with full confidence at [01:04] and [01:45]. The screen shows Type 'Cancellation' (5.0 [01:16 t00076]). |
| 5.0 [02:15] | "you will have to {input?} a tracking ID" | "input" | The 'Add tracking ID' pop-up is on screen (5.0 [02:19 t00139]). |
| 5.0 [03:14] | "the tools that Revive is providing to you" | "Revibe" | The URL stage-admin.revibe.me is visible (5.0 [00:00 t00000]). |
| 5.0 [03:18] | "I remanage your disposal, {meaning?} you have any further questions" | "I remain at your disposal, in case you have any further questions" | A French courtesy phrase ("je reste à votre disposition"). "In case" is inferred from context. |

In 13.0, speech recognition flagged only two words, and the screen confirms both: "Seller Performance" and "6 PM" (13.0 [00:05] [00:12] [00:07 t00007] [00:12 t00012]). 8.1 and 8.3 are PDFs with no narration.

## 2. Material that looks out of date

| # | Item | What | Signal | Source | What it affects |
|---|---|---|---|---|---|
| D1 | 5.0 | The cancellation policy | The trainer calls it "the new cancellation policy that we just launched". The demo claim is dated 2025-05-19, so the policy dates from about May 2025 | 5.0 [00:00] [00:44 t00044] | Three rules: the 24-hour response rule, the 24-hour shipping rule after a rejection, and the country/stage rules. Check that they still apply. |
| D2 | 8.1 | The Lab outside AE | "No Lab yet": the "yet" suggests the Lab may later reach ZA & SA | 8.1 [p2] | Whether the agent's confirmation is final outside AE. Linked to C1 and C2. |
| D3 | 13.0 | Dates for one round | The window runs from 20 Oct 2026 to 10 Nov 2026, and submissions close Thu 22 Oct at 18:00 UAE time. This reference was built on 21 Oct 2026 (README), so the deadline passes the next day | 13.0 [00:00] [00:12] [00:17] [00:07 t00007] [00:12 t00012] | Every date in the video. The process itself doesn't depend on them. |
| D4 | 13.0 | The call to action at the end | "Submit your offer before the 22nd of October", and the slide "Submit before Thu 22 Oct, 6 PM (UAE time)" | 13.0 [00:57] [00:49 t00049] | The closing narration and slide |
| D5 | 13.0 | The "new" Commitments tab | Narration: "the new commitments tab". Caption: "the new Commitments tab" | 13.0 [00:05] [00:07 t00007] | Wording only |
| D6 | 13.0 | The countdown and the save time | The countdown "7d 02:10:57" and the save time "15 Oct, 15:49" date the recording to about 15 Oct | 13.0 [00:07 t00007] [00:45 t00045] | On-screen values only |
| D7 | No specific item | Outdated material in general | The new KAMs say they were trained on "legacy tools or deprecated policies", and that "some training material refers to outdated tools or policies" | Notes [p6] [p15] | The notes don't say which material, and they don't name any of these four items. |

8.3: nothing flagged as out of date.

## 3. Personal data visible on screen

All of it is in 5.0. The frames are sampled whenever the screen changes, so check the video between the listed frames, not only the frames themselves. 5.0 runs 3:23.

| # | Item | Video time | Frames | What is visible | Action |
|---|---|---|---|---|---|
| P1 | 5.0 | 0:44 to the end | t00044, then every later frame (t00052–t00202) | The customer's full name in the order panel header. It may be a test order; the sources don't show whose name it is | Blur |
| P2 | 5.0 | Between 0:44 and 0:56, while the panel is scrolled down (seen at 0:52) | t00052 | The Customer Information section: the customer's name, personal email address, mobile phone number and full street address in Dubai | Blur |
| P3 | 5.0 | From when the Claim Details tab opens to the end. The Claim ID is clicked at 0:56, and the first frame showing the tab is at 1:16 | t00076, t00096, t00116, t00136, t00167, t00187, t00202, and faintly behind the pop-up on t00139–t00160 | The Claim Details fields: customer name, phone number, customer email and full address | Blur |
| P4 | 5.0 | 0:44 to the end | t00044 (Original Supplier in the Claims table, Supplier in Order Details), then Claim Details from t00076 | The seller trading name 'Hamza Bashir Trading', possibly a real seller. Other sellers watching would see it | Blur |
| P5 | 5.0 | The whole video | Every frame from t00000 | The browser bookmarks bar, with internal bookmarks such as 'Series B', 'Cash appart' and 'Interactive Brokers'. Not personal data | Crop |
| P6 | 5.0 | The whole video | Every frame | The trainer's webcam image (his face), bottom left. He is the presenter, not a customer | None needed. Keep it in mind if the frames are reused |

**None found:**

- **8.1 and 8.3:** they are workflow diagrams.
- **13.0:** it uses a demo account, "Demo Seller" with you@your-company.com (13.0 [00:07 t00007] [00:45 t00045]).
- **The onboarding notes:** they are internal, not seller material, and hold no customer or seller data. Their section headers give their authors' first names (Notes [p1] [p5] [p8]).

## 4. The new KAMs' questions and gaps

**The notes.** Pages 1 to 10 hold three new KAMs' own notes. Pages 11 to 19 are a combined final draft, which groups the gaps into 8 areas (Notes [p13]).

**Their key finding.** "The problem was not understanding the knowledge, data, or tools — it was not knowing what to do with them" (Notes [p2]; also [p12]). This matches what the topic pages found. All four items teach seller processes, and none has a KAM-specific version (see "Seller version vs KAM version" on the [5](topics/5-cancellations.md), [8](topics/8-warranties.md) and [13](topics/13-commitments.md) topic pages). Most of the notes' questions are about the KAM's own job: routine, tools, communication and support. That is why most of them come out as "Not covered" below.

**What "Not covered" means here.** Not covered by these four items. This run is a pilot, and other items in the "1. KAMs" folder may answer some of these questions (README, Scope of this run).

**Result:** 20 questions. None is fully answered, 3 are partly answered (Q4, Q13, Q15) and 17 are not covered.

| # | Area (Notes [p13]) | Question or gap | Where in the notes | Answer in the material |
|---|---|---|---|---|
| Q1 | Access & tools setup | Which tools, sheets and email groups do I need, and who grants access? | Notes [p6] [p14] | **Not covered.** |
| Q2 | Practical training | "I have the knowledge — what do I do now?" What do I do after training, before I have sellers? | Notes [p2] [p14] | **Not covered.** |
| Q3 | Practical training | What am I expected to do with the training material before I see live operations? How do I apply it to real situations? | Notes [p6] [p14] | **Not covered.** The items teach on demo screens, not live cases: 5.0 uses the stage admin dashboard and 13.0 uses "Demo Seller" (5.0 [00:00 t00000]; 13.0 [00:07 t00007]). |
| Q4 | Tools & dashboards | When a seller raises an issue, where do I check? | Notes [p2] [p15] | **Partly, for this pilot's three topics only.** <br>• **Cancellation:** the purple bar on the order's row, then the Claims section in Order Details, then the Claim ID link, which opens the Claim Details tab (5.0 [00:36 t00036] [00:44 t00044] [00:56 t00056] [01:16 t00076]). This was filmed on the admin dashboard (5.0 [00:00 t00000]). <br>• **Warranty claim:** the portal shows Tracking (original shipment), Pickup Tracking, Ship-Back and Lab (8.1 [p1]). All refunds, credits and charges appear in the payment tool (8.1 [p1] [p3]; 8.3 [p1]). <br>• **Commitments:** Seller Performance → Commitments tab, including the "Saved versions" list (13.0 [00:05] [00:07 t00007] [00:45 t00045]). <br>Not covered: sheets and tabs in general. |
| Q5 | Tools & dashboards | How do I confirm the information, and how do I know I'm in the right sheet or tab? | Notes [p2] [p15] | **Not covered.** |
| Q6 | Tools & dashboards | Which dashboard analyses should I check first, and do I need all of them? | Notes [p3] [p15] | **Not covered.** 13.0 shows the Seller Performance tabs (Performance, Score, Score analysis, Claims management, Price recommendations, Commitments, Payment) but explains only Commitments (13.0 [00:07 t00007]). |
| Q7 | Tools & dashboards | Which tools, policies and data sources are still current? | Notes [p6] [p15] | **Not covered** by any item. Section 2 lists what this reference flags as dated (D1–D6). |
| Q8 | Operational procedures | How do I update a seller's contact details (registered address, phone number)? | Notes [p6] [p7] [p16] | **Not covered.** |
| Q9 | Operational procedures | Which onboarding documents are accepted or rejected, and what do I do when information is missing or a document must be replaced? | Notes [p9] [p16] | **Not covered.** 8.1 and 8.3 mention documents only for a customer's warranty claim: the agent requests missing documents, and the claim is Cancelled if they aren't provided (8.1 [p1]; 8.3 [p1]). That is a different process. |
| Q10 | Operational procedures | How do box requests work: standard dimensions, how to request, delivery day, receiving fewer boxes than requested? | Notes [p7] [p16] | **Not covered.** The notes themselves record part of an answer, from the KAMs, not the training: boxes are delivered on Wednesdays; sellers may receive fewer than requested when stock is low, because all sellers' requests must be covered; and they can request again the following week (Notes [p7] [p16]). Confirm before teaching it. |
| Q11 | Operational procedures | When does payment happen? Payment confirmation vs transfer, payout schedule, bank reflection window | Notes [p6] [p7] [p16] | **Not covered.** The closest the material gets: refunds, credits and charges appear in the payment tool (8.1 [p1] [p3]; 8.3 [p1]), and 13.0 shows a Payment tab without explaining it (13.0 [00:07 t00007]). |
| Q12 | Seller communication | What do I say on first calls or messages, and what should I ask for? Includes introductions, missing documents, next steps, following up when a seller doesn't respond, and the check-in after onboarding | Notes [p9] [p16] [p17] | **Not covered.** |
| Q13 | Seller communication | How do I answer the most common seller questions? | Notes [p9] [p17] | **Partly, for this pilot's three topics.** The items answer common seller questions on their own topics. Examples: why customers cancel (5.0 [00:14] [00:20] [00:24]); why a seller can't see a warranty claim after 1 year or when misuse is declared (8.1 [p1] [p3]); where to see a refund they were charged (8.3 [p1]); which currency to enter for commitments (13.0 [00:07 t00007] [00:20 t00020]). |
| Q14 | Seller communication | How do I handle sellers who are disrespectful, have recurring communication issues, ignore the KAM's instructions, or escalate and file large complaints? When and how do I escalate? | Notes [p3] [p16] [p17] | **Not covered.** |
| Q15 | Seller communication | How do I handle sellers who refuse to accept a decision? | Notes [p3] [p17] | **Partly, for two kinds of decision.** <br>• **Cancellations:** for UAE and South Africa orders at the Created stage, the seller must always accept (5.0 [01:31] [01:38]). With no response within 24 hours, the cancellation counts as valid (5.0 [01:09] [01:16] [01:22]). <br>• **Warranty claims:** to contest, the seller marks the claim INVALID with a reason and proof, and Revibe reviews every Invalid claim (8.1 [p2]; 8.3 [p1]). Only if Revibe agrees with the seller does the device go to the Lab, which makes the final decision. If Revibe challenges the Invalid or rejects the proof, the claim is marked Valid instead (8.1: with a rationale, and "Seller must cover" sends it to Under revision; 8.3: re-marked Valid → replacement or refund) (8.1 [p2]; 8.3 [p1]). Outside AE, the agent's confirmation is final under 8.1 (8.1 [p2]); see C1. For a wrong-device claim with a repair partner there is no Lab, and Revibe decides (8.3 [p1]). <br>Not covered: how to handle the conversation itself. |
| Q16 | Monitoring & growth | How do I stay aware of a seller's activity without getting lost across tools? | Notes [p3] [p17] | **Not covered.** |
| Q17 | Monitoring & growth | Which signals mean something is wrong or needs action? How do I spot a seller's problems early? | Notes [p3] [p17] | **Not covered.** |
| Q18 | Monitoring & growth | How do I help an account grow and make more sales? | Notes [p4] [p17] | **Not covered.** The closest the material gets is 13.0's "Predictable volume": accepted commitments are locked in the buybox at the seller's price for the whole window, until the quantity is sold, so the seller can buy stock in advance with confidence (13.0 [00:48] [00:53] [00:54] [00:49 t00049]). The video doesn't present this as a growth lever. |
| Q19 | Daily routine | How should I organize and prioritize my day? How do I know my work and follow-ups are enough, and what counts as "done"? | Notes [p4] [p6] [p10] [p18] | **Not covered.** |
| Q20 | Support | Who do I go to for quick answers? | Notes [p4] [p19] | **Not covered.** |

## 5. Suggested fixes

Each fix names the finding it answers. "Confirm with the trainer" comes first wherever the right answer isn't in the material.

### 5.1 Blur and crop before sellers see 5.0

| # | Fix | Type | Item | Tied to |
|---|---|---|---|---|
| F1 | Blur the customer's name in the order panel header from 0:44 to the end | Blur | 5.0 | P1 |
| F2 | Blur the Customer Information block (name, email, phone number, Dubai address) wherever it is scrolled into view between 0:44 and 0:56 | Blur | 5.0 | P2 |
| F3 | Blur the customer name, phone number, email and address in Claim Details from when the tab opens (after the click at 0:56) to the end, including behind the pop-up from 2:19 to 2:40 | Blur | 5.0 | P3 |
| F4 | Blur the seller trading name wherever it appears from 0:44 on: Original Supplier, Supplier and Claim Details | Blur | 5.0 | P4 |
| F5 | Crop the browser bookmarks bar for the whole video | Crop | 5.0 | P5 |

### 5.2 Fix the existing items

| # | Fix | Type | Item | Tied to |
|---|---|---|---|---|
| F6 | Confirm with the trainer which countries need a tracking ID to reject a cancellation, and whether "already on the order → just press Mark Invalid" applies to every country. Then add an on-screen caption from 2:15 to 2:40, or a note under the video, giving the rule in plain words. Re-record only that passage if a caption isn't enough. What is unclear is the sentence's meaning, not his accent | Update (re-record only if needed) | 5.0 | W1 |
| F7 | Add subtitles using the corrected wording from the item page's Speech recognition fixes ("side", "Revibe", "I remain at your disposal"). The video has no subtitle track (README, Limits), and subtitles would help sellers follow the accented narration | Add | 5.0 | N1 |
| F8 | Finish the rejection on screen: enter the tracking ID, then show the claim leaving Open and the order back to normal without its purple bar. Alternatively, say in the narration that the demo stops before saving | Re-record (short insert) | 5.0 | W3 |
| F9 | Film on a seller account, or add a note that the demo is on the admin dashboard. Sellers may not see Mark Refunded, Cancel override or the Edit button on an on-hold order | Re-record or update | 5.0 | W2 |
| F10 | Confirm that the 24-hour response rule, the 24-hour shipping rule and the country/stage rules still apply. Drop "new ... just launched", and re-record any rule that has changed | Update | 5.0 | D1 |
| F11 | Decide whether the Lab applies outside AE, then make both PDFs say the same thing. If the Lab now covers ZA or SA, remove "No Lab yet" | Update | 8.1, 8.3 | C1, D2 |
| F12 | For each claim type and market, state who pays the ship-back after Lab Invalid and what happens if the customer doesn't pay. 8.1 gives 90 days but no outcome; 8.3 says the device is disposed of. In 8.1, say whether the ZA & SA customer-pays rule applies after the agent's final Invalid outside AE, or remove it | Update | 8.1, 8.3 | C2 |
| F13 | Say in one line whether skipping the revision step is intended: "Seller must cover" leads to revision for issues (8.1), while rejected proof goes straight back to Valid for a wrong device (8.3) | Update | 8.1, 8.3 | C3 |
| F14 | Use one set of market labels for automatic pickup. Say which markets "Others" covers and whether ZA is one of them. Add a legend for AE, ZA, SA, Others and AWB | Update | 8.1, 8.3 | C4 |
| F15 | Explain how a seller "pays a new AWB" after a failed delivery in AE & ZA, where Revibe makes the AWB. Say whether ZA sellers are charged 30 AED or a local amount | Update | 8.1 | W4 |
| F16 | Explain how and where an SA seller sees the claim at Pending Collection, so they can create the pickup AWB, and who pays for that AWB | Update | 8.1, 8.3 | W5 |
| F17 | Explain how "under warranty" and "no warranty-period check" fit together, and whether any time limit applies to wrong-device claims | Update | 8.3 | W6 |
| F18 | For each round, update the dates (window, deadline, countdown, closing line), or record one version without dates that points to "the dates shown in the tab". Make the closing line say 18:00 UAE time on the 22nd, and drop "new" once the tab is established | Re-record or update | 13.0 | D3, D4, D5, D6, W8 |
| F19 | Say when accepted commitments start to apply in the buybox, and how sellers are told their commitments were accepted | Add | 13.0 | W7 |
| F20 | Show the Saudi Arabia table, or state its currency | Add | 13.0 | W9 |

### 5.3 Add new material (from the new KAMs' notes)

| # | Fix | Type | Item | Tied to |
|---|---|---|---|---|
| F21 | Add a short KAM note to each topic, saying what a KAM checks or does when a seller has a cancellation, warranty or commitment question. All four items are seller material, and none has a KAM version | Add | 5.0, 8.1, 8.3, 13.0 | Q2, Q3, the notes' key finding |
| F22 | Start the "Where to check" guide that the notes ask for with the three entries the items already give: cancellations (orders list → Claims section → Claim Details), warranty claims (the portal and the payment tool) and commitments (Seller Performance → Commitments). Then add the sheets and tabs, which no item covers | Add | 5.0, 8.1, 8.3, 13.0 | Q4, Q5 |
| F23 | Add a dashboard map: what each Seller Performance tab is for, and what "Buybox open" and "19 devices open" mean. 13.0 shows them without explaining them (13.0 [00:07 t00007] [00:20 t00020]) | Add | 13.0 | Q6 |
| F24 | Label each item in the central repository with a "last checked" date, starting with the three flagged here: 5.0 (May 2025 policy), 8.1 ("No Lab yet") and 13.0 (round dates). Archive or flag anything that is out of date | Update | 5.0, 8.1, 13.0 | Q7, D1–D7 |
| F25 | Add an operational playbook. It should cover contact and address updates, onboarding document validation, box requests and dimensions, and payment timing (confirmation vs transfer, payout schedule, bank reflection window). Confirm the box answers already in the notes, then include them | Add | New | Q8, Q9, Q10, Q11 |
| F26 | Add message and call templates, plus a guide to difficult conversations with escalation rules. For disputes, point to the existing rules: the cancellation country/stage and 24-hour rules (5.0), and the warranty route of Mark INVALID with proof, Revibe review and the Lab decision (8.1, 8.3) | Add | New | Q12, Q13, Q14, Q15 |
| F27 | Add a monitoring routine, a growth guide, a daily and weekly checklist with a definition of "done", a post-training plan, a pre-boarding access checklist, and a questions channel or buddy. No item covers these. For the "practice cases" in the post-training plan, the scenario seeds on the item pages are a ready starting point | Add | New | Q1, Q2, Q16, Q17, Q18, Q19, Q20 |

The item pages list other open points under "Unclear passages". For example: what happens if a seller rejects a cancellation but doesn't ship within 24 hours (5.0), when the 1-year warranty window starts (8.1), and who bears the cost of a Lab Valid refund (8.1, 8.3). This page doesn't repeat them.
