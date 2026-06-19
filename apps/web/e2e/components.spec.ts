import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// Authenticated journeys. These require the full stack (Postgres + API + Next)
// to be running — the CI e2e job provisions it; locally start `pnpm dev` first.
test.describe('authenticated app', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('navigates from the dashboard to the components hub', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Scope to the sidebar nav — "Componenti" also appears as a body link.
    await page.getByRole('navigation').getByRole('link', { name: 'Componenti' }).click();
    await expect(page.getByRole('heading', { name: 'Componenti' })).toBeVisible();
  });

  test('accepts a natural-language search query', async ({ page }) => {
    await page.goto('/components');
    await expect(page.getByRole('heading', { name: 'Componenti' })).toBeVisible();
    const search = page.getByPlaceholder(/Ricerca/);
    await search.fill('resistenza 10k 1% 0603');
    await expect(search).toHaveValue('resistenza 10k 1% 0603');
  });

  test('dashboard has no serious or critical accessibility violations', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id), null, 2)).toEqual([]);
  });
});
