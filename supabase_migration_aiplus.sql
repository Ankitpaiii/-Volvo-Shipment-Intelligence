-- ============================================================
-- CampusFlow AI+ Database Migration
-- Run AFTER the original supabase_schema.sql
-- ============================================================

-- Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add google_email column to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS google_email TEXT;

-- ============================================================
-- Chat Hub Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mode        TEXT        NOT NULL CHECK (mode IN ('study','placement','startup','creator','general')),
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RAG / Knowledge Base Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  filename    TEXT        NOT NULL,
  category    TEXT        NOT NULL CHECK (category IN ('academic','placement','startup')),
  chunk_count INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL,
  embedding     vector(384),
  chunk_index   INT         NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Placement Tracker Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS placement_companies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  company_name    TEXT        NOT NULL,
  role            TEXT,
  status          TEXT        NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','oa','interview','offered','rejected')),
  interview_rounds JSONB      NOT NULL DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Study Groups Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS study_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject     TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  scheduled_at TIMESTAMPTZ,
  max_members INT         NOT NULL DEFAULT 5,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_group_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID        NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

-- ============================================================
-- BrainSpace Reports Table
-- ============================================================

CREATE TABLE IF NOT EXISTS startup_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  idea        TEXT        NOT NULL,
  analysis    JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Extend automation_logs type constraint for new workflow types
-- ============================================================

ALTER TABLE automation_logs DROP CONSTRAINT IF EXISTS automation_logs_type_check;
ALTER TABLE automation_logs DROP CONSTRAINT IF EXISTS "automation_logs_type_check";
ALTER TABLE automation_logs ADD CONSTRAINT automation_logs_type_check
  CHECK (type IN (
    'deadline_reminder',
    'notice_broadcast',
    'quiz_ready',
    'study_reminder',
    'attendance_alert',
    'placement_reminder',
    'study_group_invite',
    'startup_report'
  ));

-- ============================================================
-- Row Level Security for all new tables
-- ============================================================

ALTER TABLE chat_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_companies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_reports      ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "own_data" ON chat_sessions;
CREATE POLICY "own_data" ON chat_sessions FOR ALL USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "own_data" ON chat_messages;
CREATE POLICY "own_data" ON chat_messages FOR ALL USING (
  session_id IN (SELECT id FROM chat_sessions WHERE student_id = auth.uid())
);

DROP POLICY IF EXISTS "own_data" ON knowledge_documents;
CREATE POLICY "own_data" ON knowledge_documents FOR ALL USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "own_data" ON knowledge_chunks;
CREATE POLICY "own_data" ON knowledge_chunks FOR ALL USING (
  document_id IN (SELECT id FROM knowledge_documents WHERE student_id = auth.uid())
);

DROP POLICY IF EXISTS "own_data" ON placement_companies;
CREATE POLICY "own_data" ON placement_companies FOR ALL USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "own_data" ON study_groups;
CREATE POLICY "own_data" ON study_groups FOR ALL USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "own_data" ON study_group_members;
CREATE POLICY "own_data" ON study_group_members FOR ALL USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "own_data" ON startup_reports;
CREATE POLICY "own_data" ON startup_reports FOR ALL USING (auth.uid() = student_id);

-- ============================================================
-- Performance Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chat_sessions_student ON chat_sessions(student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_student ON knowledge_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_placement_companies_student ON placement_companies(student_id);
CREATE INDEX IF NOT EXISTS idx_study_groups_subject ON study_groups(subject);
CREATE INDEX IF NOT EXISTS idx_startup_reports_student ON startup_reports(student_id, created_at DESC);
