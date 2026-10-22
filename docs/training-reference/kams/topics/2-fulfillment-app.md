# 2. Fulfillment App

Sources: 2.0 (Seller, 14:45), 2.1 (KAM, 18:13), 2.2 (KAM, Fulfillment App Sheet, 5:47). Citations use the item id and the timestamp, for example (2.0 [03:12]).

## What this topic covers

- The Revibe Fulfillment App (web app, AppSheet front end): how sellers check SKUs available, create shipments, add request products, pack and label stock, and follow it through Revibe's quality check (QC) and inventory.
- How Revibe handles stock once it arrives: rejection, return to supplier, sales, aging returns, price drops in Supplier inventory, and box requests (2.0 [00:09] [08:15] [10:45] [13:21] [14:05]).
- For KAMs: what to monitor in the app, the score rules that decide whether a seller ships directly or only through fulfillment, the other app pages, and the backend Google Sheet behind the app (2.1 [00:00] [02:48]; 2.2 [00:09] [00:16]).

## How it works

One walkthrough of the process, in the order the videos present it. Seller steps come from 2.0; KAM monitoring steps come from 2.1 and 2.2.

1. **Purpose.** Fulfillment is a Revibe-managed service. Sellers send their first one or two shipments so Revibe can check they are serious and have good quality. Revibe then runs a second QC and manages packaging and shipping (2.1 [00:20] [00:35] [00:44] [00:50]; 2.0 [00:09] [00:19]).
2. **Check SKUs available.** The SKUs available list shows the SKUs eligible for the Revibe warehouse. Only SKUs with quantities allowed above zero appear (2.0 [01:25] [02:04]). Rows are ranked by quantities recommended, and warranty plan rows are ignored (2.1 [05:05] [05:15] [05:22]).
3. **Choose SKUs.** Select SKUs from the SKUs available list or from your price sheet (explained in another video), then go to Shipments (2.0 [03:23] [03:39]).
4. **Create a shipment.** On Shipments, click Add (blue + button). The Requests Supplier Form opens with Request Status Requested. Payment method is a required field, and the method in use is 100% - After sales (2.0 [04:11] [04:13] [04:22] [04:23]). Creating a shipment is the seller's role; a KAM can assist (2.1 [08:21] [08:27]).
5. **Add request products.** Press New on the form. The Request products Form opens. Choose the SKU, and the product, Quantity Allowed, Supplier and Buybox supplier fill in and the price changes from -1 to a value such as 607 (2.0 [04:37] [04:47]).
6. **Set quantity and price.** Quantity Sent must be between one and the quantity allowed (2.0 [04:54] [05:07]). The Price starts one unit below the buy box price (607 against 608). The lower the price, the more the seller sells. A price above the buy box is refused with "Come on! Let's beat Buybox!" (2.0 [05:17] [05:22] [05:26]). Total price equals Price multiplied by Quantity Sent (2.0 [05:15]).
7. **Save and add more lines.** Press Save on the shipment form. The product appears under Related entries. More products can be added while the shipment is at the requested stage (2.0 [05:32] [05:34] [06:15]). Once the shipment is no longer at requested stage, the trainer says no more products can be added (2.0 [06:29]). This is contradictory; see Contradictions.
8. **Track pending lines.** Open the Request products page and select the Open tab to see requested products still pending (2.0 [06:38]).
9. **Airway bill and packing.** Revibe creates the airway bill for a requested shipment. The seller prints it and puts it on the box (2.0 [06:54] [07:01] [07:26]; 2.1 [12:13]). Pack each device in bubble wrap, put a sticker showing the SKU, model, colour, storage and condition on it, include a charger, group the same SKUs, and do not use Revibe boxes (2.0 [07:08] [07:15] [07:22] [08:21] [08:56]; 2.1 [11:33] [11:41] [11:50]).
10. **Pickup.** Quiqup collects the boxed order (2.0 [07:05] [07:29]). Pickup is limited to 15 kg per box (2.1 [12:28], spoken only).
11. **Warehouse receipt and QC.** Revibe counts devices and records an unboxing video, so the count must match the request (2.0 [08:38] [08:44] [08:49]). Revibe technicians check function, battery level and physical condition against the quality guidelines file (2.0 [09:19] [09:32] [10:03] [10:10]).
12. **Rejection.** If most devices fail QC, the whole batch is bulk rejected to avoid wasting time on more QC (2.0 [10:17] [10:24] [10:32]; 2.1 [15:49] [15:56]). If only some fail, only those devices are returned and listed under Inventory exits, Return to supplier, with a reason per device (2.0 [10:45] [10:51] [10:58]; 2.1 [16:04] [16:05]).
13. **Live stock.** Devices that pass QC are inbounded and appear live in the seller's inventory (2.0 [11:27] [11:34]).
14. **Sales and aging.** Each sale is recorded in Inventory exits with an Order help value (the order number) and the quantity drops by one (2.0 [11:56] [12:01] [12:03]). Unsold devices are returned to the seller after 20 days, unless the price was dropped; with a dropped price Revibe waits until 30 days (2.0 [13:28] [13:33] [13:39] [13:44]).
15. **Price drop.** In Supplier inventory, select devices with the selection icon, then press Drop -2%. It lowers the selected price by 2% each press (2.0 [12:37] [12:42] [12:54]; 2.1 [17:13] [17:20]).
16. **Box requests.** On Box request, click Add (an ID is generated), choose a type (Laptop, Phone or iPad), set Reason to Send to seller, enter Quantity (the example uses 100) and choose Stickers Yes or No, then save (2.0 [13:58] [14:05] [14:10] [14:13] [14:25] [14:31]).
17. **KAM monitoring.** The KAM checks score bands and fulfillment eligibility (2.1 [02:48]), follows shipments and request products by status (2.1 [07:51] [08:36]), reviews one request or shipment in detail (2.1 [09:08] [10:10]), checks live inventory, inventory to return and exits (2.1 [13:25] [14:41] [15:14]), and uses the backend Google Sheet tabs to trace a shipment by Request ID (2.2 [01:26] [01:40]).

