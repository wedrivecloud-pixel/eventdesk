'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  Info,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import {
  bookingLimitExplanation,
  planPrice,
  pricingMoney,
  pricingPlans,
  pricingSignupHref,
  sharedPlanFeatures,
  trialDays,
  type BillingPeriod,
  type PricingPlan,
} from '@/lib/marketing-pricing';
import './pricing.css';

function BookingHelp({ planName }: { planName: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="mk-booking-help"
        type="button"
        aria-label={`How booking limits work for ${planName}`}
      >
        <Info size={16} />
      </TooltipTrigger>
      <TooltipContent className="mk-pricing-tooltip">
        {bookingLimitExplanation}
      </TooltipContent>
    </Tooltip>
  );
}

function PlanCard({
  plan,
  billing,
}: {
  plan: PricingPlan;
  billing: BillingPeriod;
}) {
  const [expanded, setExpanded] = useState(false);
  const price = planPrice(plan, billing);
  return (
    <article
      className={'mk-plan-card' + (plan.popular ? ' mk-plan-popular' : '')}
      aria-labelledby={'plan-' + plan.id}
    >
      <div className="mk-plan-ribbon">
        {plan.popular ? (
          <span>Most Popular</span>
        ) : (
          <span aria-hidden="true">&nbsp;</span>
        )}
      </div>
      <div className="mk-plan-body">
        <h3 id={'plan-' + plan.id}>{plan.name}</h3>
        <p className="mk-plan-description">{plan.description}</p>
        <div className="mk-plan-price">
          <strong>{pricingMoney(price.perMonth)}</strong>
          <span>/ month</span>
        </div>
        <p className="mk-plan-billing">
          {billing === 'annual'
            ? `${pricingMoney(price.charge)} billed annually`
            : `${pricingMoney(price.charge)} billed monthly`}
        </p>
        <p className="mk-plan-savings">
          {billing === 'annual'
            ? `Save ${pricingMoney(price.annualSavings)} per year`
            : 'Pay month to month'}
        </p>
        <a
          className={'mk-button ' + (plan.popular ? '' : 'mk-button-outline')}
          href={pricingSignupHref(plan, billing)}
        >
          Choose {plan.name}
          <ArrowRight size={17} />
        </a>
        <ul className="mk-plan-allowances">
          <li>
            <Check />
            <span>Unlimited Bookings</span>
            <BookingHelp planName={plan.name} />
          </li>
          <li>
            <Check />
            <span>{plan.administrators} administrator accounts</span>
          </li>
          <li>
            <Check />
            <span>{plan.brands} brands</span>
          </li>
          <li>
            <Check />
            <span>Unlimited staff accounts</span>
          </li>
        </ul>
        <Collapsible
          open={expanded}
          onOpenChange={setExpanded}
          className="mk-plan-expanded"
        >
          <CollapsibleTrigger
            className="mk-plan-expand"
            aria-label={`${expanded ? 'Hide' : 'View'} all features for ${plan.name}`}
          >
            {expanded ? 'Hide all features' : 'View all features'}
            <ChevronDown size={17} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mk-plan-feature-list">
              {sharedPlanFeatures.map((feature) => (
                <li key={feature}>
                  <Check size={15} />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="mk-plan-availability">
              Account and brand allowances describe the planned subscription.
              Separate staff/admin access and multi-brand management are not yet
              available.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </article>
  );
}

export function PricingSection() {
  const [billing, setBilling] = useState<BillingPeriod>('annual');
  const comparisons = [
    {
      label: 'Price per month',
      values: pricingPlans.map((plan) =>
        pricingMoney(planPrice(plan, billing).perMonth),
      ),
    },
    {
      label: billing === 'annual' ? 'Annual charge' : 'Monthly charge',
      values: pricingPlans.map((plan) =>
        pricingMoney(planPrice(plan, billing).charge),
      ),
    },
    ...(billing === 'annual'
      ? [
          {
            label: 'Annual savings',
            values: pricingPlans.map((plan) =>
              pricingMoney(planPrice(plan, billing).annualSavings),
            ),
          },
        ]
      : []),
    {
      label: 'Upcoming active bookings',
      values: ['Unlimited', 'Unlimited', 'Unlimited'],
    },
    {
      label: 'Administrator accounts',
      values: pricingPlans.map((plan) => String(plan.administrators)),
    },
    {
      label: 'Brands',
      values: pricingPlans.map((plan) => String(plan.brands)),
    },
    {
      label: 'Staff accounts',
      values: ['Unlimited', 'Unlimited', 'Unlimited'],
    },
    ...sharedPlanFeatures.map((label) => ({
      label,
      values: ['Included', 'Included', 'Included'],
    })),
  ];
  return (
    <section id="pricing" className="mk-section mk-pricing-section">
      <div className="mk-container">
        <div className="mk-section-heading">
          <p className="mk-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2>
            The right plan for
            <br />
            your kind of event business.
          </h2>
          <p className="mk-section-intro">
            From your first bookings to your busiest season, find a plan with
            room for your business.
          </p>
        </div>
        <ul className="mk-pricing-trust">
          <li>
            <ShieldCheck />
            60-day money-back guarantee
          </li>
          <li>
            <CreditCard />
            {trialDays}-day trial · No card required
          </li>
          <li>
            <Zap />
            Quick setup
          </li>
        </ul>
        <ToggleGroup
          className="mk-billing-toggle"
          aria-label="Billing period"
          multiple={false}
          value={[billing]}
          onValueChange={(value) => {
            if (value[0] === 'monthly' || value[0] === 'annual')
              setBilling(value[0]);
          }}
        >
          <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
          <ToggleGroupItem value="annual">
            Annual <span>Save 20%+</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <output
          className="mk-billing-summary"
          aria-live="polite"
          aria-atomic="true"
        >
          {billing === 'annual'
            ? 'Annual billing selected. Monthly equivalents shown; one payment per year.'
            : 'Monthly billing selected. Prices are charged each month.'}{' '}
          All prices in USD.
        </output>
        <TooltipProvider delay={100}>
          <div className="mk-plan-grid">
            {pricingPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} billing={billing} />
            ))}
          </div>
        </TooltipProvider>
        <div className="mk-pricing-explanation">
          <Info size={19} />
          <p>{bookingLimitExplanation}</p>
        </div>
        <p className="mk-pricing-release-note">
          Plan selection opens account signup. Paid subscriptions, trial timing,
          and multi-user / multi-brand allowances are not activated by signup
          yet. You won’t be charged here.
        </p>
        <div className="mk-plan-comparison">
          <h3>Find your fit, at a glance.</h3>
          <p>
            Compare plan allowances and the core event tools included in every
            plan.
          </p>
          <Table className="mk-comparison-table">
            <TableCaption>
              Prices reflect {billing} billing. Account and brand allowances are
              planned; separate staff/admin access and multi-brand management
              are not yet available.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Plan features</TableHead>
                {pricingPlans.map((plan) => (
                  <TableHead key={plan.id} scope="col">
                    {plan.name}
                    {plan.popular && (
                      <span className="mk-comparison-popular">
                        Most Popular
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((row) => (
                <TableRow key={row.label}>
                  <TableHead scope="row">{row.label}</TableHead>
                  {row.values.map((value, index) => (
                    <TableCell key={pricingPlans[index].id}>{value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
