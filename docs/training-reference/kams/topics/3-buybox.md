# 3. Buybox

## What this topic covers

The Buybox is the algorithm and sheet that picks the winning seller for each SKU in one shared catalogue. Sellers set prices for direct shipping orders in the UAE, South Africa (red, AE) and Saudi Arabia (green, SA). The topic covers: how to read the Buybox tab (Monthly Sales, Neutral Buybox, Score, Buybox, Wins, Price, Min columns); how the score and the neutral price set the buy box price; the lowest-conditions rule; minimum prices; the AE and SA price-drop tools with their accept steps; and, for KAMs only, the Buybox AI workbook, Parameters tab, edit history, Log tab and payment tabs. Sources: 3.0 (KAM, 20:49) and 3.1 (Seller, 15:10).

## How it works

Consolidated in the order the material presents it.

1. **The catalogue.** One unique catalogue is shared by all sellers; Revibe sets the rows and sellers can filter but not sort or reorder them (3.0 [01:25] [01:42]; 3.1 [01:24] [01:30]).
2. **Monthly Sales.** Each SKU shows an estimate of units sellable over the next 30 days, shown in bands (3.0 [02:09]; 3.1 [07:09]). Sellers can filter the column to target top sellers (3.1 [07:21]).
3. **Market groups and shipping.** Red (AE) covers the UAE and South Africa, where Revibe handles shipment and pays the shipping fee and provides the airway bill (3.0 [04:11] [04:28]; 3.1 [02:09] [02:33]). Green (SA) is Saudi Arabia, where the seller holds a courier contract, pays fees, ships DDP and creates the airway bill (3.0 [04:04] [04:50]; 3.1 [02:31] [02:33]).
4. **Neutral Buybox price.** The neutral price is the price a seller would compete at with a score of zero (3.0 [04:54] [05:04]; 3.1 [02:58] [03:03]). It sits in the Neutral Buybox AE and SA columns (3.0 [03:07] [t00194]).
5. **Score adjusts the price.** The seller's score (for example +2.70%) moves the price up or down; the sheet example is Price AE = Neutral Buybox AE x (1 + score) (3.0 [05:41] [05:51]). Buy box price is the neutral price impacted by the score (3.1 [03:52] [03:58]). The buy box uses the score to find the lowest scored price, not only the lowest listed price (3.0 [08:20] [08:30]).
6. **Reading the result.** Buybox AE and Buybox SA show the price to compete with (3.0 [06:01]; 3.1 [05:21]). Wins AE and Wins SA show TRUE when the seller is winning that SKU in that country and FALSE when not (3.0 [06:17]; 3.1 [05:24]).
7. **Entering a price.** Sellers type their price in Price AE (U) or Price SA (V) (3.0 [05:38]; 3.1 [05:38]). To win, the price must sit one dirham below the current price (3.0 [06:29] [06:36]); 3.1 phrases it as one dirham below the buy box price (3.1 [06:25]).
8. **Refresh.** The Buybox data refreshes about every hour, so a new price shows in Wins one hour later (3.1 [06:47] [10:21]; 3.0 [06:43]-[06:55], timing unclear).
9. **Special SKU states.** "No bid" means no seller has a price on the SKU; a price entered then wins (3.1 [07:44] [07:50]). A cell showing "<price> - Fulfillment" means the SKU went to fulfillment; a direct price will not win, and the seller must also send the SKU to fulfillment (3.1 [07:59] [08:18]).
10. **Lowest-conditions SKUs.** For the lowest storage, most basic colour and lowest condition devices, the score has no effect and sellers compete on price only (3.0 [19:11] [19:19]; 3.1 [04:31] [05:03]).
11. **Minimum prices (Min AE, Min SA).** The seller sets a floor so prices do not need manual refresh. While not winning, the function runs about hourly and steps the price to the nearest factor of five below the current price, until the minimum is reached or Wins shows TRUE (3.0 [11:52] [12:20] [12:30] [13:10]; 3.1 [08:48] [10:02]). Clearing the minimum restarts competing (3.1 [12:00]).
12. **Formula columns (KAM).** Columns Y to AG hold formulas the seller does not manage. If they break, copy row 2 (Y2:AG2) down to the end of the sheet; then hide the columns so sellers cannot open them (3.0 [13:31] [13:38] [13:43] [13:50] [13:55]).
13. **Price-drop tools.** The AE tool ("UAE & ZA", cell A1 reads 'AE and ZA' per 3.1) has a small table (drop under 20 AED) and a big table (over 20 AED) (3.0 [14:02] [14:19] [14:26]; 3.1 [12:20] [12:33]). The seller ticks Accept? on each SKU to accept, then presses the purple button or the label (3.0 [15:23] [15:32]; 3.1 [13:19] [13:26] [13:42] [13:47]). The SA tool ("KSA"; 'SA' per 3.1) follows the same layout (3.0 [17:30]; 3.1 [12:26] [13:47]).
14. **Authorization.** The button may trigger a script that asks for Google authorization. Click OK, continue in the Google window, select all permissions and continue (3.0 [15:44] [15:58] [16:02]).
15. **Checking changes (KAM).** Right-click a price cell and choose Show edit history to see editor, date and the Replaced old and new values (3.0 [16:36] [16:43] [16:48]). The Log tab lists small price drop, big price drop and Price Lock entries (3.0 [17:00] [17:05]).
16. **Payments (KAM).** The dated weekly payment tabs show orders, compensations, subtotal and total to pay (3.0 [18:04] [18:31]). The trainer says these may be replaced by a new system (3.0 [18:15] [18:22]).

