import { Type } from '@google/genai';
import { getGeminiClient, withRetry } from './geminiClient.ts';
import { ParsedThoughtData, ParsedThoughtSchema } from '../../src/schemas/thought.ts';

export interface ParseThoughtOptions {
  rawText: string;
  currentDate?: string;
  userTimezone?: string;
}

export async function parseThought({
  rawText,
  currentDate = new Date().toISOString(),
  userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
}: ParseThoughtOptions): Promise<ParsedThoughtData> {
  const ai = getGeminiClient();

  const systemInstruction = `You are an expert cognitive parser and structured thought extractor for personal knowledge and action management.
The user is recording an unstructured personal thought, voice dictation transcript, or rapid brain dump.
Your job is to faithfully decompose this thought into actionable, memorable, and organized structured items without losing meaning or hallucinating facts.

CURRENT CONTEXT:
- Current timestamp: ${currentDate}
- User timezone: ${userTimezone}

STRICT EXTRACTION RULES:
1. PRESERVE FACTUAL GROUNDING: Never invent people, deadlines, commitments, or decisions that were not in the raw text.
2. DISTINGUISH EXPLICIT VS. TENTATIVE:
   - Explicit task: "Need to call Ramesh tomorrow" -> type: "task", confidence: 0.95, due resolved based on current timestamp, original_date_phrase: "tomorrow".
   - Tentative thought: "Maybe we should validate reporting demand" -> type: "idea", confidence: 0.85, is_tentative: true.
   - Observation / Note: "Ravi said pricing is too complicated" -> type: "note" (NOT a decision to change pricing!).
   - Firm decision: "We decided to delay the launch until February" -> type: "decision".
   - Event: "Dentist appointment next Tuesday at 3pm" -> type: "event".
3. DATE RESOLUTION:
   - For relative dates ("tomorrow", "in 2 days", "next Monday"), compute the exact ISO date based on the current timestamp. Set date_precision to "date" or "exact_datetime".
   - Preserve the exact user wording in 'original_date_phrase' (e.g. "tomorrow", "sometime this week", "before Friday").
   - For vague or fuzzy terms ("sometime this week", "later this month"), set date_precision to "fuzzy" or "date_range", and do NOT invent arbitrary timestamps.
   - If no temporal reference exists, due must be null, and date_precision must be "none".
4. OBJECT TYPES:
   - "task": Action item requiring execution or follow-up.
   - "note": Informational nugget, remark by someone else, reference datum, or fact.
   - "idea": Creative spark, proposal, exploration hypothesis, or potential feature.
   - "decision": A resolved choice, agreement, or deliberate conclusion.
   - "event": Scheduled meeting, occurrence, or calendar entry.
5. ENTITIES:
   - Identify mentioned entities:
     - "person": Any named individual (e.g., "Ramesh", "Arun", "Priya").
     - "project": Any active project or product feature (e.g., "dashboard", "launch", "pricing").
     - "company": Named business, organization, or vendor.
     - "topic": Key recurring concept, domain, or theme (e.g., "land documents", "competitor pricing").
6. CONFIDENCE:
   - Provide a confidence score from 0.0 to 1.0 reflecting how unambiguous the extraction is.
   - High confidence (0.85-1.0) for clear directives.
   - Lower confidence (0.5-0.7) for speculative or ambiguous mentions.`;

  const prompt = `Deconstruct this personal thought into structured objects and entities:
"""${rawText}"""`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'A crisp one-sentence summary of the user thought.',
            },
            cleaned_text: {
              type: Type.STRING,
              description: 'Lightly cleaned version with typos or dictation stumbles fixed without altering meaning.',
            },
            objects: {
              type: Type.ARRAY,
              description: 'Structured items extracted from the thought.',
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: ['task', 'note', 'idea', 'decision', 'event'],
                  },
                  title: {
                    type: Type.STRING,
                    description: 'Concise, actionable headline for the object.',
                  },
                  description: {
                    type: Type.STRING,
                    description: 'Additional detail or contextual nuance directly stated.',
                  },
                  confidence: {
                    type: Type.NUMBER,
                    description: 'Confidence score between 0.0 and 1.0.',
                  },
                  due: {
                    type: Type.STRING,
                    description: 'ISO-8601 formatted date or datetime if explicitly stated or inferred, or null if none.',
                  },
                  date_precision: {
                    type: Type.STRING,
                    enum: ['exact_datetime', 'date', 'relative_date', 'date_range', 'fuzzy', 'none'],
                  },
                  original_date_phrase: {
                    type: Type.STRING,
                    description: 'The exact phrasing used by the user for the date or timeframe.',
                  },
                  is_tentative: {
                    type: Type.BOOLEAN,
                    description: 'True if the thought was hesitant or tentative (e.g. maybe, might, consider).',
                  },
                },
                required: ['type', 'title', 'confidence'],
              },
            },
            entities: {
              type: Type.ARRAY,
              description: 'Key named entities (people, projects, companies, topics).',
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: ['person', 'project', 'company', 'topic'],
                  },
                  name: {
                    type: Type.STRING,
                    description: 'Canonical name of the entity.',
                  },
                  relationship: {
                    type: Type.STRING,
                    description: 'Relationship or role in the thought (e.g., "collaborator", "recipient", "subject").',
                  },
                },
                required: ['type', 'name'],
              },
            },
          },
          required: ['summary', 'objects', 'entities'],
        },
      },
    })
  );

  const rawJson = response.text?.trim() || '{}';
  const parsed = JSON.parse(rawJson);

  // Validate strictly with Zod
  const validated = ParsedThoughtSchema.parse(parsed);
  return validated;
}
