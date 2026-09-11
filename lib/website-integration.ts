import { availabilityPath } from './public-booking';
export const integrationTools = [
  {
    id: 'book',
    title: 'Book Online',
    description:
      'Let clients browse your packages and start an online booking request.',
    group: 'links',
  },
  {
    id: 'package',
    title: 'Link to a specific package',
    description:
      'Skip the package selector and link to one package, service or package group.',
    group: 'links',
  },
  {
    id: 'signin',
    title: 'Sign In',
    description:
      'Help returning customers reach their connected customer account.',
    group: 'links',
  },
  {
    id: 'lead',
    title: 'Lead Forms',
    description: 'Embed a contact form. Submissions appear in your Leads.',
    group: 'widgets',
  },
  {
    id: 'addons',
    title: 'Add-on Gallery',
    description:
      'Show available extras with optional pricing and booking buttons.',
    group: 'widgets',
  },
  {
    id: 'backdrops',
    title: 'Backdrop Gallery',
    description:
      'Display backdrops with title, pricing and pagination options.',
    group: 'widgets',
  },
  {
    id: 'designs',
    title: 'Design Template Gallery',
    description: 'Display design collections with category filters.',
    group: 'widgets',
  },
  {
    id: 'staff',
    title: 'Staff Profiles',
    description: 'Display team members enabled for your staff gallery.',
    group: 'widgets',
  },
  {
    id: 'availability',
    title: 'Booking Availability Calendar',
    description:
      'Let clients choose a date and check a package before requesting a booking.',
    group: 'widgets',
  },
  {
    id: 'appointments',
    title: 'Appointment Scheduler',
    description: 'Embed an active staff appointment calendar.',
    group: 'widgets',
  },
  {
    id: 'mini',
    title: 'Mini Sessions',
    description: 'Link to a mini-session booking destination when connected.',
    group: 'widgets',
  },
] as const;
export type IntegrationKind = (typeof integrationTools)[number]['id'];
export type EmbedStyle =
  | 'Link Only'
  | 'Customized Link'
  | 'Button'
  | 'Embed on my site';
