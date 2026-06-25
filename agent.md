# AGENT.md — CampusFlow Ground Truth

> This file is the single source of truth for every AI agent, coding assistant, or LLM working on this codebase.
> Read this entire file before writing any code, suggesting any change, or answering any question about this project.
> If something is not listed here, ask the developer — do not invent it.

---

## 1. WHAT THIS PROJECT IS

**CampusFlow** is a full-stack student productivity web app. B.Tech students use it to track deadlines, get AI-generated study help, and receive automatic WhatsApp reminders + Google Calendar events — all triggered by real automation via n8n.

**The single most important data flow:**
```
User adds task on frontend
  → POST /api/tasks (Express backend)
    → INSERT into Supabase tasks table
      → POST to n8n webhook (HTTP)
        → n8n creates Google Calendar event
        → n8n waits until reminderTime
        → n8n sends WhatsApp via Twilio
```

Everything in this app exists to support that flow. Do not add features, routes, or components outside this scope without asking.

---

## 2. TECH STACK — LOCKED, NO SUBSTITUTIONS

| Layer | Package / Service | Version / Notes |
|---|---|---|
| Frontend framework | React + Vite | Latest stable |
| CSS | Tailwind CSS | darkMode: 'class' |
| Forms | React Hook Form | All forms. No uncontrolled inputs ever. |
| HTTP client | Axios | Custom instance in `src/api/axios.js` |
| Notifications | react-hot-toast | All toasts. No alert(), no console.log shown to user. |
| Backend | Node.js + Express | REST API only. No GraphQL. |
| Database | Supabase (PostgreSQL) | supabase-js v2 |
| Auth | Supabase Auth | Email + password. No OAuth, no magic link. |
| AI | Groq SDK (`groq-sdk`) | Model: `llama3-8b-8192` ONLY. No GPT, no Gemini. |
| Automation | n8n Cloud | Webhook-triggered. No polling. |
| WhatsApp | Twilio via n8n | Twilio node inside n8n. NOT called directly from backend. |
| Calendar | Google Calendar via n8n | Google Calendar node inside n8n. NOT called directly from backend. |

**If you are about to use a package not in this table — stop and ask.**

---

## 3. FOLDER STRUCTURE — EXACT, DO NOT DEVIATE

```
campusflow/
├── AGENT.md                         ← this file
├── README.md
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── .env                         ← never commit, copy from .env.example
│   ├── .env.example
│   ├── server.js                    ← entry point
│   ├── config/
│   │   └── supabase.js              ← createClient with SERVICE_KEY
│   ├── routes/
│   │   ├── auth.js                  ← /api/auth
│   │   ├── tasks.js                 ← /api/tasks
│   │   └── ai.js                    ← /api/ai
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── taskController.js
│   │   └── aiController.js
│   ├── middleware/
│   │   └── authMiddleware.js        ← JWT verify via supabase.auth.getUser()
│   └── services/
│       ├── groqService.js           ← ALL Groq calls live here
│       └── n8nService.js            ← ALL n8n webhook POSTs live here
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                  ← React Router v6 routes
        ├── api/
        │   └── axios.js             ← Axios instance, interceptors
        ├── context/
        │   └── AuthContext.jsx      ← user, token, login, logout, loading
        ├── hooks/
        │   ├── useTasks.js
        │   └── useAI.js
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── DashboardPage.jsx
        │   ├── TasksPage.jsx
        │   ├── NoticePage.jsx
        │   ├── AttendancePage.jsx
        │   └── AutomationsPage.jsx
        ├── components/
        │   ├── layout/
        │   │   ├── Navbar.jsx
        │   │   └── Sidebar.jsx
        │   ├── tasks/
        │   │   ├── TaskCard.jsx
        │   │   └── AddTaskModal.jsx
        │   ├── ai/
        │   │   ├── FlashcardDeck.jsx
        │   │   ├── SummaryResult.jsx
        │   │   └── AttendanceAlert.jsx
        │   └── ui/
        │       ├── Badge.jsx
        │       ├── Spinner.jsx
        │       └── DarkModeToggle.jsx
        └── styles/
            └── index.css
```

**Rules:**
- Do not create files outside this structure without asking.
- Do not rename files. File names are referenced across the codebase.
- Do not split a file into sub-files unless the original file exceeds 300 lines and you explain why.

---

## 4. DATABASE SCHEMA — EXACT COLUMN NAMES

