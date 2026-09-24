import { executionPlanSchema } from './schema';
import {
  extractBracketValue,
  extractQuotedValues,
  normalizeActionDependencies,
  normalizeText,
  splitCombinedFields,
} from './normalizer';
import type {
  ExecutionAction,
  ExecutionPlan,
  RequirementRule,
  TestCaseCompiler,
} from './types';
import type { TmsTestCase, TmsTestStep } from '../tms/types';

interface CompilerState {
  selectedValues: Map<string, string>;
  searchFields: string[];
}

type ActionSource = Pick<
  ExecutionAction,
  'sourceStepIndex' | 'rawAction' | 'rawData' | 'rawExpectedResult'
>;

function sourceFor(step: TmsTestStep, index: number): ActionSource {
  return {
    sourceStepIndex: index,
    rawAction: step.action,
    rawData: step.data,
    rawExpectedResult: step.expectedResult,
  };
}

function inferTarget(text: string, ignoredWords: RegExp): string | undefined {
  const bracketed = extractBracketValue(text);
  if (bracketed) return bracketed;
  const quoted = extractQuotedValues(text)[0];
  if (quoted) return quoted;
  const candidate = normalizeText(text.replace(ignoredWords, ''));
  return candidate || undefined;
}

function extractSelectedValue(data: string): string | undefined {
  const quoted = extractQuotedValues(data);
  if (quoted.length > 0) return quoted.at(-1);
  const match = data.match(/(?:chọn|select)(?:\s+(?:trạng thái|giá trị))?\s+(.+)$/i);
  return match?.[1] ? normalizeText(match[1]) : undefined;
}

function criteriaFromText(value: string): Record<string, string | boolean | number> {
  const lower = value.toLocaleLowerCase('vi-VN');
  const criteria: Record<string, string | boolean | number> = {};
  if (/\bfail\b/i.test(value)) criteria.fail = true;
  if (/\bpass\b/i.test(value)) criteria.pass = true;
  if (lower.includes('tái chế')) criteria.recycle = true;
  if (lower.includes('cần sửa')) criteria.needsCorrection = true;
  for (const quoted of extractQuotedValues(value)) {
    criteria[`value${Object.keys(criteria).length + 1}`] = quoted;
  }
  return criteria;
}

function parseRequirements(description: string): RequirementRule[] {
  return description
    .split(/\r?\n|[.;](?=\s|$)/)
    .map(normalizeText)
    .filter(Boolean)
    .flatMap((line): RequirementRule[] => {
      const lower = line.toLocaleLowerCase('vi-VN');
      if (lower.includes('không xuất hiện')) {
        return [{ type: 'RESULT_EXCLUDED', criteria: criteriaFromText(line), raw: line }];
      }
      if (lower.includes('phải xuất hiện')) {
        return [{ type: 'RESULT_INCLUDED', criteria: criteriaFromText(line), raw: line }];
      }
      return [];
    });
}

function parseStepAction(
  step: TmsTestStep,
  index: number,
  state: CompilerState,
): ExecutionAction[] {
  const source = sourceFor(step, index);
  const action = normalizeText(step.action);
  const data = normalizeText(step.data);
  const combined = `${action} ${data}`.trim();
  const actions: ExecutionAction[] = [];

  if (!action && !data) {
    return [
      {
        ...source,
        type: 'CUSTOM',
        status: 'NEED_MAPPING',
        reason: `Step ${index + 1} has no action or data.`,
      },
    ];
  }

  if (/\bmở\s+(?:modal|popup|hộp thoại)/i.test(action)) {
    const target = inferTarget(action, /^.*?\bmở\s+(?:modal|popup|hộp thoại)\s*/i);
    if (target) actions.push({ ...source, type: 'OPEN_MODAL', target });
  } else if (/\bmở\s+(?:trang|page)/i.test(action)) {
    const url = extractQuotedValues(action)[0] ?? extractBracketValue(action) ?? data;
    if (url) actions.push({ ...source, type: 'OPEN_PAGE', url });
  } else if (/dropdown|danh sách chọn|select\b/i.test(action)) {
    const target = inferTarget(action, /^.*?(?:dropdown|danh sách chọn|select)\s*/i);
    const value = extractSelectedValue(data);
    if (target && value) {
      actions.push({ ...source, type: 'SELECT', target, value });
      state.selectedValues.set(target, value);
    }
  } else if (/kiểm tra\s+tìm kiếm|tìm kiếm.*\[.*\+.*]/i.test(action)) {
    const fields = splitCombinedFields(action);
    if (fields.length > 0) {
      state.searchFields = fields;
      actions.push({ ...source, type: 'FILL_SEARCH_FIELDS', fields });
    }
    if (/bấm\s+tìm kiếm|click\s+tìm kiếm|nhấn\s+tìm kiếm/i.test(combined)) {
      actions.push({ ...source, type: 'SEARCH', target: 'Tìm kiếm' });
    }
  } else if (/^(?:bấm|nhấn|click)(?:\s+vào)?\s+(?:nút\s+)?tìm kiếm/i.test(action)) {
    actions.push({ ...source, type: 'SEARCH', target: 'Tìm kiếm' });
  } else if (/^(?:bấm|nhấn|click)(?:\s+vào)?/i.test(action)) {
    const target = inferTarget(action, /^(?:bấm|nhấn|click)(?:\s+vào)?\s+(?:nút\s+)?/i);
    if (target) actions.push({ ...source, type: 'CLICK', target });
  } else if (/^(?:nhập|điền|fill)\b/i.test(action)) {
    const target = extractQuotedValues(action)[0] ?? extractBracketValue(action);
    if (target && data) actions.push({ ...source, type: 'FILL', target, value: data });
  } else if (/^(?:tải|download|export)\b/i.test(action)) {
    const target = inferTarget(action, /^(?:tải|download|export)\s*/i) ?? 'Tải xuống';
    actions.push({ ...source, type: 'DOWNLOAD', target });
  }

  if (actions.length === 0) {
    actions.push({
      ...source,
      type: 'CUSTOM',
      status: 'NEED_MAPPING',
      reason: `No deterministic action mapping for step ${index + 1}: ${action || data}`,
    });
  }

  return actions;
}

