import { test, expect } from '@playwright/test';

test('página inicial, menu expansível, toast e tema persistente', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page).toHaveTitle('Orbit — pagina inicial');
  await expect(page.getByRole('heading', { name: 'pagina inicial', exact: true })).toBeVisible();
  const internal = page.getByRole('button', { name: 'Notificação interna', exact: true });
  const initial = (await internal.boundingBox())!.width;
  await internal.focus();
  await expect.poll(async () => (await internal.boundingBox())!.width).toBeGreaterThan(initial + 100);
  await internal.click();
  await expect(page.getByRole('status').filter({ hasText: 'Sua notificação interna chegou' })).toBeVisible();
  const before = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Ativar tema/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', before === 'dark' ? 'light' : 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', before === 'dark' ? 'light' : 'dark');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('service worker armazena a página e permite recarregar offline', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect(page.getByText('PWA pronto', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Testar modo offline', exact: true }).click();
  await expect(page.getByText('Arquivo encontrado no cache offline')).toBeVisible();
  await page.getByRole('button', { name: 'Entendi' }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'pagina inicial', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Notificação interna', exact: true }).click();
  await expect(page.getByText('Sua notificação interna chegou. Simples assim.')).toBeVisible();
  await context.setOffline(false);
});

test('permissão recusada informa erro e preserva o aviso interno combinado', async ({ page }) => {
  await page.addInitScript(() => {
    if ('Notification' in window) Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Notificação interna + externa', exact: true }).click();
  await expect(page.getByText('Notificação interna recebida', { exact: true })).toBeVisible();
  await expect(page.getByText('Não foi possível concluir', { exact: true })).toBeVisible();
});
