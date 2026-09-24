import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DeterministicTestCaseCompiler } from './compiler';
import type { TmsTestCase } from '../tms/types';

function testCase(overrides: Partial<TmsTestCase> = {}): TmsTestCase {
  return {
    testCaseId: 'TTTC-1',
    title: 'Compiler sample',
    description: '',
    steps: [],
    ...overrides,
  };
}

describe('DeterministicTestCaseCompiler', () => {
  const compiler = new DeterministicTestCaseCompiler();

  it('compiles opening the order search modal', async () => {
    const plan = await compiler.compile(
      testCase({
        steps: [
          {
            action: 'Mở modal [Tìm kiếm đơn hàng]',
            data: '',
            expectedResult: 'Hiển thị modal [Tìm kiếm đơn hàng]',
          },
        ],
      }),
    );

    assert.deepEqual(plan.actions.map((action) => action.type), [
      'OPEN_MODAL',
      'ASSERT_VISIBLE',
    ]);
    assert.equal('target' in plan.actions[0]! ? plan.actions[0].target : undefined, 'Tìm kiếm đơn hàng');
  });

  it('compiles a dropdown selection with its value', async () => {
    const plan = await compiler.compile(
      testCase({
        steps: [
          {
            action: 'Click vào dropdown "Tình trạng QA"',
            data: 'Chọn trạng thái "Tái chế"',
            expectedResult: '',
          },
        ],
      }),
    );

    const action = plan.actions[0];
    assert.equal(action?.type, 'SELECT');
    if (action?.type === 'SELECT') {
      assert.equal(action.target, 'Tình trạng QA');
      assert.equal(action.value, 'Tái chế');
    }
  });

  it('does not guess an unknown action', async () => {
    const plan = await compiler.compile(
      testCase({
        steps: [{ action: 'Thực hiện phép thuật', data: '', expectedResult: '' }],
      }),
    );

    assert.equal(plan.actions[0]?.type, 'CUSTOM');
    if (plan.actions[0]?.type === 'CUSTOM') assert.equal(plan.actions[0].status, 'NEED_MAPPING');
    assert.equal(plan.unsupportedReasons.length, 1);
  });

  it('moves a single modal opening before dependent input actions', async () => {
    const plan = await compiler.compile(
      testCase({
        steps: [
          {
            action: 'Click vào dropdown "Tình trạng QA"',
            data: 'Chọn trạng thái "Tái chế"',
            expectedResult: '',
          },
          { action: 'Mở modal [Tìm kiếm đơn hàng]', data: '', expectedResult: '' },
        ],
      }),
    );

    assert.deepEqual(plan.actions.map((action) => action.type), ['OPEN_MODAL', 'SELECT']);
    assert.equal(plan.normalizationNotes.length, 1);
  });

  it('compiles combined search fields and a business-result assertion', async () => {
    const plan = await compiler.compile(
      testCase({
        steps: [
          {
            action: 'Kiểm tra tìm kiếm [Mã/tên đơn hàng + Tình trạng lập HSSX]',
            data: 'Bấm tìm kiếm',
            expectedResult: 'Trả về kết quả tìm kiếm chính xác các đơn hàng',
          },
        ],
      }),
    );

    assert.deepEqual(plan.actions.map((action) => action.type), [
      'FILL_SEARCH_FIELDS',
      'SEARCH',
      'ASSERT_SEARCH_RESULT',
    ]);
  });
});
