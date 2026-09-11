import { text } from './crm';
export type CatalogPresentation = { showTitle: boolean; subheader: string };
export function catalogPresentation(
  data?: Record<string, unknown>,
): CatalogPresentation {
  return {
    showTitle: data?.showTitle !== false,
    subheader: String(data?.subheader || ''),
  };
}
export function validateCatalogPresentation(
  input: unknown,
): CatalogPresentation {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('Invalid booking-page settings.');
  const data = input as Record<string, unknown>;
  if (
    Object.keys(data).some((k) => !['showTitle', 'subheader'].includes(k)) ||
    typeof data.showTitle !== 'boolean'
  )
    throw Error('Invalid booking-page settings.');
  return {
    showTitle: data.showTitle,
    subheader: text(data.subheader, 'Subheader', 500, false),
  };
}
