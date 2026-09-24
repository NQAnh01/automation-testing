import type { TestCaseExecutionResult, TestCaseStatus } from '../runtime/result';

export interface TaskExecutionReport {
  taskId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: Record<TestCaseStatus, number>;
  results: TestCaseExecutionResult[];
}
