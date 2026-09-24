import { normalizeLookupKey } from '../compiler/normalizer';

export type UiElementType =
  | 'button'
  | 'input'
  | 'select'
  | 'modal'
  | 'date'
  | 'table'
  | 'download';

export type LocatorDefinition =
  | { strategy: 'role'; role: 'button' | 'dialog' | 'combobox' | 'textbox' | 'table' | 'link'; name?: string }
  | { strategy: 'label'; value: string }
  | { strategy: 'placeholder'; value: string }
  | { strategy: 'testId'; value: string }
  | { strategy: 'css'; value: string }
  | { strategy: 'candidates'; values: LocatorDefinition[] };

export interface UiElementDefinition {
  key: string;
  aliases: string[];
  type: UiElementType;
  locator: LocatorDefinition;
  trigger?: LocatorDefinition;
  scope?: string;
  notes?: string;
}

export class UiRegistry {
  private readonly definitions = new Map<string, UiElementDefinition>();
  private readonly aliases = new Map<string, string>();

  register(definition: UiElementDefinition): this {
    if (this.definitions.has(definition.key)) {
      throw new Error(`Duplicate UI registry key: ${definition.key}`);
    }
    this.definitions.set(definition.key, definition);

    for (const alias of [definition.key, ...definition.aliases]) {
      const normalizedAlias = normalizeLookupKey(alias);
      const existing = this.aliases.get(normalizedAlias);
      if (existing && existing !== definition.key) {
        throw new Error(`UI alias "${alias}" is already registered for ${existing}.`);
      }
      this.aliases.set(normalizedAlias, definition.key);
    }
    return this;
  }

  resolve(targetName: string): UiElementDefinition | undefined {
    const key = this.aliases.get(normalizeLookupKey(targetName));
    return key ? this.definitions.get(key) : undefined;
  }

  list(): UiElementDefinition[] {
    return [...this.definitions.values()];
  }
}
