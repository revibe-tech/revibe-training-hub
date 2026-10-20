# Who sees what

Every material has an `audiences` list. A person sees a material when the list
has any value they read by. Trainers and the Management team see everything.

| Value | Who it means | Set where |
|---|---|---|
| `revibe` | Revibe agents (`@revibe.me`, any team but Management) | Categories, Edit details, Upload |
| `seller` | Sellers (partners who picked Seller) | Categories, Edit details, Upload |
| `repair` | Repair partners | Categories, Edit details, Upload |
| `group:<id>` | People a trainer put in that group, e.g. "KSA sellers" | Groups (Library ⋯ or People), then Categories, Edit details, Upload |
| `user:<uid>` | One person | People → a person → Access → Share |

An empty list (materials saved before audiences existed) means Revibe agents only.

## For trainers

- **View as** (Library, top of All materials): pick Revibe agents, Sellers,
  Repair partners or a group to see the library exactly as they do. Switch to
  **Everything** to see what they can't open, dimmed, and use **Show** / **Hide**
  on a card to change it for them. Only trainers and the Management team get
  View as. Management can preview but can't change anything.
- **Groups**: Library ⋯ → Manage groups, or People → Groups. Make a group,
  tick its people, then tick the group under "Who can see this" on a material
  or a category.
- **One person**: People → ⋯ → View activity & access. The Access section lists
  every material they can open and why (their audience, a group, or "Shared with
  them"). Toggle their groups, share a single material with them, or stop sharing (×).
- **Categories**: toggling an audience on a category adds or removes it on every
  material in it. Groups and people a single material is shared with stay.
- **Delete user**: People → ⋯ → Delete user…, or the button in their drawer.
  Removes their profile, progress, ratings, activity, quiz tries and assistant
  questions. Their Google account still works: if they sign in again they start
  over as a new user (and pick Seller / Repair again).
- Deleting a group takes it off people, categories and materials. It's refused
  while a material is shared with that group only, so nothing ends up with an
  empty list (which would read as Revibe-only).

## How it's enforced

- `firestore.rules` (`canSeeAudiences`) checks every read: built-in audience,
  `'user:' + uid`, or any of the reader's `groups`. Only trainers can write a
  person's `groups`, a material's `audiences` or the `groups` collection.
- The library runs one `array-contains` query per value the person reads by and
  merges them (`lib/materials.js`), since rules only allow queries they can
  prove. The assistant does the same on the server (`lib/server/viewer.js`), so
  it only ever searches what the person could open.
- Browser and server share the logic in `lib/audience.js`.

## Setup

Publish the latest `firestore.rules` (Firebase console → Firestore → Rules, or
`firebase deploy --only firestore:rules`). Until then the library still works,
but groups can't be read or saved.
