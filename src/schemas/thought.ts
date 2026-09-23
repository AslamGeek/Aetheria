import { z } from 'zod';

export const ObjectTypeEnum = z.enum(['task', 'note', 'idea', 'decision', 'event']);
export const EntityTypeEnum = z.enum(['person', 'project', 'company', 'topic']);
export const DatePrecisionEnum = z.enum([
  'exact_datetime',
  'date',
  'relative_date',
  'date_range',
  'fuzzy',
  'none'
]);

export const ParsedObjectSchema = z.object({
  type: ObjectTypeEnum,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  due: z.string().nullable().optional(), // ISO 8601 string or null
  date_precision: DatePrecisionEnum.nullable().optional(),
  original_date_phrase: z.string().nullable().optional(),
  is_tentative: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});

export const ParsedEntitySchema = z.object({
  type: EntityTypeEnum,
  name: z.string().min(1),
  relationship: z.string().nullable().optional(),
});

export const ParsedThoughtSchema = z.object({
  summary: z.string().optional().default(''),
  cleaned_text: z.string().optional().nullable(),
  objects: z.array(ParsedObjectSchema).default([]),
  entities: z.array(ParsedEntitySchema).default([]),
});

export type ParsedThoughtData = z.infer<typeof ParsedThoughtSchema>;
export type ParsedObjectData = z.infer<typeof ParsedObjectSchema>;
export type ParsedEntityData = z.infer<typeof ParsedEntitySchema>;
