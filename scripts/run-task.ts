#!/usr/bin/env node
import { getConfig } from '../src/config/env';
import { runTask, shouldFailProcess } from '../src/runtime/task-runner';

const taskId = process.argv.slice(2).find((argument) => /^[A-Z][A-Z0-9]*-\d+$/i.test(argument));
const headed = process.argv.includes('--headed');

if (!taskId) {
  console.error('Usage: npm run test:task -- TT-1240');
  console.error('Headed: npm run test:headed -- TT-1240');
  process.exitCode = 1;
} else {
  try {
    const config = getConfig();
    if (headed) config.headless = false;
    const outcome = await runTask(taskId, config);
    console.log(`Report: ${outcome.reportPath}`);
    console.log(`Compiled plans reused from cache: ${outcome.cacheHits}/${outcome.compiledPlans.length}`);
    process.exitCode = shouldFailProcess(outcome.report, config.needAttentionExitCode) ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
