# KAM quiz plan

This plan gives the question counts, a suggested order for new joiners and the 20 strongest scenario seeds for the training quiz. It is built from the quiz blueprints on the topic pages (0 to 13) and the Quiz material sections on the item pages. It supports the question writing Pierre asked for; it does not replace it. Questions should still be written by people, with a mix of single-answer and multiple-answer items, and at most 20 questions per video.

Citations use the item id and video time, for example (6.0 [00:19]). Where a fact is marked unconfirmed or medium confidence in the source, the seeds below avoid it or say so.

## Notes on the source pack

- **All 23 items have a page.** Item 0.0 (`items/0.0.md`) and the 1.x items (`items/1.0.md`, `items/1.1.md`, `items/1.2.md`) are present, with Quiz material sections. Topic 1 (`topics/1-onboarding-app.md`) is also present.
- **Topic pages with no blueprint text.** Topics 1, 2, 4, 6, 11 and 12 give only a line about how counts are set. Their rows below use the item Quiz material (and the item lengths) instead.
- **Counting rule.** Suggested questions are the video length in whole minutes, rounded to the nearest minute, at most 20. Where a topic blueprint gives an explicit count, that count is used. Item 8.0 is 6:37, so the blueprint's 7 is slightly above the rule. Item 11.0 is 29:58 and is capped at 20. Items 8.1 and 8.3 are PDFs, so their counts follow the page-based blueprint.
- **Item 4.0** is titled "Orders App (TBU)". Check whether it is still to be updated before it is quizzed.
- **Item 13.0** has no audience in its metadata. The narration speaks to the seller, so it is listed as Seller.

## Per-item table

