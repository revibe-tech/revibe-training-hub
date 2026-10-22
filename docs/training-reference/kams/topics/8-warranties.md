# 8. Warranties

Sources: 8.0 (video, Seller & KAM, 06:37), 8.1 (PDF, Seller & KAM, 3 pages), 8.2 (video, Seller & KAM, 02:43, wrong device), 8.3 (PDF, Seller & KAM, 1 page, wrong device). Citations use the item id: video timestamps as (8.0 [03:12]), PDF pages as (8.1 p2).

## What this topic covers

How a Revibe warranty claim moves from the customer's request to a final outcome, as handled in the Revibe Admin app and the seller portal. It covers:

- Who repairs the device: the original seller within one year with no misuse declared, or the Revibe Repair Partner after one year or when misuse is declared (8.0 [00:14] [00:18]; 8.1 p1).
- The seller's Valid or Invalid decision, the Invalid proof and Revibe review path, the lab step (AE only), and the lab outcomes (8.0 [02:41] [03:37] [04:40]; 8.1 p2).
- The paid repair route under Revibe Care+ (RC+), Route A and Route B (8.0 [05:16]; 8.1 p3).
- Cancelled and reopened claims (8.0 [06:14] [06:25]).
- The wrong-device variant, where the customer received a different device from the one ordered: Valid (replacement or refund) and Invalid (proof and lab) (8.2; 8.3).

## How it works

Consolidated walkthrough, in order. The shared four-step warranty process runs first; the wrong-device variant is covered at the end.

1. **Customer raises the claim.** The customer raises the claim from My Account on Revibe; status Pending, Revibe team to review. Steps 1 and 2 need no action from the seller (8.0 [01:24] [01:26-01:32]; 8.1 p1; 8.2 [00:24]).

2. **Revibe agent check.** The Revibe agent checks the claim information and asks for missing documents. If the customer does not provide them, the claim is Cancelled. Once complete, the repair supplier is assigned and the status becomes Pending Collection (8.0 [01:26] [01:32]; 8.1 p1). For a wrong-device claim, the agent reviews the customer's proof in the same way (8.2 [00:24] [00:26]).

3. **Choose the repair supplier.** Within one year with no misuse declared, the original seller repairs. After one year, or when the customer declares misuse, the Revibe Repair Partner (Revibe Care+) repairs and the original seller does not see the claim (8.0 [00:18]; 8.1 p1 and p3).

4. **Pickup.** The AWB depends on the country. For AE (UAE) and ZA (South Africa), Revibe creates the AWB automatically and the claim moves to Under Collection immediately. For SA (Saudi Arabia), the seller creates the AWB manually (8.0 [01:52] [01:56]; 8.1 p1). Pickup tracking information is created automatically on the claim (8.0 [01:41] [01:44]). Once the courier collects the device, the claim is In Transit (8.0 [01:58]).

5. **Collection failed (if the customer does not hand over the device).** The agent asks whether the customer wants a new AWB. Yes: a new AWB is created (automatically for AE and ZA, by the seller for SA) and the claim returns to Under Collection with a new pickup ID. No: the claim is Cancelled (8.0 [02:03] [02:20]; 8.1 p1).

6. **Under QC: the seller decides.** When the device reaches the seller, the claim shows Under QC. The seller inspects it and clicks Mark valid or Mark invalid. Both buttons sit at the top of the claim (8.0 [02:27] [02:37]; 8.1 p1 and p2).

7. **Valid path (repair).** The claim stays under Repair until the seller clicks Repair finished, which moves it to Ship Back under Collection (8.0 [02:41] [02:49]). The ship-back AWB follows the same country rule as pickup. For SA, the seller clicks Edit and enters the ship-back tracking number and label link (8.0 [03:06]). For AE and ZA, Revibe creates the AWB and 30 AED is deducted from the seller (8.0 [02:59]; 8.1 p2). Then the claim goes Shipped back and Delivered.
   - Ship-back delivery failed: the agent asks whether the customer wants a new attempt. Yes: the seller pays a new AWB and the claim returns to Ship back under collection. No: the device is disposed (8.0 [03:12]; 8.1 p2).

