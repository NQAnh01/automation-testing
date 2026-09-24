import { z } from 'zod';

const sourceSchema = z.object({
  sourceStepIndex: z.number().int().nonnegative(),
  rawAction: z.string(),
  rawData: z.string(),
  rawExpectedResult: z.string(),
});

const withSource = <T extends z.ZodRawShape>(shape: T) => sourceSchema.extend(shape);

export const executionActionSchema = z.discriminatedUnion('type', [
  withSource({ type: z.literal('OPEN_PAGE'), url: z.string().min(1) }),
  withSource({ type: z.literal('OPEN_MODAL'), target: z.string().min(1) }),
  withSource({ type: z.literal('CLICK'), target: z.string().min(1) }),
  withSource({ type: z.literal('SELECT'), target: z.string().min(1), value: z.string().min(1) }),
  withSource({ type: z.literal('FILL'), target: z.string().min(1), value: z.string() }),
  withSource({ type: z.literal('FILL_SEARCH_FIELDS'), fields: z.array(z.string().min(1)).min(1) }),
  withSource({ type: z.literal('SEARCH'), target: z.string().min(1) }),
  withSource({
    type: z.literal('WAIT_FOR_RESPONSE'),
    urlPattern: z.string().min(1),
    method: z.string().optional(),
    status: z.number().int().optional(),
  }),
  withSource({ type: z.literal('ASSERT_VISIBLE'), target: z.string().min(1) }),
  withSource({ type: z.literal('ASSERT_HIDDEN'), target: z.string().min(1) }),
  withSource({ type: z.literal('ASSERT_TEXT'), target: z.string().min(1), expected: z.string() }),
  withSource({ type: z.literal('ASSERT_VALUE'), target: z.string().min(1), expected: z.string() }),
  withSource({ type: z.literal('ASSERT_SEARCH_RESULT'), criteria: z.record(z.string(), z.string()) }),
  withSource({
    type: z.literal('ASSERT_RESULT_INCLUDED'),
    criteria: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])),
  }),
  withSource({
    type: z.literal('ASSERT_RESULT_EXCLUDED'),
    criteria: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])),
  }),
  withSource({ type: z.literal('DOWNLOAD'), target: z.string().min(1) }),
  withSource({ type: z.literal('ASSERT_DOWNLOAD'), fileNamePattern: z.string().optional() }),
  withSource({
    type: z.literal('CUSTOM'),
    status: z.literal('NEED_MAPPING'),
    reason: z.string().min(1),
  }),
]);

const testStepSchema = z.object({
  action: z.string(),
  data: z.string(),
  expectedResult: z.string(),
});

const testCaseSchema = z.object({
  testCaseId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  preConditions: z.string().optional(),
  postConditions: z.string().optional(),
  steps: z.array(testStepSchema),
});

const requirementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.enum(['RESULT_INCLUDED', 'RESULT_EXCLUDED']),
    criteria: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])),
    raw: z.string(),
  }),
  z.object({ type: z.literal('CUSTOM'), raw: z.string(), reason: z.string() }),
]);

export const executionPlanSchema = z.object({
  version: z.literal(1),
  testCaseId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  rawTestCase: testCaseSchema,
  requirements: z.array(requirementSchema),
  actions: z.array(executionActionSchema),
  unsupportedReasons: z.array(z.string()),
  normalizationNotes: z.array(z.string()),
});
