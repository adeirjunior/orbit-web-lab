import { test, expect } from '@playwright/test';

test('site e API compartilham a mesma origem no runtime Cloudflare', async ({ page }) => {
  test.skip(process.env.CLOUDFLARE_E2E !== '1', 'Requer o runtime Wrangler.');
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'pagina inicial', exact: true })).toBeVisible();
  const result = await page.evaluate(async () => {
    const health = await (await fetch('/healthz')).json();
    const keys = await (await fetch('/api/push/public-key')).json();
    const rejected = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: { endpoint: 'https://127.0.0.1/push' } }) });
    return { health, fields: Object.keys(keys), keyLength: keys.publicKey?.length, rejectedStatus: rejected.status };
  });
  expect(result.health).toMatchObject({ ok: true, runtime: 'cloudflare-workers', pushConfigured: true });
  expect(result.fields).toEqual(['publicKey']);
  expect(result.keyLength).toBe(87);
  expect(result.rejectedStatus).toBe(400);
});