8. **Invalid path (proof).** The seller gives a reason (dropdown), a comment, and proof uploaded under "Proof of invalid claim by supplier". More proof is better; more files can be added in the claim attachments (8.0 [03:41] [03:45] [03:49]). The customer still sees Under QC, while the internal stage becomes Invalid claim (8.0 [03:52]; 8.1 p2).

9. **Revibe agent review of the Invalid claim.** Every Invalid claim is reviewed by a Revibe agent (8.0 [04:04]; 8.1 p2). The agent either:
   - **Agrees.** The customer sees Expert revision and the internal stage becomes Pending LAB collection (8.0 [04:07] [04:31]; 8.1 p2). Continue to step 10.
   - **Challenges.** The agent marks the claim Valid with a rationale. Then either:
     - the seller must cover it: the claim goes to Under revision, and the seller marks it Valid or Invalid again with more proof. The agent reviews again; an Invalid answer goes to the lab (8.0 [04:09] [04:24]; 8.1 p2), or
     - for a misuse claim where the customer has RC+, the seller gives a quotation (Route A, step 13) (8.0 [04:11-04:16] [05:20]; 8.1 p2).

10. **Lab (AE only).** The lab check is in the UAE only. A Quiqup AWB is created automatically, and the seller hands the device to Quiqup. Status then goes Pending lab collection, In transit to lab, Lab under QC (8.0 [04:39] [04:42]; 8.1 p2).
    - **Outside AE:** there is no lab, and the agent's confirmation of the seller's Invalid is final (8.0 [04:46]; 8.1 p2).

11. **Lab outcome.**
    - **Lab Valid:** the stage shows Ready for refund, the customer is refunded, and the device goes back to the seller (Pending lab to seller collection, In transit lab to seller, Delivered to seller) (8.0 [04:49] [05:08]; 8.1 p2).
    - **Lab Invalid:** "Invalid claim confirmed" and the claim is closed. AE: Revibe ships the device back. ZA and SA: the customer pays the shipping fees (entered as a Stripe code once paid; 90 days to pay). Then Ship back under collection, Shipped back, Delivered; or Delivery failed (new attempt, or Device disposed) (8.0 [04:49-04:59] [05:02]; 8.1 p2).

12. **Refunds and charges.** All refunds, credits and charges appear in the payment tool (8.0 [06:09]; 8.1 p1).

13. **Revibe Care+ (RC+) routes.** RC+ is Revibe's extended warranty: the repairer gives a quotation, Revibe approves it and pays the repair (8.0 [05:16]; 8.1 p3).
    - **Route A (within one year, misuse found, customer has RC+):** the agent marks "Misuse but customer has RC+". The internal stage becomes Seller quotation and the seller enters the repair price (8.0 [05:20] [05:33] [05:36]; 8.1 p3).
      - The seller's price shows in the Financial Summary as Seller Repair Quotation Amount (AED), and the claim moves to Quotation review (8.0 [05:38] [05:42]).
      - Quotation loop: the Revibe agent approves (Yes, repair) or sends it back (No, back to quotation) (8.0 [05:53] [05:55]; 8.1 p3).
      - Once approved, repair and ship back: Ready for repair, Under repair, Repair finished, To ship back, Ship back under collection, Shipped back, Delivered (8.0 [05:59]; 8.1 p3).
      - If Revibe cancels the repair, no repair is done and the device goes back to the customer as is (8.0 [06:04]).
    - **Route B (after one year, or misuse declared):** the device goes straight to the Revibe Repair Partner, which inspects it and gives a quotation. The original seller does not see the claim (8.0 [05:45]; 8.1 p3).
    - **1,500 AED split (8.1 only):** for a quoted cost up to 1,500 AED, Revibe covers the repair and the RC+ extended warranty is consumed after the repair. Above 1,500 AED, the customer pays the difference (cost minus 1,500 AED); if paid, the repair goes ahead; if not, there is no repair, the device is shipped back, and RC+ is cancelled (8.1 p3). See Contradictions.

