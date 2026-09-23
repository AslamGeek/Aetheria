export type EntryStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface Entry {
  id: string;
  user_id: string;
  raw_text: string;
  cleaned_text?: string | null;
  source: string;
  status: EntryStatus;
  parser_version: string;
  schema_version: number;
  model_name: string;
  processing_error?: string | null;
  created_at: string;
  processed_at?: string | null;
  objects?: ExtractedObject[];
}

export type ObjectType = 'task' | 'note' | 'idea' | 'decision' | 'event';
export type ObjectStatus = 'pending' | 'completed' | 'dismissed' | 'active' | 'archived';
export type DatePrecision = 'exact_datetime' | 'date' | 'relative_date' | 'date_range' | 'fuzzy' | 'none';

export interface ExtractedObject {
  id: string;
  entry_id: string;
  user_id: string;
  type: ObjectType;
  title: string;
  description?: string | null;
  status: ObjectStatus;
  confidence: number;
  due_at?: string | null;
  date_precision?: DatePrecision | null;
  original_date_phrase?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  entities?: Entity[];
}

export type EntityType = 'person' | 'project' | 'company' | 'topic';

export interface Entity {
  id: string;
  user_id: string;
  type: EntityType;
  canonical_name: string;
  metadata?: Record<string, any>;
  created_at: string;
  relationship?: string | null;
}

export interface Insight {
  id: string;
  user_id: string;
  title: string;
  observation: string;
  evidence_entry_ids: string[];
  category: string;
  created_at: string;
}

export interface MemoryQueryResult {
  answer: string;
  directEvidenceCount: number;
  sources: {
    entryId: string;
    rawText: string;
    createdAt: string;
    matchedObjects?: {
      title: string;
      type: ObjectType;
    }[];
  }[];
}
