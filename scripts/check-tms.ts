#!/usr/bin/env node
import { getConfig } from '../src/config/env';
import { createTmsClient } from '../src/tms/client';

const taskId = process.argv.slice(2).find((argument) => /^[A-Z][A-Z0-9]*-\d+$/i.test(argument));
if (!taskId) {
  console.error('Usage: npm run test:tms -- TT-1240');
  process.exitCode = 1;
} else {
  try {
    const testCases = await createTmsClient(getConfig()).getTaskTestCases(taskId);
    console.log(`Fetched ${testCases.length} test case(s) for ${taskId.toUpperCase()}.`);
    for (const item of testCases) console.log(`${item.testCaseId}: ${item.title}`);
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
