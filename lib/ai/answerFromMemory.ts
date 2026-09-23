import { getGeminiClient, withRetry } from './geminiClient.ts';
import { retrieveMemories } from './retrieveMemories.ts';
import { MemoryQueryResult } from '../../src/types/index.ts';

export async function answerFromMemory(userId: string, question: string): Promise<MemoryQueryResult> {
  const memories = await retrieveMemories(userId, question, 7);

  if (memories.length === 0) {
    return {
      answer: "You haven't recorded any thoughts or memories matching this query yet. Try asking about a person, decision, or topic you previously captured.",
      directEvidenceCount: 0,
      sources: [],
    };
  }

  // Format context for Gemini
  const contextSections = memories.map((m, idx) => {
    const formattedDate = new Date(m.entry.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const objectSummary = m.relatedObjects
      .map(o => `  - [${o.type.toUpperCase()}${o.status === 'completed' ? ' - COMPLETED' : ''}] ${o.title}${o.due_at ? ` (due: ${o.original_date_phrase || o.due_at})` : ''}`)
      .join('\n');

    return `Source Entry #${idx + 1} (Entry ID: ${m.entry.id}, Recorded: ${formattedDate}):
Raw Thought: "${m.entry.raw_text}"
Extracted Objects:
${objectSummary || '  (None)'}`;
  }).join('\n\n');

  const sources = memories.map(m => ({
    entryId: m.entry.id,
    rawText: m.entry.raw_text,
    createdAt: m.entry.created_at,
    matchedObjects: m.relatedObjects.map(o => ({
      title: o.title,
      type: o.type,
    })),
  }));

  const systemInstruction = `You are the memory recall engine for Aetheria, a personal second-brain application.
You are given the user's authentic personal captured thoughts and their structured items.

ABSOLUTE INTEGRITY PRINCIPLES:
1. Ground truth strictly in the provided Source Entries. NEVER fabricate memories, dates, agreements, or people.
2. If the user asks something that is NOT addressed or only partially addressed in the provided entries, be completely transparent and explicitly state what is known vs unknown.
3. Be calm, concise, articulate, and direct. Avoid conversational fluff or corporate jargon.
4. Always cite specific context, dates, or extracted status when answering (e.g. "On Sep 22, you recorded that...", "Regarding Ramesh, you have one pending task to...").
5. Format your answer with clean Markdown paragraphs and bullet points where appropriate.`;

  const prompt = `User Question: "${question}"

RETRIEVED PERSONAL MEMORIES:
${contextSections}

Please provide an accurate, grounded answer based solely on these memories:`;

  try {
    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
        },
      })
    );

    const answer = response.text || "I was unable to synthesize an answer from your memories at this time.";

    return {
      answer,
      directEvidenceCount: memories.length,
      sources,
    };
  } catch (err) {
    console.warn('AI synthesis temporarily unavailable, falling back to direct evidence summary:', err);
    // Direct deterministic fallback from memories
    const bullets = memories.map(m => `• **${new Date(m.entry.created_at).toLocaleDateString()}**: "${m.entry.raw_text}"`).join('\n\n');
    return {
      answer: `Here are the matching memories retrieved from your archive regarding "${question}":\n\n${bullets}`,
      directEvidenceCount: memories.length,
      sources,
    };
  }
}
