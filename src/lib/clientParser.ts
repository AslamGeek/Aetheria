import { ExtractedObject, ObjectType } from '../types/index.ts';

export interface ClientParseResult {
  cleaned_text: string;
  objects: Array<{
    type: ObjectType;
    title: string;
    description?: string;
    status?: 'pending' | 'active';
    confidence: number;
    due_at?: string;
    date_precision?: 'exact_datetime' | 'date' | 'relative_date' | 'fuzzy' | 'none';
    original_date_phrase?: string;
  }>;
}

/**
 * Intelligent client-side NLP parser for when the backend API is unavailable
 * (e.g. static Vercel deployment)
 */
export function parseThoughtClientSide(rawText: string): ClientParseResult {
  const text = rawText.trim();
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const objects: ClientParseResult['objects'] = [];
  const now = new Date();

  // Helper to extract date phrases
  function extractDate(str: string): {
    due_at?: string;
    precision?: 'exact_datetime' | 'date' | 'relative_date' | 'fuzzy' | 'none';
    phrase?: string;
  } {
    const lower = str.toLowerCase();
    
    if (lower.includes('tomorrow')) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return { due_at: d.toISOString(), precision: 'date', phrase: 'tomorrow' };
    }
    if (lower.includes('tonight')) {
      const d = new Date(now);
      d.setHours(20, 0, 0, 0);
      return { due_at: d.toISOString(), precision: 'exact_datetime', phrase: 'tonight' };
    }
    if (lower.includes('next week')) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return { due_at: d.toISOString(), precision: 'relative_date', phrase: 'next week' };
    }
    if (lower.includes('this week') || lower.includes('sometime this week')) {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      return { due_at: d.toISOString(), precision: 'fuzzy', phrase: 'this week' };
    }

    const dayMatches = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (let i = 0; i < dayMatches.length; i++) {
      if (lower.includes(dayMatches[i])) {
        const d = new Date(now);
        const currentDay = d.getDay(); // 0 is Sun, 1 is Mon...
        const targetDay = (i + 1) % 7;
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        d.setHours(9, 0, 0, 0);
        return { due_at: d.toISOString(), precision: 'date', phrase: dayMatches[i] };
      }
    }

    return {};
  }

  // If input contains multiple thoughts joined by "Also", "And then", etc.
  const clauses = text.split(/(?:\. |\n+|; |(?<=\w)\s+also\s+|(?<=\w)\s+and then\s+)/i);

  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (!trimmed || trimmed.length < 3) continue;

    const lower = trimmed.toLowerCase();
    const dateInfo = extractDate(trimmed);

    let type: ObjectType = 'note';
    let title = trimmed;

    // Detect tasks
    if (
      /^(need to|have to|must|call|email|check|send|buy|review|finish|prepare|pay|ask|schedule|setup|validate)\b/i.test(trimmed) ||
      /\b(tomorrow|by friday|by monday|due|deadline)\b/i.test(trimmed)
    ) {
      type = 'task';
      title = trimmed.replace(/^(need to|have to|must|i need to|i have to|got to)\s+/i, '');
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
    // Detect decisions
    else if (
      /\b(decided|we decided|agreed|let's delay|settled on|postponed|cancelled)\b/i.test(trimmed)
    ) {
      type = 'decision';
    }
    // Detect ideas
    else if (
      /\b(maybe|what if|idea|how about|we could|perhaps|could try|might be cool)\b/i.test(trimmed)
    ) {
      type = 'idea';
    }

    objects.push({
      type,
      title: title.length > 100 ? title.substring(0, 97) + '...' : title,
      description: title.length > 100 ? trimmed : undefined,
      status: type === 'task' ? 'pending' : 'active',
      confidence: 0.9,
      due_at: dateInfo.due_at,
      date_precision: dateInfo.precision,
      original_date_phrase: dateInfo.phrase,
    });
  }

  if (objects.length === 0) {
    objects.push({
      type: 'note',
      title: text.length > 100 ? text.substring(0, 97) + '...' : text,
      status: 'active',
      confidence: 0.8,
    });
  }

  return {
    cleaned_text: text,
    objects,
  };
}
