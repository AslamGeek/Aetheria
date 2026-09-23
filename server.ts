import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Database } from './src/server/db.ts';
import { parseThought } from './lib/ai/parseThought.ts';
import { generateEmbedding } from './lib/ai/generateEmbedding.ts';
import { answerFromMemory } from './lib/ai/answerFromMemory.ts';
import { generateInsights } from './lib/ai/generateInsights.ts';
import { checkSupabaseConnection, saveSupabaseCredentials } from './src/server/supabase.ts';
import { Entry, ExtractedObject } from './src/types/index.ts';

const app = express();
const PORT = 3000;
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

app.use(express.json());

// Prevent any caching of API responses by browsers or service workers
app.use('/api', (_req: Request, res: Response, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Helper to get active user ID (supports multi-user headers or default personal user)
function getUserId(req: Request): string {
  const custom = req.headers['x-user-id'];
  if (typeof custom === 'string' && custom.trim()) {
    return custom.trim();
  }
  return DEFAULT_USER_ID;
}

// -------------------------------------------------------------
// 1. Capture Thought Endpoint
// -------------------------------------------------------------
app.post('/api/capture', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { rawText, timezone } = req.body;

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'Text content is required' });
  }

  const now = new Date();
  const entryId = crypto.randomUUID();

  // Step 1: Immediately persist raw input unchanged
  const newEntry: Entry = {
    id: entryId,
    user_id: userId,
    raw_text: rawText.trim(),
    cleaned_text: null,
    source: 'manual',
    status: 'processing',
    parser_version: 'v1.0.0',
    schema_version: 1,
    model_name: 'gemini-3.8-flash',
    processing_error: null,
    created_at: now.toISOString(),
    processed_at: null,
  };

  Database.createEntry(newEntry);

  // Process thought with Gemini
  try {
    const parsed = await parseThought({
      rawText: rawText.trim(),
      currentDate: now.toISOString(),
      userTimezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    // Create polymorphic extracted objects with valid UUIDs
    const objectsToSave: ExtractedObject[] = parsed.objects.map((obj) => {
      const objId = crypto.randomUUID();
      return {
        id: objId,
        entry_id: entryId,
        user_id: userId,
        type: obj.type,
        title: obj.title,
        description: obj.description || null,
        status: obj.type === 'task' ? 'pending' : 'active',
        confidence: obj.confidence,
        due_at: obj.due || null,
        date_precision: obj.date_precision || null,
        original_date_phrase: obj.original_date_phrase || null,
        metadata: {
          ...obj.metadata,
          is_tentative: obj.is_tentative || false,
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
    });

    // Save objects
    Database.saveObjects(objectsToSave);

    // Save and link entities
    for (const ent of parsed.entities) {
      const createdEnt = Database.findOrCreateEntity(userId, ent.type, ent.name);
      for (const obj of objectsToSave) {
        Database.linkObjectEntity(obj.id, createdEnt.id, ent.relationship);
      }
    }

    // Embeddings generation (asynchronous / resilient)
    (async () => {
      try {
        const entryEmbedding = await generateEmbedding(rawText.trim());
        if (entryEmbedding.length) {
          Database.saveEmbedding({
            id: crypto.randomUUID(),
            user_id: userId,
            source_type: 'entry',
            source_id: entryId,
            content: rawText.trim(),
            embedding: entryEmbedding,
            embedding_model: 'gemini-embedding-2-preview',
            created_at: now.toISOString(),
          });
        }

        for (const obj of objectsToSave) {
          const objContent = `${obj.type}: ${obj.title}. ${obj.description || ''}`.trim();
          const objEmbedding = await generateEmbedding(objContent);
          if (objEmbedding.length) {
            Database.saveEmbedding({
              id: crypto.randomUUID(),
              user_id: userId,
              source_type: 'object',
              source_id: obj.id,
              content: objContent,
              embedding: objEmbedding,
              embedding_model: 'gemini-embedding-2-preview',
              created_at: now.toISOString(),
            });
          }
        }
      } catch (err) {
        console.warn('Background embedding error (non-fatal):', err);
      }
    })();

    // Update entry to complete
    const updatedEntry = Database.updateEntry(entryId, {
      status: 'complete',
      cleaned_text: parsed.cleaned_text || null,
      processed_at: new Date().toISOString(),
    });

    const fullObjects = objectsToSave.map(o => ({
      ...o,
      entities: Database.getObjectEntities(o.id),
    }));

    return res.status(201).json({
      entry: {
        ...updatedEntry,
        objects: fullObjects,
      },
      summary: parsed.summary,
    });
  } catch (err: any) {
    console.error('Error during AI parsing:', err);
    // Never lose the raw entry! Mark as failed and return
    const failedEntry = Database.updateEntry(entryId, {
      status: 'failed',
      processing_error: err?.message || 'AI parsing encountered an error',
    });

    return res.status(200).json({
      entry: {
        ...failedEntry,
        objects: [],
      },
      error: 'Capture saved, but AI parsing needs retry.',
    });
  }
});

// -------------------------------------------------------------
// 2. Reprocess Entry
// -------------------------------------------------------------
app.post('/api/entries/:id/reprocess', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const entry = Database.getEntryById(id);

  if (!entry || entry.user_id !== userId) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  Database.updateEntry(id, { status: 'processing', processing_error: null });

  try {
    const parsed = await parseThought({
      rawText: entry.raw_text,
      currentDate: new Date().toISOString(),
    });

    // Remove prior objects for this entry to avoid duplicate accumulations
    const currentObjects = Database.getObjects(userId, { entryId: id });
    for (const obj of currentObjects) {
      Database.deleteObject(obj.id);
    }

    const now = new Date();
    const newObjects: ExtractedObject[] = parsed.objects.map((obj) => {
      const objId = crypto.randomUUID();
      return {
        id: objId,
        entry_id: id,
        user_id: userId,
        type: obj.type,
        title: obj.title,
        description: obj.description || null,
        status: obj.type === 'task' ? 'pending' : 'active',
        confidence: obj.confidence,
        due_at: obj.due || null,
        date_precision: obj.date_precision || null,
        original_date_phrase: obj.original_date_phrase || null,
        metadata: { ...obj.metadata, is_tentative: obj.is_tentative || false },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
    });

    Database.saveObjects(newObjects);

    for (const ent of parsed.entities) {
      const createdEnt = Database.findOrCreateEntity(userId, ent.type, ent.name);
      for (const obj of newObjects) {
        Database.linkObjectEntity(obj.id, createdEnt.id, ent.relationship);
      }
    }

    // Refresh entry
    const updated = Database.updateEntry(id, {
      status: 'complete',
      cleaned_text: parsed.cleaned_text || null,
      processed_at: now.toISOString(),
      processing_error: null,
    });

    const fullObjects = newObjects.map(o => ({
      ...o,
      entities: Database.getObjectEntities(o.id),
    }));

    res.json({
      entry: { ...updated, objects: fullObjects },
      summary: parsed.summary,
    });
  } catch (err: any) {
    console.error('Reprocess error:', err);
    Database.updateEntry(id, {
      status: 'failed',
      processing_error: err?.message || 'Failed to reprocess thought',
    });
    res.status(500).json({ error: 'Reprocessing failed' });
  }
});

// -------------------------------------------------------------
// 3. Entries List
// -------------------------------------------------------------
app.get('/api/entries', (req: Request, res: Response) => {
  const userId = getUserId(req);
  const entries = Database.getEntries(userId);
  const allObjects = Database.getObjects(userId);

  const enriched = entries.map(entry => {
    const entryObjects = allObjects
      .filter(o => o.entry_id === entry.id)
      .map(o => ({
        ...o,
        entities: Database.getObjectEntities(o.id),
      }));
    return {
      ...entry,
      objects: entryObjects,
    };
  });

  res.json({ entries: enriched });
});

app.delete('/api/entries/:id', (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const entry = Database.getEntryById(id);
  if (!entry || entry.user_id !== userId) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  Database.deleteEntry(id);
  res.json({ success: true, id });
});

// -------------------------------------------------------------
// 4. Today View Endpoint
// -------------------------------------------------------------
app.get('/api/today', (req: Request, res: Response) => {
  const userId = getUserId(req);
  const tasks = Database.getObjects(userId, { type: 'task' });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const overdueTasks: ExtractedObject[] = [];
  const dueTodayTasks: ExtractedObject[] = [];
  const upcomingTasks: ExtractedObject[] = [];
  const noDueDateTasks: ExtractedObject[] = [];

  for (const t of tasks) {
    if (t.status === 'completed' || t.status === 'dismissed') continue;

    if (!t.due_at) {
      noDueDateTasks.push(t);
      continue;
    }

    const due = new Date(t.due_at);
    if (isNaN(due.getTime())) {
      noDueDateTasks.push(t);
    } else if (due < startOfToday) {
      overdueTasks.push(t);
    } else if (due <= endOfToday) {
      dueTodayTasks.push(t);
    } else {
      upcomingTasks.push(t);
    }
  }

  // Pick a subtle "Revisit" item from earlier ideas or decisions
  const ideasAndDecisions = Database.getObjects(userId).filter(
    o => (o.type === 'idea' || o.type === 'decision') && o.status !== 'dismissed'
  );
  const revisitItem = ideasAndDecisions.length > 0
    ? ideasAndDecisions[Math.floor(Math.random() * ideasAndDecisions.length)]
    : null;

  const revisitEntry = revisitItem ? Database.getEntryById(revisitItem.entry_id) : null;

  res.json({
    overdueTasks,
    dueTodayTasks,
    upcomingTasks: upcomingTasks.slice(0, 5),
    unscheduledTasks: noDueDateTasks.slice(0, 4),
    revisit: revisitItem ? {
      object: revisitItem,
      rawText: revisitEntry?.raw_text || null,
    } : null,
  });
});

// -------------------------------------------------------------
// 5. Objects CRUD
// -------------------------------------------------------------
app.patch('/api/objects/:id', (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const existing = Database.getObjectById(id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ error: 'Object not found' });
  }

  const { title, description, type, status, due_at, date_precision, original_date_phrase } = req.body;
  const updates: Partial<ExtractedObject> = {};

  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (type !== undefined) updates.type = type;
  if (status !== undefined) updates.status = status;
  if (due_at !== undefined) updates.due_at = due_at;
  if (date_precision !== undefined) updates.date_precision = date_precision;
  if (original_date_phrase !== undefined) updates.original_date_phrase = original_date_phrase;

  const updated = Database.updateObject(id, updates);
  res.json({ object: updated });
});

