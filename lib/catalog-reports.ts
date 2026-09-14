import type { Data } from './crm';
import type { ReportFilter } from './sales-reports';
import { packageSettings } from './package-config';
import { durationRules } from './package-pricing';
import { orderedPackages } from './package-manager';
import { effectiveExtra, ordered } from './manage-config';

export const catalogReports = ['Packages', 'Add-ons', 'Backdrops'];
export const catalogSorts = ['Name (A–Z)', 'Name (Z–A)', 'Status', 'Price (low to high)', 'Price (high to low)', 'Position'];
export const catalogStatuses = (name: string) => name === 'Packages'
  ? ['All', 'Public', 'Private', 'Disabled', 'Public + Private']
  : ['All', 'Active', 'Archived'];
const packageColumns = ['Package ID', 'Title', 'Subtitle', 'Package Group', 'Service', 'Status', 'Booking Mode', 'Date Mode', 'Calendar Mode', 'Starting Rate USD', 'Included Hours', 'Minimum Hours', 'Maximum Hours', 'Price per Extra Hour USD', 'Included Days', 'Minimum Days', 'Maximum Days', 'Price per Extra Day USD', 'Unit Pricing', 'Taxable', 'Deposit', 'Backdrop Required'];
const extraColumns = ['ID', 'Name', 'Category', 'Description', 'Status', 'Price USD', 'Taxable', 'Max Quantity', 'Unit Multiplier Enabled', 'Pricing Method', 'Lead Time (days)', 'Displayed in Website Widget'];
export const catalogColumns = (name: string) => name === 'Packages' ? packageColumns : extraColumns.filter((c) => name === 'Add-ons' || !['Max Quantity', 'Unit Multiplier Enabled', 'Pricing Method'].includes(c));
export const defaultCatalogColumns = (name: string) => name === 'Packages'
  ? ['Title', 'Package Group', 'Service', 'Status', 'Starting Rate USD', 'Included Hours', 'Included Days', 'Price per Extra Hour USD', 'Taxable', 'Deposit']
  : ['Name', 'Category', 'Status', 'Price USD', 'Taxable'];
export const catalogKind = (name: string) => name === 'Add-ons' ? 'addons' : 'backdrops';
export function catalogCategories(data: Data, name: string) {
  return (data.resources || []).filter((r) => r.kind === 'categories' && r.data.ownerKind === catalogKind(name));
}
export function catalogGroups(data: Data, service = '') {
  return [...new Set(data.packages.filter((p) => !service || p.service === service).map((p) => p.settings?.group || ''))].sort();
}
const yes = (value: unknown) => value ? 'Yes' : 'No';
const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

