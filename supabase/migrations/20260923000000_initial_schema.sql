-- Initial Schema for Aetheria Personal AI Memory & Action Engine
-- Requires PostgreSQL with pgvector extension enabled

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Entries table (Raw user captures)
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- 2. Objects table (Extracted polymorphic structured items)
CREATE TABLE IF NOT EXISTS objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- 3. Entities table (Named entities across thoughts)
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('person', 'project', 'company', 'topic')),
  canonical_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Object-Entities join table
CREATE TABLE IF NOT EXISTS object_entities (
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship TEXT,
  PRIMARY KEY (object_id, entity_id)
);

-- 5. Embeddings table (Vector search over captures and objects)
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('entry', 'object')),
  source_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  embedding_model TEXT DEFAULT 'gemini-embedding-2-preview',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Insights table (Lightweight derived observations with evidence)
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  observation TEXT NOT NULL,
  evidence_entry_ids UUID[] DEFAULT '{}',
  category TEXT DEFAULT 'pattern',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance
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

-- RLS Policies
CREATE POLICY "Users can only access their own entries" ON entries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own objects" ON objects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own entities" ON entities
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own object_entities" ON object_entities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM objects WHERE objects.id = object_entities.object_id AND objects.user_id = auth.uid())
  );

CREATE POLICY "Users can only access their own embeddings" ON embeddings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own insights" ON insights
  FOR ALL USING (auth.uid() = user_id);
