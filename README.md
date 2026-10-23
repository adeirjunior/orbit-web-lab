# Orbit — laboratório web

**Site:** https://orbit-web-lab.4adeirj.workers.dev/

**Repositório:** https://github.com/adeirjunior/orbit-web-lab

**Cloudflare:** site e servidor Web Push publicados no mesmo Worker, na conta pessoal `4adeirj@gmail.com`. Consulte [CLOUDFLARE.md](./CLOUDFLARE.md) para executar, configurar secrets e publicar. O GitHub Pages foi desativado em 23/10/2026.

Webapp de teste em **SvelteKit 2 + Svelte 5 (runes) + TypeScript + Vite + PWA**. A página inicial exibe `pagina inicial`. Em desktop, há um menu vertical flutuante à direita com círculos que se expandem ao passar o mouse ou receber foco pelo teclado. Em celular, tablet, dispositivos de toque e janelas baixas, a navegação muda para uma barra inferior com Início, Testes, Tema e Instalar. O painel de testes apresenta as oito ações com ícones, nomes e descrições, sem depender de hover.

## Interface responsiva

- Conteúdo com largura fluida, rolagem em telas pequenas e áreas de toque de pelo menos 44 px na navegação.
- Atalhos iniciais para notificações internas, teste offline e instalação.
- Painéis com rolagem própria e botão de fechar visível; fundo bloqueado enquanto um diálogo está aberto.
- Barra inferior e notificações respeitam as áreas de segurança do dispositivo; os avisos aparecem acima da navegação.
- Layout compacto em até 1024 px, em telas com toque ou sem hover e em janelas com altura inferior a 640 px. O modo desktop mantém os botões circulares.
- Modo instalado com `viewport-fit=cover`, suporte à tela inicial e respeito à preferência por movimento reduzido.

Os testes de layout verificam 320×568, 390×844, 768×1024, 844×390, 1280×800 e 1536×960, além dos fluxos desktop/mobile de notificações, tema persistente e offline.

## Executar o site completo

Requer **Node.js 22+** e acesso ao registro npm na instalação.

```bash
cd /workspace/orbit
npm install
npm run push:keys
npm run check
npm run build
npm start
```

Abra **http://localhost:3001**. A primeira visita prepara o service worker e o cache. O indicador no rodapé muda para “PWA pronto”. Se necessário, recarregue uma vez.

`npm run push:keys` cria `.push-keys.json` localmente com permissão de arquivo restrita e não sobrescreve chaves existentes. O arquivo está no `.gitignore`. A chave privada nunca é enviada ao navegador. Em produção, configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e um `VAPID_SUBJECT` real, por exemplo `mailto:voce@seudominio.com`.

## Desenvolvimento

```bash
npm run dev
```

Abra **http://localhost:5173**. O modo de desenvolvimento oferece atualização automática da interface. **O service worker só é gerado no build de produção**, evitando cache desatualizado durante o desenvolvimento. Para instalação, offline e notificações externas, use `npm run build && npm start`.

Se quiser executar a API separadamente, `npm run dev:push` inicia o servidor em `3001`; o Vite encaminha `/api/push` para ele. `npm run preview` também oferece esse encaminhamento, mas é apenas uma prévia local.

## Testes disponíveis

| Botão | Resultado |
| --- | --- |
| Notificação interna | Toast dentro da página, dispensável e anunciado por leitores de tela |
| Notificação externa · Web Push | Pede permissão, cria/reutiliza uma assinatura Push API e pede ao servidor o envio de um push real com VAPID |
| Notificação interna + externa | Exibe o toast imediatamente e tenta o Web Push; o aviso interno permanece mesmo se a permissão externa for recusada |
| Notificação local do sistema | Usa `ServiceWorkerRegistration.showNotification`, sem envio remoto; é um teste distinto de Web Push |
| Alternar tema | Claro/escuro com persistência em localStorage e preferência inicial do sistema |
| Instalar aplicativo | Usa o convite nativo quando disponível; caso contrário mostra instruções específicas para o navegador |
| Testar modo offline | Verifica um arquivo real no cache e apresenta o procedimento para testar sem conexão |
| Alternar tela cheia | Entra ou sai da Fullscreen API, com aviso em navegadores incompatíveis |

