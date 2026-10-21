# 8. Warranties

## What this topic covers

How Revibe handles a warranty claim, from the moment the customer raises it in "My Account" to the final outcome. It covers two kinds of claim:

- **Warranty issues** ([8.1](../items/8.1.md), 3-page PDF): the device has a problem. Covers who repairs it (the original seller or the Revibe Repair Partner), the pickup, the seller's Valid or Invalid decision, the Revibe review and the Lab, and Revibe Care+ (RC+) paid repairs (8.1 [p1] [p2] [p3]).
- **Wrong device** ([8.3](../items/8.3.md), 1-page PDF): the customer received a different device from the one they ordered, under warranty. Covers the same four opening steps, then replacement or refund, or a dispute based on proof (8.3 [p1]).

Both sources are workflow diagrams for sellers and KAMs, with no narration. That means there is no transcript, so there are no speech-recognition errors and nothing misheard because of the trainer's accent. Every word here comes from the printed page text. Citations are PDF pages, e.g. (8.1 [p2]). The pages don't expand AE, ZA, SA, "Others" or AWB, so this page doesn't expand them either. The reference has no 8.2 page.

## How it works

Both claim types share the first four steps. They split when the seller makes a decision at Under QC.

### 1. Who handles the claim

- **Issues.** If the claim is within 1 year and there is no misuse, the original seller inspects the device, identifies the issue and repairs it (8.1 [p1]). If the claim comes after 1 year, or the customer declares misuse, the Revibe Repair Partner (Revibe Care+ / RC+) handles it and the original seller doesn't see the claim (8.1 [p1] [p3]). The page doesn't say which date the year is counted from (8.1 [p1]).
- **Wrong device.** There is no warranty-period check. The claim goes straight to the original seller (or a repair partner) (8.3 [p1]). The page says both "under warranty" and "no warranty-period check" without saying how the two fit together (8.3 [p1]).

### 2. Step 1: Customer raises the claim (NO ACTION REQUIRED)

The customer raises the claim in the "My Account" section on Revibe. The status is Pending, which means the Revibe team will review it (8.1 [p1]; 8.3 [p1]).

### 3. Step 2: Revibe Agent Check (NO ACTION REQUIRED)

A Revibe agent checks the claim info (8.1 [p1]), or the customer's proof for a wrong-device claim (8.3 [p1]). The agent asks the customer for any missing documents. If the customer doesn't provide them, the claim is **Cancelled**. Once the check is complete, the status becomes **Pending Collection**. For an issue claim, this is also when the repair supplier is assigned (8.1 [p1]; 8.3 [p1]).

### 4. Step 3: Pickup (ACTION REQUIRED IF SA)

| Case | Pickup AWB | Source |
|---|---|---|
| Issues, AE & ZA | Created automatically. The claim moves to Under Collection immediately | (8.1 [p1]) |
| Wrong device, AE & Others | Created automatically (AE = Quiqup, Others = DHL). The claim moves to Under Collection immediately | (8.3 [p1]) |
| SA (both claim types) | The seller creates the AWB manually | (8.1 [p1]; 8.3 [p1]) |
| Wrong device, repair partner | Always created automatically (SA = Naqel) | (8.3 [p1]) |

- When the courier picks the device up from the customer, the status becomes **In Transit** (8.1 [p1]).
- **Collection failed** means the customer doesn't hand over the device. The agent asks the customer if they want a new AWB. If yes, a new AWB is created (automatically in AE & ZA, manually by the seller in SA) and the claim goes back to Under collection. If no, the claim is Cancelled (8.1 [p1]).
- Neither page says who pays for the SA pickup AWB. Neither explains how an SA seller sees the claim in time to create it, since Step 4 says the seller sees the claim once the courier delivers (8.1 [p1]; 8.3 [p1]).

### 5. Step 4: Seller action (ACTION REQUIRED)

Once the Courier Company delivers, the seller can see the claim and its status becomes **Under QC**. The seller has two options: **Mark VALID** or **Mark INVALID** (8.1 [p1]; 8.3 [p1]).

Statuses up to this point: Pending → Pending Collection → Under Collection → In Transit → Under QC (8.1 [p1]).

### 6. The seller marks the claim VALID

**Issues: repair and ship back** (8.1 [p2])
- Status flow: Under repair → the seller clicks "Repair finished" → Ship back under collection → Shipped back → Delivered.
- Ship-back cost: in SA, the seller creates and pays the AWB. In AE & ZA, Revibe makes the AWB and **30 AED is deducted from the seller**.
- If the customer refuses the delivery, the status becomes Delivery failed and the agent asks whether they want a new attempt. If yes, the seller pays a new AWB and the claim goes back to Ship back under collection. If no, the status becomes Device disposed.

