# CampusFlow AI+ 🎓

CampusFlow AI+ is an advanced, premium student productivity platform built for B.Tech students. It integrates student profiles, deadline tracking, RAG knowledge bases, persistent multi-mode AI chat workspaces, mock interviews with browser voice input, startup idea validators, and background n8n automation pipelines to manage calendar schedules and WhatsApp timed alerts.

---

## Key Features

- [x] **Secure JWT Student Auth**: Signup & login with Supabase Auth + metadata mapping (branch, year, phone, subjects, and Google Account email).
- [x] **Dynamic Deadline Tracker**: CRUD operations for tasks, automatic UTC reminder calculations, and background webhook integrations.
- [x] **Smart Study Planner**: AI partitions studying blocks and schedules them on Google Calendar & Twilio WhatsApp reminders using n8n.
- [x] **Interactive MCQ Quiz Mode**: AI parses lecture notes to generate live multiple-choice questions with answer tracking and weak topic detection.
- [x] **AI Chat Hub**: Multi-mode persistent chat (Study AI, Placement Coach, Startup Mentor, Creator Advisor, General Bot) with Web Speech API dictation support.
- [x] **RAG Knowledge Base**: Upload PDFs, extract text, chunk content, generate local 384-dimensional semantic embeddings, and run matching vector search.
- [x] **BrainSpace Startup Hub**: SWOT mapping, TAM/SAM/SOM market forecasts, scorecards (viability/risk), and print-ready report generators.
- [x] **Placement Prep Dojo**: ATS resume keyword auditing, original DSA question setter (hints, complexities, solutions), and voice-enabled mock interviews.
- [x] **Study Group Scheduler**: Group study coordinator with AI matchmaking to find optimal classmates based on shared subjects and schedules.
- [x] **Automations Logs Audit**: Tracks logs for WhatsApp notices, calendar synchronizations, quiz reminders, and startup checks.
- [x] **Responsive Premium UI**: Glassmorphic styling, Outfitters modern typography, micro-animations, and localStorage-persisted dark mode.

---

## Tech Stack

| Layer | Technology / Package | Notes |
|---|---|---|
| **Frontend** | React, Vite, Tailwind CSS, React Hook Form, Axios, Lucide React, React Hot Toast | Responsive layouts & dark mode |
| **Backend** | Node.js, Express, Multer, PDF-Parse, CORS, Dotenv, Axios | REST API (port 3001) |
| **Database & Auth** | Supabase (PostgreSQL, Supabase Auth) | JS Client v2 (RLS Guarded) |
| **AI Processing** | Groq SDK (`groq-sdk`) | Model: `llama3-8b-8192` ONLY |
| **Automation Engine** | n8n Cloud | Webhook triggered workflows |
| **Voice Input** | Web Speech API | Native browser speech recognition |
| **Citations Vector DB** | pgvector / JS Cosine Similarity | local 384-dimensional projection vectors |

---

## Quick Start

### 1. Database Setup
1. Execute `supabase_schema.sql` in the Supabase SQL Editor to initialize tables, enable RLS, and set up access policies.
2. Execute `supabase_migration_aiplus.sql` in the Supabase SQL Editor to append vectors, chat sessions, knowledge files, study groups, startup audits, and updated logs constraints.

### 2. Configure Environment Variables
Copy `backend/.env.example` to `backend/.env` and update the properties:
```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
N8N_DEADLINE_WEBHOOK=https://your-n8n.cloud/webhook/deadline
N8N_NOTICE_WEBHOOK=https://your-n8n.cloud/webhook/notice
N8N_QUIZ_WEBHOOK=https://your-n8n.cloud/webhook/quiz
N8N_STUDY_REMINDER_WEBHOOK=https://your-n8n.cloud/webhook/study-reminder
N8N_ATTENDANCE_ALERT_WEBHOOK=https://your-n8n.cloud/webhook/attendance-alert
N8N_PLACEMENT_WEBHOOK=https://your-n8n.cloud/webhook/placement
N8N_STUDY_GROUP_WEBHOOK=https://your-n8n.cloud/webhook/study-group
TWILIO_WA_FROM=+14155238886
```

### 3. Run the Application
From the root project directory:
```bash
# Install root dependencies
npm install

# Install all sub-dependencies (backend & frontend)
npm run install:all

# Run backend and frontend concurrently
npm run dev
```
Open `http://localhost:3000` to interact with CampusFlow.

---

## API Endpoints

### Authentication (Public)
- **POST** `/api/auth/register` (body: `{ name, branch, year, phone, subjects[], email, password, google_email? }`)
- **POST** `/api/auth/login` (body: `{ email, password }`)

### Tasks & Deadlines (Protected)
- **GET** `/api/tasks`
- **POST** `/api/tasks` (body: `{ title, subject, deadline, add_to_calendar }`)
- **PATCH** `/api/tasks/:id` (body: `{ status }`)
- **DELETE** `/api/tasks/:id`

### Smart Study Planner (Protected)
- **POST** `/api/deadline-planner/study-plan` (body: `{ subject, deadline, difficulty, estimatedHours }`)

### Chat Hub (Protected)
- **POST** `/api/chat` (body: `{ message, mode, sessionId? }`)
- **GET** `/api/chat/sessions`
- **GET** `/api/chat/sessions/:id`
- **DELETE** `/api/chat/sessions/:id`

### RAG Knowledge Base (Protected)
- **POST** `/api/knowledge/upload` (body: `file` [PDF], `category` ['academic','placement','startup'])
- **GET** `/api/knowledge/documents`
- **DELETE** `/api/knowledge/documents/:id`
- **POST** `/api/knowledge/search` (body: `{ query, category?, limit? }`)

### Placement Dojo & Tracker (Protected)
- **GET** `/api/placement/companies`
- **POST** `/api/placement/companies` (body: `{ company_name, role, status, notes, interview_rounds[] }`)
- **PATCH** `/api/placement/companies/:id` (body: `{ company_name, role, status, notes, interview_rounds[] }`)
- **DELETE** `/api/placement/companies/:id`
- **POST** `/api/placement/dsa-problem` (body: `{ topic, difficulty }`)
- **POST** `/api/placement/mock-interview` (body: `{ type, studentContext }`)
- **POST** `/api/placement/evaluate-interview` (body: `{ questions[], answers[] }`)
- **POST** `/api/placement/resume-analyze` (body: `{ resumeText, targetRole? }`)

### Study Groups (Protected)
- **GET** `/api/study-groups`
- **POST** `/api/study-groups` (body: `{ subject, title, scheduled_at, max_members, invitees[] }`)
- **POST** `/api/study-groups/:id/join`
- **POST** `/api/study-groups/match`

### BrainSpace Startup Hub (Protected)
- **POST** `/api/brainspace/startup-validate` (body: `{ idea, problem, solution, targetAudience }`)
- **GET** `/api/brainspace/reports`
- **DELETE** `/api/brainspace/reports/:id`

### AI Operations (Protected)
- **POST** `/api/ai/tip`
- **POST** `/api/ai/summarize` (body: `{ noticeText, phoneList? }`)
- **POST** `/api/ai/flashcards` (body: `{ notes }`)
- **POST** `/api/ai/attendance` (body: `{ attendanceData }`)
- **POST** `/api/ai/mcq` (body: `{ notes, subject, topic, count? }`)
