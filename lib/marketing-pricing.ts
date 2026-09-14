export type BillingPeriod = 'monthly' | 'annual';
// Approved offer. Billing integration must use this duration when trials are enabled.
export const trialDays = 30;
export const pricingPlans = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Best for new businesses and part-time event professionals.',
    administrators: 2,
    brands: 2,
    monthly: 29,
    annualMonthly: 19,
    popular: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Best for established and growing event businesses.',
    administrators: 5,
    brands: 4,
    monthly: 69,
    annualMonthly: 49,
    popular: false,
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'Best for high-volume businesses with larger teams.',
    administrators: 10,
    brands: 6,
    monthly: 179,
    annualMonthly: 129,
    popular: false,
  },
] as const;
export type PricingPlan = (typeof pricingPlans)[number];
export function planPrice(plan: PricingPlan, billing: BillingPeriod) {
  return {
    perMonth: billing === 'annual' ? plan.annualMonthly : plan.monthly,
    charge: billing === 'annual' ? plan.annualMonthly * 12 : plan.monthly,
    annualSavings: (plan.monthly - plan.annualMonthly) * 12,
  };
}
export function pricingSignupHref(plan: PricingPlan, billing: BillingPeriod) {
  return (
    '/sign-in?' +
    new URLSearchParams({
      mode: 'signup',
      return_to: '/app',
      plan: plan.id,
      billing,
    }).toString()
  );
}
export function parsePlanSelection(
  search: string,
): { plan: PricingPlan; billing: BillingPeriod } | null {
  const query = new URLSearchParams(search);
  const plan = pricingPlans.find((item) => item.id === query.get('plan'));
  const billing = query.get('billing');
  return plan && (billing === 'annual' || billing === 'monthly')
    ? { plan, billing }
    : null;
}
export const pricingMoney = (value: number) =>
  '$' + value.toLocaleString('en-US');
export const bookingLimitExplanation =
  'Booking limits count upcoming active bookings, not lifetime bookings or completed events. All three EventDeskly plans include unlimited upcoming active bookings.';
export const sharedPlanFeatures = [
  'Leads and client details',
  'Proposals, booking terms and invoices',
  'Offline payment records and balances',
  'Calendar and booking requests',
  'Packages, add-ons and backdrops',
  'Reusable questionnaires and checklists',
  'Staff roster and event assignments',
  'Sales, expenses and business reports',
];
