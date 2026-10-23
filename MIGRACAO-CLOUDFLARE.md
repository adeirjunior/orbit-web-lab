# Migração para Cloudflare — 23/10/2026

- [x] Projeto clonado em `C:\Users\adeir\Projects\orbit-web-lab`.
- [x] Conta conferida por `wrangler whoami`: `4adeirj@gmail.com`.
- [x] Conta pessoal fixada em `wrangler.jsonc`.
- [x] Site publicado em https://orbit-web-lab.4adeirj.workers.dev/.
- [x] Servidor Web Push no mesmo Worker; chaves VAPID em secrets de runtime.
- [x] `/healthz`: HTTP 200, `pushConfigured: true`.
- [x] Página inicial, chave pública, service worker e manifesto: HTTP 200.
- [x] `npm run check`: exit 0, sem erros ou avisos.
- [x] `npm test`: exit 0, 12 testes aprovados.
- [x] Testes de navegador no Wrangler: exit 0, 10 aprovados e 2 ignorados por aplicabilidade de viewport.
- [x] Web Push real em produção: `/api/push/test` HTTP 200 às 22:29:24, 22:30:05 e 22:30:15 UTC; provedor aceitou o envio. A exibição pelo sistema operacional não foi confirmada visualmente.
- [x] Teste com endpoint FCM fictício: HTTP 410, sem atingir um dispositivo real.
- [x] GitHub Pages desativado: `has_pages: false`.
- [x] Workflow Pages removido e endereço público do repositório atualizado.
- [x] Validação Linux no GitHub Actions aprovada: [execução 40034166251](https://github.com/adeirjunior/orbit-web-lab/actions/runs/40034166251).
- [x] GitHub App limitado ao repositório `adeirjunior/orbit-web-lab`.
- [x] Workers Builds conectado à branch `main`: build `npm run cloudflare:build`, deploy `npx wrangler deploy`, raiz `/`, previews desativados e token `orbit-web-lab-builds` aprovado pelo proprietário.

## Correções necessárias

O script de build passou a executar SvelteKit e Vite diretamente com Node, pois `spawnSync('npm.cmd')` falhava no Windows. No envio Web Push, `redirect: 'error'` foi substituído por `redirect: 'manual'`: o runtime da Cloudflare rejeitava o primeiro valor. Respostas de redirecionamento continuam recusadas; os testes incluem 302 e 307. Logs de falha omitem endpoints e chaves de dispositivo.

## Operação

Para atualizar a produção a partir deste computador autenticado:

```powershell
cd C:\Users\adeir\Projects\orbit-web-lab
npm ci
npm run check
npm test
npm run cloudflare:deploy
```

Os secrets existentes são preservados pelos deploys. Não regenere as chaves VAPID: isso invalida assinaturas existentes. `.push-keys.json` e `.dev.vars` são privados e ignorados pelo Git.

O GitHub Actions valida o código. Workers Builds publica automaticamente commits em `main` na conta pessoal; os secrets VAPID de runtime são preservados e não ficam no processo de build. O primeiro deploy foi feito pelo Wrangler. Não há campanhas ou agendamento de notificações: o servidor implementa os testes de envio previstos pelo projeto e não armazena assinaturas.

Evidências locais ignoradas pelo Git: `.wrangler/validation/e2e.log` e `.wrangler/validation/production.json` (extrato sem cabeçalhos ou assinaturas de dispositivos).
