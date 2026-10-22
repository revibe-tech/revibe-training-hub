// Sample Firestore data for local preview mode. Dates are relative to "now" so
// presence ("Online now"), "active this week" and recent activity look alive.
import { DEMO_MATERIALS, textContentFor } from './content.mjs';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const PREVIEW_USERS = {
  trainer: { uid: 'demo-trainer', email: 'sara.khan@revibe.me', displayName: 'Sara Khan' },
  trainee: { uid: 'demo-trainee', email: 'omar.ali@revibe.me', displayName: 'Omar Ali' },
  seller: { uid: 'demo-seller', email: 'ahmed@phonehub.ae', displayName: 'Ahmed Saleh' },
  admin: { uid: 'demo-admin', email: 'youssf.rehem@revibe.me', displayName: 'Hub Admin' },
  management: { uid: 'demo-management', email: 'rami.aziz@revibe.me', displayName: 'Rami Aziz' },
};

const PEOPLE = [
  ['demo-trainer', 'Sara Khan', 'sara.khan@revibe.me', 'trainer', 0.2, 1, 120],
  ['demo-trainee', 'Omar Ali', 'omar.ali@revibe.me', 'trainee', 0.3, 1, 30],
  ['demo-admin', 'Hub Admin', 'youssf.rehem@revibe.me', 'trainer', 0.1, 1, 400],
  ['demo-management', 'Rami Aziz', 'rami.aziz@revibe.me', 'trainee', 2, 10, 90],
  ['u-layla', 'Layla Haddad', 'layla.haddad@revibe.me', 'trainee', 0.5, 2, 64],
  ['u-karim', 'Karim Mansour', 'karim.mansour@revibe.me', 'trainee', 5, 30, 52],
  ['u-noor', 'Noor Saeed', 'noor.saeed@revibe.me', 'trainer', 1.2, 60, 200],
  ['u-yousef', 'Yousef Nasser', 'yousef.nasser@revibe.me', 'trainee', 40, 2 * DAY / MIN, 21],
  ['u-maya', 'Maya Fares', 'maya.fares@revibe.me', 'trainee', 300, 3 * DAY / MIN, 14],
  ['u-adam', 'Adam Rahman', 'adam.rahman@revibe.me', 'trainee', 3000, 9 * DAY / MIN, 45],
  ['u-hana', 'Hana Ibrahim', 'hana.ibrahim@revibe.me', 'trainee', 0.8, 5, 9],
  ['u-zaid', 'Zaid Khalil', 'zaid.khalil@revibe.me', 'trainee', 20000, 20 * DAY / MIN, 80],
  ['demo-seller', 'Ahmed Saleh', 'ahmed@phonehub.ae', 'trainee', 0.4, 1, 18],
  ['u-rania', 'Rania Aziz', 'rania@mobilezone.sa', 'trainee', 90, 2 * DAY / MIN, 26],
  ['u-tariq', 'Tariq Hamdan', 'tariq@fixitlab.ae', 'trainee', 600, 4 * DAY / MIN, 33],
];

// Partners (not @revibe.me): their kind, and the groups a trainer put them in.
const PARTNERS = {
  'demo-seller': { partnerType: 'seller', groups: ['group:ksa-sellers'] },
  'u-rania': { partnerType: 'seller', groups: ['group:gold-sellers'] },
  'u-tariq': { partnerType: 'repair' },
};

// Revibe staff on the management team see every material (read-only).
const TEAMS = { 'demo-management': { team: 'management' } };

const GROUPS = {
  'ksa-sellers': 'KSA sellers',
  'gold-sellers': 'Gold sellers',
};

// Who sees each material (docs/AUDIENCES.md). Anything not listed: Revibe agents.
const AUDIENCES = {
  'demo-grading': ['revibe', 'seller'],
  'demo-customer-care': ['revibe', 'group:ksa-sellers'],
  'demo-warranty': ['revibe', 'seller', 'repair'],
  'demo-battery': ['revibe', 'repair', 'group:gold-sellers'],
  'demo-express': ['revibe', 'user:demo-seller'],
};