**Wrong device: replacement or refund** (8.3 [p1])
- The seller confirms whether the right device is in stock.
- If it is available, the correct device is shipped to the customer.
- If it isn't available, an **automated refund is issued and charged to the seller (actual cost)**, and the case is closed.

### 7. The seller marks the claim INVALID

On both pages the path is Proof Required → Revibe Review → Lab Verification (8.1 [p2]; 8.3 [p1]).

1. **Seller submits proof.** For issues, the seller gives a reason and proof of invalidity, and the status becomes Invalid claim (8.1 [p2]). For a wrong device, the seller gives a written reason and supporting proof to challenge the customer's claim (8.3 [p1]).
2. **Revibe reviews it.** Revibe reviews every Invalid claim (8.1 [p2]).
   - Issues: if the agent agrees, the device goes to the Lab, which exists in AE only. Outside AE there is "No Lab yet", so the agent's confirmation of the seller's Invalid is final. If the agent challenges the Invalid, they mark the claim Valid with a rationale:
     - **"Seller must cover"**: the claim goes to Under revision. The seller marks it Valid or Invalid again and the agent reviews it again. If it is still Invalid, it goes to the Lab.
     - **"Misuse but customer has RC+"**: the claim moves to a seller quotation (Route A in step 8) (8.1 [p2] [p3]).
   - Wrong device: if the proof is good, the device is sent to the Lab. If the proof is rejected, the claim is re-marked Valid and goes to replacement or refund. For a repair partner there is no Lab, and Revibe decides (8.3 [p1]).
3. **Lab collection (issues, AE only).** The status is Pending lab collection. A Quiqup AWB is created automatically and the seller hands the device to Quiqup. Then In transit to lab → Lab under QC (8.1 [p2]).
4. **Lab final decision.**

| Lab decision | Issues (8.1 [p2]) | Wrong device (8.3 [p1]) |
|---|---|---|
| Valid | The customer is refunded and the device goes back to the seller: Pending lab to seller collection → In transit lab to seller → Delivered to seller | Full refund, and the device is shipped back to the seller |
| Invalid | Invalid claim confirmed and the claim is closed. In AE, Revibe ships the device back. In ZA & SA, the customer pays the shipping fees (a Stripe code is entered once paid) and has 90 days to pay. This ZA & SA rule is unconfirmed (see Contradictions). Then Ship back under collection → Shipped back → Delivered | The device is shipped to the customer if they pay, and disposed of if they don't |

### 8. Revibe Care+ paid repairs (issues only)

RC+ covers repairs **up to 1,500 AED**: the repairer fixes the device and Revibe pays for the repair. Above 1,500 AED, the customer pays the difference (8.1 [p3]).

- **Route A (within 1 year).** The original seller finds misuse and marks the claim Invalid (misuse). The agent sees that the customer has RC+ and marks it "Misuse but customer has RC+". The original seller then gives a quotation and repairs the device, and Revibe covers the cost (8.1 [p3]).
- **Route B (after 1 year, or misuse declared).** The device goes straight to the Revibe Repair Partner, and the original seller doesn't see the claim. The partner inspects the device, identifies the issue and gives a quotation (8.1 [p3]).
- **Quotation.** Seller quotation (the repairer enters the price) → Seller quotation review → the Revibe agent approves it or not. If not, it goes back to quotation. If approved, it moves to the cost check (8.1 [p3]).
- **Up to 1,500 AED.** Revibe covers the repair: Ready for repair → Under repair → Repair finished → To ship back → Ship back under collection → Shipped back → Delivered. The extended warranty is consumed after the repair (8.1 [p3]).
- **Over 1,500 AED.** The status is Pending customer payment, and the customer pays (cost − 1,500 AED). If they pay, the repair goes ahead with the same stages. If they don't, there is no repair, the device is shipped back to the customer and RC+ is cancelled (8.1 [p3]).

### 9. Failed ship-back, and where to check

- If a ship-back delivery fails, the agent offers a new attempt (a new AWB). If the customer refuses, the device is disposed of (8.1 [p2] [p3]; 8.3 [p1]).
- All refunds, credits and charges appear in the payment tool (8.1 [p1] [p3]; 8.3 [p1]).
- The portal shows Tracking (original shipment), Pickup Tracking, Ship-Back and Lab (8.1 [p1]).

## Seller version vs KAM version