## Seller version vs KAM version

Two audiences are covered. The seller video (2.0) is a how-to for sending stock. The KAM videos (2.1 and 2.2) are a tour for monitoring and supporting sellers.

- **Seller (2.0)** covers: the SKUs list, creating a shipment and request lines, price and quantity rules, packing and labelling, pickup, and what happens to rejected, sold and aged stock. It also includes a short Box request demo (2.0 [00:00]-[14:45]).
- **KAM (2.1)** adds: the purpose of Fulfillment for sellers (recruitment, blocked sellers), score bands and who may ship directly, the country limit, buy box priority, and the lab's role. It then covers all app tabs: SKUs available, Shipments, Request products, Pending QC, All inventory, Fulfilment live inventory, Inventory to return, Supplier inventory, Inventory exits, Stock control, Invalids to fix, Charge inventory, Box inventory, Packaging request and Fulfilment expenses (2.1 [00:20] [02:48] [07:44] [16:18]).
- **KAM backend (2.2)** adds: the Google Sheet "Fulfillment App - O&D" behind the app, the tabs Requests, Request_products, Inventory, Inventory_movements, box_movements and Users, how to trace a shipment by Request ID, the super admin seller view, and an example of a return with a photo (2.2 [00:09] [01:26] [02:04] [03:35] [05:27]).
- Only the KAM videos mention score rules, the seller view, and the monitoring of seller performance. Only the seller video explains how a seller creates a shipment.

## Rules, numbers and deadlines

