import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parsePlanSelection,
  planPrice,
  pricingPlans,
  pricingSignupHref,
} from '../lib/marketing-pricing';

await test('approved prices, yearly charges and savings match for every plan', () => {
  const expected = [
    [29, 19, 228, 120, 2, 2],
    [69, 49, 588, 240, 5, 4],
    [179, 129, 1548, 600, 10, 6],
  ];
  pricingPlans.forEach((plan, index) => {
    const [monthly, annualMonthly, charge, savings, admins, brands] =
      expected[index];
    assert.deepEqual(planPrice(plan, 'annual'), {
      perMonth: annualMonthly,
      charge,
      annualSavings: savings,
    });
    assert.deepEqual(planPrice(plan, 'monthly'), {
      perMonth: monthly,
      charge: monthly,
      annualSavings: savings,
    });
    assert.equal(plan.administrators, admins);
    assert.equal(plan.brands, brands);
    assert.ok(
      savings / (monthly * 12) >= 0.2,
      'Save 20%+ is accurate for every annual plan',
    );
  });
  assert.deepEqual(
    pricingPlans.filter((plan) => plan.popular).map((plan) => plan.id),
    ['standard'],
  );
});
await test('all six choices reach signup and preserve the plan and billing period', () => {
  for (const plan of pricingPlans)
    for (const billing of ['monthly', 'annual'] as const) {
      const url = new URL(
        pricingSignupHref(plan, billing),
        'https://eventdeskly.com',
      );
      assert.equal(url.pathname, '/sign-in');
      assert.equal(url.searchParams.get('mode'), 'signup');
      assert.equal(url.searchParams.get('return_to'), '/app');
      assert.deepEqual(parsePlanSelection(url.search), { plan, billing });
      assert.equal(url.origin, 'https://eventdeskly.com');
    }
});
await test('signup ignores missing or unsupported plan selections', () => {
  for (const value of [
    '',
    '?plan=standard',
    '?plan=unknown&billing=annual',
    '?plan=growth&billing=weekly',
    '?plan=https://example.com&billing=annual',
  ])
    assert.equal(parsePlanSelection(value), null);
});