// Reads only the catalog already scoped to the signed-in business by the API.
// Values describe current configuration, never revenue or historical quotes.
export function buildCatalogReport(data: Data, name: string, f: ReportFilter) {
  const columns = catalogColumns(name), selected = columns.filter((c) => f.columns?.includes(c));
  const headers = selected.length ? selected : defaultCatalogColumns(name);
  const resources = data.resources || [], categories = catalogCategories(data, name);
  const status = f.catalogStatus || (name === 'Packages' ? 'All' : 'Active');
  let entries: { id: string; title: string; status: string; price: number; position: number; values: Record<string, unknown> }[];
  if (name === 'Packages') {
    entries = orderedPackages(data).filter((p) => (!f.service || p.service === f.service) && (!f.packageGroup || (p.settings?.group || '') === (f.packageGroup === '__ungrouped__' ? '' : f.packageGroup))).map((p, position) => {
      const s = packageSettings(p.settings, p.duration), rules = durationRules(s);
      let deposit = s.depositMode === 'None' ? 'None' : s.depositMode === 'Flat rate' ? usd(s.depositValue) : s.depositMode === 'Percentage' ? `${s.depositValue}%` : 'Business default';
      if (s.depositMode === 'Business default') {
        const mode = data.settings?.depositMode, value = Number(data.settings?.depositValue || 0);
        deposit += mode === 'Percentage' ? ` (${value}%)` : mode === 'Fixed amount' ? ` (${usd(value)})` : ' (none)';
      }
      return { id: p.id, title: p.name, status: s.status, price: p.price / 100, position, values: {
        'Package ID': p.id, Title: p.name, Subtitle: s.subheader, 'Package Group': s.group || 'Ungrouped', Service: p.service, Status: s.status,
        'Booking Mode': s.bookingMode, 'Date Mode': s.dateMode, 'Calendar Mode': s.picker, 'Starting Rate USD': p.price / 100,
        'Included Hours': rules.dayBased ? '—' : rules.included / 60, 'Minimum Hours': rules.dayBased ? '—' : rules.min / 60, 'Maximum Hours': rules.dayBased ? '—' : rules.max / 60,
        'Price per Extra Hour USD': !rules.dayBased && s.extraHours ? s.extraRate : '—',
        'Included Days': rules.dayBased ? rules.included / 1440 : '—', 'Minimum Days': rules.dayBased ? rules.min / 1440 : '—', 'Maximum Days': rules.dayBased ? rules.max / 1440 : '—',
        'Price per Extra Day USD': rules.dayBased && s.extraDays ? s.dailyRate : '—', 'Unit Pricing': s.unitMode, Taxable: yes(s.taxable), Deposit: deposit, 'Backdrop Required': yes(s.requireBackdrop),
      } };
    });
  } else {
    entries = ordered(resources.filter((r) => r.kind === catalogKind(name)))
      .filter((r) => !f.categoryId || (f.categoryId === '__uncategorized__' ? !r.data.categoryId : r.data.categoryId === f.categoryId))
      .map((r, position) => {
        const value = effectiveExtra(r, resources).data, category = categories.find((c) => c.id === r.data.categoryId);
        const price = Number(value.price || 0), state = r.archived ? 'Archived' : 'Active';
        return { id: r.id, title: r.name, status: state, price, position, values: {
          ID: r.id, Name: r.name, Category: category ? category.name + (category.archived ? ' (archived)' : '') : r.data.categoryId ? 'Unavailable category' : 'Uncategorized',
          Description: String(value.description || ''), Status: state, 'Price USD': price, Taxable: yes(value.taxable !== false),
          'Max Quantity': Number(value.maxQuantity ?? 1), 'Unit Multiplier Enabled': yes(['Multiply by package hours', 'Multiply by package days'].includes(String(value.pricingMethod))),
          'Pricing Method': String(value.pricingMethod || 'Flat rate / per unit'), 'Lead Time (days)': Number(value.leadDays || 0), 'Displayed in Website Widget': yes(value.showGallery),
        } };
      });
  }
  entries = entries.filter((r) => (status === 'All' || (status === 'Public + Private' ? r.status !== 'Disabled' : r.status === status)) && (!f.search || Object.values(r.values).some((v) => String(v ?? '').toLowerCase().includes(f.search.trim().toLowerCase()))));
  const sort = f.sort || 'Name (A–Z)';
  entries.sort((a, b) => (sort === 'Position' ? a.position - b.position : sort === 'Status' ? a.status.localeCompare(b.status) : sort.startsWith('Price') ? (a.price - b.price) * (sort === 'Price (high to low)' ? -1 : 1) : 0) || a.title.localeCompare(b.title) * (sort === 'Name (Z–A)' ? -1 : 1) || a.id.localeCompare(b.id));
  return { headers, columns, rows: entries.map((r) => headers.map((c) => r.values[c])), recordIds: entries.map((r) => r.id), error: '',
    note: name === 'Packages' ? 'Current package settings and starting prices in USD. Deposits show the configured rule; the final amount depends on the booking. Date filters do not apply.' : 'Current catalog prices in USD. Backdrop price and lead-time defaults come from the active category. Gallery visibility shows the saved setting; package and category restrictions still apply. Date filters do not apply.' };
}
