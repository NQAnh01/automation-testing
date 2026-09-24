import type { Page } from '@playwright/test';
import type { TestDataProvider } from '../data/types';
import type { UiRegistry } from '../ui/registry';
import type { NetworkCollector } from './network';

export interface RuntimeLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface DownloadArtifact {
  suggestedFilename: string;
  path: string;
}

export interface RuntimeContext {
  page: Page;
  testCaseId: string;
  appBaseUrl: string;
  outputDir: string;
  registry: UiRegistry;
  dataProvider: TestDataProvider;
  network: NetworkCollector;
  downloads: DownloadArtifact[];
  logger: RuntimeLogger;
}
