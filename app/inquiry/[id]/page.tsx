import { notFound } from 'next/navigation';
import { leadFormContext } from '@/db/lead-forms';
import Inquiry from './inquiry';
import { optionsFromQuery, widgetDefaults } from '@/lib/website-integration';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params,
    c = await leadFormContext(id);
  if (!c) notFound();
  const q = await searchParams;
  return (
    <Inquiry
      widget={
        q.widget
          ? optionsFromQuery(q)
          : {
              ...widgetDefaults(),
              buttonColor: String(c.b.settings.color || '#315ee8'),
              maxWidth: 850,
            }
      }
      initial={{
        id,
        name: c.form.name,
        business: {
          id: c.b.id,
          name: c.b.name,
          color: String(c.b.settings.color),
        },
        fields: c.fields,
        questions: c.questions,
        packages: c.packages,
        button: String(c.form.data.buttonText || 'Send inquiry'),
        privacy: {
          url: String(c.b.settings.privacyUrl || ''),
          text: String(c.b.settings.consentText || ''),
          required: Boolean(c.b.settings.requireConsent),
        },
      }}
    />
  );
}
