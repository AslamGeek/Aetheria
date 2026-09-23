import fs from 'fs';
import path from 'path';
import { Entry, ExtractedObject, Entity, Insight } from '../types/index.ts';
import { cosineSimilarity } from '../../lib/ai/generateEmbedding.ts';

export interface StoredEmbedding {
  id: string;
  user_id: string;
  source_type: 'entry' | 'object';
  source_id: string;
  content: string;
  embedding: number[];
  embedding_model: string;
  created_at: string;
}

export interface ObjectEntityRelation {
  object_id: string;
  entity_id: string;
  relationship?: string | null;
}

export interface DatabaseState {
  entries: Entry[];
  objects: ExtractedObject[];
  entities: Entity[];
  object_entities: ObjectEntityRelation[];
  embeddings: StoredEmbedding[];
  insights: Insight[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'aetheria_db.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState(): DatabaseState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading database file, initializing empty state:', err);
  }

  // Seed sample initial data demonstrating the product principles if empty
  const defaultUserId = '00000000-0000-0000-0000-000000000001';
  const now = new Date();
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

  const initialEntries: Entry[] = [
    {
      id: 'e101',
      user_id: defaultUserId,
      raw_text: "Need to call Ramesh tomorrow about the land documents. Also maybe we should validate whether anyone wants reporting before building the dashboard. Check competitor pricing sometime this week.",
      cleaned_text: "Need to call Ramesh tomorrow about the land documents. Also maybe validate whether anyone wants reporting before building the dashboard. Check competitor pricing sometime this week.",
      source: 'manual',
      status: 'complete',
      parser_version: 'v1.0.0',
      schema_version: 1,
      model_name: 'gemini-3.8-flash',
      processing_error: null,
      created_at: yesterday.toISOString(),
      processed_at: yesterday.toISOString(),
    },
    {
      id: 'e102',
      user_id: defaultUserId,
      raw_text: "We decided to delay the launch until February.",
      cleaned_text: "We decided to delay the launch until February.",
      source: 'manual',
      status: 'complete',
      parser_version: 'v1.0.0',
      schema_version: 1,
      model_name: 'gemini-3.8-flash',
      processing_error: null,
      created_at: yesterday.toISOString(),
      processed_at: yesterday.toISOString(),
    }
  ];

  const initialEntities: Entity[] = [
    {
      id: 'ent1',
      user_id: defaultUserId,
      type: 'person',
      canonical_name: 'Ramesh',
      metadata: {},
      created_at: yesterday.toISOString(),
    },
    {
      id: 'ent2',
      user_id: defaultUserId,
      type: 'project',
      canonical_name: 'Dashboard Reporting',
      metadata: {},
      created_at: yesterday.toISOString(),
    },
    {
      id: 'ent3',
      user_id: defaultUserId,
      type: 'topic',
      canonical_name: 'Competitor Pricing',
      metadata: {},
      created_at: yesterday.toISOString(),
    },
    {
      id: 'ent4',
      user_id: defaultUserId,
      type: 'project',
      canonical_name: 'Launch',
      metadata: {},
      created_at: yesterday.toISOString(),
    }
  ];

  const initialObjects: ExtractedObject[] = [
    {
      id: 'obj1',
      entry_id: 'e101',
      user_id: defaultUserId,
      type: 'task',
      title: 'Call Ramesh about the land documents',
      description: 'Follow up regarding land documentation.',
      status: 'pending',
      confidence: 0.95,
      due_at: now.toISOString(),
      date_precision: 'relative_date',
      original_date_phrase: 'tomorrow',
      metadata: {},
      created_at: yesterday.toISOString(),
      updated_at: yesterday.toISOString(),
    },
    {
      id: 'obj2',
      entry_id: 'e101',
      user_id: defaultUserId,
      type: 'idea',
      title: 'Validate demand for reporting before building the dashboard',
      description: 'Check whether customers actually need reporting before dedicating engineering effort.',
      status: 'active',
      confidence: 0.88,
      due_at: null,
      date_precision: 'none',
      original_date_phrase: null,
      metadata: { is_tentative: true },
      created_at: yesterday.toISOString(),
      updated_at: yesterday.toISOString(),
    },
    {
      id: 'obj3',
      entry_id: 'e101',
      user_id: defaultUserId,
      type: 'task',
      title: 'Check competitor pricing',
      description: 'Review current competitive rates in the market.',
      status: 'pending',
      confidence: 0.9,
      due_at: tomorrow.toISOString(),
      date_precision: 'fuzzy',
      original_date_phrase: 'sometime this week',
      metadata: {},
      created_at: yesterday.toISOString(),
      updated_at: yesterday.toISOString(),
    },
    {
      id: 'obj4',
      entry_id: 'e102',
      user_id: defaultUserId,
      type: 'decision',
      title: 'Delay product launch until February',
      description: 'Official timing shift resolved for launch.',
      status: 'active',
      confidence: 0.98,
      due_at: '2027-02-01T00:00:00.000Z',
      date_precision: 'date_range',
      original_date_phrase: 'February',
      metadata: {},
      created_at: yesterday.toISOString(),
      updated_at: yesterday.toISOString(),
    }
  ];

  const initialObjectEntities: ObjectEntityRelation[] = [
    { object_id: 'obj1', entity_id: 'ent1', relationship: 'contact' },
    { object_id: 'obj2', entity_id: 'ent2', relationship: 'focus' },
    { object_id: 'obj3', entity_id: 'ent3', relationship: 'subject' },
    { object_id: 'obj4', entity_id: 'ent4', relationship: 'milestone' }
  ];

  const state: DatabaseState = {
    entries: initialEntries,
    objects: initialObjects,
    entities: initialEntities,
    object_entities: initialObjectEntities,
    embeddings: [],
    insights: [
      {
        id: 'ins1',
        user_id: defaultUserId,
        title: 'Prudent feature prioritization',
        observation: 'You consistently favor user demand validation before committing dev bandwidth to large surfaces like the dashboard.',
        evidence_entry_ids: ['e101'],
        category: 'pattern',
        created_at: yesterday.toISOString(),
      }
    ],
  };

  saveState(state);
  return state;
}

