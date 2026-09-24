import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { ExecutionAction } from '../compiler/types';
import { resolveElement } from '../ui/resolver';
import type { RuntimeContext } from './context';
import type { TestCaseStatus } from './result';
import {
  assertContainsAll,
  assertHidden,
  assertText,
  assertValue,
  assertVisible,
} from './assertions';

export interface ActionHandlerOutcome {
  status: TestCaseStatus;
  expected?: string;
  actual?: string;
  reason?: string;
}

export type ActionHandler = (
  action: ExecutionAction,
  context: RuntimeContext,
) => Promise<ActionHandlerOutcome>;

export class TestDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestDataUnavailableError';
  }
}

function success(details?: Pick<ActionHandlerOutcome, 'expected' | 'actual'>): ActionHandlerOutcome {
  return { status: 'PASS', ...details };
}

async function resultTable(context: RuntimeContext) {
  return (await resolveElement(context.page, context.registry, 'Kết quả tìm kiếm')).locator;
}

const openPage: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'OPEN_PAGE' }>;
  let url: string;
  try {
    url = new URL(action.url, `${context.appBaseUrl}/`).toString();
  } catch {
    return { status: 'NEED_MAPPING', reason: `Cannot map page description to URL: ${action.url}` };
  }
  await context.page.goto(url);
  return success({ actual: url });
};

const openModal: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'OPEN_MODAL' }>;
  const trigger = await resolveElement(context.page, context.registry, action.target, { useTrigger: true });
  await trigger.locator.click();
  const modal = await resolveElement(context.page, context.registry, action.target);
  await assertVisible(modal.locator);
  return success({ expected: `${action.target} visible` });
};

const click: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'CLICK' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target);
  await resolved.locator.click();
  return success();
};

const select: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'SELECT' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target);
  const tagName = await resolved.locator.evaluate((element) => element.tagName.toLowerCase());
  if (tagName === 'select') {
    await resolved.locator.selectOption({ label: action.value });
  } else {
    await resolved.locator.click();
    await context.page.getByRole('option', { name: action.value, exact: true }).click();
  }
  return success({ expected: action.value, actual: action.value });
};

const fill: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'FILL' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target);
  await resolved.locator.fill(action.value);
  return success({ expected: action.value });
};

const fillSearchFields: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'FILL_SEARCH_FIELDS' }>;
  const values = await context.dataProvider.resolveFields(action.fields);
  if (!values) {
    throw new TestDataUnavailableError(
      `No test data configured for all search fields: ${action.fields.join(', ')}`,
    );
  }
  for (const field of action.fields) {
    const resolved = await resolveElement(context.page, context.registry, field);
    await resolved.locator.fill(values[field]!);
  }
  return success({ actual: JSON.stringify(values) });
};

const search: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'SEARCH' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target);
  await resolved.locator.click();
  return success();
};

const waitForResponse: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'WAIT_FOR_RESPONSE' }>;
  const record = await context.network.waitFor(context.page, action.urlPattern, {
    ...(action.method ? { method: action.method } : {}),
    ...(action.status !== undefined ? { status: action.status } : {}),
  });
  return success({ actual: `${record.method} ${record.url} -> ${record.status ?? 'unknown'}` });
};

const visible: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'ASSERT_VISIBLE' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target);
  await assertVisible(resolved.locator);
  return success({ expected: `${action.target} visible` });
};

const hidden: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'ASSERT_HIDDEN' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target, {
    allowMissing: true,
  });
  await assertHidden(resolved.locator);
  return success({ expected: `${action.target} hidden` });
};

const text: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'ASSERT_TEXT' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target);
  await assertText(resolved.locator, action.expected);
  return success({ expected: action.expected });
};

const value: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'ASSERT_VALUE' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target);
  await assertValue(resolved.locator, action.expected);
  return success({ expected: action.expected });
};

const searchResult: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'ASSERT_SEARCH_RESULT' }>;
  const expectation = await context.dataProvider.getSearchExpectation(action.criteria);
  if (!expectation) {
    return {
      status: 'NEED_DATA',
      reason: `No business search expectation configured for ${JSON.stringify(action.criteria)}.`,
    };
  }
  if (expectation.includedOrderCodes.length === 0 && expectation.excludedOrderCodes.length === 0) {
    return {
      status: 'PARTIAL',
      reason: 'Search ran, but configured expectation contains no included or excluded orders.',
    };
  }
  const table = await resultTable(context);
  await assertContainsAll(table, expectation.includedOrderCodes, expectation.excludedOrderCodes);
  return success({
    expected: JSON.stringify(expectation),
    actual: 'Configured included/excluded order codes were verified in the result table.',
  });
};

const assertResultMembership = (included: boolean): ActionHandler => async (rawAction, context) => {
  const action = rawAction as Extract<
    ExecutionAction,
    { type: 'ASSERT_RESULT_INCLUDED' | 'ASSERT_RESULT_EXCLUDED' }
  >;
  const order = await context.dataProvider.findOrder({ ...action.criteria, requiredFields: ['orderCode'] });
  if (!order) {
    return {
      status: 'NEED_DATA',
      reason: `No order test data matches ${JSON.stringify(action.criteria)}.`,
    };
  }
  const table = await resultTable(context);
  await assertContainsAll(
    table,
    included ? [order.orderCode] : [],
    included ? [] : [order.orderCode],
  );
  return success({ expected: `${order.orderCode} ${included ? 'included' : 'excluded'}` });
};

const download: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'DOWNLOAD' }>;
  const resolved = await resolveElement(context.page, context.registry, action.target);
  const [downloadArtifact] = await Promise.all([
    context.page.waitForEvent('download'),
    resolved.locator.click(),
  ]);
  const directory = path.join(context.outputDir, 'downloads', context.testCaseId);
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, downloadArtifact.suggestedFilename());
  await downloadArtifact.saveAs(destination);
  context.downloads.push({
    suggestedFilename: downloadArtifact.suggestedFilename(),
    path: destination,
  });
  return success({ actual: destination });
};

const assertDownload: ActionHandler = async (rawAction, context) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'ASSERT_DOWNLOAD' }>;
  const latest = context.downloads.at(-1);
  if (!latest) throw new Error('Expected a download, but no download was captured.');
  if (action.fileNamePattern && !latest.suggestedFilename.includes(action.fileNamePattern)) {
    throw new Error(
      `Downloaded filename "${latest.suggestedFilename}" does not contain "${action.fileNamePattern}".`,
    );
  }
  return success({ expected: action.fileNamePattern ?? 'any downloaded file', actual: latest.path });
};

const custom: ActionHandler = async (rawAction) => {
  const action = rawAction as Extract<ExecutionAction, { type: 'CUSTOM' }>;
  return { status: 'NEED_MAPPING', reason: action.reason };
};

export const actionHandlers: Record<ExecutionAction['type'], ActionHandler> = {
  OPEN_PAGE: openPage,
  OPEN_MODAL: openModal,
  CLICK: click,
  SELECT: select,
  FILL: fill,
  FILL_SEARCH_FIELDS: fillSearchFields,
  SEARCH: search,
  WAIT_FOR_RESPONSE: waitForResponse,
  ASSERT_VISIBLE: visible,
  ASSERT_HIDDEN: hidden,
  ASSERT_TEXT: text,
  ASSERT_VALUE: value,
  ASSERT_SEARCH_RESULT: searchResult,
  ASSERT_RESULT_INCLUDED: assertResultMembership(true),
  ASSERT_RESULT_EXCLUDED: assertResultMembership(false),
  DOWNLOAD: download,
  ASSERT_DOWNLOAD: assertDownload,
  CUSTOM: custom,
};
