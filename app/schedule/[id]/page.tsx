import { notFound } from 'next/navigation';
import { schedulingPage } from '@/db/appointment-scheduling';
import AppointmentScheduler from './scheduler';
import { WidgetFrame } from '../../widget-frame';
import { optionsFromQuery } from '@/lib/website-integration';
import '../../staff-scheduling.css';
export const dynamic = 'force-dynamic';
export default async function Schedule({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params,
    q = await searchParams,
    data = await schedulingPage(id);
  if (!data) notFound();
  const scheduler = (
    <AppointmentScheduler data={data} selected={q.calendar || ''} />
  );
  return q.widget ? (
    <WidgetFrame options={optionsFromQuery(q)}>{scheduler}</WidgetFrame>
  ) : (
    scheduler
  );
}