Notificações internas são elementos da página; notificações do sistema são exibidas pelo navegador/sistema operacional. O sistema pode ocultá-las em modo “não perturbe”. Aceitação pelo serviço de push não garante que a notificação será visível imediatamente.

O servidor de teste envia ao clicar: ele **não agenda mensagens nem mantém assinaturas em banco**. Uma mensagem já enviada pode ser processada pelo service worker mesmo sem a página aberta, conforme as regras do navegador. Para disparos futuros, campanhas ou um teste de envio após fechar a página, é necessário persistir a assinatura e adicionar um disparador autenticado no backend.

No iOS/iPadOS, o suporte a Web Push exige versão compatível e abertura do PWA instalado na tela inicial. Permissões recusadas devem ser reativadas nas configurações do navegador. Acesso pelo IP da rede local em HTTP não equivale a localhost: use HTTPS.

## Offline e atualização

O service worker usa as listas e a versão geradas pelo SvelteKit para armazenar HTML, scripts, CSS, manifesto e ícones. Navegações tentam a rede e retornam a página em cache na ausência de conexão. Arquivos do build usam cache primeiro; pedidos à API nunca entram no cache. Não há fontes externas ou dependências de CDN em tempo de execução.

Para testar: abra online, aguarde “PWA pronto”, clique no teste offline, desligue a conexão e recarregue. Tema e toasts continuam funcionando. O indicador “Online/Offline” reflete `navigator.onLine`, que indica conectividade do dispositivo e não garante acesso à internet.

Atualizações usam o ciclo padrão do service worker: um novo worker aguarda as abas antigas serem fechadas. Isso evita trocar os arquivos de uma sessão em uso. O novo cache substitui os caches antigos do Orbit ao ativar.

## Hospedagem

### GitHub Pages

O workflow `.github/workflows/pages.yml` verifica TypeScript, executa os testes de backend e os testes de navegador desktop/mobile, gera o build e publica automaticamente a branch `main`. O frontend é compilado com `BASE_PATH=/orbit-web-lab`, incluindo manifesto, ícones, cache e links compatíveis com o subdiretório.

GitHub Pages não executa o servidor Node. Notificações internas, notificações locais do sistema (com permissão), temas, instalação e offline funcionam no site publicado. **Web Push remoto requer hospedar o backend separadamente** e configurar a variável de repositório `VITE_PUSH_API_URL` em Settings → Secrets and variables → Actions → Variables. A URL é pública. Depois, execute o workflow novamente; configure também `ALLOWED_ORIGINS=https://adeirjunior.github.io` e as chaves VAPID no backend. A origem não inclui o caminho `/orbit-web-lab`.

Para reproduzir o build do GitHub Pages localmente:

```bash
BASE_PATH=/orbit-web-lab npm run build
BASE_PATH=/orbit-web-lab npm run preview
```

Abra `http://localhost:4173/orbit-web-lab/`. Para outras hospedagens no domínio raiz, omita `BASE_PATH`.

O frontend gera **arquivos estáticos em `build/`**, sem dependência de APIs exclusivas de hospedagem. A API Web Push é um servidor Node separado logicamente, que também pode servir esses arquivos.

### Vercel e Netlify

As configurações `vercel.json` e `netlify.toml` publicam o frontend estático. Comando: `npm run build`; pasta: `build`.

Para Web Push real, hospede `server/index.mjs` no Render ou Cloud Run e configure **antes do build**:

```dotenv
VITE_PUSH_API_URL=https://seu-backend.example
```