**Table: `students`**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, references auth.users(id) |
| name | TEXT | NOT NULL |
| branch | TEXT | e.g. "CSE", "ECE" |
| year | INT | 1–4 |
| phone | TEXT | E.164 format: "+919876543210" |
| subjects | TEXT[] | e.g. ["DBMS", "OS", "CN"] |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Table: `tasks`**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, gen_random_uuid() |
| student_id | UUID | FK → students(id) |
| title | TEXT | NOT NULL |
| subject | TEXT | must be one of student's subjects |
| deadline | TIMESTAMPTZ | NOT NULL |
| reminder_time | TIMESTAMPTZ | deadline − 24 hours, set by backend |
| add_to_calendar | BOOLEAN | default TRUE |
| status | TEXT | 'pending' or 'done' only |
| n8n_triggered | BOOLEAN | set to TRUE after successful webhook POST |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Table: `automation_logs`**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, gen_random_uuid() |
| student_id | UUID | FK → students(id) |
| type | TEXT | 'deadline_reminder' or 'notice_broadcast' only |
| payload | JSONB | the full object sent to n8n |
| status | TEXT | 'success' or 'failed' only |
| triggered_at | TIMESTAMPTZ | DEFAULT NOW() |

**Do not add columns without updating this file.**
**Do not use column names that differ from the table above** — e.g. `dueDate` is wrong, `deadline` is right. `userId` is wrong, `student_id` is right.

---

## 5. API ROUTES — COMPLETE LIST

All routes are prefixed with `/api`. Every route except auth requires `authMiddleware`.

### Auth (no middleware)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /api/auth/register | `{ name, branch, year, phone, subjects[], email, password }` | `{ user, session }` |
| POST | /api/auth/login | `{ email, password }` | `{ user, session, token }` |

### Tasks (requires auth)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/tasks | — | `{ tasks: Task[] }` |
| POST | /api/tasks | `{ title, subject, deadline, add_to_calendar }` | `{ task: Task }` |
| PATCH | /api/tasks/:id | `{ status: 'done' \| 'pending' }` | `{ task: Task }` |
| DELETE | /api/tasks/:id | — | `{ success: true }` |

### AI (requires auth)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /api/ai/tip | — | `{ tip: string }` |
| POST | /api/ai/summarize | `{ noticeText, phoneList?: string[] }` | `{ summary: string[], eventTitle: string, eventDate: string \| null }` |
| POST | /api/ai/flashcards | `{ notes: string }` | `{ flashcards: [{ question, answer }] }` |
| POST | /api/ai/attendance | `{ attendanceData: [{ subject, attended, total }] }` | `{ alerts: [{ subject, currentPercent, classesNeeded, isAtRisk }], overallTip: string }` |

**No other routes exist. Do not invent routes like `/api/students`, `/api/users`, `/api/seed`, `/api/health` unless explicitly asked.**

---

## 6. ENVIRONMENT VARIABLES — WHAT EACH ONE IS

### Backend (`backend/.env`)
```
PORT=3001
SUPABASE_URL=          # From Supabase dashboard → Settings → API → Project URL
SUPABASE_SERVICE_KEY=  # From Supabase dashboard → Settings → API → service_role key (NOT anon key)
GROQ_API_KEY=          # From console.groq.com → API Keys
N8N_DEADLINE_WEBHOOK=  # From n8n workflow 1 → Webhook node → copy "Test URL" (switch to Production URL before demo)
N8N_NOTICE_WEBHOOK=    # From n8n workflow 2 → Webhook node → copy "Test URL"
TWILIO_WA_FROM=        # The Twilio WhatsApp sandbox number: +14155238886 (standard sandbox number)
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=          # http://localhost:3001 in dev, deployed backend URL in prod
VITE_SUPABASE_URL=     # Same as backend SUPABASE_URL
VITE_SUPABASE_ANON_KEY=# From Supabase dashboard → Settings → API → anon public key
```

**Rules:**
- Backend uses `SUPABASE_SERVICE_KEY` (bypasses RLS — safe because backend verifies JWT before any query).
- Frontend uses `SUPABASE_ANON_KEY` (respects RLS — users only see their own data).
- Never use `SUPABASE_SERVICE_KEY` in frontend code. Never use `SUPABASE_ANON_KEY` in backend code.
- All frontend env vars must start with `VITE_` or Vite will not expose them.
- Never log env vars. Never commit `.env` files.

---

