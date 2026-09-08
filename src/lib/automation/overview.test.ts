import { describe, expect, it } from 'vitest';
import { nextAutomationAction, type AutomationOverview } from './overview';
const data = (counts: Partial<NonNullable<AutomationOverview['counts']>> = {}): AutomationOverview => ({
  checkedAt: new Date().toISOString(), database: true, setup: [],
  counts: { products: 0, links: 0, producing: 0, drafts: 0, scheduled: 0, published: 0, attention: 0, ...counts },
});
describe('automation next action', () => {
  it('does not interpret unknown data as an empty library', () => {
    expect(nextAutomationAction(null).href).toBe('#setup');
    expect(nextAutomationAction({ ...data(), counts: null }).href).toBe('#setup');
    expect(nextAutomationAction({ ...data({ products: 20 }), database: false }).href).toBe('#setup');
  });
  it('prioritizes uncertain publishing results over more production', () => {
    expect(nextAutomationAction(data({ products: 20, drafts: 5, attention: 1 })).href).toBe('/publishing?filter=attention');
  });
  it('prioritizes draft review over creating more videos', () => {
    expect(nextAutomationAction(data({ products: 20, drafts: 5 })).href).toBe('/publishing?filter=draft');
  });
  it('offers onboarding only for a verified empty library', () => {
    expect(nextAutomationAction(data()).href).toBe('/scanner');
    expect(nextAutomationAction(data({ products: 1 })).href).toBe('/library');
  });
});
