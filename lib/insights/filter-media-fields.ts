export function filterFieldsForEndpoint(
  fields: string[],
  endpoint: 'account_media' | 'tagged_media'
): string[] {
  if (endpoint !== 'tagged_media') {
    return fields;
  }
  const unsupported = ['username'];

  return fields.filter((field) => !unsupported.includes(field));
}