14. **Cancelled and reopened claims.** A claim can stop partway (for example, the customer cancels or never sends missing documents). The stage becomes Cancelled and the claim is closed (8.0 [06:14] [06:21]). If a claim was cancelled by mistake, Revibe can reopen it; it returns to Form received and is active again (8.0 [06:25] [06:28]).

### Wrong-device variant (8.2 and 8.3)

The wrong-device flow applies when the customer received a different device from the one ordered. It uses the same four steps (8.2 [00:08]; 8.3 p1).

1. Customer raises the claim, then the Revibe agent check (steps 1 and 2; no seller action) (8.2 [00:24]; 8.3 p1).
2. Pickup: AE (Quiqup) and Others (DHL) get an automatic AWB and move to Under Collection; SA needs a manual AWB from the seller. Repair partner pickup is always automatic, labelled "SA = Naqel" on the page (8.2 [00:33] [00:38] [00:40]; 8.3 p1).
3. The claim appears under Under QC in the R - Seller Warranties view, with Subtype Wrong device. The seller checks the device received and asks, "Is it really the wrong one?" (8.2 [00:43] [00:55]).
4. **Valid (the customer is right):** the seller clicks Mark valid, then answers "Device Available For Replacement?" (8.2 [01:05] [01:11]).
   - **Yes (stock available):** enter the Replacement Device IMEI of the device being sent and confirm. The claim moves to ship back, like after a repair (8.2 [01:14] [01:21]).
   - **No (not in stock):** no IMEI is needed. Confirming moves the claim to Ready for refund. Revibe refunds the customer automatically and charges the refund to the seller at actual cost. The case closes and the seller keeps the device; there is no extra shipping (8.2 [01:29] [01:34] [01:38] [01:44]).
5. **Invalid (not a wrong device):** mark invalid with a written reason and proof, as for an issue claim. A higher-spec device is not a wrong device (8.2 [01:48] [01:56] [02:02]). The proof dialog accepts attachments under 100 MB (8.2 [02:02]).
   - Revibe checks the proof. Good proof sends the device to the Lab. Rejected proof re-marks the claim Valid, leading to a replacement or refund. For repair-partner claims there is no Lab and Revibe decides (8.2 [02:09] [02:12]; 8.3 p1).
   - Lab final decision: Valid gives a full refund and the device goes back to the seller. Invalid means the customer pays and the device is shipped to them; if they do not pay, it is disposed (8.2 [02:18] [02:23]; 8.3 p1).
6. Ship-back delivery failed: the agent offers a new AWB; if refused, the device goes to disposal (8.2 [02:28]; 8.3 p1). Refunds and charges are in the payment tool (8.2 [02:33]).

## Seller version vs KAM version

Only one version. All four items are marked Seller & KAM, and the material is written for sellers and KAMs alike. The material says questions go to the Key Account Manager (8.0 [06:34]; 8.2 [02:39]). KAMs should be able to explain the same steps to sellers; the source does not describe a separate KAM-only procedure.

## Rules, numbers and deadlines

