import type { Metadata } from 'next';

// BUSINESS REVIEW: supply approved destinations here before public launch.
// Null means unavailable; never render invented URLs, prices or social proof.
export const marketingConfig = {
  demoUrl: null as string | null,
  supportEmail: null as string | null,
  privacyUrl: null as string | null,
  termsUrl: null as string | null,
  socialLinks: [] as { label: string; href: string }[],
  // Approved public 1200 × 630 asset path/URL. No image is advertised until supplied.
  socialImage: null as string | null,
};
export const signupHref = '/sign-in?mode=signup&return_to=%2Fapp';
export const loginHref = '/sign-in?return_to=%2Fapp';
export const demoHref = marketingConfig.demoUrl || '#demo';
export const marketingMetadata: Metadata = {
  metadataBase: new URL('https://eventdeskly.com'),
  title: 'EventDeskly | CRM for event professionals',
  description:
    'Run your event business from one place. Organize leads, proposals, invoices, offline payments, bookings and event workflows with EventDeskly.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'EventDeskly',
    url: '/',
    title: 'Your event business. All together. | EventDeskly',
    description:
      'A workspace for the business behind every great event. Leads, proposals, bookings and all the details in between.',
    ...(marketingConfig.socialImage
      ? {
          images: [
            {
              url: marketingConfig.socialImage,
              width: 1200,
              height: 630,
              alt: 'EventDeskly — CRM for event professionals',
            },
          ],
        }
      : {}),
  },
  twitter: {
    card: marketingConfig.socialImage ? 'summary_large_image' : 'summary',
    title: 'EventDeskly | CRM for event professionals',
    description:
      'Your leads, proposals, bookings and event details. All together.',
    ...(marketingConfig.socialImage
      ? { images: [marketingConfig.socialImage] }
      : {}),
  },
};
export const faqs = [
  {
    question: 'Who is EventDeskly for?',
    answer:
      'EventDeskly is built for independent event professionals: photo booth companies, DJs, entertainers, event planners, rental companies, venues and production teams. It brings the business side of your events into one owner workspace.',
  },
  {
    question: 'What can EventDeskly manage?',
    answer:
      'Organize leads, client details, proposals, packages, booking terms, invoices, offline payment records, bookings and schedules. Questionnaires, checklists, attachments, expenses and reports help you manage the details around each event.',
  },
  {
    question: 'Can multiple team members use it?',
    answer:
      'Owners can maintain a staff roster, assign people to bookings and track availability. Separate staff logins, invitations and permission levels are not available in the current version.',
  },
  {
    question: 'Can I manage more than one event at a time?',
    answer:
      'Yes. Manage multiple leads, proposals and bookings, and review your schedule across events. Availability settings and blackout dates help you organize booking requests; public requests need your approval.',
  },
  {
    question: 'Does EventDeskly support contracts and invoices?',
    answer:
      'You can organize contract templates and booking terms, include terms in proposals, and create invoice views. Electronic signatures are not available. Payments received outside EventDeskly can be recorded and tracked; online payment processing is not connected.',
  },
  {
    question: 'Can I send messages or automate follow-ups?',
    answer:
      'You can prepare message drafts and reusable templates, and organize checklists and questionnaires. Live email/SMS sending and automated message delivery are not connected in the current version.',
  },
  {
    question: 'Can I request a demo?',
    answer: marketingConfig.demoUrl
      ? 'Yes. Choose Book a Demo to open our demo booking page and arrange a walkthrough.'
      : 'A guided demo booking option is not available yet. You can explore the interactive product preview on this page to see how leads, proposals and event planning fit together.',
  },
];
