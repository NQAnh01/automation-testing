export function safeFileSegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+$/, '_');
  if (!sanitized) throw new Error(`Cannot use empty value as a file path segment: "${value}".`);
  return sanitized;
}
