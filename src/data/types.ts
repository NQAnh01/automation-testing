export interface OrderCriteria {
  [key: string]: string | boolean | number | string[] | undefined;
  requiredFields?: string[];
}

export interface OrderTestData {
  orderCode: string;
  customerCode?: string;
  po?: string;
  qaStatus?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface SearchExpectation {
  includedOrderCodes: string[];
  excludedOrderCodes: string[];
}

export interface TestDataProvider {
  resolveFields(fields: string[], hints?: Record<string, string>): Promise<Record<string, string> | null>;
  findOrder(criteria: OrderCriteria): Promise<OrderTestData | null>;
  getSearchExpectation(criteria: Record<string, string>): Promise<SearchExpectation | null>;
}
