import { rawDb } from './raw';
import { publicBusiness } from './manage-public';
import { defaultLeadFields, details, appliesTo } from '@/lib/manage-config';
import type { Resource } from '@/lib/settings';
export async function leadFormContext(id: string) {
  const row = await rawDb()
    .prepare(
      "SELECT business_id FROM resources WHERE id=? AND kind='lead_forms' AND archived=0",
    )
    .bind(id)
    .first<{ business_id: string }>();
  if (!row) return null;
  const b = await publicBusiness(row.business_id);
  if (!b) return null;
  const form = b.resources.find((r) => r.id === id)!;
  const d = details(form);
  const packages = (
    await rawDb()
      .prepare('SELECT id,name,service FROM packages WHERE business_id=?')
      .bind(b.id)
      .all<{ id: string; name: string; service: string }>()
  ).results.filter(
    (p) => b.publicPackageIds.includes(p.id) && appliesTo(form, [p.id]),
  );
  return {
    b,
    form,
    fields: d.leadFields.length ? d.leadFields : defaultLeadFields(),
    questions: d.fields,
    packages,
  };
}
export type LeadFormContext = NonNullable<
  Awaited<ReturnType<typeof leadFormContext>>
>;