| Id | Title | Audience | Suggested questions | Good for multiple-answer | Main areas |
|---|---|---|---|---|---|
| 0.0 | Revibe Ecosystem | KAM | 7 | Five legal documents; Revibe App functions; Seller portal functions; trial-period KAM duties | Onboarding steps and durations; quality check of 20 to 30 pieces; KAM role; Buybox vs Fulfillment countries; Saudi exclusion; scoring affects prices. Avoid the commission, the exact rejection threshold and the scoring calculation (not stated). |
| 1.0 | Onboarding App | KAM | 15 | Documents to check at review; Rationale options; Accepted sub-statuses in order; Onboarding Plan "if no" rationales | Public form; agreement via DocuSign; Approval (Incomplete, Missing data, Under Review); Profile list groups; Onboarding Plan; Leads and Lead Stage; Accepted next steps. Avoid the approval-is-admin-only line (unconfirmed) and the internal comment date format (unconfirmed). |
| 1.1 | Onboarding App | Seller | 15 | Agreement clauses that apply to a UAE seller; Required fields marked *; Grades and what each allows | Three markets and who ships; four steps; sell.revibe.me for one-time sales; Accepted or Incomplete approval; Fulfillment App link steps; quality guideline thresholds. The agreement clause numbers in 1.1 differ from the 9.0 agreement page; check against 9.0 before quizzing on clause numbers. |
| 1.2 | Onboarding App, Fulfillment | Seller | 11 | Fulfillment App tabs; packing steps; Device conditions; Quality outcome of the first shipment | First shipment steps; Quantities recommended; price 9,999 and 9998 rules; Create a shipment (+ Add, New); beat-Buybox error; packing; Quiqup collection; quality outcomes. Avoid "30 to 50 pieces" (spoken only) and the sticker placement (unsettled). |
| 2.0 | Fulfillment App | Seller | 15 | Shipment statuses and Request products groups; Inventory exits types; Return to supplier reasons; Box request fields | Quantities allowed; Price one below Buybox supplier; Total price = Price x Quantity Sent; packing rules; Aging return (20 and 30 days); Drop -2%; box types. Avoid the 35-units error (trainer says an error shows, frame shows none). |
| 2.1 | Fulfillment App (KAM) | KAM | 18 | Three purposes of Fulfillment; score bands (> 0%, 0 to -5%, < -5%); shipment groups; Inventory tabs; Drop -2% | Purpose and eligibility; Saudi exclusion; regional groups AE and SA; SKU Status Free market; prices 9,999 and 9998; Request products fields; bulk QC rejection; Return to supplier. Avoid the trainer's "null or positive" score line (unconfirmed). |
| 2.2 | Fulfillment App Sheet (backend) | KAM | 6 | Backend tabs; fields on a Request_products row; sidebar items hidden in the seller view | Frontend vs backend sheet; finding SKUs by Request ID; Reason for return; seller view; data-entry rule. Avoid the SteppingStone buy-box price line (cut off, unconfirmed). |
| 3.0 | Buybox (KAM) | KAM | 20 | Minimum price stop conditions; price-drop tool steps; privacy and redaction items; formula columns | Catalogue and Monthly Sales bands; red and green markets; neutral price and Price AE formula; lowest scored price; Wins flags; accept steps; edit history and Log tab. Payments are low weight and may be superseded. |
| 3.1 | Buybox (Seller) | Seller | 15 | Reading Buybox cell values (No bid, Fulfillment, Locked); AE and SA tool steps | Shipping per market; neutral vs buy box price; lowest-condition devices; Wins; the one-dirham rule (unit unconfirmed); minimum prices; hourly refresh. Avoid QuickUp and DHL names (speech-only). |
| 4.0 | Orders App (TBU) | Seller | 12 | Order stage groups in order; steps for a UAE order; Request Revibe options | Order created, Shipped and Delivered meanings; Availability Status and the 5% charge; Tracking ID for Saudi orders; 48-hour shipping; DHL pickup scan; invoices. Avoid the KPI names (unclear). Check the TBU status first. |
| 5.0 | Cancellations | Seller | 3 | Country rules (which may reject, which must mark valid); the 24-hour shipping rule | Cancellation flow and purple bar; Mark Invalid; tracking ID modal. Avoid the tracking ID rule per country (unconfirmed) and the "{created?}" stage. |
| 6.0 | Returns | Seller | 12 | Which events happen without seller action; which claim states need seller action | 15-day eligibility and second valid claim; AE and ZA auto AWB vs SA manual; Mark VALID and Mark INVALID; lab decisions; Under revision steps; 100 MB attachment limit. |
| 7.0 | Refund policy | Seller | 11 | Which stages the seller owns in SA vs other markets; which events stop the clock; claims-list marker meanings | Scope and deadlines (5, 6/7, 8/9 WD); weekends; under collection; resolution requests (Add Resolution); dashboard path. Avoid "9 WD +", the orders app, working-hour conversion and the snapshot figures. |
| 8.0 | Warranties, Issues | Seller & KAM | 7 | Which actions the seller takes at each stage; RC+ routes; invalid reason options | One-year rule and misuse; Claim Management views (R, W, WR); Tracker stages; collection and AWB rules; Valid and Invalid; Repair finished; lab in UAE only; RC+ routes. Note: 6:37 rounded to 7 per topic blueprint. |
| 8.1 | Warranties, Issues (PDF) | Seller & KAM | 12 | RC+ above 1,500 AED; Lab outcomes; Invalid reason and proof | Within 1 year vs repair partner; AE and ZA auto AWB, SA manual; Invalid reason and proof; agent agrees or challenges; lab collection AE only; Lab Valid and Invalid; RC+ 1,500 AED cap. Check the Naqel and Stripe details before quizzing. |
| 8.2 | Warranties, Wrong Device | Seller & KAM | 3 | Replacement available vs not (Yes or No); Invalid path steps | Four steps; Mark VALID; Device Available For Replacement; refund at actual cost when no stock; proof under 100 MB. Avoid the higher-spec example and the "choose No" screen detail (unconfirmed on screen); use 8.3 for the No path. |
| 8.3 | Warranties, Wrong Device (PDF) | Seller & KAM | 5 | Pickup rules per market; VALID path with and without stock; lab final decisions | No warranty-period check; AWB rules per market; VALID with and without stock; Invalid proof; lab Valid and Invalid; ship-back failures. Repair partner "Naqel" line is unconfirmed. |
| 9.0 | Seller agreement | Seller & KAM | 4 | Required documents to keep valid; warranty exclusions; grade definitions; post-termination duties; payee account types Revibe never pays | Shipping deadline and shipped-status penalties; payment account rule; weekly payment and withholding; VAT scheme and renewal; grades and thresholds; packing evidence and exit. |
| 10.0 | Quality guidelines | Seller & KAM | 5 | Banned-element groups; screen acceptance by grade; parts allowed by grade; laptop rules | Grades and 100% functional baseline; battery minimums; plug and parts; banned elements; claims limit and 10% penalty. Avoid the camera-dot limit for Excellent and Very good (sources conflict) and who checks claims. |
| 11.0 | Dashboard | KAMs | 20 (30 capped) | Morning checklist items; Buybox closed since bands; Refund policy warning columns; KPI weights | Daily tab; time frames; Methodology; meetings target and colours; Legal card; late and stuck orders; policy clock and hours; KAM index; bonus period; KPI thresholds; scoring every Thursday. Avoid the stuck-order day count (4 vs 3 days, conflicting) and the MARKED under-70% rule (unconfirmed). |
| 11.1 | Dashboard (Seller) | Seller | 9 | Defect-rate scope (warranty and return claims only); on-time rules; Days-to-solve end dates; next-score weights | Sign in; header tools; Monthly, Weekly and Daily views; on-time rules (3 working days outside SA and 5 in SA, medium confidence for the outside-SA figure); defect rate; claims coverage; days to solve; four-KPI score (10, 60, 20, 10). Avoid the same-item vs same-order rule (held, sources conflict). |
| 12.0 | South Africa Bulk Shipments | Seller & KAM | 5 | Step order for the day; what the rider scan does; rules for the sealed box | Ready for pickup; barcodes; one sealed box with red tape; Missing and Can't scan; Mark ready for collection at about 3 PM; the daily checklist. Quiqup and DHL field mappings were removed as unsupported. |
| 13.0 | Commitments | Seller | 1 | Rules on the offer (colour split, change until deadline, save confirmation) | Commitment window and deadline; per-device price and quantity; colour split must add up; saving and changing an offer; accepted commitments locked. Avoid multiple-answer on the dates (recording may be out of date). |

