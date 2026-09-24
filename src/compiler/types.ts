import type { TmsTestCase } from '../tms/types';

export type RequirementRule =
  | {
      type: 'RESULT_INCLUDED' | 'RESULT_EXCLUDED';
      criteria: Record<string, string | boolean | number>;
      raw: string;
    }
  | {
      type: 'CUSTOM';
      raw: string;
      reason: string;
    };

interface ActionSource {
  sourceStepIndex: number;
  rawAction: string;
  rawData: string;
  rawExpectedResult: string;
}

export type ExecutionAction =
  | (ActionSource & { type: 'OPEN_PAGE'; url: string })
  | (ActionSource & { type: 'OPEN_MODAL'; target: string })
  | (ActionSource & { type: 'CLICK'; target: string })
  | (ActionSource & { type: 'SELECT'; target: string; value: string })
  | (ActionSource & { type: 'FILL'; target: string; value: string })
  | (ActionSource & { type: 'FILL_SEARCH_FIELDS'; fields: string[] })
  | (ActionSource & { type: 'SEARCH'; target: string })
  | (ActionSource & {
      type: 'WAIT_FOR_RESPONSE';
      urlPattern: string;
      method?: string;
      status?: number;
    })
  | (ActionSource & { type: 'ASSERT_VISIBLE'; target: string })
  | (ActionSource & { type: 'ASSERT_HIDDEN'; target: string })
  | (ActionSource & { type: 'ASSERT_TEXT'; target: string; expected: string })
  | (ActionSource & { type: 'ASSERT_VALUE'; target: string; expected: string })
  | (ActionSource & {
      type: 'ASSERT_SEARCH_RESULT';
      criteria: Record<string, string>;
    })
  | (ActionSource & {
      type: 'ASSERT_RESULT_INCLUDED' | 'ASSERT_RESULT_EXCLUDED';
      criteria: Record<string, string | boolean | number>;
    })
  | (ActionSource & { type: 'DOWNLOAD'; target: string })
  | (ActionSource & { type: 'ASSERT_DOWNLOAD'; fileNamePattern?: string })
  | (ActionSource & {
      type: 'CUSTOM';
      status: 'NEED_MAPPING';
      reason: string;
    });

export interface ExecutionPlan {
  version: 1;
  testCaseId: string;
  title: string;
  description: string;
  rawTestCase: TmsTestCase;
  requirements: RequirementRule[];
  actions: ExecutionAction[];
  unsupportedReasons: string[];
  normalizationNotes: string[];
}

export interface TestCaseCompiler {
  compile(testCase: TmsTestCase): Promise<ExecutionPlan>;
}