function parseExpectedResult(
  step: TmsTestStep,
  index: number,
  state: CompilerState,
): ExecutionAction[] {
  const source = sourceFor(step, index);
  const expected = normalizeText(step.expectedResult);
  if (!expected) return [];
  const lower = expected.toLocaleLowerCase('vi-VN');

  if (/không\s+hiển thị|bị\s+ẩn/.test(lower)) {
    const target = inferTarget(expected, /^.*?(?:không\s+hiển thị|bị\s+ẩn)\s*/i);
    if (target) return [{ ...source, type: 'ASSERT_HIDDEN', target }];
  }

  if (/hiển thị\s+(?:modal|popup|hộp thoại)/.test(lower)) {
    const target = extractBracketValue(expected) ?? extractQuotedValues(expected)[0];
    if (target) return [{ ...source, type: 'ASSERT_VISIBLE', target }];
  }

  if (/giữ\s+(?:lại\s+)?(?:giá trị|value)|filter.*giữ/.test(lower)) {
    const selected = [...state.selectedValues.entries()].at(-1);
    if (selected) {
      return [{ ...source, type: 'ASSERT_VALUE', target: selected[0], expected: selected[1] }];
    }
  }

  if (/trả\s+về\s+kết\s+quả\s+tìm\s+kiếm|kết\s+quả\s+tìm\s+kiếm\s+chính\s+xác/.test(lower)) {
    const criteria: Record<string, string> = {};
    for (const [target, value] of state.selectedValues) criteria[target] = value;
    for (const field of state.searchFields) criteria[field] = `{{data:${field}}}`;
    return [{ ...source, type: 'ASSERT_SEARCH_RESULT', criteria }];
  }

  if (/không\s+xuất\s+hiện/.test(lower)) {
    return [{ ...source, type: 'ASSERT_RESULT_EXCLUDED', criteria: criteriaFromText(expected) }];
  }

  if (/phải\s+xuất\s+hiện|có\s+trong\s+kết\s+quả/.test(lower)) {
    return [{ ...source, type: 'ASSERT_RESULT_INCLUDED', criteria: criteriaFromText(expected) }];
  }

  if (/tải\s+(?:file|xuống)|download/.test(lower)) {
    const fileNamePattern = extractQuotedValues(expected)[0];
    return [
      {
        ...source,
        type: 'ASSERT_DOWNLOAD',
        ...(fileNamePattern ? { fileNamePattern } : {}),
      },
    ];
  }

  return [
    {
      ...source,
      type: 'CUSTOM',
      status: 'NEED_MAPPING',
      reason: `Expected result is not deterministically verifiable: ${expected}`,
    },
  ];
}

export class DeterministicTestCaseCompiler implements TestCaseCompiler {
  async compile(testCase: TmsTestCase): Promise<ExecutionPlan> {
    const state: CompilerState = { selectedValues: new Map(), searchFields: [] };
    const parsedActions = testCase.steps.flatMap((step, index) => [
      ...parseStepAction(step, index, state),
      ...parseExpectedResult(step, index, state),
    ]);
    const normalized = normalizeActionDependencies(parsedActions);
    const customReasons = normalized.actions
      .filter((action): action is Extract<ExecutionAction, { type: 'CUSTOM' }> => action.type === 'CUSTOM')
      .map((action) => action.reason);

    const plan: ExecutionPlan = {
      version: 1,
      testCaseId: testCase.testCaseId,
      title: testCase.title,
      description: testCase.description,
      rawTestCase: testCase,
      requirements: parseRequirements(testCase.description),
      actions: normalized.actions,
      unsupportedReasons: [...new Set([...customReasons, ...normalized.unsupportedReasons])],
      normalizationNotes: normalized.notes,
    };

    return executionPlanSchema.parse(plan) as ExecutionPlan;
  }
}

export class AiTestCaseCompiler implements TestCaseCompiler {
  async compile(_testCase: TmsTestCase): Promise<ExecutionPlan> {
    void _testCase;
    throw new Error(
      'AiTestCaseCompiler is an extension point only. Configure a provider and schema-validated implementation before use.',
    );
  }
}
