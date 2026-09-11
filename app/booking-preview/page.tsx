import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { snapshot } from '@/db/store';
import { notFound } from 'next/navigation';
import BookingPreview from './preview';
import type { Data } from '@/lib/crm';
export const dynamic = 'force-dynamic';
async function ProtectedPreview({
  packageId,
  requested,
}: {
  packageId: string;
  requested: boolean;
}) {
  const returnTo = packageId
    ? `/booking-preview?package=${encodeURIComponent(packageId)}`
    : '/booking-preview';
  const user = await requireChatGPTUser(returnTo);
  const data = (await snapshot(user.userId)) as unknown as Data;
  if (requested) {
    const selected = data.packages.find(
      (p) => p.id === packageId && p.settings?.status !== 'Disabled',
    );
    if (!selected) notFound();
    data.packages = [selected];
  }
  return (
    <BookingPreview
      key={packageId || 'catalog'}
      initial={{ ...data, events: [], payments: [] }}
      packageId={packageId}
    />
  );
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ package?: string | string[] }>;
}) {
  const query = await searchParams;
  const packageId =
    typeof query.package === 'string' && query.package.length <= 100
      ? query.package
      : '';
  return (
    <ProtectedPreview
      packageId={packageId}
      requested={query.package !== undefined}
    />
  );
}
