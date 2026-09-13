'use client';
import { useSyncExternalStore } from 'react';
import {
  parsePlanSelection,
  planPrice,
  pricingMoney,
  trialDays,
} from '@/lib/marketing-pricing';

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}
export function SignupPlanSummary() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  );
  const selection = parsePlanSelection(search);
  if (!selection) return null;
  const { plan, billing } = selection;
  const price = planPrice(plan, billing);
  return (
    <aside
      aria-label="Selected plan"
      style={{
        padding: 16,
        marginBlock: 20,
        border: '1px solid #b8dcff',
        borderRadius: 10,
        background: '#f3f9ff',
        color: '#0b1f3a',
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <strong>
        {plan.name} · {billing === 'annual' ? 'Annual' : 'Monthly'} billing
      </strong>
      <p>
        {pricingMoney(price.perMonth)}/month · {pricingMoney(price.charge)}{' '}
        billed {billing === 'annual' ? 'annually' : 'monthly'}
      </p>
      <p>
        Selected offer: {trialDays}-day trial with no card required.
      </p>
      <p>
        Creating an account does not start a paid subscription or activate plan
        allowances. Trial activation is not connected yet. No payment is collected here.
      </p>
    </aside>
  );
}