Only one version. Both items are single PDFs labelled "Seller & KAM", so sellers and KAMs get the same material. There is no KAM-only content that adds to it or changes it (see the 8.1 and 8.3 page headers).

The action tags (NO ACTION REQUIRED / ACTION REQUIRED IF SA / ACTION REQUIRED) read as seller actions. Step 3 says "SA: Seller to create the AWB manually" and Step 4 is titled "Seller action". However, 8.3 notes that the page doesn't say this outright (8.3 [p1]).

## Rules, numbers and deadlines

| Rule or number | Source |
|---|---|
| Issues within 1 year with no misuse: the original seller repairs | (8.1 [p1]) |
| Issues after 1 year, or misuse declared by the customer: the Revibe Repair Partner (RC+) handles the claim and the original seller doesn't see it | (8.1 [p1] [p3]) |
| Wrong device: no warranty-period check; the claim goes straight to the original seller (or repair partner) | (8.3 [p1]) |
| The customer raises the claim in "My Account" on Revibe; the status starts at Pending | (8.1 [p1]; 8.3 [p1]) |
| Step 1 and Step 2: NO ACTION REQUIRED. Step 3 (Pickup): ACTION REQUIRED IF SA. Step 4 (Seller action): ACTION REQUIRED | (8.1 [p1]; 8.3 [p1]) |
| Missing documents requested and not provided: the claim is Cancelled | (8.1 [p1]; 8.3 [p1]) |
| Agent check complete: Pending Collection (for issues, the repair supplier is assigned) | (8.1 [p1]; 8.3 [p1]) |
| Pickup AWB created automatically in AE & ZA (issues) / AE & Others (wrong device); the claim moves to Under Collection immediately | (8.1 [p1]; 8.3 [p1]) |
| Pickup couriers: AE = Quiqup, Others = DHL; repair partner in SA = Naqel | (8.3 [p1]) |
| SA: the seller creates the pickup AWB manually | (8.1 [p1]; 8.3 [p1]) |
| Repair partner pickup AWB is always automatic | (8.3 [p1]) |
| Collection failed: if the customer wants a new AWB, it is automatic in AE & ZA and created manually by the seller in SA, and the claim goes back to Under collection. If not, Cancelled | (8.1 [p1]) |
| Under QC: the seller sees the claim once the Courier Company delivers; two options, Mark VALID or Mark INVALID | (8.1 [p1]; 8.3 [p1]) |
| Valid issue: the seller clicks "Repair finished" after the repair | (8.1 [p2]) |
| Valid issue, ship-back in SA: the seller creates and pays the AWB | (8.1 [p2]) |
| Valid issue, ship-back in AE & ZA: Revibe makes the AWB and 30 AED is deducted from the seller | (8.1 [p2]) |
| Valid issue, delivery failed: if the customer wants a new attempt, the seller pays a new AWB; if not, Device disposed | (8.1 [p2]) |
| Valid wrong device: correct device shipped if in stock; otherwise an automated refund charged to the seller (actual cost), and the case is closed | (8.3 [p1]) |
| Invalid needs a reason and proof (issues) / a written reason and supporting proof (wrong device) | (8.1 [p2]; 8.3 [p1]) |
| Revibe reviews every Invalid claim | (8.1 [p2]) |
| Agent challenges an Invalid issue: marks it Valid with a rationale. "Seller must cover" → Under revision; "Misuse but customer has RC+" → seller quotation | (8.1 [p2] [p3]) |
| Wrong device, proof rejected: re-marked Valid → replacement or refund | (8.3 [p1]) |
| Wrong device, repair partner: no Lab, Revibe decides | (8.3 [p1]) |
| Lab collection is AE only: a Quiqup AWB is created automatically and the seller hands the device to Quiqup | (8.1 [p2]) |
| Outside AE, "No Lab yet": the agent's confirmation of the seller's Invalid is final (flagged possibly out of date) | (8.1 [p2]) |
| Lab Valid: the customer is refunded (full refund) and the device goes back to the seller | (8.1 [p2]; 8.3 [p1]) |
| Lab Invalid, issues: Invalid claim confirmed, claim closed; in AE, Revibe ships the device back | (8.1 [p2]) |
| Lab Invalid, issues, ZA & SA: the customer pays the shipping fees (Stripe code) and has **90 days** to pay. Unconfirmed, because 8.1 says the Lab is AE only | (8.1 [p2]) |
| Lab Invalid, wrong device: shipped to the customer if they pay, disposed of if not | (8.3 [p1]) |
| RC+ covers repairs up to **1,500 AED**; Revibe pays for the repair | (8.1 [p3]) |
| RC+ over 1,500 AED: Pending customer payment; the customer pays (cost − 1,500 AED) | (8.1 [p3]) |
| RC+ difference not paid: no repair, the device is shipped back and RC+ is cancelled | (8.1 [p3]) |
| RC+ repair covered by Revibe: the extended warranty is consumed after the repair | (8.1 [p3]) |
| RC+ quotation must be approved by the Revibe agent; if not approved, it goes back to quotation | (8.1 [p3]) |
| Failed ship-back: a new attempt / new AWB is offered; if refused, the device is disposed of | (8.1 [p2] [p3]; 8.3 [p1]) |
| All refunds, credits and charges appear in the payment tool | (8.1 [p1] [p3]; 8.3 [p1]) |
| Portal shows Tracking (original shipment), Pickup Tracking, Ship-Back, Lab | (8.1 [p1]) |
| Deadlines: none for the seller's decision, the proof or missing documents. The only deadline in the topic is the unconfirmed 90 days above | (8.3 [p1]; 8.1 [p2]) |