## 7. AUTHENTICATION FLOW — EXACT IMPLEMENTATION

```
Register:
  Frontend → POST /api/auth/register { name, branch, year, phone, subjects, email, password }
  Backend  → supabase.auth.signUp({ email, password })
           → INSERT INTO students (id=auth.user.id, name, branch, year, phone, subjects)
           → return { user, session }
  Frontend → store session.access_token in localStorage as 'campusflow_token'
           → store user object in localStorage as 'campusflow_user'
           → redirect to /dashboard

Login:
  Frontend → POST /api/auth/login { email, password }
  Backend  → supabase.auth.signInWithPassword({ email, password })
           → return { user, session, token: session.access_token }
  Frontend → store token + user → redirect to /dashboard

Every protected request:
  Frontend axios interceptor → reads 'campusflow_token' from localStorage
                             → adds header: Authorization: Bearer <token>
  Backend authMiddleware     → extracts token from header
                             → supabase.auth.getUser(token)
                             → if valid: req.user = { id, email } → next()
                             → if invalid: return res.status(401).json({ error: 'Unauthorized' })

Logout:
  Frontend → remove 'campusflow_token' and 'campusflow_user' from localStorage
           → reset AuthContext state
           → redirect to /login

Session rehydration on page reload:
  AuthContext useEffect on mount → read token from localStorage
                                 → if token exists: set it in state (user is restored)
                                 → if not: user stays null (ProtectedRoute redirects to /login)
```

---

## 8. GROQ API — EXACT USAGE PATTERN

**Always use this pattern. Never deviate.**

```js
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const response = await groq.chat.completions.create({
  model: 'llama3-8b-8192',           // ALWAYS this model
  response_format: { type: 'json_object' },  // ALWAYS json_object
  messages: [
    { role: 'system', content: 'You are a helpful assistant for B.Tech students. Always respond with valid JSON.' },
    { role: 'user', content: yourPromptHere }
  ],
  max_tokens: 1024,
});

const result = JSON.parse(response.choices[0].message.content);
```

**Rules:**
- Always `response_format: { type: 'json_object' }` — this guarantees parseable JSON output. Never string-parse AI responses with regex or `.split()`.
- Always `JSON.parse(response.choices[0].message.content)` — the content is a string even with json_object mode.
- Always wrap in try/catch. If Groq fails, return HTTP 502 with `{ error: 'AI service unavailable' }`.
- Never call Groq from the frontend. All Groq calls go through the backend.
- Never cache Groq responses in a variable across requests — every call must be fresh.

### Exact prompts for each endpoint

**POST /api/ai/tip**
```
system: "You are a helpful assistant for B.Tech students. Always respond with valid JSON."
user:   "Give one specific, actionable study tip for today. Keep it under 20 words.
         Return JSON: { \"tip\": string }"
```

**POST /api/ai/summarize**
```
system: "You are a helpful assistant for college students. Always respond with valid JSON."
user:   "Summarize the following college notice in exactly 3 bullet points. Extract the event date and title if mentioned.
         Return JSON: { \"summary\": string[], \"eventTitle\": string, \"eventDate\": string | null }
         The eventDate must be in ISO 8601 format if found, or null if not mentioned.
         Notice: <noticeText>"
```

**POST /api/ai/flashcards**
```
system: "You are a helpful study assistant for B.Tech students. Always respond with valid JSON."
user:   "Generate exactly 5 flashcards from these lecture notes. Make questions specific and testable.
         Return JSON: { \"flashcards\": [{ \"question\": string, \"answer\": string }] }
         Notes: <notes>"
```

**POST /api/ai/attendance**
```
system: "You are a helpful academic advisor for B.Tech students. Always respond with valid JSON."
user:   "Analyze this attendance data. For each subject, calculate the current percentage.
         Mark subjects below 75% as at-risk and calculate how many more classes they must attend
         (without missing any) to reach 75%. Also give one overall motivational tip.
         Return JSON: { \"alerts\": [{ \"subject\": string, \"currentPercent\": number, \"classesNeeded\": number, \"isAtRisk\": boolean }], \"overallTip\": string }
         Data: <JSON.stringify(attendanceData)>"
```

---

## 9. n8n WEBHOOK — EXACT PAYLOAD SHAPES

