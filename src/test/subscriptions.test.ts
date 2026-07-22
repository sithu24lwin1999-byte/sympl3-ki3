import { describe, expect, it } from 'vitest';
import { addCalendarMonths, daysRemaining, renewalPeriod, subscriptionState } from '@/lib/subscriptions';

describe('subscription rules', () => {
  it('adds a calendar month and clamps month-end dates', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addCalendarMonths('2026-02-28', 1)).toBe('2026-03-28');
  });

  it('extends an unexpired subscription from its existing expiry', () => {
    expect(renewalPeriod('2026-08-31', '2026-07-23')).toEqual({ periodStart: '2026-08-31', periodEnd: '2026-09-30' });
  });

  it('starts an expired renewal from the renewal date', () => {
    expect(renewalPeriod('2026-06-01', '2026-07-23')).toEqual({ periodStart: '2026-07-23', periodEnd: '2026-08-23' });
  });

  it('honors an explicit renewal start date', () => {
    expect(renewalPeriod('2026-06-01', '2026-07-23', '2026-08-01')).toEqual({ periodStart: '2026-08-01', periodEnd: '2026-09-01' });
  });

  it('derives trial, expiring, expired and suspended states', () => {
    expect(subscriptionState({ status: 'TRIAL', expiry: '2026-08-01' }, '2026-07-23')).toBe('TRIAL');
    expect(subscriptionState({ status: 'ACTIVE', expiry: '2026-07-27' }, '2026-07-23')).toBe('EXPIRING_SOON');
    expect(subscriptionState({ status: 'ACTIVE', expiry: '2026-07-22' }, '2026-07-23')).toBe('EXPIRED');
    expect(subscriptionState({ status: 'SUSPENDED', expiry: '2027-01-01' }, '2026-07-23')).toBe('SUSPENDED');
    expect(daysRemaining('2026-07-27', '2026-07-23')).toBe(4);
  });
});
