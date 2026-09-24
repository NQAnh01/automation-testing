import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from '@playwright/test';
import type { AutomationConfig } from '../config/env';
import type { UiRegistry } from '../ui/registry';
import { resolveElement } from '../ui/resolver';

export interface AuthenticationPreparation {
  storageStatePath?: string;
  issue?: string;
}

export async function prepareAuthentication(
  browser: Browser,
  config: AutomationConfig,
  registry: UiRegistry,
): Promise<AuthenticationPreparation> {
  if (config.authMode === 'none') return {};

  if (config.authMode === 'storage-state') {
    try {
      await access(config.authStorageState);
      return { storageStatePath: config.authStorageState };
    } catch {
      return { issue: `AUTH_MODE=storage-state but ${config.authStorageState} does not exist.` };
    }
  }

  if (!config.appBaseUrl) return { issue: 'APP_BASE_URL is required for AUTH_MODE=form.' };
  if (!config.testUsername || !config.testPassword) {
    return { issue: 'TEST_USERNAME and TEST_PASSWORD are required for AUTH_MODE=form.' };
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(config.appBaseUrl);
    const username = await resolveElement(page, registry, 'Tên đăng nhập');
    const password = await resolveElement(page, registry, 'Mật khẩu');
    const submit = await resolveElement(page, registry, 'Đăng nhập');
    await username.locator.fill(config.testUsername);
    await password.locator.fill(config.testPassword);
    await submit.locator.click();
    await page.waitForLoadState('networkidle');
    await mkdir(path.dirname(config.authStorageState), { recursive: true });
    await context.storageState({ path: config.authStorageState });
    return { storageStatePath: config.authStorageState };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      issue:
        `Form login could not be completed: ${message} ` +
        'Add verified mappings for "Tên đăng nhập", "Mật khẩu", and "Đăng nhập".',
    };
  } finally {
    await context.close();
  }
}
