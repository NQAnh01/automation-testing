import axios, { type AxiosInstance } from 'axios';
import type { AutomationConfig } from '../config/env';
import { adaptTaskTestCases } from './adapter';
import type { TmsTestCase } from './types';

const TASK_ID_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/i;

export class TmsClient {
  private readonly http: AxiosInstance;

  constructor(private readonly config: AutomationConfig) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (config.tmsToken) {
      headers[config.tmsAuthHeader] = config.tmsAuthScheme
        ? `${config.tmsAuthScheme} ${config.tmsToken}`.trim()
        : config.tmsToken;
    }

    this.http = axios.create({
      baseURL: config.tmsBaseUrl,
      timeout: 30_000,
      headers,
    });
  }

  async getTaskTestCases(taskId: string): Promise<TmsTestCase[]> {
    const normalizedTaskId = taskId.trim().toUpperCase();
    if (!TASK_ID_PATTERN.test(normalizedTaskId)) {
      throw new Error(`Invalid task ID: "${taskId}". Expected a value such as TT-1240.`);
    }

    try {
      const response = await this.http.get(
        `/api/tasks/task/${encodeURIComponent(normalizedTaskId)}/testcases`,
      );
      return adaptTaskTestCases(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const suffix = status ? ` (HTTP ${status})` : '';
        throw new Error(`Unable to fetch test cases for ${normalizedTaskId}${suffix}.`, {
          cause: error,
        });
      }
      throw error;
    }
  }
}

export function createTmsClient(config: AutomationConfig): TmsClient {
  return new TmsClient(config);
}
