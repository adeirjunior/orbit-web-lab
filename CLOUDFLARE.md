# Site e Web Push em um único Cloudflare Worker

O projeto usa **Workers Static Assets** para servir o build estático do SvelteKit e executar a API no mesmo domínio. Não exige servidor Node separado, banco de dados, domínio próprio nem migração de framework.

```text
https://orbit-web-lab.4adeirj.workers.dev/
  /                          → site SvelteKit e PWA
  /service-worker.js         → cache offline e recebimento de push
  /api/push/public-key       → chave VAPID pública
  /api/push/test             → criptografia e envio Web Push
  /healthz                  → status do Worker
```

Publicado na conta pessoal `4adeirj@gmail.com` em 23/10/2026. O `account_id` em `wrangler.jsonc` fixa a conta de destino e evita publicar nas contas de outras empresas. O GitHub Pages foi desativado e seu workflow removido. A cópia local fica em `C:\Users\adeir\Projects\orbit-web-lab`.

## O que já está preparado

- `wrangler.jsonc`: Worker `orbit-web-lab`, frontend em `build/`, roteamento da API e limite de testes por IP.
- `cloudflare/worker.ts`: API usando Fetch e Web Crypto, sem `node:http` ou servidor sempre ativo.
- Web Push compatível com AES128GCM (RFC 8291) e autenticação VAPID (RFC 8292), inclusive o formato exigido pela Apple.
- Chaves privadas fornecidas por secrets; o navegador recebe apenas a chave pública.
- `npm run cloudflare:build`: força build no domínio raiz e remove a dependência de API externa.
- Testes de protocolo que descriptografam a mensagem com uma implementação independente e verificam a assinatura do JWT.
- Testes de navegador no runtime local Wrangler: frontend, API, responsividade, tema e offline.
- GitHub Actions valida o Worker sem precisar de credenciais de produção.

## Publicar por CLI

É necessário acesso à conta Cloudflare. Autentique no seu terminal de confiança ou configure `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` nos segredos do ambiente de execução. Nunca envie tokens pelo chat nem coloque valores em arquivos versionados.

```bash
npm ci
npx wrangler login
npm run check
npm test
npm run cloudflare:deploy
npm run cloudflare:secrets
```

`cloudflare:deploy` publica o site e o código do Worker. `cloudflare:secrets` reutiliza o par VAPID de `.push-keys.json` ou gera um par local quando ele ainda não existe, e envia ambas as chaves ao Cloudflare pelo stdin do Wrangler. Os valores não são exibidos nem enviados ao GitHub. O comando requer autenticação Cloudflare e preserva as chaves entre deploys.

Após adicionar os secrets, abra a URL informada pelo Wrangler e confira `/healthz`: `pushConfigured` deve ser `true`. Clique no teste Web Push e conceda a permissão. A exibição final depende do navegador, do serviço de push e das configurações de notificações do dispositivo.

O token, quando utilizado, precisa de permissão de edição de Workers Scripts na conta escolhida e acesso de leitura à conta para o Wrangler. Como o projeto usa Workers Static Assets, confira também as permissões de assets solicitadas pela versão atual do Wrangler. Não são necessárias permissões de DNS quando se usa `workers.dev`.

## Publicar pelo GitHub conectado à Cloudflare

1. No painel Cloudflare, abra **Workers & Pages** e crie um Worker importando o repositório GitHub `adeirjunior/orbit-web-lab`.
2. Escolha o projeto `orbit-web-lab`, a branch de produção `main` e a raiz do repositório como diretório do projeto.
3. Configure o comando de build como **`npm run cloudflare:build`** e o comando de deploy como **`npx wrangler deploy`**. O build lê `wrangler.jsonc`.
4. Depois do primeiro deploy, em **Settings → Variables and Secrets**, configure **`VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` como secrets do Worker em runtime**. Variáveis apenas do processo de build não atendem a API. Também é possível enviá-las com `npm run cloudflare:secrets` em um terminal autenticado.
5. Confirme o deploy da configuração e visite `/healthz`. Os próximos commits em `main` serão publicados automaticamente pelo Workers Builds.

Não configure `BASE_PATH=/orbit-web-lab` nem `VITE_PUSH_API_URL` no projeto Cloudflare. O comando de build já garante domínio raiz e API na mesma origem. A aplicação estática e as funções são publicadas como uma única unidade.

## Desenvolvimento e validação local

```bash
npm run cloudflare:build
npm run cloudflare:local-keys
npm run cloudflare:dev
```

Abra **http://localhost:8787**. O frontend é um build de produção, então o service worker, o offline e os testes de notificação estão disponíveis. `.dev.vars` é um arquivo privado e ignorado pelo Git; não é usado como armazenamento de secrets de produção.

```bash
npm run check
npm test
npm run cloudflare:dry-run
CLOUDFLARE_E2E=1 npm run test:e2e
```

O modo `CLOUDFLARE_E2E=1` inicia o Wrangler, prepara chaves exclusivamente locais e verifica o site e a API no mesmo host. Em CI, essas chaves efêmeras nunca são publicadas. Os testes de criptografia usam um receptor local e um transporte controlado, sem enviar mensagens a dispositivos reais.

## Plano gratuito e limites

O projeto não provisiona serviços pagos. Os arquivos estáticos são atendidos pelo mecanismo de assets; apenas `/api/*`, `/healthz` e caminhos sem asset correspondente passam pelo Worker. O Workers Free tem limites próprios de requisições e CPU, inclusive para criptografia. O dry-run valida o bundle, mas não substitui medir a CPU e os erros no ambiente de produção.

O rate limiter permite aproximadamente 10 tentativas por IP em 60 segundos, por localidade Cloudflare; não é um contador global exato. O identificador de namespace `524001` foi definido para este projeto e pode ser alterado antes do deploy se já estiver em uso por outro Worker da conta.

As assinaturas são enviadas pelo navegador a cada teste e não são persistidas. O Worker faz um envio remoto real e termina a requisição. Para campanhas, envios programados ou disparos futuros após fechar o site, será necessário armazenar assinaturas e adicionar um disparador autenticado, por exemplo com D1 e Cron Triggers.

## Arquivos preservados para outras hospedagens

`server/index.mjs` continua disponível como alternativa para Render, Cloud Run ou desenvolvimento Node. Ele não é utilizado no deploy Cloudflare. A hospedagem ativa é o Worker; o workflow de GitHub Pages foi removido para impedir republicações acidentais.

Referências: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
