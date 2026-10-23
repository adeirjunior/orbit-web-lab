import { test, expect, type Page } from '@playwright/test';

async function selectTest(page: Page, name: string) {
  if (await page.getByRole('navigation', { name: 'Testes da plataforma' }).isVisible()) {
    await page.getByRole('button', { name, exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Testes', exact: true }).click();
    await page.getByRole('dialog', { name: 'Escolha um teste' }).getByRole('button', { name, exact: true }).click();
  }
}

test('página inicial, menu expansível, toast e tema persistente', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page).toHaveTitle('Orbit — pagina inicial');
  await expect(page.getByRole('heading', { name: 'pagina inicial', exact: true })).toBeVisible();
  if (await page.getByRole('navigation', { name: 'Testes da plataforma' }).isVisible()) {
    const internal = page.getByRole('button', { name: 'Notificação interna', exact: true });
    const initial = (await internal.boundingBox())!.width;
    await internal.focus();
    await expect.poll(async () => (await internal.boundingBox())!.width).toBeGreaterThan(initial + 100);
  }
  await selectTest(page, 'Notificação interna');
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
  await selectTest(page, 'Testar modo offline');
  await expect(page.getByText('Arquivo encontrado no cache offline')).toBeVisible();
  await page.getByRole('button', { name: 'Entendi' }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'pagina inicial', exact: true })).toBeVisible();
  await selectTest(page, 'Notificação interna');
  await expect(page.getByText('Sua notificação interna chegou. Simples assim.')).toBeVisible();
  await context.setOffline(false);
});

test('permissão recusada informa erro e preserva o aviso interno combinado', async ({ page }) => {
  await page.addInitScript(() => {
    if ('Notification' in window) Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
  });
  await page.goto('./');
  await selectTest(page, 'Notificação interna + externa');
  await expect(page.getByText('Notificação interna recebida', { exact: true })).toBeVisible();
  await expect(page.getByText('Não foi possível concluir', { exact: true })).toBeVisible();
});

test('navegação se adapta a celular, tablet, paisagem e desktop sem sobreposições', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A matriz de dimensões é verificada uma vez no contexto desktop.');
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [844, 390], [1280, 800], [1536, 960]]) {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const compact = width <= 1024 || height < 640;
    const mobileNav = page.getByRole('navigation', { name: 'Navegação do aplicativo' });
    await expect(mobileNav).toBeVisible({ visible: compact });
    await expect(page.getByRole('navigation', { name: 'Testes da plataforma' })).toBeVisible({ visible: !compact });
    if (compact) {
      const navBox = (await mobileNav.boundingBox())!;
      expect(navBox.y + navBox.height).toBeLessThanOrEqual(height + 1);
      for (const button of await mobileNav.getByRole('button').all()) {
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      const lastQuickAction = page.locator('.quick-start .test-row').last();
      await lastQuickAction.scrollIntoViewIfNeeded();
      const quickBox = (await lastQuickAction.boundingBox())!;
      expect(quickBox.y + quickBox.height).toBeLessThanOrEqual(navBox.y);
      await page.getByRole('button', { name: 'Explorar testes', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Escolha um teste' });
      await expect(sheet).toBeVisible();
      expect(await sheet.getByRole('button').count()).toBe(9);
      await sheet.getByRole('button', { name: 'Alternar tela cheia', exact: true }).scrollIntoViewIfNeeded();
      await expect(sheet.getByRole('button', { name: 'Fechar testes', exact: true })).toBeInViewport();
      const bounds = (await sheet.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
      await page.keyboard.press('Escape');
      await expect(sheet).not.toBeVisible();
      await expect(page.locator('body')).not.toHaveClass(/modal-open/);
    }
  }
});

test('painel de testes fecha, devolve o foco e permite executar uma ação por toque', async ({ page }) => {
  await page.goto('./');
  const navigation = page.getByRole('navigation', { name: 'Navegação do aplicativo' });
  test.skip(!(await navigation.isVisible()), 'Fluxo específico da navegação compacta.');
  const open = page.getByRole('button', { name: 'Testes', exact: true });
  await open.click();
  const sheet = page.getByRole('dialog', { name: 'Escolha um teste' });
  await expect(sheet).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/modal-open/);
  await sheet.getByRole('button', { name: 'Fechar testes', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(open).toBeFocused();
  await selectTest(page, 'Notificação interna');
  await expect(sheet).not.toBeVisible();
  await expect(page.getByText('Sua notificação interna chegou. Simples assim.')).toBeVisible();
  const toast = (await page.getByRole('status').boundingBox())!;
  const nav = (await navigation.boundingBox())!;
  expect(toast.y + toast.height).toBeLessThanOrEqual(nav.y);
});