| Rule or number | Source |
|---|---|
| Quantities allowed are based on sales over the last 15 days in UAE and South Africa, plus current inventory. | 2.0 [02:14] [02:21] |
| Quantities recommended are based on sales over the past two weeks in UAE and South Africa, minus current stock. (Conflicts with 15 days; see Contradictions.) | 2.1 [05:58] [06:03] |
| SKUs available shows only SKUs whose quantities allowed are above zero. | 2.0 [02:04] |
| Quantity Sent must be between one and the quantity allowed. The trainer says 35 against 34 gives an error, but no error text is visible. | 2.0 [04:54] [05:02] |
| A price above Buybox supplier is refused: "Come on! Let's beat Buybox!" | 2.0 [05:22] [05:26] |
| Price starts one unit below Buybox supplier (607 vs 608; 369 vs 370; 638 vs 639). | 2.0 [05:17] [05:46] |
| Total price = Price x Quantity Sent (6,070; 3,600; 1,914; 304 x 3 = 912 in 2.1). | 2.0 [05:15] [06:01] [06:17]; 2.1 [10:32] |
| Payment method 100% - After sales; payment method is required on the Requests Supplier Form. | 2.0 [04:13] [04:23] |
| A 95% payment at warehouse reception method "will be implemented" (not on screen). | 2.0 [04:28] |
| Beat the buy box by at least one DRAM (unit unconfirmed). | 2.0 [03:00] [03:04] |
| Battery thresholds: Good at least 85%, Very good at least 90%, Excellent battery figure 25% (low confidence). | 2.0 [09:44] [09:56] [10:03] |
| Aging: returned after 20 days unless the price was dropped; with a dropped price, returned after 30 days in any case. | 2.0 [13:28] [13:33] [13:39] [13:44] |
| Drop -2% lowers the selected price by 2%; press as many times as wanted (cumulative effect not stated). | 2.0 [12:42] [12:54]; 2.1 [17:20] |
| Quiqup pickup limit: 15 kg per box (spoken only). | 2.1 [12:28] |
| Score band "> 0%": direct shipping and fulfillment allowed. | 2.1 [02:48] |
| Score band "0% to -5%": direct shipping allowed; fulfillment allowed with score upgraded at 0%. | 2.1 [02:40] [02:48] |
| Score band "< -5%": direct shipping not allowed; fulfillment allowed with score upgraded at 0%. | 2.1 [01:31] [02:48] |
| Fulfillment is restricted to sellers who cannot win orders with their buy box, and to newly onboarded sellers. | 2.1 [04:14] [04:22] |
| Fulfillment is not available for Saudi Arabia; available for UAE, South Africa and other countries. | 2.1 [02:04] [02:48] |
| Fulfillment payment terms are the same as for direct shipping orders; "seven days" is spoken only. | 2.1 [17:36] [17:42] |
| Price 9,999 means no price in the market (warranty rows); a price of 9998 is useless and never sells. | 2.1 [05:22] [06:47] [07:00] |
| Sellers send their first one or two shipments to fulfillment. | 2.1 [00:35] [00:40] |
| Bulk rejection: most devices fail QC, so the whole batch is rejected. | 2.0 [10:17] [10:24]; 2.1 [15:49] |
| Snapshot counts: Live 171 (2.1, 13:23 to 14:57); Live 174 (2.2, 02:14); Out of stock 0 in both. | 2.1 [13:23] [14:57]; 2.2 [02:14] |
| Snapshot shipment counts differ by video: 2.0 Picked up 1, Warehouse received 14, Cancelled 1; 2.1 Requested 1, AWB created 2, Under QC 1, Completed 1056; 2.2 AWB created 3, Under QC 1, Completed 1056. | 2.0 [03:43]; 2.1 [07:51]; 2.2 [00:33] |
| Request products snapshot: Open 345 and Closed 25,389 (2.1); Open 315 and Closed 25,419 (2.2). | 2.1 [08:36]; 2.2 [01:08] |
| Shipment d3d4befb holds 12 related request products; shipment f1f9de7f holds 3 SKU lines (quantities recommended 14, 11, 11). | 2.1 [09:13]; 2.2 [01:52] |
| Box request example: Quantity 100 for "50 sales a week" over two weeks (the link is not stated). | 2.0 [14:17] [14:22] [14:25] |
| Example sample dates are old (2024 to 2025 in 2.0 and 2.2; Packaging request rows from 5/19/2026 to 7/1/2026 in 2.1 and 2.2, which are past dates when this topic was written on 2026-10-22). | 2.0 [04:50] [10:20]; 2.1 [16:41]; 2.2 [00:31] [02:56] |

## Contradictions