function saveState(state: DatabaseState): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// In-memory cache
let db: DatabaseState = loadState();

export const Database = {
  // Entries
  getEntries(userId: string): Entry[] {
    const list = db.entries.filter(e => e.user_id === userId);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getEntryById(id: string): Entry | undefined {
    return db.entries.find(e => e.id === id);
  },

  createEntry(entry: Entry): Entry {
    db.entries.unshift(entry);
    saveState(db);
    return entry;
  },

  updateEntry(id: string, updates: Partial<Entry>): Entry | null {
    const idx = db.entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    db.entries[idx] = { ...db.entries[idx], ...updates };
    saveState(db);
    return db.entries[idx];
  },

  deleteEntry(id: string): boolean {
    const initialLen = db.entries.length;
    db.entries = db.entries.filter(e => e.id !== id);
    // Cascade delete objects and embeddings
    const removedObjectIds = db.objects.filter(o => o.entry_id === id).map(o => o.id);
    db.objects = db.objects.filter(o => o.entry_id !== id);
    db.object_entities = db.object_entities.filter(oe => !removedObjectIds.includes(oe.object_id));
    db.embeddings = db.embeddings.filter(emb => !(emb.source_id === id || removedObjectIds.includes(emb.source_id)));
    saveState(db);
    return db.entries.length < initialLen;
  },

  // Objects
  getObjects(userId: string, filter?: { type?: string; status?: string; entryId?: string }): ExtractedObject[] {
    let result = db.objects.filter(o => o.user_id === userId);
    if (filter?.type) {
      result = result.filter(o => o.type === filter.type);
    }
    if (filter?.status) {
      result = result.filter(o => o.status === filter.status);
    }
    if (filter?.entryId) {
      result = result.filter(o => o.entry_id === filter.entryId);
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getObjectById(id: string): ExtractedObject | undefined {
    return db.objects.find(o => o.id === id);
  },

  saveObjects(objects: ExtractedObject[]): ExtractedObject[] {
    for (const obj of objects) {
      const existingIdx = db.objects.findIndex(o => o.id === obj.id);
      if (existingIdx >= 0) {
        db.objects[existingIdx] = obj;
      } else {
        db.objects.push(obj);
      }
    }
    saveState(db);
    return objects;
  },

  updateObject(id: string, updates: Partial<ExtractedObject>): ExtractedObject | null {
    const idx = db.objects.findIndex(o => o.id === id);
    if (idx === -1) return null;
    db.objects[idx] = {
      ...db.objects[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveState(db);
    return db.objects[idx];
  },

  deleteObject(id: string): boolean {
    const initialLen = db.objects.length;
    db.objects = db.objects.filter(o => o.id !== id);
    db.object_entities = db.object_entities.filter(oe => oe.object_id !== id);
    db.embeddings = db.embeddings.filter(emb => emb.source_id !== id);
    saveState(db);
    return db.objects.length < initialLen;
  },

  // Entities
  getEntities(userId: string): Entity[] {
    return db.entities.filter(e => e.user_id === userId);
  },

  findOrCreateEntity(userId: string, type: Entity['type'], canonicalName: string): Entity {
    const normalized = canonicalName.trim();
    const existing = db.entities.find(
      e => e.user_id === userId && e.type === type && e.canonical_name.toLowerCase() === normalized.toLowerCase()
    );
    if (existing) return existing;

    const newEnt: Entity = {
      id: 'ent_' + Math.random().toString(36).substring(2, 11),
      user_id: userId,
      type,
      canonical_name: normalized,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    db.entities.push(newEnt);
    saveState(db);
    return newEnt;
  },

  linkObjectEntity(objectId: string, entityId: string, relationship?: string | null): void {
    const exists = db.object_entities.some(oe => oe.object_id === objectId && oe.entity_id === entityId);
    if (!exists) {
      db.object_entities.push({ object_id: objectId, entity_id: entityId, relationship });
      saveState(db);
    }
  },

  getObjectEntities(objectId: string): Entity[] {
    const links = db.object_entities.filter(oe => oe.object_id === objectId);
    return links.map(link => {
      const ent = db.entities.find(e => e.id === link.entity_id);
      return ent ? { ...ent, relationship: link.relationship } : null;
    }).filter(Boolean) as Entity[];
  },

  // Embeddings & Semantic Search
  saveEmbedding(embedding: StoredEmbedding): void {
    const idx = db.embeddings.findIndex(
      e => e.source_id === embedding.source_id && e.source_type === embedding.source_type
    );
    if (idx >= 0) {
      db.embeddings[idx] = embedding;
    } else {
      db.embeddings.push(embedding);
    }
    saveState(db);
  },

  semanticSearch(userId: string, queryEmbedding: number[], topK = 6): { sourceId: string; sourceType: 'entry' | 'object'; score: number; content: string }[] {
    if (!queryEmbedding.length) return [];
    const userEmbeddings = db.embeddings.filter(e => e.user_id === userId);
    
    const scored = userEmbeddings.map(emb => ({
      sourceId: emb.source_id,
      sourceType: emb.source_type,
      score: cosineSimilarity(queryEmbedding, emb.embedding),
      content: emb.content,
    }));

    return scored
      .filter(s => s.score > 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  },

  // Insights
  getInsights(userId: string): Insight[] {
    return db.insights
      .filter(i => i.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  saveInsight(insight: Insight): Insight {
    db.insights.unshift(insight);
    saveState(db);
    return insight;
  },

  deleteInsight(id: string): boolean {
    const len = db.insights.length;
    db.insights = db.insights.filter(i => i.id !== id);
    saveState(db);
    return db.insights.length < len;
  },

  // Full export
  exportAllData(userId: string) {
    const userEntries = db.entries.filter(e => e.user_id === userId);
    const userObjects = db.objects.filter(o => o.user_id === userId);
    const userEntities = db.entities.filter(e => e.user_id === userId);
    const objectIds = new Set(userObjects.map(o => o.id));
    const userRelations = db.object_entities.filter(oe => objectIds.has(oe.object_id));
    const userInsights = db.insights.filter(i => i.user_id === userId);

    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      entries: userEntries,
      objects: userObjects,
      entities: userEntities,
      object_entities: userRelations,
      insights: userInsights,
    };
  }
};