// Categories trainers have set up; the rest fall back to Revibe agents.
const CATEGORIES = {
  quality: { name: 'Quality', audiences: ['revibe', 'seller'] },
  'customer-care': { name: 'Customer Care', audiences: ['revibe', 'group:ksa-sellers'] },
  policies: { name: 'Policies', audiences: ['revibe'] },
};

// [uid, materialIndex, pagesViewed (or 'all'), daysAgoStarted]
const PROGRESS = [
  ['demo-trainee', 0, 'all', 6], ['demo-trainee', 1, 'all', 5], ['demo-trainee', 2, 4, 2], ['demo-trainee', 3, 2, 1],
  ['u-layla', 0, 'all', 9], ['u-layla', 1, 'all', 8], ['u-layla', 2, 'all', 6], ['u-layla', 3, 'all', 4], ['u-layla', 5, 3, 1],
  ['u-karim', 0, 'all', 12], ['u-karim', 1, 5, 7], ['u-karim', 6, 'all', 3],
  ['u-hana', 0, 'all', 4], ['u-hana', 3, 3, 1],
  ['u-yousef', 0, 'all', 15], ['u-yousef', 2, 'all', 11], ['u-yousef', 4, 'all', 9], ['u-yousef', 7, 2, 4],
  ['u-maya', 0, 3, 3],
  ['u-adam', 0, 'all', 20], ['u-adam', 1, 'all', 18], ['u-adam', 4, 'all', 15], ['u-adam', 6, 4, 10],
];

// [uid, materialIndex, rating, comment]
const FEEDBACK = [
  ['demo-trainee', 0, 5, 'Super clear intro. Loved the first week plan.'],
  ['demo-trainee', 1, 4, ''],
  ['u-layla', 0, 5, 'Best onboarding deck I have seen.'],
  ['u-layla', 1, 5, 'The photo checklist slide is gold.'],
  ['u-layla', 2, 4, 'Would love a video for the touch grid test.'],
  ['u-layla', 3, 5, ''],
  ['u-karim', 0, 4, ''],
  ['u-karim', 6, 3, 'Cut off times changed last month, please update.'],
  ['u-hana', 0, 5, 'Very welcoming!'],
  ['u-yousef', 0, 4, ''],
  ['u-yousef', 2, 5, 'Exactly what I needed on the floor.'],
  ['u-yousef', 4, 4, 'Clear and short.'],
  ['u-adam', 1, 3, 'Fair vs Good is still a bit fuzzy.'],
  ['u-adam', 4, 4, ''],
];

