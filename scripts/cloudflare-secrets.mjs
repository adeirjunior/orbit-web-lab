import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const root = new URL('../', import.meta.url);
let keys;
try { keys = JSON.parse(await readFile(new URL('.push-keys.json', root), 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  keys = webpush.generateVAPIDKeys();
  await writeFile(new URL('.push-keys.json', root), JSON.stringify(keys, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
if (!keys.publicKey || !keys.privateKey) throw new Error('Chaves VAPID locais inválidas.');
const secrets = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey };
if (process.argv.includes('--local')) {
  try {
    await writeFile(new URL('.dev.vars', root), Object.entries(secrets).map(([name, value]) => `${name}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    console.log('.dev.vars criado para o desenvolvimento local. Valores não exibidos.');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('.dev.vars já existe e foi preservado.');
  }
} else {
  // Apenas o processo Wrangler recebe o JSON pelo stdin; segredos não aparecem nos argumentos ou logs.
  const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'secret', 'bulk'], {
    cwd: fileURLToPath(root), input: JSON.stringify(secrets), stdio: ['pipe', 'inherit', 'inherit']
  });
  process.exit(result.status ?? 1);
}
