import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Um único domínio na Cloudflare: não herde o subdiretório nem a API externa do Pages.
const kit = fileURLToPath(new URL('../node_modules/@sveltejs/kit/svelte-kit.js', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const options = {
  stdio: 'inherit',
  env: { ...process.env, BASE_PATH: '', VITE_PUSH_API_URL: '' }
};
for (const args of [[kit, 'sync'], [vite, 'build']]) {
  const result = spawnSync(process.execPath, args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