| Rule or number | Source |
|---|---|
| Within one year with no misuse declared, the original seller covers and repairs. | 8.0 [00:14]; 8.1 p1 |
| After one year, or when the customer declares misuse, the Revibe Repair Partner repairs; the original seller does not see the claim. | 8.0 [00:18] [05:45]; 8.1 p1, p3 |
| Wrong-device claims have no warranty-period check and go straight to the original seller or repair partner. | 8.2 [00:18] [00:20]; 8.3 p1 |
| AE and ZA: AWB created automatically by Revibe, claim moves to Under Collection immediately. SA: seller creates the AWB. | 8.0 [01:52] [01:56]; 8.1 p1; 8.2 [00:33] [00:40] |
| After a failed collection, a new AWB is auto for AE and ZA, manual for SA. | 8.0 [02:03]; 8.1 p1 |
| Collection failed, customer says no to a new AWB: claim is Cancelled. | 8.0 [02:03]; 8.1 p1 |
| Seller marks Valid (repair) or Invalid (reason and proof). Revibe reviews every Invalid claim. | 8.0 [02:41] [04:04]; 8.1 p2 |
| An Invalid claim requires a reason and proof of invalidity. | 8.0 [03:36]; 8.1 p2 |
| Invalid reason dropdown options: No issue, Misuse, Time expired for specific issue, Other. | 8.0 [03:42] |
| Lab check is in the UAE only (AE). Outside AE there is no lab and the agent's confirmation of the Invalid is final. | 8.0 [04:39] [04:46]; 8.1 p2 |
| Ship-back AWB for AE and ZA is created by Revibe, with 30 AED deducted from the seller. | 8.0 [02:59]; 8.1 p2 |
| Lab Invalid for ZA and SA: the customer pays shipping fees, entered as a Stripe code once paid, with 90 days to pay. | 8.0 [04:49] [04:59]; 8.1 p2 |
| Delivery failed (ship-back): the agent offers a new attempt; the seller pays the new AWB; if refused, the device is disposed. | 8.0 [03:12]; 8.1 p2 |
| The customer has about 48 hours to accept a new attempt (spoken only, not shown on screen). | 8.0 [03:24] |
| RC+ covers repairs up to 1,500 AED. Above that, the customer pays the difference (cost minus 1,500 AED). | 8.1 p3 |
| Route A (within one year, misuse found, customer has RC+): the seller quotes and repairs; Revibe covers the cost. | 8.0 [05:20] [05:25]; 8.1 p3 |
| Route B (after one year or misuse declared): Revibe Repair Partner; seller does not see the claim. | 8.0 [05:45]; 8.1 p3 |
| Repair above 1,500 AED not paid: no repair, device shipped back, RC+ cancelled. | 8.1 p3 |
| Wrong device, replacement in stock: choose Yes, enter the Replacement Device IMEI, confirm. | 8.2 [01:14] |
| Wrong device, not in stock: choose No; the claim moves to Ready for refund; automated refund charged to the seller at actual cost. | 8.2 [01:29] [01:34] [01:38] |
| Wrong device, proof attachment limit: less than 100 MB. | 8.2 [02:02] |
| Policy timer: a "Seller policy timer: N days left" banner at the top of the claim (sample shows 8 days left; a snapshot, not live). | 8.0 [01:00] [03:29]; 8.2 [00:50] |
| All refunds, credits and charges appear in the payment tool. | 8.0 [06:09]; 8.1 p1; 8.2 [02:33] |

## Contradictions

1. **One-year warranty window versus no warranty-period check (cross-item).** 8.0 and 8.1 say the original seller covers within one year, and after that the Revibe Repair Partner takes over (8.0 [00:14] [00:18]; 8.1 p1). 8.2 and 8.3 say wrong-device claims have no warranty-period check and go straight to the original seller or repair partner (8.2 [00:18]; 8.3 p1). The two rules are not reconciled in the material. Treat this as an open question for the KAM.

2. **1,500 AED RC+ cap versus Route A "Revibe pays" (8.0 vs 8.1).** 8.0 says that in Route A the seller quotes, repairs, and Revibe pays with no cap stated (8.0 [05:20] [05:25]). 8.1 states a 1,500 AED limit and a customer-paid difference above it (8.1 p3). 8.1 itself flags that it is not confirmed whether the cap applies to Route A (8.1 Rules line 58).

3. **Who pays the new AWB after delivery failed in AE and ZA (8.0 and 8.1 versus AE/ZA rule).** 8.0 and 8.1 both say the seller pays a new AWB on a failed ship-back delivery (8.0 [03:12]; 8.1 p2). 8.0 also says Revibe creates the AWB for AE and ZA, with 30 AED deducted (8.0 [02:59]). 8.1 flags that it is unclear whether AE and ZA sellers pay for a re-attempt.