**Total suggested questions: 231** (sum of the Suggested questions column, after the 11.0 cap). Each video stays at or under 20.

## Suggested order for new joiners

Follow the folder numbering. Nothing in the source material asks for a different order, so the order is:

1. 0.0 Revibe Ecosystem
2. 1.0, 1.1, 1.2 Onboarding App
3. 2.0, 2.1, 2.2 Fulfillment App
4. 3.0, 3.1 Buybox
5. 4.0 Orders App
6. 5.0 Cancellations
7. 6.0 Returns
8. 7.0 Refund policy
9. 8.0, 8.1, 8.2, 8.3 Warranties
10. 9.0 Seller agreement
11. 10.0 Quality guidelines
12. 11.0, 11.1 Dashboard
13. 12.0 South Africa Bulk Shipments
14. 13.0 Commitments

## Strongest scenario seeds (20)

Each seed names the item and the answer the material supports. Citations follow the item id and time.

1. **Quality sample rejected.** A seller's sample is mostly rejected at quality check. Answer: the seller cannot proceed with the application (0.0 [00:58] [00:58 t00060]).
2. **Legal clearance documents.** A new seller asks which documents are needed. Answer: the five documents, namely the seller agreement, trading licence, VAT registration certificate, Emirates ID and bank details (0.0 [02:48] [02:59] [02:50 t00170]). Suits multiple-answer.
3. **First shipment fails quality.** A seller's first shipment fails the quality check. Answer: the devices are returned, and the result is Return and No-onboarding (1.1 [03:03] [03:10] [03:12 t00144]).
4. **Trial period shipping.** A seller asks whether they can ship direct to customers during the trial period. Answer: only Fulfillment by Revibe is available; direct shipping comes at full onboarding (1.1 [03:33 t00227] [04:13 t00248]).
5. **Score below minus 5%.** A seller's score is below minus 5%. Answer: direct shipping is not allowed, fulfillment is still allowed, and the score is upgraded at 0% in fulfillment (2.1 [02:48 t00168] [01:31] [02:40]).
6. **Lowest scored price.** A seller asks why SKU 980105-000004 is won by SF at 24 when SCL is at 25. Answer: SF has the lowest calculated scored price, 23.04 (3.0 [08:47] [09:17] [10:14]).
7. **Price to win.** A seller at 296, with buy box 290 and price to win 285, asks what to do. Answer: drop 11 to 285, tick Accept, and press the button (3.0 [14:57] [15:17] [15:23] [15:38]).
8. **Fulfillment SKU.** A seller sees "190 - Fulfillment" on a SKU and enters a winning price. Answer: that price will not win; the SKU must also be sent to fulfillment to sell (3.1 [07:59] [08:08] [08:18]).
9. **Not Available charge.** A seller sets an order to Not Available. Answer: a confirmation dialog shows a 5% charge on the cost (4.0 [05:00 t00300] [05:02-05:09]). Check the TBU status of 4.0 first.
10. **Invalid claim needs a tracking ID.** A seller presses Mark Invalid on an order with no tracking ID. Answer: the error "Tracking ID is required to mark the claim as invalid" appears and the Add tracking ID modal opens (5.0 [02:15] [02:19]).
11. **Eligibility window.** A customer's order was delivered 16 days ago and they raise a first claim. Answer: eligibility is 15 days from delivery, so the first claim is not eligible; a second valid claim is accepted after 15 days (6.0 [00:19] [00:33]).
12. **Resolution clock.** A seller raises a resolution request on Wednesday and it is solved on Friday. Answer: the clock froze on Wednesday, restarted on Friday, and the seller still has 3 WD before a warning (7.0 [02:26-02:48]).
13. **Warranty over one year.** A customer's claim is more than a year old and no misuse is declared. Answer: the Revibe Repair Partner handles it, and the original seller does not see the claim (8.0 [00:18] [00:24]).
14. **Right device not in stock.** A wrong-device claim is marked Valid and the right device is not in stock. Answer: Revibe refunds the customer automatically and the seller is charged at actual cost; the case closes (8.3 [p1]).
15. **Shipped-status breach.** A seller marks an order shipped before the device has left. Answer: a breach of the shipped-status rule, with a 20% penalty of the initially quoted SKU price (9.0 [00:30] [00:42] [00:37]).
16. **Personal bank account.** A seller asks for payment into a personal bank account. Answer: refused; Revibe pays only to the company account in the registered name, and the rule cannot be changed (9.0 [00:56] [01:03]).
17. **Battery below the Good minimum.** A phone has 84% battery health and is sold as Good. Answer: below the Good minimum of 85%, so it is a banned element (10.0 [01:01] [03:52]).
18. **Buybox closed for 12 days.** A seller's Buybox closed row shows 12 days in the Since column and the seller is Active. Answer: call the seller today; over 10 is red, and every day closed is lost volume (11.0 [06:00 t00360] [05:46 t00346]).
19. **Missing device in a box.** A device is on the open box list but not in the box. Answer: press Remove on that device's row; otherwise it comes back as Missing and goes into the next box (12.0 [02:46 t00167] [02:50]).
20. **Colour split.** A seller has split a 200-unit device into colours that add up to 120. Answer: do not save as is; the row shows a red error, so the colours must add up to 200 first (13.0 [00:39 t00039] [00:07 t00007]).