1. **Sales window.** 2.0 says quantities allowed use sales over the last 15 days. 2.1 and 2.2 say quantities recommended use the past two weeks. Check which term and window the app actually uses before writing questions about it (2.0 [02:14]; 2.1 [05:58]).
2. **Column name.** 2.0 calls the field Quantities allowed. 2.1 and 2.2 call it Quantities recommended (2.0 [02:09]; 2.1 [05:58]; 2.2 [01:39]).
3. **Open and Closed.** 2.0 says Open shows requested products still pending (06:38). 2.1 says Open holds Requested and Cancelled rows, and Closed holds rejected or warehouse received rows (08:52) (2.0 [06:38]; 2.1 [08:52] [09:01]).
4. **Adding products after requested.** 2.0 says products can be added while the shipment is at the requested stage (06:15), then says it cannot add products once the shipment is requested (06:29). 2.0 marks this as garbled and does not state it as fact (2.0 [06:08] [06:15] [06:29]).
5. **Shipment status names.** 2.0 uses Requested, Picked up, Warehouse received and Cancelled. 2.1 and 2.2 use Requested, AWB created, Under QC and Completed. 2.1 says a picked-up status exists but no rows show it (2.0 [03:43]; 2.1 [10:57] [11:06]; 2.2 [00:33]).
6. **Drop -2% visibility.** 2.0 says the Drop -2% button and any selection count are narrated but not visible on any frame (2.0 [12:42]). 2.1 shows the "1 Selected" state with the Drop -2% button on screen (2.1 [17:13] [17:20]).
7. **Bulk return.** 2.1 says sellers can "request for return in bulk" (2.1 [17:13]), but no return button is visible on the frames the page cites, and 2.1 flags this itself.
8. **Box request vs packaging.** 2.0 presents Box request as a seller form to order boxes (2.0 [13:58] [14:05]). 2.1 says Box inventory is not really used and Packaging request is the lab's view of seller requests (2.1 [16:38] [16:44]). 2.2 says box_movements corresponds to the Packaging request page (2.2 [02:38] [02:56]).
9. **Who the KAM may act for.** 2.1 says the KAM is not supposed to interact in the app (2.1 [14:14] [14:21]), and then suggests connecting with the seller's password is "way enough" (2.1 [14:32], unconfirmed and flagged). 2.2 says data should not be entered in backend tabs or the app (2.2 [02:57]), yet the trainer edits his own Users row to a seller's values and later back to Superadmin (2.2 [03:52] [04:50]). The videos do not say whether a KAM may take a seller view this way. Treat as an open question for the team.
10. **Who creates the airway bill.** 2.0 says Revibe creates it for a requested shipment (2.0 [06:54]). 2.1 gives a garbled sentence that could suggest the seller creates one for several shipments (2.1 [12:42], flagged as garbled).
11. **Fulfillment scope.** 2.0 presents fulfillment as the route for sellers in general, with Revibe picking and shipping their devices (2.0 [00:41] [00:44]). 2.1 restricts it to sellers who cannot win buy box orders and newly onboarded sellers (2.1 [04:14] [04:22]).
12. **Buy box as price.** 2.0 treats Buybox supplier as a price (608 for 010109-060101) and says the list price equals the buy box price (2.0 [02:42] [04:47]). 2.1 treats Buybox supplier as a numeric column whose meaning is not defined (2.1 [10:28]). 2.2 says the meaning is not explained (2.2 [01:46]).
13. **Pickup and destination.** 2.0 says Quiqup collects the boxed order (2.0 [07:29]). 2.1 says the seller must ship requested products to "ReviveLab" and that Quiqup picks up at the seller's office (2.1 [11:16] [11:24]). The name ReviveLab does not appear on screen.
14. **Charger wording.** 2.0 says include a charger with each device (2.0 [07:22]). 2.1 says phones need USB-C cables and laptops need the whole cable and charger (2.1 [12:01]).
15. **Quantity sent limit.** 2.0 says Quantity Sent cannot exceed the allowed quantity (2.0 [04:54]). 2.1 shows a Warning message for rows where Quantity Sent is above Quantity recommended (2.1 [08:57], unconfirmed). 2.0 also notes a Missing item row with Quantity Allowed 0 and Quantity Sent 2, and a price above buy box that should be refused (2.0 [07:33]).
16. **Out-of-date data.** 2.0 flags the 95% payment method as not yet live and possibly out of date. 2.0 also says the score logic slide dates from 2024 (2.1 [02:48]). The example dates and "new feature" wording in 2.0 may age (2.0 [13:58]).

Other notes on what is not confirmed: the score rules and country list come from a Drive slide that may be out of date (2.1 [02:48]); the 15 kg limit and the seven-day payment basis are spoken only (2.1 [12:28] [17:42]); the battery figures are read from speech with low confidence (2.0 [09:44]).

## Quiz blueprint

Question counts follow the rule of about one per minute of video, at most 20 per video.

### 2.0 (Seller, 14:45 = 885 s)

