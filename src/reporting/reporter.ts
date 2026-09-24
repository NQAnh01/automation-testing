import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TEST_CASE_STATUSES, type TestCaseExecutionResult } from '../runtime/result';
import type { TaskExecutionReport } from './types';
import { safeFileSegment } from '../utils/files';

export function buildTaskReport(
  taskId: string,
  startedAt: string,
  results: TestCaseExecutionResult[],
): TaskExecutionReport {
  const finishedAt = new Date().toISOString();
  const summary = Object.fromEntries(TEST_CASE_STATUSES.map((status) => [status, 0])) as TaskExecutionReport['summary'];
  for (const result of results) summary[result.status] += 1;
  return {
    taskId,
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    summary,
    results,
  };
}

export function printTaskReport(report: TaskExecutionReport): void {
  console.log(`\nTask: ${report.taskId}\n`);
  console.log(`Total:        ${report.results.length}`);
  for (const status of TEST_CASE_STATUSES) {
    console.log(`${`${status}:`.padEnd(14)}${report.summary[status]}`);
  }
  console.log('');
  for (const result of report.results) {
    console.log(`${result.testCaseId}\n${result.status}`);
    if (result.failedActionIndex !== undefined) console.log(`Step: ${result.failedActionIndex + 1}`);
    if (result.reason) console.log(`Reason: ${result.reason}`);
    console.log('');
  }
}

export async function writeTaskReport(
  outputDir: string,
  report: TaskExecutionReport,
): Promise<string> {
  const reportDirectory = path.join(outputDir, 'reports');
  await mkdir(reportDirectory, { recursive: true });
  const reportPath = path.join(reportDirectory, `${safeFileSegment(report.taskId)}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}
