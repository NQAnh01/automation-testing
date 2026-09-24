import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { ExecutionPlan } from '../compiler/types';
import { UiElementNotFoundError, UnknownUiTargetError } from '../ui/resolver';
import { safeFileSegment } from '../utils/files';
import { actionHandlers, TestDataUnavailableError } from './actions';
import type { RuntimeContext } from './context';
import {
  combineStatuses,
  type ActionExecutionResult,
  type TestCaseExecutionResult,
  type TestCaseStatus,
} from './result';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

function statusForError(error: unknown): TestCaseStatus {
  if (error instanceof UnknownUiTargetError || error instanceof UiElementNotFoundError) {
    return 'NEED_MAPPING';
  }
  if (error instanceof TestDataUnavailableError) return 'NEED_DATA';
  return 'FAIL';
}

export async function executePlan(
  context: RuntimeContext,
  plan: ExecutionPlan,
): Promise<TestCaseExecutionResult> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const actionResults: ActionExecutionResult[] = [];
  let status: TestCaseStatus = plan.actions.length === 0 ? 'SKIP' : 'PASS';
  let reason: string | undefined;
  let failedActionIndex: number | undefined;

  if (plan.unsupportedReasons.length > 0) {
    status = 'NEED_MAPPING';
    reason = plan.unsupportedReasons.join(' | ');
  } else {
    for (const [actionIndex, action] of plan.actions.entries()) {
      const actionStarted = Date.now();
      context.logger.info(`[${plan.testCaseId}] #${actionIndex + 1} ${action.type}`);
      try {
        const outcome = await actionHandlers[action.type](action, context);
        const result: ActionExecutionResult = {
          actionIndex,
          action,
          status: outcome.status,
          durationMs: Date.now() - actionStarted,
          ...(outcome.reason ? { error: outcome.reason } : {}),
          ...(outcome.expected ? { expected: outcome.expected } : {}),
          ...(outcome.actual ? { actual: outcome.actual } : {}),
        };
        actionResults.push(result);
        status = combineStatuses(status, outcome.status);
        if (outcome.status !== 'PASS') {
          reason = outcome.reason ?? `${action.type} completed with ${outcome.status}.`;
          failedActionIndex = actionIndex;
          break;
        }
      } catch (error) {
        const actionStatus = statusForError(error);
        const screenshotDirectory = path.join(
          context.outputDir,
          'screenshots',
          safeFileSegment(plan.testCaseId),
        );
        await mkdir(screenshotDirectory, { recursive: true });
        const screenshot = path.join(screenshotDirectory, 'failure.png');
        await context.page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
        const message = errorMessage(error);
        actionResults.push({
          actionIndex,
          action,
          status: actionStatus,
          durationMs: Date.now() - actionStarted,
          error: message,
          screenshot,
        });
        status = combineStatuses(status, actionStatus);
        reason = message;
        failedActionIndex = actionIndex;
        break;
      }
    }
  }

  const finished = Date.now();
  return {
    testCaseId: plan.testCaseId,
    title: plan.title,
    status,
    startedAt,
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - started,
    ...(reason ? { reason } : {}),
    ...(failedActionIndex !== undefined ? { failedActionIndex } : {}),
    actionResults,
    artifacts: {},
    network: context.network.snapshot(),
    normalizationNotes: plan.normalizationNotes,
  };
}