### Workflow 1 — Deadline Reminder
Backend sends this exact payload to `N8N_DEADLINE_WEBHOOK`:
```json
{
  "studentName": "Rahul Sharma",
  "phone": "919876543210",
  "subject": "DBMS",
  "taskTitle": "Lab Assignment 3",
  "deadline": "2025-08-15T23:59:00.000Z",
  "reminderTime": "2025-08-14T23:59:00.000Z"
}
```
- `phone` without the `+` prefix (Twilio adds `whatsapp:+` in n8n)
- `deadline` and `reminderTime` in ISO 8601 UTC
- `reminderTime` = deadline − 86400000ms (24 hours)

### Workflow 2 — Notice Broadcast
Backend sends this exact payload to `N8N_NOTICE_WEBHOOK`:
```json
{
  "noticeText": "The original notice text...",
  "aiSummary": "• Point 1\n• Point 2\n• Point 3",
  "eventTitle": "Annual Sports Day",
  "eventDate": "2025-08-20T09:00:00.000Z",
  "phoneList": ["919876543210", "918765432109"]
}
```
- `phoneList` items without `+` prefix
- `aiSummary` is the bullet string joined from the `summary` array: `summary.map(s => '• ' + s).join('\n')`
- `eventDate` is null if AI couldn't extract it — handle this in n8n with an IF node

---

## 10. SUPABASE QUERY PATTERNS — USE THESE EXACTLY

```js
// backend/config/supabase.js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET tasks for current user
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('student_id', req.user.id)
  .order('deadline', { ascending: true });

// INSERT a task
const { data, error } = await supabase
  .from('tasks')
  .insert({ student_id: req.user.id, title, subject, deadline, reminder_time, add_to_calendar })
  .select()
  .single();

// UPDATE n8n_triggered after webhook fires
await supabase.from('tasks').update({ n8n_triggered: true }).eq('id', task.id);

// GET student profile
const { data: student } = await supabase
  .from('students')
  .select('*')
  .eq('id', req.user.id)
  .single();

// INSERT automation log
await supabase.from('automation_logs').insert({
  student_id: req.user.id,
  type: 'deadline_reminder',
  payload: { studentName, phone, subject, taskTitle, deadline },
  status: 'success'
});

// Error handling pattern — use for every query
if (error) {
  console.error('Supabase error:', error.message);
  return res.status(500).json({ error: error.message });
}
```

---

## 11. FRONTEND STATE & DATA RULES

### What lives in AuthContext
- `user` — object from Supabase auth (id, email) + student profile (name, branch, year, phone, subjects)
- `token` — JWT string from Supabase session
- `loading` — boolean, true while checking session on mount

### What lives in component state (useState)
- `tasks` — fetched in `useTasks.js`, used in TasksPage and DashboardPage
- `aiTip` — fetched on DashboardPage mount
- `automationLogs` — fetched in AutomationsPage
- `flashcards` — returned from /api/ai/flashcards, lives in the page component that triggered it
- `attendanceAlerts` — returned from /api/ai/attendance, lives in AttendancePage

