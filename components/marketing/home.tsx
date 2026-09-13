import {
  ArrowRight,
  AudioLines,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Headphones,
  Layers,
  ListTodo,
  MessageSquare,
  Package,
  Play,
  Settings2,
  Users,
  Waypoints,
} from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { PricingSection } from './pricing';
import Link from 'next/link';
import { marketingConfig, signupHref, demoHref } from './content';
import { MarketingFaq, MarketingNav, ProductTour } from './interactive';
import { DashboardPreview, PlanningPreview, ProposalPreview } from './previews';
import './marketing.css';

const audiences = [
  [
    Camera,
    'Photo booth companies',
    'Packages, backdrops and every picture-perfect detail.',
  ],
  [
    Headphones,
    'DJs & entertainers',
    'Keep the booking organized before you take the stage.',
  ],
  [
    CalendarCheck,
    'Event planners',
    'Bring the big picture and the little details together.',
  ],
  [
    Package,
    'Event rental companies',
    'Organize your catalog, extras and event bookings.',
  ],
  [Building2, 'Venues', 'Keep client requests and event schedules in view.'],
  [
    AudioLines,
    'Event production teams',
    'Plan assignments, equipment checklists and event details.',
  ],
] as const;
const features = [
  {
    icon: Users,
    name: 'Leads & sales pipeline',
    text: 'Keep inquiries, client details and next steps organized as leads become bookings.',
  },
  {
    icon: FileText,
    name: 'Proposals & booking terms',
    text: 'Create proposals with packages, extras and reusable contract terms.',
    note: 'Electronic signatures are not available.',
  },
  {
    icon: CircleDollarSign,
    name: 'Invoices & payment tracking',
    text: 'Prepare invoices and record payments received outside EventDeskly.',
    note: 'Online payment processing is not connected.',
  },
  {
    icon: CalendarDays,
    name: 'Calendar & bookings',
    text: 'See upcoming events, manage availability and review new booking requests.',
  },
  {
    icon: MessageSquare,
    name: 'Communication preparation',
    text: 'Prepare message drafts and reusable templates for client conversations.',
    note: 'Email and SMS delivery are not connected.',
  },
  {
    icon: Settings2,
    name: 'Reusable event workflows',
    text: 'Start with saved questionnaires and checklists instead of building every plan again.',
    note: 'Automated message delivery is not available.',
  },
  {
    icon: ListTodo,
    name: 'Staff planning & tasks',
    text: 'Manage a staff roster, booking assignments, availability and to-do lists.',
    note: 'Separate staff logins are not available.',
  },
  {
    icon: BarChart3,
    name: 'Reports & business insights',
    text: 'Review sales, expenses, recorded payments and outstanding balances.',
  },
];

function CallsToAction({ light = false }: { light?: boolean }) {
  return (
    <div className="mk-cta-row">
      <a
        href={signupHref}
        className={'mk-button' + (light ? ' mk-button-white' : '')}
      >
        Get Started <ArrowRight size={18} />
      </a>
      <a
        href={demoHref}
        className={
          'mk-button mk-button-outline' +
          (light ? ' mk-button-light-outline' : '')
        }
      >
        <Play size={15} />
        Book a Demo
      </a>
    </div>
  );
}
function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mk-section-heading">
      <p className="mk-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children && <p className="mk-section-intro">{children}</p>}
    </div>
  );
}

