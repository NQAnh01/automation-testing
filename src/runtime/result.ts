import type { ExecutionAction } from '../compiler/types';
import type { NetworkRecord } from './network';

export const TEST_CASE_STATUSES = [
  'PASS',
  'FAIL',
  'SKIP',
  'NEED_MAPPING',
  'NEED_DATA',
  'PARTIAL',
] as const;

export type TestCaseStatus = (typeof TEST_CASE_STATUSES)[number];

export interface ActionExecutionResult {
  actionIndex: number;
  action: ExecutionAction;
  status: TestCaseStatus;
  durationMs: number;
  error?: string;
  expected?: string;
  actual?: string;
  screenshot?: string;
}

export interface FailureArtifacts {
  screenshot?: string;
  trace?: string;
}

export interface TestCaseExecutionResult {
  testCaseId: string;
  title: string;
  status: TestCaseStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  reason?: string;
  failedActionIndex?: number;
  actionResults: ActionExecutionResult[];
  artifacts: FailureArtifacts;
  network: NetworkRecord[];
  normalizationNotes: string[];
}

const STATUS_PRIORITY: Record<TestCaseStatus, number> = {
  PASS: 0,
  SKIP: 1,
  PARTIAL: 2,
  NEED_DATA: 3,
  NEED_MAPPING: 4,
  FAIL: 5,
};

export function combineStatuses(current: TestCaseStatus, next: TestCaseStatus): TestCaseStatus {
  return STATUS_PRIORITY[next] > STATUS_PRIORITY[current] ? next : current;
}
