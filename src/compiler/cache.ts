import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { executionPlanSchema } from './schema';
import type { ExecutionPlan, TestCaseCompiler } from './types';
import type { TmsTestCase } from '../tms/types';
import { safeFileSegment } from '../utils/files';

const cacheEntrySchema = z.object({
  fingerprint: z.string(),
  compiledAt: z.string(),
  plan: executionPlanSchema,
});

function fingerprint(testCase: TmsTestCase): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        title: testCase.title,
        description: testCase.description,
        preConditions: testCase.preConditions,
        postConditions: testCase.postConditions,
        steps: testCase.steps,
      }),
    )
    .digest('hex');
}

export class CompiledPlanCache {
  constructor(private readonly directory = path.resolve('.cache')) {}

  async getOrCompile(
    testCase: TmsTestCase,
    compiler: TestCaseCompiler,
  ): Promise<{ plan: ExecutionPlan; cacheHit: boolean }> {
    const currentFingerprint = fingerprint(testCase);
    const cachePath = path.join(this.directory, `${safeFileSegment(testCase.testCaseId)}.json`);

    try {
      const cached = cacheEntrySchema.parse(JSON.parse(await readFile(cachePath, 'utf8')));
      if (cached.fingerprint === currentFingerprint) {
        return { plan: cached.plan as ExecutionPlan, cacheHit: true };
      }
    } catch {
      // Missing, stale, or invalid cache entries are safely rebuilt.
    }

    const plan = await compiler.compile(testCase);
    await mkdir(this.directory, { recursive: true });
    await writeFile(
      cachePath,
      `${JSON.stringify(
        { fingerprint: currentFingerprint, compiledAt: new Date().toISOString(), plan },
        null,
        2,
      )}\n`,
      'utf8',
    );
    return { plan, cacheHit: false };
  }
}
