import { notFound } from 'next/navigation';
import { bookingContext, publicBooking } from '@/db/public-booking';
import CustomerBooking from './booking';
import { availabilityPath } from '@/lib/public-booking';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Request your event booking | EventDesk',
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
  const c = await bookingContext(id);
  if (!c) notFound();
  const query = await searchParams;
  return (
    <CustomerBooking
      initial={await publicBooking(c)}
      catalogHref={availabilityPath(c.bid)}
      requestedDate={
        /^\d{4}-\d{2}-\d{2}$/.test(query.date || '') ? query.date : ''
      }
    />
  );
}
