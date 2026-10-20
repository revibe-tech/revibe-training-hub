# REVIBE Training Hub

An internal employee training platform for **REVIBE** — upload training decks, view them as a polished slideshow, and track every trainee's progress, completion, and feedback.

Built with Next.js (App Router), Firebase, and Supabase.

---

## ✨ Features

### 📚 Training materials
- **Upload PDF & PPTX** decks via drag-and-drop (stored in Supabase Storage).
- **Google Slides friendly** — export as PDF for the best rendering + full progress tracking.
- **Auto text extraction** at upload time (up to 50 pages) powers full-text search.
- **Auto thumbnails** generated from page 1 of each PDF.
- **Category filters** generated dynamically from the uploaded library.
- **Dashboard search** across material names and embedded slide text.
- **Videos** that play from Google Drive, with the steps they cover shown under the player.
- **Import training bundle** (trainer): add a set of Drive decks and videos in one go, e.g. when moving training over from another tool ([docs/WARRANTY_MIGRATION.md](docs/WARRANTY_MIGRATION.md)).

### 🖥️ High-quality slide viewer
- **Crisp HiDPI / Retina rendering** via PDF.js (DPR-aware canvas).
- **Zoom, page navigation, and a page jump input.**
- **Slideshow autoplay** with configurable slide duration (3s / 5s / 10s).
- **Presentation mode** for full-screen, distraction-free viewing.
- **In-document search** (Ctrl+F) with match navigation and "X of Y" counter.
- **End-of-deck completion banner** with a clear finish cue.
- Legacy **PowerPoint Live** viewer retained as a fallback for older `.pptx` uploads.

### 📈 Progress tracking
- **Per-page view tracking** written to Firestore as the trainee moves through a deck.
- **Completion percentage** and completed/in-progress state per material.
- Powers the trainee's personal dashboard and the trainer's analytics.

### ⭐ Feedback & ratings
- **5-star rating + optional comment** collected per material.
- **Auto-prompted** when a trainee reaches the final slide.
- **Always-available Feedback button** in the viewer toolbar (trainees rate anytime; trainers can preview the form).
- Server-side validation of rating range and comment length via Firestore rules.

### 🤖 Training assistant (AI)
- **Ask questions in plain language** from the chat button in the bottom-right corner; inside a deck it answers about that deck.
- **Answers only from material the person can open**, with links to the exact slide (`/viewer?id=…&page=N`).
- **Hybrid search** (pgvector + keywords) over slide text, kept in sync on upload, re-upload and delete; anything missing is indexed when a trainer opens the library.
- **Unanswered questions are logged** so trainers can see what the material is missing.
- Setup and design: [docs/AI_ASSISTANT.md](docs/AI_ASSISTANT.md).

### 📝 Quizzes
- **Topic-by-topic quizzes** with multiple choice and sliders, graded on the server; the latest try per topic counts and the pass mark decides.
- **Review after each topic**: correct answers, why, and links to the deck or video to revisit.
- **Trainer results**: who passed, who's in progress and who hasn't started, per-topic scores, CSV, and imports of past results. See [docs/QUIZ.md](docs/QUIZ.md).

### 📊 Activity (trainer)
- **Per-person activity** on the People page: active time per day, per section, per material and per slide, plus recent actions (opened, searched, asked, completed, rated).
- **Time this week** column, sort and CSV export for everyone.
- Setup and privacy notes: [docs/ACTIVITY.md](docs/ACTIVITY.md).

### 🏆 Gamification
- **Achievement badges** — multiple badges awarded for milestones (first step, completions, feedback, perfect scores, and more) with progress indicators.
- **Completion certificates** — printable / downloadable certificates for finished materials.
- **My Learning page** — personalized progress, in-progress vs. completed tabs, badges, and certificates.

### 👥 Roles & administration
- **Google Sign-In** (Firebase Auth) with automatic popup → redirect fallback.
- **Role-based access** — Trainer vs. Trainee, resolved from email + Firestore.
- **User management** (trainer only) — promote/demote users between roles.
- **Analytics dashboard** (trainer only) — platform metrics, popular materials, and a trainee leaderboard.
- **Annotation editor** (trainer only) — draw/text/shape overlays on PDF pages (Fabric.js), saved per page to Firestore.

