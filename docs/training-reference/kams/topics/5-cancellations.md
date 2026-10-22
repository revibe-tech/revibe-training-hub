# 5. Cancellations

Source pages: [5.0 Cancellations (Seller)](../items/5.0.md), a 3:23 video for sellers. Citations use the item id and the video time, for example (5.0 [00:44]).

## What this topic covers

How a seller answers a cancellation claim in the Revibe orders app: how a cancelled order is flagged in the Orders list and in the order drawer, the two answers a seller can give (Mark valid or Mark Invalid), the tracking ID requirement, and the 24-hour rules for some countries (5.0 [00:31]-[02:48]). The screens come from the staging environment (5.0 [00:00]).

## How it works

1. **The customer cancels.** A customer cancels because they changed their mind, or because the shipment is delayed on the seller's side and the customer no longer wants to wait (5.0 [00:15] [00:20] [00:24]).
2. **Spot the order.** In the Orders list, a cancelled order has a small purple vertical bar on the left edge of its row. In the demo this was row 65068-1 (5.0 [00:36] [00:36 t00036]).
3. **Open the order drawer.** Clicking the order opens the drawer, where a purple banner reads that the order is on hold, "about 1 hour ago" in the sample (5.0 [00:44] [00:44 t00044]).
4. **Do not edit the order while it is on hold.** The trainer says the seller cannot edit it and cannot do anything with it (5.0 [00:48]). This rests on narration: the word "{cannot?}" is low confidence, and the greyed-out fields on screen are the only support (5.0 [00:44 t00044]).
5. **Find the claim.** In the Claims table of the drawer, the claim row shows Claim ID, Stage "To be cancelled", Type "Cancellation", Subtype "Change of mind" and Since creation (5.0 [00:52] [00:44 t00044]).
6. **Answer the claim.** The trainer says the seller must respond to a claim that has just been created. Click the Claim ID link to open the Claim Details tab (5.0 [00:52] [00:56 t00056]). The tab shows Stage "To be cancelled" and Status "Open", with the buttons Mark valid, Mark Invalid, Mark Refunded (greyed out) and Cancel override (5.0 [01:16 t00076]). The trainer does not explain Mark Refunded or Cancel override (5.0 [01:16]).
7. **Know the default.** If the seller does not respond within 24 hours, the claim is treated as marked valid, the order is cancelled and the customer is refunded. The start of the 24 hours is garbled in the audio (5.0 [01:09] [01:17] [01:22]).
8. **Accept with Mark valid.** This refunds the customer and cancels the order (5.0 [01:00] [01:25] [01:28]).
9. **Check whether rejection is allowed.**
   - UAE and South Africa at the quality check stage: the seller may reject with Mark Invalid (5.0 [01:48] [01:56]).
   - UAE and South Africa at the stage the audio renders as "{created?}": the seller must always mark valid. This is unconfirmed, because the stage name is garbled and no frame shows the stage list (5.0 [01:32] [01:39]).
   - Saudi Arabia: the seller always has the option to reject (5.0 [02:04] [02:12]).
10. **Ship after rejecting.** For UAE and South Africa at quality check, and for Saudi Arabia, a rejected cancellation requires the seller to ship the order within the next 24 hours (5.0 [01:57] [02:03] [02:12]).
11. **Enter a tracking ID if asked.** Pressing Mark Invalid on an order without a tracking ID shows the red error "Tracking ID is required to mark the claim as invalid" and opens the Add tracking ID modal, which has a Tracking ID field and Cancel and Add buttons (5.0 [02:15] [02:19 t00139]). Which countries need this is unclear (see Contradictions).
12. **Reuse an existing tracking ID.** If the order already has a tracking ID, the seller can press Mark Invalid without entering it again (5.0 [02:31] [02:38]).
13. **After handling (not shown on screen).** The trainer says the order then returns to the order dashboard as a normal order that the seller can edit and treat as normal (5.0 [02:40] [02:48]). No frame confirms this: at 03:22 the claim still shows Stage "To be cancelled" and Status "Open" (5.0 [03:22 t00202]).

## Seller version vs KAM version

Only one version. The topic has a single audience, sellers (5.0 [00:00]).

## Rules, numbers and deadlines

| Rule or number | Source |
|---|---|
| Two situations lead a customer to cancel: changed mind, or seller-side shipment delay the customer will not wait for | 5.0 [00:15] [00:20] [00:24] |
| A cancelled order has a small purple vertical bar on the left edge of its row in the Orders list | 5.0 [00:36] |
| While on hold, the seller cannot edit the order or do anything with it (narration only, medium confidence) | 5.0 [00:48] |
| The seller must respond to a claim that has just been created, from the Claims table (Claim ID link) | 5.0 [00:52] [00:56] |
| A claim has two answers: Mark valid (accept) and Mark Invalid (reject) | 5.0 [01:00] [01:05] |
| Mark valid refunds the customer and cancels the order | 5.0 [01:25] [01:28] |
| No response within 24 hours: the claim is treated as marked valid, the order is cancelled and the customer is refunded. The trigger event for the 24 hours is garbled | 5.0 [01:09] [01:17] [01:22] |
| UAE and South Africa, quality check stage: seller may reject (Mark Invalid) | 5.0 [01:48] [01:56] |
| UAE and South Africa, quality check stage: after rejecting, ship within 24 hours | 5.0 [01:57] [02:03] |
| UAE and South Africa, stage "{created?}": must always mark valid (unconfirmed stage name) | 5.0 [01:32] [01:39] |
| Saudi Arabia: seller always has the option to reject, and must then ship within 24 hours | 5.0 [02:04] [02:12] |
| Marking invalid requires a tracking ID; error text "Tracking ID is required to mark the claim as invalid" | 5.0 [02:15] [02:19] |
| If the order already has a tracking ID, Mark Invalid can be pressed without re-entering it | 5.0 [02:31] |
| Claim Details shows Stage "To be cancelled" and Status "Open" while awaiting the seller | 5.0 [01:16 t00076] |
| Sample values "about 1 hour ago" and "0 Day(s), 0 Hour(s)" are sample data, not a rule | 5.0 [00:44 t00044] |