## Seller version vs KAM version

Two versions exist, and they differ in depth and in what they expose.

- **Seller (3.1):** Covers the catalogue, shipping by market, neutral and buy box prices, score effect, lowest-condition rule, reading Wins and Price, minimum prices, and the AE and SA tools with accept steps. It also notes that the seller can ask for a meeting (3.1 [15:00] [15:05]). It does not cover Buybox AI, Parameters, formula columns, edit history, the Log tab or payments.
- **KAM (3.0):** Adds the internal workbook view: Buybox AI database tabs and scored prices for six competing sellers (3.0 [07:20] [08:00]); the Parameters tab (Premium codes, market settings) (3.0 [08:55] [t00544]); how to find a competitor's row and why SF beats SCL on one SKU (3.0 [09:11] [10:14]); formula maintenance and hiding (3.0 [13:31] [13:55]); the Log tab and edit history; payment tabs; and the marketing purpose of lowest-conditions SKUs (3.0 [20:26] [20:37]).
- **Privacy split.** The KAM page flags items not for seller material: staff names and emails, the Log user ID, and competitor codes on Buybox AI (3.0 Personal data section, e.g. [15:58] [16:48] [17:00]). Seller-facing material should not show these.

## Rules, numbers and deadlines

| Rule or number | Source |
|---|---|
| One shared catalogue; sellers filter, cannot sort or reorder | 3.0 [01:25] [01:42]; 3.1 [01:24] [01:30] |
| Monthly Sales = estimate of units over the next 30 days; bands 0-1, 1-3, 3-5, 5-10, 10-20, 20-50, 50+ | 3.0 [02:09] [t00000] [t00837]; 3.1 [07:09] [07:25] |
| Do not ignore SKUs with 0-1 units in 30 days; low sales may reflect a non-competitive price | 3.0 [02:35] [02:54] |
| Red: UAE and South Africa; Revibe pays shipping and provides airway bill | 3.0 [03:41] [04:11] [04:28]; 3.1 [02:00] [02:09] |
| Green: Saudi Arabia (only green country at time of video); seller pays, ships DDP, own courier contract | 3.0 [03:56] [04:04] [04:50]; 3.1 [02:31] [02:33] |
| Neutral price = price at score 0% | 3.0 [04:54] [05:04]; 3.1 [02:58] [03:03] |
| Price AE = Neutral Buybox AE x (1 + score); example 159.84 x 1.027 = 164.15568 (tooltip; trainer says "160 let's say" then 164) | 3.0 [05:41] [05:51] [t00351] |
| Win by pricing one dirham below current price | 3.0 [06:29] [06:36]; 3.1 [06:25] |
| Refresh about hourly; new price shows in Wins about one hour later | 3.1 [06:47] [10:21]; 3.0 [06:43] |
| Small price drop: under 20 AED; big price drop: over 20 AED | 3.0 [14:19] [14:26] [t00848]; 3.1 [12:20] [12:31] |
| Worked drop: price 296, buy box 290, price to win 285, drop 11 (sheet values; trainer reads 2.96 / 2.90 / 2.85) | 3.0 [14:51] [15:17] [t00891] |
| Row 4 example: current 833, price needed 820, drop 13 | 3.1 [13:08] [13:13] |
| Min floor steps to nearest factor of five below current price, about hourly, while not winning | 3.0 [12:20] [12:30] [15:05]; 3.1 [10:02] [10:18] |
| Minimum example values: 200 or 202 (3.0); 800 (UAE) and 950 (SA) (3.1) | 3.0 [12:07] [12:17]; 3.1 [09:41] [09:47] |
| Formula copy range Y2:AG2 dropped to row 16824 | 3.0 [13:38] [13:43] (row end per 3.0 quiz item 30) |
| Priority column bands: 50+ = 7, 20-50 = 6, 10-20 = 5, 5-10 = 4, 3-5 = 3, 1-3 = 2, 0-1 = 1 | 3.0 [13:31] [t00815] |
| Parameters examples: Shipping UAE 15; Shipping KSA fees 100; Min premium 3.0%; Avg take rate (KSA shipping) 20% | 3.0 [08:55] [t00544] |
| Scored price example: SCL 25 at score 0.027 gives 24.325; SF 24 at 0.04 gives 23.04 | 3.0 [08:00] [08:47] [t00480] [t00614] |
| Score examples: -4.00% (3.1 seller sheet); +2.70% (3.0 Smart Cell) | 3.1 [03:12]; 3.0 [05:25] |
| Edit history: right-click cell, Show edit history; example 285 replaced by 296 | 3.0 [16:36] [16:48] [t01008] |
| Weekly payment snapshot 12-10-26 total to pay 67,657 (snapshot only) | 3.0 [18:31] [t01111] |
| Seller Performance snapshot (dated): Score +2.7%, orders 411 | 3.0 [05:25] [t00325] |