## Contradictions

1. **Is there a Lab outside AE?** 8.1 says Lab collection is "AE only". Outside AE there is "No Lab yet", so the agent's confirmation of the seller's Invalid is final (8.1 [p2]). 8.3 says good proof sends the device to the Lab for the final decision, with no market limit. Its only exception is a repair partner (no Lab, Revibe decides) (8.3 [p1]). So for a wrong-device dispute in SA, ZA or Others, the pages disagree on whether the Lab applies. 8.1 flags "No Lab yet" as possibly out of date (8.1 [p2]), so either page could be the stale one. Confirm with the trainer before quizzing the Lab for markets other than AE.
2. **Who pays the ship-back after Lab Invalid.** 8.1: in AE, Revibe ships the device back; in ZA & SA, the customer pays the shipping fees and has 90 days to pay (8.1 [p2]). 8.3: the device goes to the customer only if they pay, and is disposed of if not, with no market split (8.3 [p1]). Because 8.1 puts the Lab in AE only, an AE Lab Invalid is shipped back by Revibe under 8.1 but paid by the customer under 8.3. The claim types differ, so this may be intended, but neither page says so. Within 8.1 itself, the ZA & SA rule sits under a Lab that 8.1 says doesn't exist outside AE, and 8.1 keeps it out of the quiz until it is clarified (8.1 [p2]). 8.1 also doesn't say what happens if the customer doesn't pay within 90 days, whereas 8.3 says the device is disposed of.
3. **Rejected Invalid: revision or straight to Valid.** For issues, a challenged Invalid with "Seller must cover" goes to Under revision, where the seller can mark it Valid or Invalid again (8.1 [p2]). For a wrong device, rejected proof is re-marked Valid and goes to replacement or refund, with no revision step (8.3 [p1]). This is probably a deliberate difference between claim types, but quiz questions should name the claim type.
4. **Automatic-pickup market labels.** 8.1 lists "AE & ZA" (8.1 [p1]). 8.3 lists "AE & Others" (8.3 [p1]). 8.3 doesn't say which markets count as "Others", or whether ZA is one of them. This isn't strictly a contradiction, but don't mix the two labels in one question.

Out-of-date flags: only 8.1's "No Lab yet" outside AE (8.1 [p2]), covered in point 1. 8.3 has none.

Open on both pages (gaps, not contradictions): how an SA seller sees the claim before Under QC in order to create the pickup AWB (8.1 [p1]; 8.3 [p1]); who pays for the SA pickup AWB (8.1 [p1]); who bears the cost of a Lab Valid refund (8.1 [p2]; 8.3 [p1]).

## Quiz blueprint

Both items are PDFs, so the guide is one question per key rule. No speech-recognition caveats apply.

### 8.1 Warranties - Issues (Seller & KAM, 3 pages)

**Suggested questions: 20.** The page has about 25 key rules (48 ★ facts). Merge the closest pairs to stay at 20, the same cap Pierre set per video.

**Areas to cover**
- Routing: who repairs, and why a seller can't see a Route B claim (2)
- Steps 1 to 4: action tags and the status order up to Under QC (3)
- Pickup by market, and a failed collection (2)
- Valid path: "Repair finished", ship-back cost (SA vs AE & ZA, 30 AED), failed delivery (3)
- Invalid path: proof, Revibe reviews every Invalid, "Seller must cover" / Under revision, Lab AE only with Quiqup, Lab Valid and Lab Invalid in AE (5)
- RC+: the 1,500 AED cap, Route A, quotation approval, the over-1,500 outcomes, extended warranty consumed (4)
- Payment tool and portal info (1)

