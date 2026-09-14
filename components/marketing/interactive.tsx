'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { AppLogo } from '@/components/app-logo';
import { demoHref, faqs, loginHref, signupHref } from './content';
import { PipelinePreview, PlanningPreview, ProposalPreview } from './previews';

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [open]);
  return (
    <header className="mk-header">
      <div className="mk-container mk-nav-row">
        <Link
          className="mk-logo"
          href="/welcome"
          aria-label="EventDeskly homepage"
        >
          <AppLogo />
        </Link>
        <button
          className="mk-mobile-toggle"
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="marketing-navigation"
          ref={toggle}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          id="marketing-navigation"
          className={open ? 'is-open' : ''}
          aria-label="Main navigation"
        >
          <div className="mk-nav-sections">
            <a href="#product" onClick={() => setOpen(false)}>
              Product
            </a>
            <a href="#solutions" onClick={() => setOpen(false)}>
              Solutions
            </a>
            <a href="#pricing" onClick={() => setOpen(false)}>
              Pricing
            </a>
            <a href="#resources" onClick={() => setOpen(false)}>
              Resources
            </a>
          </div>
          <div className="mk-nav-actions">
            <a href={loginHref}>Log In</a>
            <a
              href={demoHref}
              className="mk-button mk-button-outline"
              onClick={() => setOpen(false)}
            >
              Book a Demo
            </a>
            <a href={signupHref} className="mk-button">
              Get Started <ArrowRight size={15} />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}

export function ProductTour() {
  return (
    <Tabs defaultValue="pipeline" className="mk-tour">
      <TabsList aria-label="Product preview" className="mk-tour-tabs">
        <TabsTrigger value="pipeline">
          <Users size={17} />
          Leads & sales
        </TabsTrigger>
        <TabsTrigger value="proposals">
          <FileText size={17} />
          Proposals
        </TabsTrigger>
        <TabsTrigger value="planning">
          <CalendarDays size={17} />
          Event planning
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pipeline">
        <PipelinePreview />
      </TabsContent>
      <TabsContent value="proposals">
        <ProposalPreview />
      </TabsContent>
      <TabsContent value="planning">
        <PlanningPreview />
      </TabsContent>
    </Tabs>
  );
}

export function MarketingFaq() {
  return (
    <Accordion className="mk-faq-list">
      {faqs.map(({ question, answer }, index) => (
        <AccordionItem value={String(index)} key={question}>
          <AccordionTrigger>{question}</AccordionTrigger>
          <AccordionContent>
            <p>{answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
