export interface TmsTestStep {
  action: string;
  data: string;
  expectedResult: string;
}

export interface TmsTestCase {
  testCaseId: string;
  title: string;
  description: string;
  preConditions?: string;
  postConditions?: string;
  steps: TmsTestStep[];
}
