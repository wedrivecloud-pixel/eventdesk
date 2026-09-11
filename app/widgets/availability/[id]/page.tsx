import { notFound } from 'next/navigation';
import { packageCatalog } from '@/db/package-catalog';
import { publicBusiness } from '@/db/manage-public';
import { optionsFromQuery } from '@/lib/website-integration';
import AvailabilityWidget from './widget';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params,
    q = await searchParams,
    c = await packageCatalog(id);
  if (!c) notFound();
  const b = await publicBusiness(id);
  if (!b) notFound();
  const options = optionsFromQuery(q),
    packages = c.groups
      .flatMap((g) => g.packages)
      .filter(
        (p) => !options.packageIds.length || options.packageIds.includes(p.id),
      )
      .map((p) => ({ id: p.id, name: p.name, minutes: p.includedMinutes }));
  return (
    <AvailabilityWidget
      business={{
        id,
        name: c.business.name,
        timezone: String(b.settings.timezone || 'America/Los_Angeles'),
      }}
      packages={packages}
      options={options}
    />
  );
}
