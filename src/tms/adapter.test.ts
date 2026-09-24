import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adaptTaskTestCases } from './adapter';

describe('adaptTaskTestCases', () => {
  it('keeps only execution fields and normalizes nullable text', () => {
    const result = adaptTaskTestCases({
      success: true,
      data: [{
        id: 'internal-id',
        testCaseId: 'TTTC-2614',
        title: ' Search order ',
        description: null,
        watchers: ['ignored'],
        steps: [{ action: ' Open ', data: null, expectedResult: ' Visible ' }],
      }],
    });
    assert.deepEqual(result, [{
      testCaseId: 'TTTC-2614',
      title: 'Search order',
      description: '',
      steps: [{ action: 'Open', data: '', expectedResult: 'Visible' }],
    }]);
  });
});
