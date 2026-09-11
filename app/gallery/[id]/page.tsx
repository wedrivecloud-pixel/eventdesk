import { notFound } from 'next/navigation';
import { publicBusiness, publicGalleryRows } from '@/db/manage-public';
import { availabilityPath } from '@/lib/public-booking';
import { optionsFromQuery } from '@/lib/website-integration';
import GalleryView from './gallery';
import { bookingContext } from '@/db/public-booking';
export const dynamic = 'force-dynamic';
export default async function Gallery({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params,
    q = await searchParams,
    b = await publicBusiness(id);
  if (!b) notFound();
  const kind = q.kind || 'addons';
  if (!['addons', 'backdrops', 'designs', 'staff'].includes(kind)) notFound();
  const options = optionsFromQuery(q);
  // Preserve existing links that used individual query parameters.
  if (!q.widget) {
    options.price = q.price !== 'false';
    options.button = q.button !== 'false';
    options.buttonText = (q.buttonText || 'Check availability').slice(0, 100);
    options.buttonColor = String(b.settings.color || '#315ee8');
  }
  const rows = publicGalleryRows(
    b.resources,
    kind,
    b.publicPackageIds,
    q.category,
  ).filter(
    (r) =>
      !options.categoryIds.length || options.categoryIds.includes(r.categoryId),
  );
  const selected = options.bookingPackage
    ? await bookingContext(options.bookingPackage)
    : null;
  const bookingHref =
    selected?.bid === id
      ? '/book/' + encodeURIComponent(options.bookingPackage)
      : availabilityPath(id);
  const title = (
    {
      addons: 'Add-ons',
      backdrops: 'Backdrops',
      designs: 'Design gallery',
      staff: 'Our team',
    } as Record<string, string>
  )[kind];
  return (
    <GalleryView
      business={{ id, name: b.name }}
      kind={kind}
      title={title}
      rows={rows}
      options={options}
      bookingHref={bookingHref}
    />
  );
}
