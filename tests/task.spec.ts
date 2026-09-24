import { expect, test } from '@playwright/test';
import { getConfig } from '../src/config/env';
import { runTask } from '../src/runtime/task-runner';

const taskId = process.env.TASK_ID;

test('execute a TMS task through the data-driven engine', async () => {
  test.skip(!taskId, 'Set TASK_ID to execute the data-driven TMS task test.');
  const outcome = await runTask(taskId!, getConfig());
  expect(outcome.report.summary.FAIL).toBe(0);
});
