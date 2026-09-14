import { notFound } from 'next/navigation';
import { bookingContext, publicBooking } from '@/db/public-booking';
import CustomerBooking from './booking';
import { availabilityPath } from '@/lib/public-booking';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Request your event booking | Eventdeskly',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (query.brand && (typeof query.brand !== 'string' || query.brand.length > 100)) notFound();
  const c = await bookingContext(id, query.brand || '');
  if (!c) notFound();
  return (
    <CustomerBooking
      initial={await publicBooking(c)}
      catalogHref={availabilityPath(c.bid, c.brand?.id)}
      requestedDate={
        /^\d{4}-\d{2}-\d{2}$/.test(query.date || '') ? query.date : ''
      }
    />
  );
}
