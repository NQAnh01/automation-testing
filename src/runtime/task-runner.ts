import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { prepareAuthentication } from '../auth/login';
import { CompiledPlanCache } from '../compiler/cache';
import { DeterministicTestCaseCompiler } from '../compiler/compiler';
import type { ExecutionPlan } from '../compiler/types';
import type { AutomationConfig } from '../config/env';
import { StaticTestDataProvider } from '../data/provider';
import { buildTaskReport, printTaskReport, writeTaskReport } from '../reporting/reporter';
import type { TaskExecutionReport } from '../reporting/types';
import { createTmsClient } from '../tms/client';
import { createDefaultUiRegistry } from '../ui/pages/order-list';
import { safeFileSegment } from '../utils/files';
import { executePlan } from './executor';
import { NetworkCollector } from './network';
import type { TestCaseExecutionResult, TestCaseStatus } from './result';

export interface RunTaskOutcome {
  report: TaskExecutionReport;
  reportPath: string;
  compiledPlans: ExecutionPlan[];
  cacheHits: number;
}

function nonExecutedResult(
  plan: ExecutionPlan,
  status: TestCaseStatus,
  reason: string,
): TestCaseExecutionResult {
  const now = new Date().toISOString();
  return {
    testCaseId: plan.testCaseId,
    title: plan.title,
    status,
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    reason,
    actionResults: [],
    artifacts: {},
    network: [],
    normalizationNotes: plan.normalizationNotes,
  };
}

async function executeInBrowser(
  browser: Browser,
  config: AutomationConfig,
  plan: ExecutionPlan,
  storageStatePath?: string,
): Promise<TestCaseExecutionResult> {
  const context = await browser.newContext({
    baseURL: config.appBaseUrl!,
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();
  const network = new NetworkCollector();
  network.attach(page);
  const registry = createDefaultUiRegistry();
  const dataProvider = new StaticTestDataProvider(config.testDataJson);
  const testCaseDirectory = safeFileSegment(plan.testCaseId);
  const traceDirectory = path.join(config.outputDir, 'traces', testCaseDirectory);
  await mkdir(traceDirectory, { recursive: true });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  let result: TestCaseExecutionResult;
  try {
    if (!plan.actions.some((action) => action.type === 'OPEN_PAGE')) {
      await page.goto(config.appBaseUrl!);
    }
    result = await executePlan(
      {
        page,
        testCaseId: plan.testCaseId,
        appBaseUrl: config.appBaseUrl!,
        outputDir: config.outputDir,
        registry,
        dataProvider,
        network,
        downloads: [],
        logger: console,
      },
      plan,
    );
  } catch (error) {
    const now = new Date().toISOString();
    result = {
      testCaseId: plan.testCaseId,
      title: plan.title,
      status: 'FAIL',
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      reason: error instanceof Error ? error.stack ?? error.message : String(error),
      actionResults: [],
      artifacts: {},
      network: network.snapshot(),
      normalizationNotes: plan.normalizationNotes,
    };
  }

  if (result.status === 'PASS') {
    await context.tracing.stop();
  } else {
    const tracePath = path.join(traceDirectory, 'trace.zip');
    await context.tracing.stop({ path: tracePath }).catch(() => undefined);
    result.artifacts.trace = tracePath;
    const actionScreenshot = result.actionResults.find((item) => item.screenshot)?.screenshot;
    if (actionScreenshot) {
      result.artifacts.screenshot = actionScreenshot;
    } else {
      const screenshotDirectory = path.join(config.outputDir, 'screenshots', testCaseDirectory);
      await mkdir(screenshotDirectory, { recursive: true });
      const screenshotPath = path.join(screenshotDirectory, 'failure.png');
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
      result.artifacts.screenshot = screenshotPath;
    }
  }

  await context.close();
  return result;
}

export async function runTask(taskId: string, config: AutomationConfig): Promise<RunTaskOutcome> {
  const normalizedTaskId = taskId.trim().toUpperCase();
  const startedAt = new Date().toISOString();
  const testCases = await createTmsClient(config).getTaskTestCases(normalizedTaskId);
  const compiler = new DeterministicTestCaseCompiler();
  const cache = new CompiledPlanCache();
  const compiled = await Promise.all(testCases.map((item) => cache.getOrCompile(item, compiler)));
  const compiledPlans = compiled.map((entry) => entry.plan);
  const cacheHits = compiled.filter((entry) => entry.cacheHit).length;
  const results: TestCaseExecutionResult[] = [];

  if (!config.appBaseUrl) {
    for (const plan of compiledPlans) {
      results.push(
        nonExecutedResult(
          plan,
          plan.actions.length === 0 ? 'SKIP' : 'NEED_MAPPING',
          plan.unsupportedReasons.length > 0
            ? plan.unsupportedReasons.join(' | ')
            : 'APP_BASE_URL is not configured; browser execution was not started.',
        ),
      );
    }
  } else {
    const browser = await chromium.launch({ headless: config.headless });
    try {
      const auth = await prepareAuthentication(browser, config, createDefaultUiRegistry());
      if (auth.issue) {
        for (const plan of compiledPlans) {
          results.push(nonExecutedResult(plan, 'NEED_MAPPING', auth.issue));
        }
      } else {
        for (const plan of compiledPlans) {
          if (plan.unsupportedReasons.length > 0) {
            results.push(nonExecutedResult(plan, 'NEED_MAPPING', plan.unsupportedReasons.join(' | ')));
            continue;
          }
          results.push(await executeInBrowser(browser, config, plan, auth.storageStatePath));
        }
      }
    } finally {
      await browser.close();
    }
  }

  const report = buildTaskReport(normalizedTaskId, startedAt, results);
  printTaskReport(report);
  const reportPath = await writeTaskReport(config.outputDir, report);
  return { report, reportPath, compiledPlans, cacheHits };
}

export function shouldFailProcess(report: TaskExecutionReport, needAttentionExitCode: boolean): boolean {
  if (report.summary.FAIL > 0) return true;
  if (!needAttentionExitCode) return false;
  return report.summary.NEED_MAPPING > 0 || report.summary.NEED_DATA > 0 || report.summary.PARTIAL > 0;
}