app.delete('/api/objects/:id', (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const existing = Database.getObjectById(id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ error: 'Object not found' });
  }

  Database.deleteObject(id);
  res.json({ success: true, id });
});

// -------------------------------------------------------------
// 6. Memory Query Endpoint
// -------------------------------------------------------------
app.post('/api/memory/query', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { question } = req.body;

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const result = await answerFromMemory(userId, question.trim());
    res.json(result);
  } catch (err: any) {
    console.error('Memory search error:', err);
    res.status(500).json({ error: err?.message || 'Failed to query memory' });
  }
});

// -------------------------------------------------------------
// 7. Insights
// -------------------------------------------------------------
app.get('/api/insights', (req: Request, res: Response) => {
  const userId = getUserId(req);
  const list = Database.getInsights(userId);
  res.json({ insights: list });
});

app.post('/api/insights/generate', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  try {
    const list = await generateInsights(userId);
    res.json({ insights: list });
  } catch (err: any) {
    console.error('Insight generation error:', err);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

app.delete('/api/insights/:id', (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { id } = req.params;
  Database.deleteInsight(id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// 8. Full Export
// -------------------------------------------------------------
app.get('/api/export', (req: Request, res: Response) => {
  const userId = getUserId(req);
  const data = Database.exportAllData(userId);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="aetheria_memory_export.json"');
  res.send(JSON.stringify(data, null, 2));
});

// -------------------------------------------------------------
// 9. Supabase Status & Sync Endpoints
// -------------------------------------------------------------
app.get('/api/supabase/status', async (_req: Request, res: Response) => {
  const status = await checkSupabaseConnection();
  res.json(status);
});

app.post('/api/supabase/config', async (req: Request, res: Response) => {
  try {
    const { url, key, serviceKey, anonKey } = req.body;
    const resolvedKey = key || serviceKey || anonKey;
    if (!url || !resolvedKey) {
      return res.status(400).json({ error: 'Both url and key (serviceKey or anonKey) are required' });
    }
    saveSupabaseCredentials(url, resolvedKey);
    const status = await checkSupabaseConnection();
    return res.json({ success: true, status });
  } catch (err: any) {
    console.error('Error saving Supabase config:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error configuring Supabase' });
  }
});

app.post('/api/supabase/sync', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const result = await Database.pushAllToSupabase(userId);
  res.json(result);
});

app.get('/api/supabase/migration-sql', (_req: Request, res: Response) => {
  try {
    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260923000000_initial_schema.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      return res.type('text/plain').send(sql);
    }
    return res.status(404).send('-- Migration file not found');
  } catch (err: any) {
    res.status(500).send(`-- Error reading migration: ${err?.message}`);
  }
});

// -------------------------------------------------------------
// 10. Seed Example Scenarios
// -------------------------------------------------------------
app.post('/api/seed-examples', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const seedPhrases = [
    "Need to pay the electricity bill tomorrow and ask Arun if he's free this weekend.",
    "I think the app should probably have just one input box. Projects and tags can happen automatically.",
    "We decided to delay the launch until February.",
    "Maybe I should talk to Ravi about pricing.",
    "Ravi said the current pricing is too complicated.",
    "I've got to send Priya the prototype before Friday."
  ];

  const results: any[] = [];
  for (const phrase of seedPhrases) {
    const now = new Date();
    const entryId = crypto.randomUUID();
    Database.createEntry({
      id: entryId,
      user_id: userId,
      raw_text: phrase,
      cleaned_text: null,
      source: 'seed',
      status: 'pending',
      parser_version: 'v1.0.0',
      schema_version: 1,
      model_name: 'gemini-3.8-flash',
      processing_error: null,
      created_at: now.toISOString(),
      processed_at: null,
    });

    try {
      const parsed = await parseThought({ rawText: phrase });
      const objs: ExtractedObject[] = parsed.objects.map(o => ({
        id: crypto.randomUUID(),
        entry_id: entryId,
        user_id: userId,
        type: o.type,
        title: o.title,
        description: o.description || null,
        status: o.type === 'task' ? 'pending' : 'active',
        confidence: o.confidence,
        due_at: o.due || null,
        date_precision: o.date_precision || null,
        original_date_phrase: o.original_date_phrase || null,
        metadata: { ...o.metadata, is_tentative: o.is_tentative || false },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }));

      Database.saveObjects(objs);

      for (const ent of parsed.entities) {
        const createdEnt = Database.findOrCreateEntity(userId, ent.type, ent.name);
        for (const obj of objs) {
          Database.linkObjectEntity(obj.id, createdEnt.id, ent.relationship);
        }
      }

      Database.updateEntry(entryId, {
        status: 'complete',
        cleaned_text: parsed.cleaned_text || null,
        processed_at: new Date().toISOString(),
      });
      results.push({ phrase, objectsCount: objs.length });
    } catch (err: any) {
      Database.updateEntry(entryId, {
        status: 'failed',
        processing_error: err?.message,
      });
    }
  }

  res.json({ message: 'Seed examples imported successfully', count: results.length });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serve
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aetheria server running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

export default app;