### Data freshness rules
- `tasks` — re-fetch after every createTask and deleteTask (don't optimistically update, always re-fetch from Supabase)
- `automationLogs` — fetch on AutomationsPage mount only
- `aiTip` — fetch on DashboardPage mount only (one fresh Groq call per visit)
- Student profile — fetch once on login, store in AuthContext, don't re-fetch on every page

### localStorage keys (use these exact strings)
- `campusflow_token` — the JWT string
- `campusflow_user` — JSON stringified user + student profile object
- `campusflow-theme` — `'dark'` or `'light'` for DarkModeToggle

---

## 12. WHAT THE AI MUST NEVER DO

### Never invent data
- Never return hardcoded strings from AI endpoints (e.g. `return { tip: "Study 25 minutes then take a 5 minute break." }`)
- Never initialize stats with numbers (e.g. `const [taskCount, setTaskCount] = useState(5)`)
- Never render fake cards, fake logs, or fake subjects in the UI

### Never add unauthorised packages
- No Redux, no Zustand, no Context API beyond AuthContext
- No Prisma, no TypeORM, no Sequelize — Supabase client only
- No OpenAI, no Anthropic, no Google Generative AI — Groq only
- No Framer Motion, no GSAP — Tailwind transitions only
- No react-query, no SWR — manual fetch with useEffect + useState

### Never call external services directly from frontend
- No Groq calls from frontend — all AI goes through `/api/ai/*`
- No Twilio calls from frontend — all WhatsApp goes through n8n
- No Google Calendar API calls from frontend — all calendar goes through n8n
- Supabase can be called from frontend ONLY for: reading automation_logs (AutomationsPage) and session management

### Never skip error handling
- Every `async/await` must have a `try/catch`
- Every Supabase query must check `if (error)`
- Every Groq call must handle failure gracefully with a user-visible toast
- Every n8n webhook call must not throw — log error, continue, still return 200 to user

### Never write these anti-patterns
```js
// ❌ Hardcoded data
const subjects = ["DBMS", "OS", "CN", "DSA"];

// ❌ Static AI response
return res.json({ tip: "Take breaks every 25 minutes." });

// ❌ Skipping auth middleware
router.get('/tasks', taskController.getTasks);  // missing authMiddleware

// ❌ String-parsing AI output
const tip = response.choices[0].message.content.split('"tip":')[1];

// ❌ Calling Groq from frontend
const res = await fetch('https://api.groq.com/...', { headers: { Authorization: process.env.GROQ_KEY } });

// ❌ Blocking response on n8n
await n8nService.triggerDeadlineReminder(...);  // if this throws, user gets a 500
// ✅ Correct pattern:
try { await n8nService.triggerDeadlineReminder(...); } catch(e) { console.error(e); }
// then always return 200

// ❌ Initialising state with fake data
const [tasks, setTasks] = useState([{ title: "OS Assignment", subject: "OS" }]);

// ❌ Using wrong env var
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY); // in backend!
```

---

## 13. DARK MODE — IMPLEMENTATION PATTERN

```jsx
// frontend/src/components/ui/DarkModeToggle.jsx
useEffect(() => {
  const saved = localStorage.getItem('campusflow-theme');
  if (saved === 'dark') document.documentElement.classList.add('dark');
}, []);

const toggle = () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('campusflow-theme', isDark ? 'dark' : 'light');
};
```

```js
// tailwind.config.js — this must be set or dark mode won't work
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx}'],
  ...
}
```

Every component must use `dark:` variants:
```jsx
// ✅ Correct
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">

// ❌ Wrong — hardcoded color, invisible in dark mode
<div style={{ backgroundColor: 'white', color: '#111' }}>
```

---

## 14. EMPTY STATES — EXACT COPY

These strings must appear exactly as written when data is absent:

| Location | Empty State |
|---|---|
| Dashboard — no tasks today | "No tasks due today. Add your first deadline →" with a button to /tasks |
| TasksPage — 0 tasks in DB | "You haven't added any tasks yet. Hit '+ Add Task' to get started." |
| TasksPage — filter returns 0 | "No tasks match this filter." |
| AutomationsPage — 0 logs | "No automations triggered yet. Add a task to send your first WhatsApp reminder." |
| AttendancePage — before submit | "Enter your attendance numbers above and click Analyze Risk." |
| NoticePage — before summarize | "Paste a college notice above to get an AI summary and broadcast it to your study group." |
| FlashcardDeck — notes empty | "Please enter your lecture notes before generating flashcards." (shown as form validation, not empty state) |

---

## 15. SUBJECT COLOR BADGE — DETERMINISTIC LOGIC

The same subject must always render the same color. Use this function:

```js
// src/components/ui/Badge.jsx
const COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
];

export function getSubjectColor(subject) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Badge({ subject }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSubjectColor(subject)}`}>
      {subject}
    </span>
  );
}
```

---

## 16. DEADLINE COUNTDOWN — EXACT FORMAT

```js
// Use this function everywhere a deadline is displayed
export function getDeadlineLabel(deadline) {
  const now = new Date();
  const due = new Date(deadline);
  const diffMs = due - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) return { label: 'OVERDUE', className: 'text-red-600 font-bold' };
  if (diffHours < 1) return { label: 'Due in < 1 hour', className: 'text-red-500 font-semibold' };
  if (diffHours < 24) return { label: `Due in ${diffHours}h`, className: 'text-orange-500 font-semibold' };
  if (diffDays === 1) return { label: 'Due tomorrow', className: 'text-amber-500' };
  return { label: `Due in ${diffDays} days`, className: 'text-gray-500 dark:text-gray-400' };
}
```

---

## 17. PHONE NUMBER VALIDATION (NoticePage)

```js
// Validate each phone number before sending to backend
const PHONE_REGEX = /^\+[1-9]\d{9,14}$/;

