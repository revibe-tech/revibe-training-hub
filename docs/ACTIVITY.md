# Activity tracking

Trainers see how each person uses the hub: **People → a person → Activity**.

| What | How it's measured |
|---|---|
| Time on the hub, per day | Active time only: the tab is visible and they did something in the last 2 minutes (20 for videos, since watching needs no input) |
| Where the time goes | The same time, by section (Library, decks and videos, My learning…) |
| Time per material and per slide | Time with a deck or video open, split by slide. Shows where someone slowed down |
| Visits, active days | Browser-tab visits and days with any activity |
| Recent actions | Opened, searched (and whether the library had it), asked the assistant (and whether it could answer), completed, rated |

The People list also gets a **Time this week** column, a sort and a CSV column.

## How it works

- `lib/activity.js` runs in the browser for whoever is signed in
  (`components/ActivityTracker.js`). It adds up active time every 5 seconds and
  sends a batch to `/api/activity` every minute, when the tab is hidden and when
  the page closes.
- `/api/activity` (POST) takes the person from their verified Firebase ID token,
  never from the request body, checks every event (known types, at most an hour
  per event) and saves it with the service-role key.
- Trainers read it through `/api/activity` (GET, trainer only), which sums it in
  Postgres (`user_activity_summary`, `activity_overview`).
- RLS is on with no policies and the functions are revoked from `anon` and
  `authenticated`, as for the assistant: the browser's anon key can't read anyone's activity.

## Setup (one time)

1. **Supabase → SQL Editor:** run `supabase/migrations/20261021_activity.sql`.
2. Nothing else: it uses the `SUPABASE_SERVICE_ROLE_KEY` the assistant already needs.

Until the SQL has run, the tracker gets a 503 and switches itself off, and the
People page shows a setup note instead of activity.

## Privacy

This is workplace monitoring, so tell people it happens (onboarding or the
training policy is enough). It records no keystrokes, question text or page
content: only time, routes, material ids, and search terms typed into the library search.
Delete old rows on a schedule if you want a retention limit (see the end of the migration).
