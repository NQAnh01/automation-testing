import type { Locator, Page } from '@playwright/test';
import type { LocatorDefinition, UiElementDefinition, UiRegistry } from './registry';

export class UnknownUiTargetError extends Error {
  constructor(readonly target: string) {
    super(`Unknown UI target: "${target}". Add it to the UI registry or an alias list.`);
    this.name = 'UnknownUiTargetError';
  }
}

export class UiElementNotFoundError extends Error {
  constructor(readonly target: string, readonly key: string) {
    super(`UI mapping "${key}" for target "${target}" did not match any element.`);
    this.name = 'UiElementNotFoundError';
  }
}

function locatorFromDefinition(page: Page, definition: LocatorDefinition): Locator[] {
  switch (definition.strategy) {
    case 'role':
      return [
        page.getByRole(definition.role, {
          ...(definition.name ? { name: definition.name, exact: true } : {}),
        }),
      ];
    case 'label':
      return [page.getByLabel(definition.value, { exact: true })];
    case 'placeholder':
      return [page.getByPlaceholder(definition.value, { exact: true })];
    case 'testId':
      return [page.getByTestId(definition.value)];
    case 'css':
      return [page.locator(definition.value)];
    case 'candidates':
      return definition.values.flatMap((candidate) => locatorFromDefinition(page, candidate));
  }
}

export interface ResolvedUiElement {
  definition: UiElementDefinition;
  locator: Locator;
}

export async function resolveElement(
  page: Page,
  registry: UiRegistry,
  target: string,
  options: { useTrigger?: boolean; allowMissing?: boolean } = {},
): Promise<ResolvedUiElement> {
  const definition = registry.resolve(target);
  if (!definition) throw new UnknownUiTargetError(target);

  const locatorDefinition = options.useTrigger ? definition.trigger : definition.locator;
  if (!locatorDefinition) {
    throw new UnknownUiTargetError(`${target} (${options.useTrigger ? 'trigger' : 'element'})`);
  }

  const candidates = locatorFromDefinition(page, locatorDefinition);
  for (const candidate of candidates) {
    if ((await candidate.count()) > 0) {
      return { definition, locator: candidate.first() };
    }
  }

  if (options.allowMissing && candidates[0]) {
    return { definition, locator: candidates[0] };
  }
  throw new UiElementNotFoundError(target, definition.key);
}