export type WidgetOptions = {
  embed: boolean;
  button: boolean;
  buttonText: string;
  price: boolean;
  showTitle: boolean;
  showTags: boolean;
  categoryIds: string[];
  packageIds: string[];
  bookingPackage: string;
  customBookingUrl: string;
  availableMessage: string;
  unavailableMessage: string;
  compatibility: boolean;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  font: string;
  maxWidth: number;
  labelWeight: number;
  labelSize: number;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  inputBackground: string;
  wideButtons: boolean;
  placeholders: boolean;
  pageSize: number;
  height: number;
};
export const widgetDefaults = (): WidgetOptions => ({
  embed: false,
  button: true,
  buttonText: 'Book Now',
  price: true,
  showTitle: true,
  showTags: true,
  categoryIds: [],
  packageIds: [],
  bookingPackage: '',
  customBookingUrl: '',
  availableMessage:
    'This package is currently available. Continue to request your booking; the business will review your request.',
  unavailableMessage:
    'Online booking is unavailable for this date. Choose another date or contact the business.',
  compatibility: false,
  textColor: '#25324a',
  buttonColor: '#315ee8',
  buttonTextColor: '#ffffff',
  font: 'Arial, sans-serif',
  maxWidth: 1000,
  labelWeight: 500,
  labelSize: 16,
  borderWidth: 1,
  borderColor: '#d4dce8',
  borderRadius: 8,
  inputBackground: '#ffffff',
  wideButtons: false,
  placeholders: false,
  pageSize: 12,
  height: 800,
});
export function safeHttps(value: unknown) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
  } catch {
    return '';
  }
}
export const htmlEscape = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
export function widgetOptions(input: unknown): WidgetOptions {
  const defaults = widgetDefaults(),
    o =
      input && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
  const result = { ...defaults };
  for (const k of [
    'embed',
    'button',
    'price',
    'showTitle',
    'showTags',
    'compatibility',
    'wideButtons',
    'placeholders',
  ] as const)
    if (typeof o[k] === 'boolean') result[k] = o[k];
  for (const k of [
    'buttonText',
    'availableMessage',
    'unavailableMessage',
  ] as const)
    if (typeof o[k] === 'string')
      result[k] = o[k].slice(0, k === 'buttonText' ? 100 : 1000);
  for (const k of [
    'textColor',
    'buttonColor',
    'buttonTextColor',
    'borderColor',
    'inputBackground',
  ] as const)
    if (/^#[0-9a-f]{6}$/i.test(String(o[k]))) result[k] = String(o[k]);
  for (const [k, min, max] of [
    ['maxWidth', 280, 1600],
    ['labelWeight', 100, 900],
    ['labelSize', 14, 32],
    ['borderWidth', 0, 6],
    ['borderRadius', 0, 48],
    ['pageSize', 1, 100],
    ['height', 250, 2000],
  ] as const)
    if (typeof o[k] === 'number' && Number.isFinite(o[k]))
      result[k] = Math.min(max, Math.max(min, Math.round(o[k])));
  if (typeof o.font === 'string' && /^[a-zA-Z0-9 ,-]{1,100}$/.test(o.font))
    result.font = o.font;
  for (const k of ['categoryIds', 'packageIds'] as const)
    if (Array.isArray(o[k]))
      result[k] = [
        ...new Set(
          o[k].filter(
            (v): v is string =>
              typeof v === 'string' && /^[a-zA-Z0-9_:\-. ]{1,150}$/.test(v),
          ),
        ),
      ].slice(0, 50);
  if (
    typeof o.bookingPackage === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(o.bookingPackage)
  )
    result.bookingPackage = o.bookingPackage;
  result.customBookingUrl = safeHttps(o.customBookingUrl);
  return result;
}
export function optionsFromQuery(q: Record<string, string>) {
  let raw: unknown = {};
  try {
    raw = JSON.parse((q.widget || '{}').slice(0, 16000));
  } catch {}
  return widgetOptions(raw);
}
export function integrationPath(
  kind: IntegrationKind,
  selection: {
    business: string;
    packageId?: string;
    service?: string;
    group?: string;
    formId?: string;
    staffId?: string;
    calendarId?: string;
    externalUrl?: string;
  },
  options: WidgetOptions,
) {
  const s = selection;
  let path = '';
  if (kind === 'book') path = availabilityPath(s.business);
  if (kind === 'package')
    path = s.packageId
      ? '/book/' + encodeURIComponent(s.packageId)
      : s.service
        ? availabilityPath(s.business) +
          '&' +
          new URLSearchParams({
            service: s.service,
            ...(s.group !== undefined ? { group: s.group } : {}),
          })
        : '';
  if (kind === 'signin' || kind === 'mini') return safeHttps(s.externalUrl);
  if (kind === 'lead' && s.formId)
    path = '/inquiry/' + encodeURIComponent(s.formId);
  if (['addons', 'backdrops', 'designs', 'staff'].includes(kind))
    path = '/gallery/' + encodeURIComponent(s.business) + '?kind=' + kind;
  if (kind === 'availability')
    path = '/widgets/availability/' + encodeURIComponent(s.business);
  if (kind === 'appointments' && s.staffId)
    path =
      '/schedule/' +
      encodeURIComponent(s.staffId) +
      (s.calendarId ? '?calendar=' + encodeURIComponent(s.calendarId) : '');
  if (
    path &&
    [
      'lead',
      'addons',
      'backdrops',
      'designs',
      'staff',
      'availability',
      'appointments',
    ].includes(kind)
  )
    path +=
      (path.includes('?') ? '&' : '?') +
      new URLSearchParams({ widget: JSON.stringify(widgetOptions(options)) });
  return path;
}
export function integrationCode(
  origin: string,
  path: string,
  style: EmbedStyle,
  title: string,
  input: WidgetOptions,
) {
  if (!path) return '';
  const o = widgetOptions(input),
    url = new URL(path, origin).href,
    href = htmlEscape(url),
    label = htmlEscape(o.buttonText || title);
  if (style === 'Link Only') return url;
  if (style === 'Customized Link')
    return `<a href="${href}" target="_top">${label}</a>`;
  if (style === 'Button')
    return `<a href="${href}" target="_top" style="display:inline-block;padding:12px 20px;background:${o.buttonColor};color:${o.buttonTextColor};font-family:${o.font};font-size:16px;text-decoration:none;border-radius:${o.borderRadius}px">${label}</a>`;
  if (o.compatibility)
    return `<iframe src="${href}" title="${htmlEscape(title)}" width="100%" height="${o.height}" loading="lazy" style="border:0;max-width:${o.maxWidth}px"></iframe>\n<a href="${href}" target="_blank" rel="noopener">Open ${htmlEscape(title)}</a>`;
  return `<div class="eventdesk-widget-embed" data-eventdesk-src="${href}" data-eventdesk-title="${htmlEscape(title)}" data-eventdesk-height="${o.height}" style="max-width:${o.maxWidth}px"></div>\n<script src="${htmlEscape(new URL('/eventdesk-widgets.js', origin).href)}" async></script>`;
}