No backend, configure `ALLOWED_ORIGINS=https://seu-frontend.example` e as chaves VAPID. Refaça o build quando mudar a URL pública da API. `VITE_PUSH_API_URL` é público; nunca coloque segredos em variáveis `VITE_*`. Sem API, os testes locais, tema, instalação e offline continuam disponíveis; o teste de push informa a ausência do servidor.

Esta versão não inclui Functions próprias de Vercel ou Netlify. O arquivo `vercel.json` desativa a detecção automática do framework para publicar a saída estática do adapter-static.

### Render

`render.yaml` descreve um serviço Node com build `npm install && npm run build`, inicialização `npm start` e health check `/healthz`. Configure `ALLOWED_ORIGINS` com a URL HTTPS final do próprio serviço e as variáveis VAPID. Deixe `VITE_PUSH_API_URL` vazio quando página e API estiverem no mesmo domínio.

O plano gratuito pode suspender o serviço por inatividade. O primeiro teste de push após uma pausa pode falhar por tempo limite; aguarde a inicialização e tente novamente. Limites e disponibilidade do plano dependem da plataforma.

### Google Cloud Run / Docker

```bash
docker build -t orbit .
docker run --rm -p 8080:8080 --env-file .env orbit
```

Crie `.env` a partir de `.env.example`, preencha as variáveis VAPID e `ALLOWED_ORIGINS` e defina `PORT=8080` para esse exemplo. Abra `http://localhost:8080`. No Cloud Run, publique a imagem em seu projeto e configure as variáveis no serviço, incluindo a origem HTTPS final. O servidor respeita `PORT` e escuta em `0.0.0.0`. O Dockerfile não copia chaves privadas nem arquivos `.env`.

Cloud Run exige configuração de faturamento; franquia gratuita não garante custo zero. Esta entrega inclui os arquivos para deploy e não publica nada em uma conta externa.

## Verificação

```bash
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de política rodam apenas com Node, sem instalar pacotes. Eles cobrem validação de endpoints/assinaturas, restrição de origens e limite de envios. Os testes Playwright cobrem desktop/mobile, menu expansível, notificação interna, tema persistente, permissão recusada e recarga offline real.

O recebimento remoto de Web Push exige navegador compatível, permissão do usuário, conexão, API em execução e VAPID configurado; não é simulado pelos testes de interface.

## Estrutura

```text
src/
  app.html                    # Documento, manifesto e tema antes da renderização
  app.css                     # Tokens, claro/escuro, responsividade e movimento reduzido
  lib/Icon.svelte             # Ícones SVG
  lib/notifications.ts        # Permissão, assinatura e clientes das notificações
  routes/+layout.svelte       # Estilos compartilhados
  routes/+layout.ts           # Prerender estático
  routes/+page.svelte         # Página, menu, toasts e painéis
  service-worker.ts           # Cache offline, push e clique em notificação
server/
  index.mjs                   # API Web Push + servidor de arquivos estáticos
  policy.mjs                  # Validação e limite de envio
scripts/generate-keys.mjs     # Geração local de chaves VAPID
static/                      # Manifesto, ícones e arquivo de teste offline
tests/                       # Políticas e fluxos E2E
```

## Limites do servidor de demonstração

O backend aceita apenas origens configuradas e endpoints HTTPS conhecidos de serviços de push. Limita o tamanho dos pedidos, o tempo de envio e o número de chamadas por IP. O limite é em memória e, atrás de um proxy, pode ser compartilhado entre usuários. Não substitui autenticação, controle distribuído ou gerenciamento de assinaturas de um produto em produção. Chaves VAPID devem permanecer estáveis entre reinicializações; ao trocá-las, remova a assinatura antiga nas configurações do site antes de testar novamente.

Não foram incluídos Canvas ou WebAssembly porque esses testes não precisam de desenho ou processamento pesado. A arquitetura permite adicioná-los sem alterar a hospedagem estática.