export function MarketingHome() {
  return (
    <div className="mk-site">
      <a href="#main-content" className="mk-skip">
        Skip to content
      </a>
      <MarketingNav />
      <main id="main-content">
        <section className="mk-hero">
          <div className="mk-container mk-hero-grid">
            <div className="mk-hero-copy">
              <p className="mk-eyebrow">
                <span className="mk-label-rule" />
                THE CRM FOR EVENT PROFESSIONALS
              </p>
              <h1>
                Run your entire
                <br className="mk-desktop-break" /> event business
                <br className="mk-desktop-break" /> <span>from one place.</span>
              </h1>
              <p className="mk-hero-description">
                Manage leads, proposals, booking terms, invoices, offline
                payments, bookings, clients and event workflows without juggling
                disconnected tools.
              </p>
              <CallsToAction />
              <div className="mk-hero-footnote">
                <Check size={16} />
                Built around the way event businesses work.
              </div>
            </div>
            <div className="mk-hero-visual">
              <div className="mk-visual-label">
                <Waypoints size={16} /> A little less busywork. A lot more
                together.
              </div>
              <DashboardPreview />
              <div className="mk-workflow-ribbon">
                <span>New inquiry</span>
                <ArrowRight />
                <span>Proposal</span>
                <ArrowRight />
                <strong>Next great event</strong>
              </div>
            </div>
          </div>
        </section>
        <section id="solutions" className="mk-section mk-container">
          <SectionHeading
            eyebrow="YOUR BUSINESS BELONGS HERE"
            title="Built for businesses that make events happen."
          />
          <div className="mk-audience-grid">
            {audiences.map(([Icon, title, text]) => (
              <article key={title}>
                <div className="mk-icon-box">
                  <Icon size={25} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="product" className="mk-section mk-tinted">
          <div className="mk-container">
            <SectionHeading
              eyebrow="ONE CONNECTED WORKSPACE"
              title="Everything you need to turn inquiries into successful events."
            >
              Bring your sales process, event plans and business records
              together. Find the details you need, when you need them.
            </SectionHeading>
            <div className="mk-feature-grid">
              {features.map(({ icon: Icon, name, text, note }) => (
                <article key={name}>
                  <Icon size={25} />
                  <h3>{name}</h3>
                  <p>{text}</p>
                  {note && <small>{note}</small>}
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="how-it-works" className="mk-section mk-container">
          <SectionHeading
            eyebrow="FROM FIRST HELLO TO EVENT DAY"
            title="A clearer path from inquiry to event."
          />
          <div className="mk-steps">
            {[
              [
                '01',
                'Capture the opportunity.',
                'Collect new inquiries and keep client details, dates and next steps together.',
              ],
              [
                '02',
                'Make it a booking.',
                'Build a professional proposal with booking terms. Prepare invoices and record payments received.',
              ],
              [
                '03',
                'Bring the event to life.',
                'Keep schedules, questionnaires and checklists connected to the booking, through event day and follow-up.',
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span className="mk-step-number">{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="benefits" className="mk-benefits">
          <div className="mk-container mk-benefits-grid">
            <div>
              <p className="mk-eyebrow">MORE ROOM FOR WHAT YOU DO BEST</p>
              <h2>
                Less chasing details.
                <br />
                More making <br />
                <span>things happen.</span>
              </h2>
              <p>
                Your next event has a lot of moving parts. Your admin doesn’t
                have to.
              </p>
            </div>
            <div className="mk-benefit-list">
              {[
                'Find lead details faster',
                'Keep bookings and schedules organized',
                'Reuse templates and reduce repetitive admin',
                'Present a professional client experience',
                'Keep staff assignments and event plans together',
                'Understand sales and outstanding balances',
              ].map((text) => (
                <div key={text}>
                  <span>
                    <Check size={17} />
                  </span>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="resources" className="mk-section mk-container">
          <SectionHeading
            eyebrow="TAKE A CLOSER LOOK"
            title="Your workflow, with everything in view."
          >
            Explore an illustrative preview of the tools behind your next
            booking. Every example uses sample data.
          </SectionHeading>
          <ProductTour />
        </section>
        <section className="mk-showcases mk-container">
          <div className="mk-showcase">
            <div className="mk-showcase-copy">
              <span className="mk-showcase-tag">
                <FileText size={17} />
                PROPOSALS & INVOICES
              </span>
              <h2>A professional first impression. Every time.</h2>
              <p>
                Bring your packages, add-ons and booking terms into one clear
                proposal. Give clients the details they need to take the next
                step.
              </p>
              <ul>
                <li>
                  <Check />
                  Flexible package and extra pricing
                </li>
                <li>
                  <Check />
                  Shareable proposals and invoice views
                </li>
                <li>
                  <Check />
                  Recorded payments and remaining balances
                </li>
              </ul>
              <a className="mk-text-link" href={signupHref}>
                Get your business organized <ArrowRight size={17} />
              </a>
            </div>
            <ProposalPreview />
          </div>
          <div className="mk-showcase mk-showcase-reverse">
            <div className="mk-showcase-copy">
              <span className="mk-showcase-tag">
                <ClipboardList size={17} />
                EVENT PLANNING
              </span>
              <h2>
                The plan is in place.
                <br />
                You’re ready for the event.
              </h2>
              <p>
                Keep questionnaires, checklists and staff assignments alongside
                the booking. Spend less time searching for the details and more
                time putting them to work.
              </p>
              <ul>
                <li>
                  <Check />
                  Reusable checklists and questionnaires
                </li>
                <li>
                  <Check />
                  Event attachments and design selections
                </li>
                <li>
                  <Check />
                  Staff roster and booking assignments
                </li>
              </ul>
              <a className="mk-text-link" href="#resources">
                Explore the product preview <ArrowRight size={17} />
              </a>
            </div>
            <PlanningPreview />
          </div>
        </section>
        <section className="mk-website-section mk-container">
          <div className="mk-icon-box">
            <Layers size={27} />
          </div>
          <div>
            <h2>Your website. Your next inquiry.</h2>
            <p>
              Share booking links, lead forms and availability widgets on your
              existing website. New booking submissions remain requests for you
              to review.
            </p>
          </div>
          <a className="mk-text-link" href="#product">
            Explore the platform <ArrowRight size={17} />
          </a>
        </section>
        <PricingSection />
        <section id="faq" className="mk-section mk-container mk-faq">
          <div>
            <p className="mk-eyebrow">A FEW THINGS TO KNOW</p>
            <h2>
              Good questions.
              <br />
              Clear answers.
            </h2>
            <p>A closer look at what EventDeskly can do today.</p>
          </div>
          <MarketingFaq />
        </section>
        <section id="demo" className="mk-demo mk-container">
          <div>
            <p className="mk-eyebrow">SEE HOW IT FITS YOUR BUSINESS</p>
            <h2>Meet your next workspace.</h2>
            <p>
              {marketingConfig.demoUrl
                ? 'Arrange a guided walkthrough of EventDeskly and explore the tools for your business.'
                : 'Guided demo scheduling is not available yet. In the meantime, take a look around with our interactive product preview.'}
            </p>
          </div>
          <a
            href={marketingConfig.demoUrl || '#resources'}
            className="mk-button mk-button-outline"
          >
            {marketingConfig.demoUrl ? 'Book a Demo' : 'Explore the preview'}{' '}
            <ArrowRight size={17} />
          </a>
        </section>
        <section className="mk-final">
          <div className="mk-container">
            <p className="mk-eyebrow">
              YOUR EVENTS. YOUR BUSINESS. ALL TOGETHER.
            </p>
            <h2>
              Ready to run your event <br />
              business with less busywork?
            </h2>
            <p>
              Make room for the work you love. Bring the details to EventDeskly.
            </p>
            <CallsToAction light />
          </div>
        </section>
      </main>
      <footer className="mk-footer mk-container">
        <div className="mk-footer-brand">
          <Link
            className="mk-logo"
            href="/welcome"
            aria-label="EventDeskly homepage"
          >
            <AppLogo />
          </Link>
          <p>
            The workspace for the business
            <br />
            behind every great event.
          </p>
        </div>
        <div className="mk-footer-columns">
          <FooterColumn
            title="Product"
            links={[
              ['Platform', '#product'],
              ['Product preview', '#resources'],
              ['Pricing', '#pricing'],
            ]}
          />
          <FooterColumn
            title="Solutions"
            links={[
              ['Photo booths', '#solutions'],
              ['DJs & entertainers', '#solutions'],
              ['Rentals & venues', '#solutions'],
            ]}
          />
          <FooterColumn
            title="Resources"
            links={[
              ['How it works', '#how-it-works'],
              ['FAQs', '#faq'],
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              ['About EventDeskly', '#benefits'],
              ['Book a Demo', demoHref],
            ]}
          />
          <FooterColumn
            title="Support"
            links={[
              ['Product questions', '#faq'],
              ...(marketingConfig.supportEmail
                ? [
                    [
                      'Contact support',
                      'mailto:' + marketingConfig.supportEmail,
                    ] as [string, string],
                  ]
                : []),
            ]}
          />
          <FooterColumn
            title="Legal"
            links={[
              ...(marketingConfig.privacyUrl
                ? [['Privacy', marketingConfig.privacyUrl] as [string, string]]
                : []),
              ...(marketingConfig.termsUrl
                ? [['Terms', marketingConfig.termsUrl] as [string, string]]
                : []),
            ]}
            pending="Policies forthcoming"
          />
          <FooterColumn
            title="Social"
            links={marketingConfig.socialLinks.map((item) => [
              item.label,
              item.href,
            ])}
            pending="Profiles forthcoming"
          />
        </div>
        <div className="mk-footer-bottom">
          <span>© {new Date().getFullYear()} EventDeskly</span>
          <span>Made for the people who make events happen.</span>
        </div>
      </footer>
    </div>
  );
}
function FooterColumn({
  title,
  links,
  pending,
}: {
  title: string;
  links: [string, string][];
  pending?: string;
}) {
  return (
    <div>
      <h3>{title}</h3>
      {links.map(([label, href]) => (
        <a key={label} href={href}>
          {label}
        </a>
      ))}
      {!links.length && pending && (
        <span className="mk-footer-pending">{pending}</span>
      )}
    </div>
  );
}
