-- ============================================================
-- CampusFlow Database Schema
-- Run in Supabase SQL Editor: project → SQL Editor → New query
-- ============================================================

-- Students table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS students (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  branch       TEXT        NOT NULL,
  year         INT         NOT NULL CHECK (year BETWEEN 1 AND 4),
  phone        TEXT        NOT NULL CHECK (phone ~ '^\+[1-9]\d{9,14}$'),
  subjects     TEXT[]      NOT NULL CHECK (array_length(subjects, 1) > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL CHECK (char_length(title) > 0),
  subject          TEXT        NOT NULL,
  deadline         TIMESTAMPTZ NOT NULL,
  reminder_time    TIMESTAMPTZ,
  add_to_calendar  BOOLEAN     NOT NULL DEFAULT TRUE,
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  n8n_triggered    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automation logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('deadline_reminder', 'notice_broadcast')),
  payload      JSONB       NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security — users only ever see their own rows
ALTER TABLE students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent collision errors
DROP POLICY IF EXISTS "students: own row only" ON students;
DROP POLICY IF EXISTS "tasks: own rows only" ON tasks;
DROP POLICY IF EXISTS "automation_logs: own rows only" ON automation_logs;
DROP POLICY IF EXISTS "students_own" ON students;
DROP POLICY IF EXISTS "tasks_own" ON tasks;
DROP POLICY IF EXISTS "logs_own" ON automation_logs;

CREATE POLICY "students: own row only"
  ON students FOR ALL USING (auth.uid() = id);

CREATE POLICY "tasks: own rows only"
  ON tasks FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "automation_logs: own rows only"
  ON automation_logs FOR ALL USING (auth.uid() = student_id);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_tasks_student_deadline
  ON tasks(student_id, deadline ASC);

CREATE INDEX IF NOT EXISTS idx_automation_logs_student_triggered
  ON automation_logs(student_id, triggered_at DESC);
