import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The auth gate is the first screen every user sees, so it must render and be
// accessible regardless of backend state (a fresh DB shows the setup form, an
// existing one shows login). These checks don't depend on authenticated data.
test.describe('auth gate', () => {
  test('renders a usable auth form on first load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('PartEngine').first()).toBeVisible({ timeout: 30_000 });
    // Either the setup or the login form must offer an email + password field.
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Password').first()).toBeVisible();
  });

  test('does not show the desktop title bar in a browser', async ({ page }) => {
    // The custom OS title bar must appear only inside the Electron shell, where
    // `window.partengine.isDesktop` is true — never in a plain browser tab.
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Chiudi' })).toHaveCount(0);
  });

  test('has no serious or critical accessibility violations (WCAG 2 A/AA)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('Email')).toBeVisible({ timeout: 30_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id), null, 2)).toEqual([]);
  });
});