function parsePhoneList(rawInput) {
  const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
  const valid = [];
  const invalid = [];
  for (const line of lines) {
    if (PHONE_REGEX.test(line)) valid.push(line.replace('+', ''));
    else invalid.push(line);
  }
  return { valid, invalid };
}

// Show error if any are invalid — do not proceed with broadcast until all are valid
if (invalid.length > 0) {
  setError(`Invalid numbers: ${invalid.join(', ')} — use format +91XXXXXXXXXX`);
  return;
}
```

---

## 18. n8n STATUS INDICATOR — EXACT LOGIC

```js
// In DashboardPage — query automation_logs for latest entry
const { data: logs } = await supabase
  .from('automation_logs')
  .select('triggered_at')
  .eq('student_id', user.id)
  .order('triggered_at', { ascending: false })
  .limit(1);

const lastLog = logs?.[0];
const isRecentlyActive = lastLog &&
  (new Date() - new Date(lastLog.triggered_at)) < 24 * 60 * 60 * 1000;

// Render:
// isRecentlyActive  → green dot + "Automation Active — last triggered X mins ago"
// !lastLog          → gray dot + "No automations triggered yet"
// lastLog but old   → gray dot + "Last triggered X days ago"
```

---

## 19. COMMON MISTAKES TO CATCH BEFORE THEY HAPPEN

| Mistake | Correct Behaviour |
|---|---|
| Using `SUPABASE_ANON_KEY` in backend | Use `SUPABASE_SERVICE_KEY` in backend |
| Using `SUPABASE_SERVICE_KEY` in frontend | Use `VITE_SUPABASE_ANON_KEY` in frontend |
| Calling n8n and throwing on failure | Wrap in try/catch, never throw, always return 200 |
| `useState([])` with hardcoded initial tasks | `useState([])` then fetch from Supabase on mount |
| Forgetting `authMiddleware` on a route | Every route in `tasks.js` and `ai.js` needs it |
| `response_format` missing from Groq call | Add `response_format: { type: 'json_object' }` |
| `JSON.parse` missing on Groq response | `response.choices[0].message.content` is a string, always parse it |
| Phone with `+` sent to n8n | Strip `+` before sending, n8n adds `whatsapp:+` |
| Dark mode not working | Check `darkMode: 'class'` is in `tailwind.config.js` |
| Tailwind classes not applying | Check `content` glob in `tailwind.config.js` includes `./src/**/*.{js,jsx}` |
| Form submitting without validation | Every form field needs `register` from React Hook Form with validation rules |
| Missing loading state | Every `async` action needs `setLoading(true)` before and `setLoading(false)` in finally |
| Token not sent with request | Check axios interceptor in `src/api/axios.js` is attaching Bearer header |

---

## 20. BUILD ORDER — FOLLOW THIS SEQUENCE

Build in this exact order. Do not skip ahead. Each step depends on the previous.

```
1.  backend/package.json + .env.example
2.  backend/config/supabase.js
3.  backend/middleware/authMiddleware.js
4.  backend/services/groqService.js
5.  backend/services/n8nService.js
6.  backend/controllers/authController.js
7.  backend/controllers/taskController.js
8.  backend/controllers/aiController.js
9.  backend/routes/auth.js + tasks.js + ai.js
10. backend/server.js
11. [ Run Supabase SQL schema ]
12. frontend/package.json + vite.config.js + tailwind.config.js + index.html
13. frontend/src/styles/index.css
14. frontend/src/api/axios.js
15. frontend/src/context/AuthContext.jsx
16. frontend/src/App.jsx (with ProtectedRoute)
17. frontend/src/components/ui/ (Badge, Spinner, DarkModeToggle)
18. frontend/src/components/layout/ (Navbar, Sidebar)
19. frontend/src/pages/LoginPage.jsx
20. frontend/src/hooks/useTasks.js + useAI.js
21. frontend/src/components/tasks/ (TaskCard, AddTaskModal)
22. frontend/src/pages/TasksPage.jsx
23. frontend/src/pages/DashboardPage.jsx
24. frontend/src/components/ai/ (SummaryResult, AttendanceAlert, FlashcardDeck)
25. frontend/src/pages/NoticePage.jsx
26. frontend/src/pages/AttendancePage.jsx
27. frontend/src/pages/AutomationsPage.jsx
28. README.md + .gitignore
```

---

*CampusFlow v2.0 | CampusAI Hackathon 2025 | This file is the ground truth — update it if anything changes.*