function thumbnail(title, category) {
  const words = title.split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > 22 && lines.length < 3) lines.push(w);
    else lines[lines.length - 1] = (cur + ' ' + w).trim();
  }
  const text = lines
    .map((l, i) => `<text x="48" y="${170 + i * 46}" font-family="Montserrat,Arial,sans-serif" font-size="38" font-weight="800" fill="#fff">${l.replace(/&/g, '&amp;')}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C82D8C"/><stop offset=".55" stop-color="#7F19A0"/><stop offset="1" stop-color="#5019A0"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#g)"/>
<circle cx="560" cy="60" r="140" fill="#fff" fill-opacity=".08"/><circle cx="80" cy="360" r="160" fill="#fff" fill-opacity=".06"/>
<rect x="48" y="52" rx="16" height="32" width="${category.length * 11 + 36}" fill="#fff" fill-opacity=".18"/>
<text x="66" y="74" font-family="Montserrat,Arial,sans-serif" font-size="15" font-weight="700" fill="#fff" letter-spacing="1">${category.toUpperCase()}</text>
${text}
<text x="48" y="320" font-family="Montserrat,Arial,sans-serif" font-size="18" font-weight="900" fill="#fff" letter-spacing="2">REVIBE</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createSeed(Timestamp) {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const users = {};
  const materials = {};
  const progress = {};
  const feedback = {};

  for (const [uid, displayName, email, role, activeMinsAgo, loginMinsAgo, joinedDaysAgo] of PEOPLE) {
    users[uid] = {
      uid, displayName, email, role, photoURL: null,
      lastActive: iso(activeMinsAgo * MIN),
      lastLogin: iso(loginMinsAgo * MIN),
      createdAt: iso(joinedDaysAgo * DAY),
      earnedBadges: uid === 'demo-trainee' ? ['first_step', 'first_completion'] : undefined,
      ...PARTNERS[uid],
      ...TEAMS[uid],
    };
    if (users[uid].earnedBadges === undefined) delete users[uid].earnedBadges;
  }

  DEMO_MATERIALS.forEach((m) => {
    materials[m.id] = {
      id: m.id,
      name: m.name,
      fileName: `${m.id}.pdf`,
      category: m.category,
      audiences: AUDIENCES[m.id] || ['revibe'],
      fileSize: 180000 + m.slides.length * 42000,
      pageCount: m.slides.length,
      storagePath: `${m.id}.pdf`,
      downloadURL: `/preview-files/${m.id}.pdf`,
      thumbnailURL: thumbnail(m.name, m.category),
      textContent: textContentFor(m),
      uploadedBy: 'sara.khan@revibe.me',
      uploadedAt: new Timestamp(now - m.daysAgo * DAY),
    };
  });

  // A few videos and quizzes so the library shows every kind of material.
  for (const [id, kind, name, category, daysAgo] of [
    ['demo-video-grading', 'video', 'Grading a phone, step by step', 'Quality', 1],
    ['demo-video-returns', 'video', 'Processing a return in the OMS', 'Operations', 3],
    ['demo-quiz-grading', 'quiz', 'Grading standards check', 'Quality', 2],
    ['demo-quiz-policies', 'quiz', 'Warranty & returns policy quiz', 'Policies', 4],
  ]) {
    materials[id] = {
      id, kind, name, category,
      audiences: ['revibe'],
      pageCount: 0,
      textContent: [],
      thumbnailURL: thumbnail(name, category),
      uploadedBy: 'sara.khan@revibe.me',
      uploadedAt: new Timestamp(now - daysAgo * DAY),
    };
  }

  for (const [uid, idx, viewed, startedDaysAgo] of PROGRESS) {
    const m = DEMO_MATERIALS[idx];
    const total = m.slides.length;
    const count = viewed === 'all' ? total : viewed;
    const completed = count >= total;
    const startedMs = startedDaysAgo * DAY;
    const lastMs = Math.max(startedMs - 6 * HOUR, 20 * MIN);
    progress[`${uid}_${m.id}`] = {
      uid, materialId: m.id, materialName: m.name, totalPages: total,
      viewedPages: Array.from({ length: count }, (_, i) => i + 1),
      lastPage: count,
      completed,
      completionPercentage: Math.round((count / total) * 100),
      startedAt: iso(startedMs),
      lastViewedAt: iso(lastMs),
      ...(completed ? { completedAt: iso(lastMs) } : {}),
    };
  }

  FEEDBACK.forEach(([uid, idx, rating, comment], i) => {
    const m = DEMO_MATERIALS[idx];
    const u = users[uid];
    const at = iso((i + 1) * 7 * HOUR);
    feedback[`${uid}_${m.id}`] = {
      uid, materialId: m.id, materialName: m.name, rating, comment,
      userName: u.displayName, userEmail: u.email, userPhoto: null,
      createdAt: at, updatedAt: at,
    };
  });

  const groups = Object.fromEntries(Object.entries(GROUPS).map(([id, name]) => [id, { name, description: '', createdAt: iso(10 * DAY) }]));
  const categories = Object.fromEntries(Object.entries(CATEGORIES).map(([id, c]) => [id, { ...c, updatedAt: iso(10 * DAY) }]));

  return {
    users,
    materials,
    progress,
    feedback,
    groups,
    categories,
    annotations: {},
    materialUpdates: {
      'upd-1': {
        materialId: 'demo-onboarding',
        materialName: DEMO_MATERIALS[0].name,
        updatedBy: 'Sara Khan',
        action: 'added',
        audiences: ['revibe'],
        updatedAt: new Timestamp(now - 3 * HOUR),
      },
    },
    notificationDismissals: {},
  };
}