4. **Misuse routing: customer-declared versus seller-found (8.0 and 8.1).** 8.0 and 8.1 page 1 send the claim to the Revibe Repair Partner when the customer declares misuse (8.0 [00:18]; 8.1 p1). Route A keeps seller-found misuse, within one year, with the original seller under RC+ (8.0 [05:20]; 8.1 p3). 8.1 flags that the difference should be confirmed.

5. **Quotation actor (8.0 narration versus slide, and 8.1).** The narration says the seller enters the repair price ("It's your turn to quote the repair", 8.0 [05:36]). The slide at 8.0 [05:53] (t00353) reads "repairer enters the price", and 8.1 p3 also says the repairer enters it. The page follows the narration and records the slide wording in the quotation loop. Confirm which is right.

6. **Lab location (8.0 narration).** The narration says "The lab check is in the UAE only" (8.0 [04:39]) and then "it travels to the lab outside the UAE" (8.0 [04:42]). The screen does not show where the lab is.

7. **Lab-invalid country list (8.0 narration versus slide).** The narration names Saudi Arabia and South Africa for the customer-paid return (8.0 [04:54-04:59]). The slide (t00289) names ZA and SA. 8.1 p2 uses ZA and SA. Use the slide wording.

8. **Wrong-device delivery failure: new attempt versus new AWB (8.2 narration versus slide).** 8.2 narration says "Revibe offers the customer a new attempt" (8.2 [02:28]). The slide (t00150) says "agent offers a new AWB" (8.2 [02:28]; 8.3 p1). Both sources use "new AWB" in the rule.

9. **Lab Invalid "claim closed" versus continued steps (8.1 and 8.0).** 8.1 p2 labels Lab Invalid "claim closed" but shows the same branch continuing to ship-back, Delivered, Delivery failed and Device disposed. 8.0 shows the same sequence (8.0 [04:49]). Whether the claim closes before or after ship-back is not stated.

10. **RC+ cancellation and "Revibe cancels the repair" (8.0 versus 8.1).** 8.0 says if Revibe cancels the repair, the device goes back "as is" (8.0 [06:04]). 8.1 says if the customer does not pay the above-1,500 AED difference, RC+ is cancelled and the device shipped back (8.1 p3). These are different triggers; the material does not connect them.

11. **Wrong-device "SA = Naqel" (8.2 and 8.3).** The Pickup card line reads "Repair partner: always auto (SA = Naqel)" (8.2 [00:33]; 8.3 p1). Both sources flag that it is unclear whether Naqel applies to all repair-partner pickups or only SA.

12. **Source-internal: wrong-device Yes/No frame (8.2).** Narration at 8.2 [01:29] says choose No, but the frame at t00089 shows Yes selected. The No path is confirmed by the narration and the result screen at t00094.

### Flagged as out of date or unconfirmed

- Claim Management view names may change (8.0 [00:44]).
- The "8 days left" policy timer is a snapshot from the recording (8.0 [03:29]; 8.2 [00:50]).
- The "(paused)" label on the policy timer appears on some claims and not others; the reason is not explained (8.0 Warnings and tips; 8.0 [03:51] [04:25]).
- The 48-hour window is spoken only (8.0 [03:24]).
- Page references to "page 2" and "page 3" in 8.0 point to a document not in the pack (8.0 [00:18]).
- Recording-era claim dates (14/10/2026 and 15/10/2026) are sample data, not current (8.0 [03:29] [06:14]).

## Quiz blueprint

Total suggested: about 27 questions across the four items (7 for 8.0, 12 for 8.1, 3 for 8.2, 5 for 8.3).

### 8.0 Warranties - Issues (video, 06:37)

