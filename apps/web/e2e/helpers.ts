import { expect, type Page } from '@playwright/test';

/** Credentials used by the E2E run to bootstrap / sign into a fresh stack. */
export const E2E_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@partengine.test',
  name: 'E2E Admin',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'partengine-e2e-pw',
};

/**
 * Land in the authenticated app from any starting auth state.
 *
 * The AuthGate shows one of three things depending on backend state: a setup
 * form (fresh install, no users), a login form (users exist), or the app
 * itself (valid token). This helper handles the first two — performing first-run
 * setup on a clean DB, or logging in with the same credentials otherwise — so a
 * spec can simply call `signIn(page)` and assume it's inside the shell.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/');

  // Wait for the gate to resolve (it briefly renders nothing while it checks).
  const setupHeading = page.getByText("crea l'account amministratore", { exact: false });
  const loginHeading = page.getByText('Accedi per continuare', { exact: false });
  const dashboard = page.getByRole('heading', { name: 'Dashboard' });

  await expect(setupHeading.or(loginHeading).or(dashboard)).toBeVisible({ timeout: 30_000 });

  if (await dashboard.isVisible().catch(() => false)) return;

  if (await setupHeading.isVisible().catch(() => false)) {
    await page.getByPlaceholder(/Nome completo/).fill(E2E_ADMIN.name);
    await page.getByPlaceholder('Email').fill(E2E_ADMIN.email);
    await page.getByPlaceholder(/Password \(min/).fill(E2E_ADMIN.password);
    await page.getByPlaceholder('Conferma password').fill(E2E_ADMIN.password);
    await page.getByRole('button', { name: /Crea amministratore/ }).click();
  } else {
    await page.getByPlaceholder('Email').fill(E2E_ADMIN.email);
    await page.getByPlaceholder('Password').fill(E2E_ADMIN.password);
    await page.getByRole('button', { name: 'Accedi' }).click();
  }

  await expect(dashboard).toBeVisible({ timeout: 30_000 });
}
