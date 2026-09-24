import { z } from 'zod';
import type { TmsTestCase, TmsTestStep } from './types';

const rawStepSchema = z
  .object({
    action: z.unknown().optional(),
    data: z.unknown().optional(),
    expectedResult: z.unknown().optional(),
  })
  .passthrough();

const rawTestCaseSchema = z
  .object({
    testCaseId: z.unknown(),
    title: z.unknown().optional(),
    description: z.unknown().optional(),
    preConditions: z.unknown().optional(),
    postConditions: z.unknown().optional(),
    steps: z.array(rawStepSchema).optional().default([]),
  })
  .passthrough();

const responseSchema = z.object({
  success: z.boolean(),
  data: z.array(rawTestCaseSchema),
});

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function adaptStep(step: z.infer<typeof rawStepSchema>): TmsTestStep {
  return {
    action: text(step.action),
    data: text(step.data),
    expectedResult: text(step.expectedResult),
  };
}

export function adaptTaskTestCases(payload: unknown): TmsTestCase[] {
  const parsed = responseSchema.parse(payload);
  if (!parsed.success) {
    throw new Error('TMS returned success=false while fetching task test cases.');
  }

  return parsed.data.map((item) => {
    const testCaseId = text(item.testCaseId);
    if (!testCaseId) throw new Error('TMS testcase is missing testCaseId.');

    const preConditions = text(item.preConditions);
    const postConditions = text(item.postConditions);

    return {
      testCaseId,
      title: text(item.title),
      description: text(item.description),
      ...(preConditions ? { preConditions } : {}),
      ...(postConditions ? { postConditions } : {}),
      steps: item.steps.map(adaptStep),
    };
  });
}
