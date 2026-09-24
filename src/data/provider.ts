import { normalizeLookupKey } from '../compiler/normalizer';
import type {
  OrderCriteria,
  OrderTestData,
  SearchExpectation,
  TestDataProvider,
} from './types';

interface StaticDataShape {
  fields?: Record<string, string>;
  orders?: OrderTestData[];
  searchExpectations?: Array<{
    criteria: Record<string, string>;
    includedOrderCodes?: string[];
    excludedOrderCodes?: string[];
  }>;
}

function matchesCriteria(order: OrderTestData, criteria: OrderCriteria): boolean {
  return Object.entries(criteria).every(([key, expected]) => {
    if (key === 'requiredFields' || expected === undefined || Array.isArray(expected)) return true;
    return String(order[key] ?? '').toLocaleLowerCase('vi-VN') === String(expected).toLocaleLowerCase('vi-VN');
  });
}

export class StaticTestDataProvider implements TestDataProvider {
  private readonly data: StaticDataShape;

  constructor(json?: string) {
    if (!json) {
      this.data = {};
      return;
    }
    try {
      this.data = JSON.parse(json) as StaticDataShape;
    } catch (error) {
      throw new Error('TEST_DATA_JSON must be valid JSON.', { cause: error });
    }
  }

  async resolveFields(fields: string[]): Promise<Record<string, string> | null> {
    const configured = this.data.fields ?? {};
    const byNormalizedKey = new Map(
      Object.entries(configured).map(([key, value]) => [normalizeLookupKey(key), value]),
    );
    const resolved: Record<string, string> = {};
    for (const field of fields) {
      const value = byNormalizedKey.get(normalizeLookupKey(field));
      if (value === undefined) return null;
      resolved[field] = value;
    }
    return resolved;
  }

  async findOrder(criteria: OrderCriteria): Promise<OrderTestData | null> {
    const order = (this.data.orders ?? []).find((candidate) => matchesCriteria(candidate, criteria));
    if (!order) return null;
    const requiredFields = criteria.requiredFields ?? [];
    if (requiredFields.some((field) => order[field] === undefined)) return null;
    return order;
  }

  async getSearchExpectation(criteria: Record<string, string>): Promise<SearchExpectation | null> {
    const expectation = (this.data.searchExpectations ?? []).find((candidate) =>
      Object.entries(candidate.criteria).every(([key, value]) => criteria[key] === value),
    );
    if (!expectation) return null;
    return {
      includedOrderCodes: expectation.includedOrderCodes ?? [],
      excludedOrderCodes: expectation.excludedOrderCodes ?? [],
    };
  }
}