### 🔒 Security
- **Firestore security rules** enforcing per-user ownership on progress and feedback, trainer-only writes on materials, and input validation.

---

## 🧱 Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, Turbopack) + React |
| Styling | Tailwind CSS v4 + a custom REVIBE design system (`app/globals.css`) |
| Auth | Firebase Authentication (Google) |
| Database | Firebase Firestore |
| File storage | Supabase Storage |
| PDF rendering | `pdfjs-dist` (pinned to `4.4.168`) |
| Annotation canvas | `fabric` |
| Fonts | Poppins, Inter, JetBrains Mono (via `next/font`) |

> ⚠️ **`pdfjs-dist` must stay at `4.4.168`.** Newer 6.x builds change the worker artifact and break CDN worker loading. Do not upgrade without testing.

---

## 🚀 Getting started

### Prerequisites
- Node.js 18+
- A Firebase project (Auth + Firestore enabled)
- A Supabase project with a public `materials` storage bucket

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Preview mode (no keys, no sign-in)

```bash
npm run dev:preview
```

Runs the whole site with sample decks, people, progress and feedback, without
Firebase/Supabase keys or Google sign-in. Firebase and Supabase are swapped for
in-memory stand-ins (`demo/`) on the dev server only; `npm run build` and
production are unaffected. A floating **Preview** pill switches between the
Trainer and Trainee views and resets the sample data.

### Design system

UI follows the revibe.me brand. See [DESIGN.md](DESIGN.md) for tokens,
components (`components/ui/`) and rules.

### Build for production

```bash
npm run build
npm start
```

---

## 🔑 Environment variables

Create a `.env.local` file in the project root (never commit this file):

```env
# Firebase (client SDK — safe to expose as NEXT_PUBLIC_*)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Training assistant (server-only: never prefix with NEXT_PUBLIC_)
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

The assistant, activity tracking and quizzes each need a one-time SQL migration; see [docs/AI_ASSISTANT.md](docs/AI_ASSISTANT.md), [docs/ACTIVITY.md](docs/ACTIVITY.md) and [docs/QUIZ.md](docs/QUIZ.md).

---

## 📁 Project structure

```
app/
  page.js               # Login page (Google Sign-In)
  dashboard/            # Material grid, search, category filters
    analytics/          # Trainer analytics dashboard
    my-learning/        # Trainee progress, badges, certificates
    users/              # Trainer user management
  editor/               # Trainer annotation editor
  viewer/               # Slide viewer
  globals.css           # Master design system
components/
  Navbar.js             # Top navigation + version pill
  PDFViewer.js          # Slide viewer (search, slideshow, feedback, completion)
  PDFEditor.js          # Fabric.js annotation editor
  UploadZone.js         # Drag-and-drop upload
  FeedbackModal.js      # 5-star rating + comment modal
  BadgesDisplay.js      # Achievement badges
  Certificate.js        # Completion certificate
  ProgressBar.js
contexts/
  AuthContext.js        # Auth state + role detection
lib/
  firebase.js           # Firebase init
  supabase.js           # Supabase init
  materials.js          # Material CRUD
  progress.js           # Per-page progress tracking
  feedback.js           # Ratings & feedback
  achievements.js       # Badge logic + certificate data
  users.js              # User management + leaderboard
  version.js            # App version (shown in navbar)
firestore.rules         # Firestore security rules
```

---

## 🔐 Firestore collections

| Collection | Purpose |
|---|---|
| `users` | Profiles + role (`trainee` / `trainer`) |
| `materials` | Deck metadata, page count, extracted text, storage URL |
| `annotations` | Per-page Fabric.js annotation JSON |
| `progress` | Per-user, per-material viewed pages + completion |
| `feedback` | Per-user, per-material rating + comment |

Deploy the rules with:

```bash
firebase deploy --only firestore:rules
```

---

## 🚢 Deployment

- The web app deploys to **Vercel** (push to `main`).
- **Firestore security rules deploy separately** — run `firebase deploy --only firestore:rules` or paste `firestore.rules` into the Firebase Console → Firestore → Rules.
- Add your production domain to Firebase → Authentication → Authorized domains.

---

## 📌 Versioning

The current app version is shown as a pill next to the REVIBE logo in the navbar and is sourced from `package.json`. Bump it on each meaningful release so deployed builds are easy to identify.
