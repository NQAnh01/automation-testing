import type { Page, Request } from '@playwright/test';

export interface NetworkRecord {
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  failed?: boolean;
}

const SENSITIVE_QUERY_KEYS = /token|password|secret|authorization|cookie|key/i;

function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.test(key)) url.searchParams.set(key, '[REDACTED]');
    }
    return url.toString();
  } catch {
    return rawUrl.replace(/(token|password|secret|authorization)=([^&\s]+)/gi, '$1=[REDACTED]');
  }
}

export class NetworkCollector {
  private readonly startedAt = new Map<Request, number>();
  private readonly records: NetworkRecord[] = [];

  attach(page: Page): void {
    page.on('request', (request) => {
      this.startedAt.set(request, Date.now());
    });
    page.on('response', (response) => {
      const request = response.request();
      const start = this.startedAt.get(request);
      this.records.push({
        method: request.method(),
        url: redactUrl(request.url()),
        status: response.status(),
        ...(start ? { durationMs: Date.now() - start } : {}),
      });
      this.startedAt.delete(request);
    });
    page.on('requestfailed', (request) => {
      const start = this.startedAt.get(request);
      this.records.push({
        method: request.method(),
        url: redactUrl(request.url()),
        failed: true,
        ...(start ? { durationMs: Date.now() - start } : {}),
      });
      this.startedAt.delete(request);
    });
  }

  snapshot(): NetworkRecord[] {
    return [...this.records];
  }

  async waitFor(
    page: Page,
    urlPattern: string,
    options: { method?: string; status?: number; timeoutMs?: number } = {},
  ): Promise<NetworkRecord> {
    const matches = (record: NetworkRecord) =>
      record.url.includes(urlPattern) &&
      (!options.method || record.method === options.method.toUpperCase()) &&
      (options.status === undefined || record.status === options.status);
    const existing = this.records.find(matches);
    if (existing) return existing;

    const response = await page.waitForResponse(
      (candidate) => {
        const request = candidate.request();
        return (
          redactUrl(candidate.url()).includes(urlPattern) &&
          (!options.method || request.method() === options.method.toUpperCase()) &&
          (options.status === undefined || candidate.status() === options.status)
        );
      },
      { timeout: options.timeoutMs ?? 10_000 },
    );
    return {
      method: response.request().method(),
      url: redactUrl(response.url()),
      status: response.status(),
    };
  }
}
