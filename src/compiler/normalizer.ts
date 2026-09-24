import type { ExecutionAction } from './types';

export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLookupKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase('vi-VN');
}

export function extractBracketValue(value: string): string | undefined {
  return value.match(/\[([^\]]+)]/)?.[1]?.trim();
}

export function extractQuotedValues(value: string): string[] {
  return [...value.matchAll(/["']([^"']+)["']/g)]
    .map((match) => match[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

export function splitCombinedFields(value: string): string[] {
  const bracketed = extractBracketValue(value);
  if (!bracketed) return [];
  return bracketed
    .split(/\s*\+\s*|\s*,\s*/)
    .map(normalizeText)
    .filter(Boolean);
}

export interface NormalizationResult {
  actions: ExecutionAction[];
  notes: string[];
  unsupportedReasons: string[];
}

const inputActionTypes = new Set<ExecutionAction['type']>([
  'SELECT',
  'FILL',
  'FILL_SEARCH_FIELDS',
]);

export function normalizeActionDependencies(actions: ExecutionAction[]): NormalizationResult {
  const normalized = [...actions];
  const notes: string[] = [];
  const unsupportedReasons: string[] = [];

  if (normalized.some((action) => action.type === 'CUSTOM')) {
    return { actions: normalized, notes, unsupportedReasons };
  }

  const modalIndexes = normalized
    .map((action, index) => (action.type === 'OPEN_MODAL' ? index : -1))
    .filter((index) => index >= 0);
  const firstInputIndex = normalized.findIndex((action) => inputActionTypes.has(action.type));

  if (modalIndexes.length === 1 && firstInputIndex >= 0 && modalIndexes[0]! > firstInputIndex) {
    const modalIndex = modalIndexes[0]!;
    const [modal] = normalized.splice(modalIndex, 1);
    if (modal) {
      normalized.splice(firstInputIndex, 0, modal);
      notes.push('Moved the single OPEN_MODAL before form interactions to satisfy a safe dependency.');
    }
  } else if (modalIndexes.length > 1 && firstInputIndex >= 0) {
    const firstModalIndex = modalIndexes[0]!;
    if (firstModalIndex > firstInputIndex) {
      unsupportedReasons.push(
        'Multiple modals are present and their control dependencies cannot be reordered safely.',
      );
    }
  }

  const searchIndexes = normalized
    .map((action, index) => (action.type === 'SEARCH' ? index : -1))
    .filter((index) => index >= 0);
  const lastInputIndex = normalized.reduce(
    (last, action, index) => (inputActionTypes.has(action.type) ? index : last),
    -1,
  );

  if (searchIndexes.length === 1 && searchIndexes[0]! < lastInputIndex) {
    const searchIndex = searchIndexes[0]!;
    const hasAssertionBetween = normalized
      .slice(searchIndex + 1, lastInputIndex + 1)
      .some((action) => action.type.startsWith('ASSERT_'));
    if (hasAssertionBetween) {
      unsupportedReasons.push(
        'SEARCH appears before input actions, but assertions between them make reordering unsafe.',
      );
    } else {
      const [search] = normalized.splice(searchIndex, 1);
      if (search) {
        const newLastInputIndex = normalized.reduce(
          (last, action, index) => (inputActionTypes.has(action.type) ? index : last),
          -1,
        );
        normalized.splice(newLastInputIndex + 1, 0, search);
        notes.push('Moved SEARCH after filter input actions to satisfy a safe dependency.');
      }
    }
  } else if (searchIndexes.length > 1 && searchIndexes[0]! < lastInputIndex) {
    unsupportedReasons.push('Multiple SEARCH actions prevent safe dependency reordering.');
  }

  return { actions: normalized, notes, unsupportedReasons };
}