- **Suggested questions:** 15.
- **Areas to cover:** the Fulfillment principle and seller benefits; SKUs available (quantities allowed, the list filter, sorting, download); creating a shipment and request lines (Add, New, Save); price and quantity rules; airway bill and packing; pickup; warehouse QC and rejection; return and inventory exits; the 20 and 30 day aging rule; Drop -2%; the Box request form.
- **Multiple-answer areas:** the packing checklist (bubble wrap, sticker fields, charger, grouped SKUs, carton not Revibe box) (2.0 [07:08] [07:15] [07:22] [08:21] [08:56]); the sticker fields (SKU, model, colour, storage, condition) (2.0 [07:15] [09:04]); Request products list columns (2.0 [07:33] [07:48]); Inventory exits groups (2.0 [10:54] [11:02]); Box request form fields (2.0 [14:12] [14:25]).
- **Best scenario seeds:**
  1. A seller wants to set a price of 609 on a line whose buy box is 608. The form refuses it with "Come on! Let's beat Buybox!". Set a price that beats the buy box, since a lower price sells more (2.0 [05:22] [05:26] [05:17]).
  2. A seller has packed 10 devices for a shipment. Which steps are correct? Bubble-wrap each device, add a sticker per device with SKU, model, colour, storage and condition, include a charger, group the same SKUs, and do not use Revibe boxes (2.0 [07:08] [07:15] [07:22] [08:21] [08:56]).
  3. An unsold device has been in stock for 20 days and the price was not dropped. What happens? Revibe returns it as an aging inventory return. If the seller drops the price, Revibe waits until 30 days (2.0 [13:28] [13:33] [13:39]).

### 2.1 (KAM, 18:13 = 1093 s)

- **Suggested questions:** 18.
- **Areas to cover:** the purpose of fulfillment (recruiting, blocked sellers); score bands and what each allows; fulfillment eligibility and the country limit; the SKUs available list (quantities recommended, warranty rows, 9999 and 9998 prices); the Shipments and Request products groups and the Open/Closed split; the packing rules; live inventory and inventory to return; bulk rejection vs return to supplier; Drop -2%; the KAM role in the app.
- **Multiple-answer areas:** the score band rules (which bands allow direct shipping and which allow fulfillment) (2.1 [02:48]); the inventory exit types and groups (2.1 [15:24] [15:48] [16:15]); the shipment quantity fields read in order (2.1 [09:52]); the packing rules (2.1 [11:33] [11:41] [12:01] [12:13]); the sections of Supplier inventory (2.1 [14:57] [17:08]). Avoid multiple-answer items on the disputed charger wording.
- **Best scenario seeds:**
  1. A seller has a score below -5% and is blocked from direct shipping. Is fulfillment still allowed? Yes, with the score upgraded at 0% in fulfillment (2.1 [02:48] [01:31] [02:40]).
  2. A seller asks to use fulfillment from Saudi Arabia. Answer: fulfillment is not available for Saudi Arabia (2.1 [02:04] [02:48]).
  3. A shipment shows Completed, but one of its request products shows Cancelled. Record it as a warning; the video gives no further action (2.1 [09:20]). Use this as a "what does the video say" item, not a process item.

### 2.2 (KAM backend sheet, 5:47 = 347 s)

- **Suggested questions:** 6.
- **Areas to cover:** the front end versus the backend Google Sheet; the backend tabs and what each holds; filtering Request_products by Request ID; the Packaging request and box_movements link; the seller view for meetings; Inventory exits return reasons and photo proof.
- **Multiple-answer areas:** backend tabs and their purpose (Requests, Request_products, Inventory, Inventory_movements, box_movements, Users) (2.2 [00:00] [02:05] [02:26] [02:51] [03:35]); Requests tab columns (2.2 [00:00]); the Inventory exits reasons (2.2 [05:27] [05:33]). Avoid asking KAMs to act on the Users-row edit, because the videos conflict on it.
- **Best scenario seeds:**
  1. A seller asks which SKUs are in shipment f1f9de7f. Filter Request_products by Request ID f1f9de7f and read the three SKU lines with quantities (2.2 [01:26] [01:39] [01:52]).
  2. You are in the backend tabs and want to change a value. The video says usually you should not input data in these tabs or in the Fulfillment app (2.2 [02:57]). Note the trainer's own Users-row edit contradicts this; see Contradictions item 9.
  3. A seller asks why a device came back. Open Inventory exits, Return to supplier, read the Reason for return, and check Related Attachments for the photo proof (2.2 [05:19] [05:27] [05:33]). Note the camera dot is not clearly visible in the full-size photo (2.2 [05:40]).
