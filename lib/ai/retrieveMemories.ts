import { Database } from '../../src/server/db.ts';
import { generateEmbedding } from './generateEmbedding.ts';
import { Entry, ExtractedObject } from '../../src/types/index.ts';

export interface RetrievedMemoryContext {
  entry: Entry;
  relatedObjects: ExtractedObject[];
  relevanceScore: number;
  matchReasons: string[];
}

export async function retrieveMemories(
  userId: string,
  query: string,
  limit = 8
): Promise<RetrievedMemoryContext[]> {
  const normalizedQuery = query.toLowerCase().trim();
  const queryTerms = normalizedQuery.split(/\s+/).filter(w => w.length > 2);

  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Vector search
  const vectorResults = queryEmbedding.length > 0
    ? Database.semanticSearch(userId, queryEmbedding, 10)
    : [];

  // Map to entry IDs
  const scoredEntryIds = new Map<string, { score: number; reasons: string[] }>();

  // Process vector results
  for (const v of vectorResults) {
    let entryId = v.sourceId;
    if (v.sourceType === 'object') {
      const obj = Database.getObjectById(v.sourceId);
      if (obj) entryId = obj.entry_id;
    }

    const current = scoredEntryIds.get(entryId) || { score: 0, reasons: [] };
    current.score = Math.max(current.score, v.score * 1.2);
    current.reasons.push(`semantic match (${(v.score * 100).toFixed(0)}%)`);
    scoredEntryIds.set(entryId, current);
  }

  // 3. Keyword and entity lexical matching across all user entries
  const allEntries = Database.getEntries(userId);
  const allObjects = Database.getObjects(userId);
  const allEntities = Database.getEntities(userId);

  // Check matching entities
  const matchingEntityNames = allEntities
    .filter(ent => normalizedQuery.includes(ent.canonical_name.toLowerCase()))
    .map(ent => ent.canonical_name.toLowerCase());

  for (const entry of allEntries) {
    const textLower = entry.raw_text.toLowerCase();
    const entryObjects = allObjects.filter(o => o.entry_id === entry.id);
    let lexicalScore = 0;
    const reasons: string[] = [];

    // Check query terms
    for (const term of queryTerms) {
      if (textLower.includes(term)) {
        lexicalScore += 0.25;
      }
      for (const obj of entryObjects) {
        if (obj.title.toLowerCase().includes(term) || (obj.description && obj.description.toLowerCase().includes(term))) {
          lexicalScore += 0.3;
        }
      }
    }

    // Check entity matches
    for (const entName of matchingEntityNames) {
      if (textLower.includes(entName)) {
        lexicalScore += 0.5;
        reasons.push(`mentions entity: ${entName}`);
      }
    }

    if (lexicalScore > 0) {
      const current = scoredEntryIds.get(entry.id) || { score: 0, reasons: [] };
      current.score += lexicalScore;
      if (reasons.length > 0) current.reasons.push(...reasons);
      scoredEntryIds.set(entry.id, current);
    }
  }

  // If still empty or few matches, include latest entries as recent context
  if (scoredEntryIds.size === 0) {
    for (const e of allEntries.slice(0, 3)) {
      scoredEntryIds.set(e.id, { score: 0.1, reasons: ['recent context'] });
    }
  }

  // Sort and retrieve top entries
  const sorted = Array.from(scoredEntryIds.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit);

  const results: RetrievedMemoryContext[] = [];
  for (const [entryId, meta] of sorted) {
    const entry = Database.getEntryById(entryId);
    if (!entry) continue;
    const relatedObjects = allObjects.filter(o => o.entry_id === entry.id);
    results.push({
      entry,
      relatedObjects,
      relevanceScore: meta.score,
      matchReasons: meta.reasons,
    });
  }

  return results;
}
