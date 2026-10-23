import { spawnSync } from 'node:child_process';

// Um único domínio na Cloudflare: não herde o subdiretório nem a API externa do Pages.
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_PATH: '', VITE_PUSH_API_URL: '' }
});
process.exit(result.status ?? 1);
