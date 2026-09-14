import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { MarketingHome } from '@/components/marketing/home';
export { marketingMetadata as metadata } from '@/components/marketing/content';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Preserve existing CRM bookmarks, including package/editor query parameters.
  if (query.section !== undefined) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value)
        ? value
        : value === undefined
          ? []
          : [value])
        params.append(key, item);
    }
    redirect('/app?' + params.toString());
  }
  const cookie = (await headers()).get('cookie') || '';
  if (/(?:^|;\s*)(?:__Secure-)?eventdesk\.session_token=/.test(cookie)) {
    // Verify the session before redirecting. Anonymous marketing never needs a DB.
    let signedIn = false;
    try {
      const { getChatGPTUser } = await import('./chatgpt-auth');
      signedIn = Boolean(await getChatGPTUser());
    } catch {
      // Keep the public homepage available during an account-service outage.
    }
    if (signedIn) redirect('/app');
  }
  return <MarketingHome />;
}