## Contradictions

- **Score direction in scored price.** The narration says the score is "plus 2.7" added (3.0 [08:06]), but the sheet values fit subtraction (SCL 25 gives 24.325 at 0.027). 3.0 flags this as unconfirmed. Related: the Scored Price implied formula Price x (1 - Score) is also unconfirmed (3.0 implied definitions).
- **Minimum floor and nearest-five rule.** 3.1 shows a 1016 price with a 950 minimum dropping to 1015 (3.1 [10:26] [10:35]), which is not a multiple of five. 3.0 says the step lands on the nearest factor of five and gives 222 as a non-multiple example. 3.0 also says the drop happens about hourly, while 3.1 says "every time you're not winning" (3.1 [10:02]). 3.1 itself flags the 1015 figure.
- **Units.** 3.0 reads 296 / 290 / 285 as 2.96 / 2.90 / 2.85 (3.0 [14:57] flagged); 3.1 reads 842 / 840 as 8.42 / 8.40 (3.1 [10:11] flagged). Neither page confirms the currency or decimal unit on screen. 3.0 cites AED for the threshold; 3.1 uses "dirham" and marks it unconfirmed.
- **Tool heading labels.** 3.0 reads AE tool as 'UAE & ZA' and SA tool as 'KSA' (3.0 [t00848] [t01044]). 3.1 reads cell A1 as 'AE and ZA' and 'SA' (3.1 [12:20] [12:26]).
- **Wins SA colour.** 3.0's Buybox column group colours are AE red and SA green (3.0 [03:31]), but its review log says the Wins SA header was corrected to pink. 3.1 says Buybox SA and Wins SA are green (3.1 [02:00] [02:10]).
- **Wins timing.** 3.0 says the algorithm synchronises and Wins shows TRUE, timing unclear (3.0 [06:43] [06:55]). 3.1 says one hour later and flags its own frame t00476, which shows Wins AE TRUE in the same frame as the new price (3.1 [07:56]).
- **Price lock.** 3.1 says sellers can lock prices in UAE and South Africa by sending devices to the warehouse (3.1 [00:59] [01:04]). 3.0 says Price Lock is not used at the moment and that its frames date from 2026 (3.0 [17:05] and out-of-date notes).
- **Accept action result.** 3.1 says ticked SKUs disappear from the sheet and buy box prices update automatically after the button (3.1 [13:30] [13:39]). 3.0 says the button "will work" and runs a script (3.0 [15:32]) but does not describe disappearing SKUs. No frame confirms the result (3.1 flags t00812 and t00817 still showing ticks).
- **Price drop bucket edge.** Small is under 20 and big is over 20; a drop of exactly 20 is covered by neither bucket as described (3.0 [14:19] [14:26] flagged).
- **Min refresh cadence framing.** 3.1 says minimums spare sellers from refreshing "every day or every two days" (3.1 [09:01]); 3.0 says the function runs hourly. Not a conflict if the floor is the hourly-run value, but worth stating the cadence precisely.