**Good for multiple-answer questions**
- What sends a claim to the Revibe Repair Partner: after 1 year; the customer declares misuse (8.1 [p1])
- Which steps are NO ACTION REQUIRED: Step 1 and Step 2 (8.1 [p1])
- Markets where the pickup AWB is created automatically: AE, ZA (8.1 [p1])
- What the portal shows: Tracking (original shipment), Pickup Tracking, Ship-Back, Lab (8.1 [p1])
- The agent's rationales when challenging an Invalid: "Seller must cover", "Misuse but customer has RC+" (8.1 [p2])
- What happens when the customer doesn't pay above 1,500 AED: no repair; device shipped back; RC+ cancelled (8.1 [p3])

**Keep out until clarified:** the ZA & SA customer-pays rule and the 90 days after Lab Invalid; when the 1-year window starts; whether ZA is charged 30 AED or a local amount; whether the 1,500 AED cap applies on Route A; the Lab outside AE (Contradiction 1) (8.1 [p1] [p2] [p3]).

**Best 3 scenario seeds**
1. An AE seller receives a device at Under QC within 1 year and finds a genuine fault → Mark VALID, repair it and click "Repair finished". Revibe makes the ship-back AWB and 30 AED is deducted from the seller (8.1 [p1] [p2]).
2. Within 1 year, a seller finds misuse but the customer has RC+ → the seller marks Invalid (misuse) and the agent marks "Misuse but customer has RC+". The original seller gives a quotation and repairs the device, and Revibe covers the cost (8.1 [p3]).
3. An RC+ repair quote comes in above 1,500 AED → Pending customer payment, and the customer pays (cost − 1,500 AED). If they don't pay, there is no repair, the device is shipped back and RC+ is cancelled (8.1 [p3]).

### 8.3 Warranties - Wrong Device (Seller & KAM, 1 page)

**Suggested questions: 14**, one per key rule.

**Areas to cover**
- Scope: a different device than ordered, no warranty-period check, straight to the original seller or repair partner (1)
- Steps 1 and 2: "My Account", Pending, missing documents → Cancelled, Pending Collection (2)
- Pickup: automatic for AE (Quiqup) and Others (DHL), manual for SA, always automatic for a repair partner (SA = Naqel) (3)
- Step 4: Under QC, Mark VALID / Mark INVALID (1)
- Valid: replacement if in stock; otherwise an automated refund charged to the seller (actual cost), case closed (2)
- Invalid: written reason and proof; good proof → Lab, rejected → re-marked Valid; repair partner → no Lab, Revibe decides (2)
- Lab decision: Valid → full refund and ship back to the seller; Invalid → customer pays or the device is disposed of (2)
- Failed ship-back and the payment tool (1)

**Good for multiple-answer questions**
- Where the pickup AWB is automatic: AE, Others, and any repair partner including SA (8.3 [p1])
- Courier per case: AE = Quiqup, Others = DHL, repair partner in SA = Naqel (8.3 [p1])
- Outcomes after Revibe checks the proof: good → Lab; rejected → re-marked Valid; repair partner → no Lab, Revibe decides (8.3 [p1])
- Statuses on the workflow: Pending, Cancelled, Pending Collection, Under Collection, Under QC (8.3 [p1])

**Keep out until clarified:** when an SA seller sees the claim (fact 18 for SA); any claim that wrong-device claims have no time limit at all; what "actual cost" covers; who bears the cost of the Lab Valid refund; the Lab outside AE (Contradiction 1) (8.3 [p1]).

**Best 3 scenario seeds**
1. A claim reaches Under QC and the seller agrees it is the wrong device → Mark VALID and check stock of the right device. If it's available, the correct device is shipped to the customer. If not, an automated refund is charged to the seller (actual cost) and the case is closed (8.3 [p1]).
2. A seller believes the customer's wrong-device claim isn't justified → Mark INVALID with a written reason and supporting proof. Revibe checks it: good proof → device sent to the Lab; rejected proof → re-marked Valid → replacement or refund. For a repair partner there is no Lab, and Revibe decides (8.3 [p1]).
3. A disputed device is with the Revibe Lab → the Lab makes the final decision. Valid → full refund and the device is shipped back to the seller. Invalid → shipped to the customer if they pay, disposed of if they don't. Set this scenario in AE until Contradiction 1 is settled (8.3 [p1]).

**Topic total: 34 questions** (20 + 14), mixing single-answer and multiple-answer questions.
