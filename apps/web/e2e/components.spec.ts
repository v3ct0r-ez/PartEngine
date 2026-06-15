import { expect, test } from '@playwright/test';

// Smoke E2E for the intelligent search flow. Expanded in Sprint 9.
test('components page renders and accepts a natural-language query', async ({ page }) => {
  await page.goto('/components');
  await expect(page.getByRole('heading', { name: 'Componenti' })).toBeVisible();

  const search = page.getByPlaceholder(/Ricerca intelligente/);
  await search.fill('resistenza 10k 1% 0603');
  await expect(search).toHaveValue('resistenza 10k 1% 0603');
});
