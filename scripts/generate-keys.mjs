import { writeFile } from 'node:fs/promises';
import webpush from 'web-push';

try {
  await writeFile(new URL('../.push-keys.json', import.meta.url), JSON.stringify(webpush.generateVAPIDKeys(), null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Chaves VAPID salvas em .push-keys.json. Não publique esse arquivo. Reinicie o servidor.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('As chaves já existem. Mantidas para preservar as assinaturas existentes.');
  else throw error;
}
