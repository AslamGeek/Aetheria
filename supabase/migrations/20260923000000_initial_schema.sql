-- ==============================================================================
-- Aetheria Database Migration for Supabase (PostgreSQL with pgvector)
-- ==============================================================================
-- How to apply:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql
-- 2. Go to the "SQL Editor" tab on the left sidebar
-- 3. Click "New query", paste this entire script, and click "Run"
-- ==============================================================================

-- 1. Enable pgvector for semantic memory embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Entries table (Raw user captures - preserved permanently as source of truth)
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  raw_text TEXT NOT NULL,
  cleaned_text TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  parser_version TEXT DEFAULT 'v1.0.0',
  schema_version INTEGER DEFAULT 1,
  model_name TEXT DEFAULT 'gemini-3.8-flash',
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- 3. Objects table (Polymorphic extracted items: tasks, notes, ideas, decisions, events)
CREATE TABLE IF NOT EXISTS objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task', 'note', 'idea', 'decision', 'event')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed', 'active', 'archived')),
  confidence FLOAT NOT NULL DEFAULT 1.0,
  due_at TIMESTAMPTZ,
  date_precision TEXT CHECK (date_precision IN ('exact_datetime', 'date', 'relative_date', 'date_range', 'fuzzy', 'none')),
  original_date_phrase TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Entities table (Named entities across thoughts: people, projects, companies, topics)
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('person', 'project', 'company', 'topic')),
  canonical_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Object-Entities join table
CREATE TABLE IF NOT EXISTS object_entities (
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship TEXT,
  PRIMARY KEY (object_id, entity_id)
);

-- 6. Embeddings table (Vector storage for similarity search across thoughts)
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('entry', 'object')),
  source_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  embedding_model TEXT DEFAULT 'gemini-embedding-2-preview',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Insights table (Lightweight derived observations with evidence citations)
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  observation TEXT NOT NULL,
  evidence_entry_ids UUID[] DEFAULT '{}',
  category TEXT DEFAULT 'pattern',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objects_user ON objects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objects_due ON objects(user_id, due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objects_entry ON objects(entry_id);
CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_embeddings_user ON embeddings(user_id);

-- Row Level Security (RLS)
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Permissive policy for authenticated and service_role access
-- (Works with both Supabase Auth and Service Role Server Proxy)
DO $$
BEGIN
  -- Drop existing policies if re-running
  DROP POLICY IF EXISTS "Allow user or service access to entries" ON entries;
  DROP POLICY IF EXISTS "Allow user or service access to objects" ON objects;
  DROP POLICY IF EXISTS "Allow user or service access to entities" ON entities;
  DROP POLICY IF EXISTS "Allow user or service access to object_entities" ON object_entities;
  DROP POLICY IF EXISTS "Allow user or service access to embeddings" ON embeddings;
  DROP POLICY IF EXISTS "Allow user or service access to insights" ON insights;
END $$;

CREATE POLICY "Allow user or service access to entries" ON entries
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Allow user or service access to objects" ON objects
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Allow user or service access to entities" ON entities
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Allow user or service access to object_entities" ON object_entities
  FOR ALL USING (true);

CREATE POLICY "Allow user or service access to embeddings" ON embeddings
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Allow user or service access to insights" ON insights
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id);