## Contradictions

- **Tracking ID countries.** The 02:15 narration says a tracking ID is needed when marking invalid, with no country limit. At 02:23 the narration says "This you will have to do it for Saudi Arabia orders only". The 02:28 UAE and South Africa sentence is garbled. The order on screen is a UAE order, and the system did require a tracking ID (5.0 [02:15] [02:23] [02:28] [02:19 t00139]). The item cannot settle which countries require it.
- **Stage name for the always-valid rule.** The stage is rendered as "{created?}" at 01:32, and no frame shows the stage list. The rule is unconfirmed (5.0 [01:32]).
- **Start of the 24-hour window.** The audio at 01:09 is garbled ("after the order has been {we?}"). The screens show a Since creation counter and a Confirmed Date, but no frame confirms which event starts the clock (5.0 [01:09]).
- **Result of Mark Invalid not shown.** The trainer says the order returns to the dashboard as normal (5.0 [02:40] [02:48]). Frames at 02:40 to 03:22 still show Stage "To be cancelled" and Status "Open" (5.0 [03:22 t00202]). The result is not confirmed on screen.
- **On-hold editing.** The "cannot edit" rule rests on narration, and the greyed-out fields are the only on-screen support. The "{cannot?}" word is low confidence (5.0 [00:48] [00:44 t00044]).
- **Tracking ID link.** The words "tracking ID link" at 02:38 may mean the field or a tracking link. The screen does not show it (5.0 [02:38]).
- **Possibly out of date.** The trainer says the policy was "just launched" with no date (5.0 [00:00]). The sample dates are inconsistent: the claim is dated 2025-05-19 but the banner says "about 1 hour ago" (5.0 [00:44]). The screens are from the staging admin, and the live admin may differ (5.0 [00:00]).
- **Speech fix (not a contradiction).** "Revive is providing" should read "Revibe is providing" (5.0 [03:14]).

## Quiz blueprint

**5.0 Cancellations (Seller), 203 seconds.** About one question per minute gives 3 questions.

- **Question 1 (single answer): the cancellation flow.** Cover the purple bar, the on-hold banner, the Claim ID link and the two answers. Cite 5.0 [00:36] [00:44] [00:56] [01:00] [01:05]. Not suited to multiple answer.
- **Question 2 (multiple answer suits): country rules.** Cover which countries may reject, which must always mark valid, and the 24-hour shipping rule after rejection. Keep to the confirmed rules (UAE and South Africa quality check; Saudi Arabia). Avoid the unconfirmed "{created?}" stage. Cite 5.0 [01:48] [01:56] [01:57] [02:03] [02:04] [02:12].
- **Question 3 (single answer): tracking ID.** Cover the error text, the Add tracking ID modal, and reuse of an existing tracking ID. Avoid which countries need one. Cite 5.0 [02:15] [02:19] [02:31].

Best scenario seeds:

1. A customer cancels because they changed their mind. The seller sees a purple bar in the Orders list. What do they do first? Answer: open the order drawer, see that it is on hold, and click the Claim ID link to answer the claim (5.0 [00:36] [00:44] [00:52] [00:56]).
2. A UAE order at the quality check stage has a cancellation claim, and the seller wants to reject it. What is needed? Answer: Mark Invalid, a tracking ID if the order has none, and shipping within 24 hours. The tracking ID rule for UAE is unconfirmed, so the question should test the 24-hour shipping rule and the Mark Invalid step (5.0 [01:48] [01:56] [01:57] [02:03] [02:15] [02:19]).
3. A seller presses Mark Invalid on an order with no tracking ID. What happens? Answer: the error "Tracking ID is required to mark the claim as invalid" appears and the Add tracking ID modal opens. The seller enters a tracking ID before continuing (5.0 [02:15] [02:19]).

## Problems found

- **Garbled or unconfirmed:** the 24-hour trigger (01:09), the "{created?}" stage name (01:32), the country scope of the tracking ID (02:15 to 02:28), the "tracking ID link" wording (02:38), the post-handling result (02:40 to 03:22), "{cannot?}" at 00:48, the closing sentence (03:18).
- **Unexplained on screen:** Mark Refunded (greyed out) and Cancel override (01:16).
- **Personal data on screen:** customer names, email, phone and address appear in the drawer and Claim Details frames (5.0 [00:44] [00:52] [01:16]). Do not reproduce these in quiz material.
- **Speech fix:** "Revive" should read "Revibe" (5.0 [03:14]).