- **Suggested questions:** 7 (about one per minute of video, rounded from 6.6 minutes).
- **Areas to cover:** one-year repair rule and who repairs; finding claims in Claim Management; the Tracker stages in order; Valid path (Repair finished, ship back, SA Edit step); Invalid path (reason, proof, Revibe review, agree versus challenge); lab (UAE only) and lab outcomes; RC+ Route A and Route B; cancelled and reopened claims.
- **Suited to multiple-answer questions:** the Tracker stage order (multi-select of the stages in sequence); the Route A steps (select all that apply); Lab Valid and Lab Invalid outcomes (select all that apply to each); ship-back AWB owner by country (select all that apply).
- **Best scenario seeds:**
  1. A customer's claim is more than a year old and no misuse is declared. The KAM should expect the Revibe Repair Partner to handle it, and the original seller does not see the claim (8.0 [00:18] [00:24]).
  2. A seller marks a claim Invalid and the Revibe agent challenges it. The KAM should cover the claim, which goes to Under revision, and mark it Valid or Invalid again with more proof (8.0 [04:09] [04:11] [04:24]).
  3. A customer has Revibe Care+ and misuse is found within one year. The seller gives a quotation in the Seller quotation stage and repairs the device; Revibe pays (8.0 [05:20] [05:25] [05:33] [05:36]).

### 8.1 Warranties - Issues (PDF, 3 pages)

- **Suggested questions:** 12 (one per key rule; there are about 19 starred rules and several overlap).
- **Areas to cover:** the one-year rule and original seller; AWB by country; Under QC decision; Invalid proof and Revibe review; agree versus challenge; Under revision; AE-only lab; lab Valid and Invalid outcomes; Outside-AE finality; RC+ Route A and Route B; the 1,500 AED split; delivery failed.
- **Suited to multiple-answer questions:** Valid-path statuses (select all that apply); lab Valid and lab Invalid outcomes (select all that apply); the 1,500 AED split outcomes (select all that apply).
- **Best scenario seeds:**
  1. Seller marks an Invalid claim outside AE. The agent's confirmation is final; there is no lab step (8.1 p2).
  2. Quoted repair is above 1,500 AED and the customer does not pay. No repair; device shipped back; RC+ cancelled (8.1 p3).
  3. Lab Invalid in ZA. The customer pays the ship-back shipping fees with a Stripe code once paid, and has 90 days to pay (8.1 p2).

### 8.2 Warranties - Wrong Device (video, 02:43)

- **Suggested questions:** 3 (about one per minute, rounded from 2.7 minutes).
- **Areas to cover:** the Valid decision and the Device Available For Replacement dialog (Yes and IMEI; No and automatic refund); the Invalid proof path and Revibe checks; the 100 MB limit; delivery failed on ship-back.
- **Suited to multiple-answer questions:** the outcome of answering Yes versus No on the replacement dialog (select all that apply); what the seller must do before choosing Yes.
- **Best scenario seeds:**
  1. A claim is Valid and the right device is not in stock. Choose No; confirming moves the claim to Ready for refund; Revibe refunds the customer automatically and charges the seller at actual cost (8.2 [01:29] [01:34] [01:38]).
  2. A device received is a higher-spec model of the one ordered. It is not a wrong device, so mark Invalid with a written reason and proof (8.2 [01:56] [01:48]).
  3. Revibe rejects the seller's proof on an Invalid claim. The claim is re-marked Valid and the outcome is a replacement or refund (8.2 [02:09] [02:12]).

### 8.3 Warranties - Wrong Device (PDF, 1 page)

- **Suggested questions:** 5 (one per key rule, selected from the 13 quiz items, which overlap).
- **Areas to cover:** no warranty-period check; pickup by market (AE and Others automatic; SA manual; repair partner automatic); Under QC VALID and INVALID; VALID with and without stock; INVALID proof, Revibe review and lab; repair partners have no lab; delivery failed.
- **Suited to multiple-answer questions:** pickup owner by market (match each market to who creates the AWB, or select all that apply); Lab final decision outcomes (select all that apply).
- **Best scenario seeds:**
  1. The seller believes the customer claim is wrong. Mark INVALID and submit a written reason plus supporting proof (8.3 p1).
  2. A repair partner claim is in dispute. Revibe decides; there is no lab step (8.3 p1).
  3. Lab finds the claim Invalid and the customer does not pay. The device is disposed (8.3 p1).
