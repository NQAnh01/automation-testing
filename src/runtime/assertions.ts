import { expect, type Locator } from '@playwright/test';

export async function assertVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
}

export async function assertHidden(locator: Locator): Promise<void> {
  await expect(locator).toBeHidden();
}

export async function assertText(locator: Locator, expected: string): Promise<void> {
  await expect(locator).toContainText(expected);
}

export async function assertValue(locator: Locator, expected: string): Promise<void> {
  await expect(locator).toHaveValue(expected);
}

export async function assertContainsAll(
  locator: Locator,
  includedValues: string[],
  excludedValues: string[] = [],
): Promise<void> {
  for (const value of includedValues) await expect(locator).toContainText(value);
  for (const value of excludedValues) await expect(locator).not.toContainText(value);
}
