<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { fly } from 'svelte/transition';
  import Icon from '$lib/Icon.svelte';
  import TestList from '$lib/TestList.svelte';
  import { actions, type ActionId } from '$lib/actions';
  import { sendWebPush, showSystemNotification, workerReady } from '$lib/notifications';

  type Toast = { id: number; title: string; message: string; kind: 'success' | 'info' | 'error' };
  type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
  let dark = $state(false);
  let online = $state(true);
  let ready = $state(false);
  let installed = $state(false);
  let busy = $state<ActionId | null>(null);
  let activePanel = $state<'offline' | 'install' | null>(null);
  let offlineProof = $state(false);
  let installPrompt = $state<InstallEvent | null>(null);
  let toasts = $state<Toast[]>([]);
  let panel: HTMLDialogElement;
  let dock: HTMLElement;
  let testSheet: HTMLDialogElement;
  let sheetOpen = $state(false);
  let reduceMotion = $state(false);
  let toastId = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function explore() {
    if (dock && getComputedStyle(dock).display !== 'none') {
      dock.querySelector<HTMLButtonElement>('button')?.focus();
    } else {
      sheetOpen = true;
      testSheet.showModal();
    }
  }

  function chooseTest(id: ActionId) {
    testSheet.close();
    sheetOpen = false;
    void run(id);
  }

  function goHome() {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
    document.getElementById('page-title')?.focus({ preventScroll: true });
  }

  function notify(title: string, message: string, kind: Toast['kind'] = 'success') {
    const id = ++toastId;
    toasts = [...toasts.slice(-3), { id, title, message, kind }];
    const timer = setTimeout(() => { dismiss(id); timers.delete(timer); }, kind === 'error' ? 10000 : 6000);
    timers.add(timer);
  }

  function dismiss(id: number) { toasts = toasts.filter((item) => item.id !== id); }

  function setTheme(value: boolean) {
    dark = value;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111116' : '#ffffff');
    try { localStorage.setItem('orbit-theme', dark ? 'dark' : 'light'); } catch {
      notify('Tema alterado', 'O navegador não permitiu salvar sua preferência.', 'info');
    }
  }

  function showPanel(value: 'offline' | 'install') {
    activePanel = value;
    panel.showModal();
  }

  async function run(id: ActionId) {
    if (busy) return;
    if (id === 'internal') {
      notify('Olá, do Orbit!', 'Sua notificação interna chegou. Simples assim.');
      return;
    }
    if (id === 'theme') { setTheme(!dark); return; }
    busy = id;
    try {
      if (id === 'push' || id === 'both') {
        if (id === 'both') notify('Notificação interna recebida', 'Agora vamos enviar a externa por Web Push.');
        await sendWebPush();
        notify('Web Push enviado', 'O serviço de push aceitou a mensagem. A exibição depende das permissões e do sistema.', 'info');
      } else if (id === 'system') {
        await showSystemNotification();
        notify('Notificação solicitada', 'Confira a central de notificações do sistema.', 'info');
      } else if (id === 'install') {
        if (installed) { notify('Você já está no aplicativo', 'O Orbit está aberto em modo instalado.', 'info'); }
        else if (installPrompt) {
          await installPrompt.prompt();
          const result = await installPrompt.userChoice;
          installPrompt = null;
          notify(result.outcome === 'accepted' ? 'Instalação aceita' : 'Instalação cancelada', result.outcome === 'accepted' ? 'O navegador está adicionando o Orbit aos seus aplicativos.' : 'Você pode instalar quando quiser pelo menu do navegador.', 'info');
        } else showPanel('install');
      } else if (id === 'offline') {
        offlineProof = false;
        showPanel('offline');
        await workerReady();
        const keys = await caches.keys();
        for (const key of keys.filter((key) => key.startsWith(`orbit-${encodeURIComponent(base)}-`))) {
          const match = await (await caches.open(key)).match(`${base}/offline-proof.json`);
          if (match) { const data = await match.json(); offlineProof = data.app === 'Orbit'; break; }
        }
        if (!offlineProof) throw new Error('Cache offline ainda não encontrado. Recarregue a página após o primeiro acesso online.');
      } else if (id === 'fullscreen') {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        else throw new Error('Este navegador não oferece tela cheia para esta página.');
      }
    } catch (error) {
      notify('Não foi possível concluir', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    } finally { busy = null; }
  }

  onMount(() => {
    dark = document.documentElement.dataset.theme === 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111116' : '#ffffff');
    online = navigator.onLine;
    installed = matchMedia('(display-mode: standalone)').matches;
    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = motionQuery.matches;
    const motionChanged = () => { reduceMotion = motionQuery.matches; };
    motionQuery.addEventListener('change', motionChanged);
    const lockScroll = () => { document.body.classList.toggle('modal-open', panel.open || testSheet.open); };
    const modalObserver = new MutationObserver(lockScroll);
    modalObserver.observe(panel, { attributes: true, attributeFilter: ['open'] });
    modalObserver.observe(testSheet, { attributes: true, attributeFilter: ['open'] });
    const connectivity = () => {
      online = navigator.onLine;
      notify(online ? 'Conexão restabelecida' : 'Você está offline', online ? 'Os testes de rede estão disponíveis novamente.' : 'A página continua funcionando pelo cache. Web Push requer conexão.', 'info');
    };
    const beforeInstall = (event: Event) => { event.preventDefault(); installPrompt = event as InstallEvent; };
    const appInstalled = () => { installed = true; installPrompt = null; notify('Orbit instalado', 'Seu laboratório agora tem um lugar na tela inicial.'); };
    let alive = true;
    if ('serviceWorker' in navigator && !import.meta.env.DEV) navigator.serviceWorker.ready.then(() => { if (alive) ready = true; });
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', appInstalled);
    return () => {
      alive = false;
      modalObserver.disconnect();
      document.body.classList.remove('modal-open');
      motionQuery.removeEventListener('change', motionChanged);
      timers.forEach(clearTimeout);
      window.removeEventListener('online', connectivity);
      window.removeEventListener('offline', connectivity);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', appInstalled);
    };
  });
</script>

<svelte:head>
  <title>Orbit — pagina inicial</title>
  <meta name="description" content="Experimente notificações, Web Push, temas e funcionamento offline em um laboratório SvelteKit + TypeScript + PWA." />
</svelte:head>

<a href="#main" class="skip-link">Pular para o conteúdo</a>
<div class="app-shell">
  <header class="header">
    <a class="brand" href={`${base}/`} aria-label="Orbit — página inicial"><Icon name="orbit" size={30} /><span>orbit</span></a>
    <span class="stack-label">SvelteKit <span class="stack-plus">+</span> TypeScript</span>
    <span class="header-connection"><span class="status-dot" class:is-offline={!online}></span>{online ? 'Online' : 'Offline'}</span>
  </header>

  <main id="main" class="playground">
    <section class="welcome" aria-labelledby="page-title">
      <div class="planet"><Icon name="orbit" size={50} /></div>
      <h1 id="page-title" tabindex="-1">pagina inicial</h1>
      <p>Um espaço para experimentar o que a web pode fazer.<span class="desktop-instructions"><br />Passe o mouse pelos ícones à direita e escolha um teste.</span></p>
      <button class="explore-button" onclick={explore}><Icon name="play" size={20} /><span>Explorar testes</span><Icon name="arrow" size={17} /></button>
      <div class="welcome-status"><span class="status-dot"></span>Pronto para experimentar</div>
    </section>

    <section class="quick-start" aria-labelledby="quick-title">
      <h2 id="quick-title">Comece por aqui</h2>
      <button class="test-row" onclick={() => run('internal')}><span class="row-icon"><Icon name="toast" /></span><span class="row-copy"><strong>Uma notificação de boas-vindas</strong><span>Veja uma mensagem dentro do app.</span></span><Icon name="chevron" size={18} /></button>
      <button class="test-row" onclick={() => run('offline')}><span class="row-icon"><Icon name="wifi" /></span><span class="row-copy"><strong>Pronto para ficar offline</strong><span>Confira o cache deste dispositivo.</span></span><Icon name="chevron" size={18} /></button>
      <button class="test-row" onclick={() => run('install')}><span class="row-icon"><Icon name="download" /></span><span class="row-copy"><strong>Leve o Orbit com você</strong><span>Adicione à sua tela inicial.</span></span><Icon name="chevron" size={18} /></button>
    </section>

    <nav bind:this={dock} class="test-dock" aria-label="Testes da plataforma">
      {#each actions as action}
        <button
          class="dock-button"
          class:running={busy === action.id}
          class:theme-active={action.id === 'theme' && dark}
          aria-label={action.id === 'theme' ? (dark ? 'Ativar tema claro' : 'Ativar tema escuro') : action.label}
          aria-busy={busy === action.id}
          aria-disabled={busy !== null}
          onclick={() => run(action.id)}
        >
          <span class="dock-label">{action.id === 'theme' ? (dark ? 'Ativar tema claro' : 'Ativar tema escuro') : action.label}</span>
          <span class="dock-icon"><Icon name={action.id === 'theme' ? (dark ? 'moon' : 'sun') : action.icon} /></span>
        </button>
      {/each}
    </nav>

    <p class="keyboard-hint"><kbd>Tab</kbd> para navegar <span>·</span> <kbd>Enter</kbd> para testar</p>
  </main>

  <footer class="footer">
    <span class="connection"><span class="status-dot" class:is-offline={!online}></span>{online ? 'Online' : 'Offline'}</span>
    <span class="footer-message">Feito para explorar. Construído com padrões abertos.</span>
    <span class="pwa-status" title={ready ? 'Service worker ativo e cache offline preparado' : 'O service worker é ativado no build de produção'}>{installed ? 'PWA instalado' : ready ? 'PWA pronto' : 'PWA · preparando'}</span>
  </footer>
  <nav class="mobile-nav" aria-label="Navegação do aplicativo">
    <button class:nav-active={!sheetOpen} aria-current={!sheetOpen ? 'page' : undefined} onclick={goHome}><Icon name="home" /><span>Início</span></button>
    <button class:nav-active={sheetOpen} aria-haspopup="dialog" aria-expanded={sheetOpen} aria-controls="test-sheet" onclick={explore}><Icon name="sliders" /><span>Testes</span></button>
    <button aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'} aria-pressed={dark} onclick={() => run('theme')}><Icon name={dark ? 'moon' : 'sun'} /><span>Tema</span></button>
    <button aria-label="Instalar Orbit" onclick={() => run('install')}><Icon name="download" /><span>Instalar</span></button>
  </nav>
</div>

<dialog id="test-sheet" bind:this={testSheet} class="test-sheet" aria-labelledby="tests-title" onclose={() => sheetOpen = false}>
  <div class="sheet-handle" aria-hidden="true"></div>
  <div class="sheet-heading"><div><h2 id="tests-title">Escolha um teste</h2><p>Explore os recursos do seu navegador.</p></div><button class="icon-button" onclick={() => testSheet.close()} aria-label="Fechar testes"><Icon name="close" /></button></div>
  <TestList {dark} {busy} onselect={chooseTest} />
</dialog>

<div class="toast-region" aria-live="polite" aria-relevant="additions" aria-atomic="false">
  {#each toasts as toast (toast.id)}
    <div class="toast" class:toast-error={toast.kind === 'error'} role="status" transition:fly={{ y: reduceMotion ? 0 : 16, duration: reduceMotion ? 0 : 180 }}>
      <span class="toast-symbol"><Icon name={toast.kind === 'success' ? 'check' : 'info'} size={19} /></span>
      <div class="toast-copy"><strong>{toast.title}</strong><p>{toast.message}</p></div>
      <button class="icon-button toast-close" onclick={() => dismiss(toast.id)} aria-label="Fechar notificação"><Icon name="close" size={17} /></button>
    </div>
  {/each}
</div>

<dialog bind:this={panel} class="detail-dialog" onclose={() => activePanel = null}>
  {#if activePanel}
    <div class="dialog-header"><span class="dialog-icon"><Icon name={activePanel === 'offline' ? 'wifi' : 'download'} size={26} /></span><button class="icon-button" onclick={() => panel.close()} aria-label="Fechar painel"><Icon name="close" /></button></div>
    {#if activePanel === 'offline'}
      <h2>A web também funciona offline.</h2>
      <p>O service worker guarda a página e seus arquivos neste dispositivo.</p>
      <div class="verification" class:verified={offlineProof} aria-live="polite"><Icon name={offlineProof ? 'check' : 'info'} size={18} /><span>{offlineProof ? 'Arquivo encontrado no cache offline' : busy === 'offline' ? 'Verificando o cache…' : 'Cache ainda não disponível'}</span></div>
      <ol><li>Acesse o site uma vez com conexão.</li><li>Desligue o Wi-Fi ou ative o modo avião.</li><li>Recarregue. A página, o tema e as notificações internas continuam funcionando.</li></ol>
      <p class="dialog-note">Web Push e outros pedidos ao servidor precisam de internet. O indicador de conexão acompanha o navegador.</p>
    {:else}
      <h2>Seu laboratório, a um toque.</h2>
      <p>Instale o Orbit para abrir em uma janela própria e acessar pela tela inicial.</p>
      <ol><li><strong>Chrome ou Edge:</strong> use “Instalar aplicativo” na barra de endereço ou no menu.</li><li><strong>iPhone ou iPad:</strong> no Safari, toque em Compartilhar → Adicionar à Tela de Início.</li><li><strong>Outros navegadores:</strong> procure a opção de instalação ou abra em um navegador compatível.</li></ol>
      <p class="dialog-note">O convite automático depende do navegador, HTTPS e dos critérios de instalação. No desenvolvimento, teste com o build de produção.</p>
    {/if}
    <button class="primary-button" onclick={() => panel.close()}>Entendi<Icon name="check" size={18} /></button>
  {/if}
</dialog>