## Quiz blueprint

**3.0 (KAM), 20:49 video.** Suggested 20 questions (cap). Areas to cover, with suitability:
- Catalogue and Monthly Sales bands (single answer).
- Red vs green markets and who pays shipping (single answer; shipping details are also in 3.1).
- Neutral price, score effect, and Price AE formula (single answer; worked numbers are good).
- Scored price and the lowest-scored-price rule (single answer; the SF vs SCL example).
- Wins TRUE/FALSE and the one-dirham rule (single answer).
- Minimum price behaviour (multiple-answer suited: which stop conditions apply, and what the step rule is).
- Price-drop tools: buckets, accept steps and authorization (multiple-answer suited: the ordered steps).
- Lowest-conditions SKUs (single answer).
- Formula columns and hiding (single answer; KAM-only).
- Edit history and Log tab (single answer; KAM-only).
- Privacy and redaction for seller material (multiple-answer suited: which items must not reach sellers).
- Payments (low weight; mark as possibly superseded).

Scenario seeds (cited):
1. A seller asks why SKU 980105-000004 is won by SF at 24 when SCL is at 25. Answer: SF has the lowest calculated scored price (23.04) (3.0 [08:47] [09:17] [10:14]).
2. A seller at 296 with buy box 290 and price to win 285 asks what to do. Answer: drop 11 to 285, tick Accept? and press the button if they agree (3.0 [14:57] [15:17] [15:23] [15:38]).
3. A seller wants prices to stop falling below a level. Answer: set Min AE or Min SA; the price will not go below it, and clearing it restarts competing (3.0 [12:20] [13:10]; 3.1 [11:55] [12:00]).

**3.1 (Seller), 15:10 video.** Suggested 15 questions. Areas to cover:
- Shipping per market (single answer; QuickUp and DHL are speech-only names, so avoid them in questions).
- Neutral vs buy box price and the score (single answer).
- Lowest-condition devices and why score does not matter (single answer).
- Reading Buybox cell values: No bid, Fulfillment, Locked (multiple-answer suited).
- Wins TRUE/FALSE meaning (single answer).
- Price entry columns and the one-dirham rule (single answer; flag the unit as unconfirmed).
- Minimum price behaviour and removal (single answer).
- AE and SA tools: small and big tables, accept checkboxes and labels (multiple-answer suited: which steps are needed).
- Hourly refresh (single answer).
- Buybox vs Fulfillment App on the ecosystem diagram (single answer).

Scenario seeds (cited):
1. A UAE seller asks who pays shipping on a direct order. Answer: Revibe handles and pays shipping and provides the airway bill (3.1 [02:09] [02:18]).
2. A seller sees "190 - Fulfillment" on a SKU and wants to enter a winning price. Answer: a price entered there will not win; the SKU must also be sent to fulfillment to sell (3.1 [07:59] [08:08] [08:18]).
3. A UAE seller with score -4.00% sees neutral 211 and buy box 203 and asks why. Answer: neutral is the score-zero price; a negative score lowers the buy box price (3.1 [03:08] [03:25] [03:29] [03:39]).
