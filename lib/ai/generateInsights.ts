import { Type } from '@google/genai';
import { getGeminiClient } from './geminiClient.ts';
import { Database } from '../../src/server/db.ts';
import { Insight } from '../../src/types/index.ts';

export async function generateInsights(userId: string): Promise<Insight[]> {
  const entries = Database.getEntries(userId);
  const objects = Database.getObjects(userId);

  if (entries.length < 2) {
    return [];
  }

  const entriesContext = entries.slice(0, 15).map(e => {
    const related = objects.filter(o => o.entry_id === e.id).map(o => `${o.type}: ${o.title}`).join('; ');
    return `[ID: ${e.id}] (Date: ${new Date(e.created_at).toLocaleDateString()}): "${e.raw_text}" (Items: ${related})`;
  }).join('\n');

  const systemInstruction = `You are an analytical reflector for personal thoughts.
Look across the user's recent captures and identify 1 to 3 meaningful meta-patterns:
- Recurring themes or topics
- Unresolved decisions or open questions
- Potential tensions or shifts in perspective
- Common threads across projects

RULES:
- Do not state obvious tautologies.
- Every insight MUST reference at least 1 or more evidence entry IDs from the input.
- Distinguish this clearly as an observational pattern, not a new fact.`;

  const prompt = `Review these user thoughts and extract high-value cognitive patterns or insights:
${entriesContext}`;

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Short, insightful title for the pattern.',
            },
            observation: {
              type: Type.STRING,
              description: 'A 1-2 sentence thoughtful observation of the trend or shift.',
            },
            evidence_entry_ids: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of Entry IDs that support this insight.',
            },
            category: {
              type: Type.STRING,
              enum: ['recurring_theme', 'unresolved_decision', 'perspective_shift', 'prioritization'],
            },
          },
          required: ['title', 'observation', 'evidence_entry_ids', 'category'],
        },
      },
    },
  });

  try {
    const raw = response.text?.trim() || '[]';
    const items = JSON.parse(raw);
    const newInsights: Insight[] = items.map((it: any) => ({
      id: 'ins_' + Math.random().toString(36).substring(2, 11),
      user_id: userId,
      title: it.title,
      observation: it.observation,
      evidence_entry_ids: Array.isArray(it.evidence_entry_ids) ? it.evidence_entry_ids : [],
      category: it.category || 'recurring_theme',
      created_at: new Date().toISOString(),
    }));

    // Save into database
    for (const ins of newInsights) {
      Database.saveInsight(ins);
    }

    return Database.getInsights(userId);
  } catch (err) {
    console.error('Error parsing insights JSON:', err);
    return Database.getInsights(userId);
  }
}
